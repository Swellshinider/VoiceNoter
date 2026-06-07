import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { Job, JobType } from "../../shared/types";
import type { VoiceNoterDatabase } from "./database";
import { MediaService } from "./media";
import { NoteService } from "./note";
import { QueueService } from "./queue";
import { SearchService } from "./search";
import { TranscriptionService } from "./transcription";

type PendingJobRow = {
  id: string;
  item_id: string | null;
  type: JobType;
};

type ProcessingItemRow = {
  id: string;
  original_path: string;
  library_media_path: string;
  extracted_audio_path: string | null;
  source_type: "audio" | "video";
};

export class ProcessingService {
  private readonly media = new MediaService();

  constructor(
    private readonly libraryRoot: string,
    private readonly db: VoiceNoterDatabase,
    private readonly queue: QueueService,
  ) {}

  async processNextPendingJob(): Promise<Job | null> {
    const row = this.db
      .prepare(
        `
          SELECT id, item_id, type
          FROM jobs AS current_job
          WHERE status = 'pending'
            AND NOT EXISTS (
              SELECT 1
              FROM jobs AS previous_job
              WHERE previous_job.item_id = current_job.item_id
                AND previous_job.rowid < current_job.rowid
                AND previous_job.status != 'completed'
            )
          ORDER BY rowid
          LIMIT 1
        `,
      )
      .get() as
      | PendingJobRow
      | undefined;
    if (!row) {
      return null;
    }
    try {
      this.queue.startJob(row.id);
      await this.runJob(row);
      return this.queue.completeJob(row.id);
    } catch (error) {
      console.error(`[processing] Job ${row.id} (${row.type}) failed:`, error);
      try {
        return this.queue.failJob(row.id, error);
      } catch (failError) {
        console.error(`[processing] Failed to mark job ${row.id} as failed:`, failError);
        return null;
      }
    }
  }

  async processAllPending(): Promise<void> {
    try {
      while (await this.processNextPendingJob()) {
        // loop until queue is empty
      }
    } catch (error) {
      console.error("[processing] processAllPending loop crashed:", error);
    }
  }

  private async runJob(job: PendingJobRow): Promise<void> {
    if (job.type === "download_model") {
      return;
    }
    if (!job.item_id) {
      throw new Error(`Job ${job.id} has no item_id`);
    }
    const item = this.getProcessingItem(job.item_id);

    switch (job.type) {
      case "import_file": {
        await copyFileWithProgress(item.original_path, item.library_media_path, (progress, message) => {
          this.queue.updateProgress(job.id, progress, {
            itemId: item.id,
            stage: job.type,
            message,
          });
        });
        this.db.prepare("UPDATE items SET status = 'processing', updated_at = ? WHERE id = ?").run(new Date().toISOString(), item.id);
        return;
      }
      case "inspect_media": {
        const inspection = await this.media.inspectMedia(item.library_media_path);
        this.db
          .prepare("UPDATE items SET duration_seconds = ?, updated_at = ? WHERE id = ?")
          .run(inspection.durationSeconds, new Date().toISOString(), item.id);
        return;
      }
      case "extract_audio": {
        const outputPath = await this.media.extractAudio(item.library_media_path, item.id, this.libraryRoot);
        this.db
          .prepare("UPDATE items SET extracted_audio_path = ?, updated_at = ? WHERE id = ?")
          .run(outputPath, new Date().toISOString(), item.id);
        return;
      }
      case "transcribe": {
        const inputPath = item.extracted_audio_path ?? item.library_media_path;
        let language: string | undefined;
        try {
          const settings = JSON.parse(await readFile(join(this.libraryRoot, "settings.json"), "utf8")) as { transcriptionLanguage?: string };
          if (settings.transcriptionLanguage && settings.transcriptionLanguage !== "auto") {
            language = settings.transcriptionLanguage;
          }
        } catch {
          // settings not readable, use auto
        }
        const result = await new TranscriptionService(this.libraryRoot, this.db, this.queue).transcribe(job.id, item.id, inputPath, language);
        this.db
          .prepare(
            `
              INSERT INTO transcripts (
                id, item_id, engine, model, language, raw_text, segments_json, created_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
          )
          .run(
            result.id,
            result.itemId,
            result.engine,
            result.model,
            result.language,
            result.rawText,
            JSON.stringify(result.segments),
            new Date().toISOString(),
          );
        return;
      }
      case "generate_markdown": {
        const transcript = this.db.prepare("SELECT model FROM transcripts WHERE item_id = ? ORDER BY created_at DESC LIMIT 1").get(item.id) as
          | { model: "tiny" | "base" | "small" }
          | undefined;
        await new NoteService(this.libraryRoot, this.db).generateMarkdownNote(item.id, transcript?.model ?? "base");
        return;
      }
      case "index_note":
        await new SearchService(this.db).indexItem(item.id);
        this.db.prepare("UPDATE items SET status = 'ready', updated_at = ? WHERE id = ? AND note_path IS NOT NULL").run(
          new Date().toISOString(),
          item.id,
        );
        return;
    }
  }

  private getProcessingItem(itemId: string): ProcessingItemRow {
    const row = this.db.prepare("SELECT id, original_path, library_media_path, extracted_audio_path, source_type FROM items WHERE id = ?").get(itemId) as
      | ProcessingItemRow
      | undefined;
    if (!row) {
      throw new Error(`Item not found: ${itemId}`);
    }
    return row;
  }
}

async function copyFileWithProgress(
  sourcePath: string,
  destinationPath: string,
  onProgress: (progress: number, message: string) => void,
): Promise<void> {
  await mkdir(dirname(destinationPath), { recursive: true });
  const tempPath = `${destinationPath}.partial`;
  const sourceStat = await stat(sourcePath);
  let copiedBytes = 0;

  await new Promise<void>((resolve, reject) => {
    const input = createReadStream(sourcePath);
    const output = createWriteStream(tempPath);
    const cleanup = async (error?: unknown) => {
      input.destroy();
      output.destroy();
      try {
        await unlink(tempPath);
      } catch {
        // ignore cleanup errors for partially copied files
      }
      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    input.on("data", (chunk: Buffer) => {
      copiedBytes += chunk.length;
      onProgress(Math.min(copiedBytes / sourceStat.size, 1), `Copying ${basename(sourcePath)}`);
    });
    input.on("error", (error) => {
      void cleanup(error);
    });
    output.on("error", (error) => {
      void cleanup(error);
    });
    output.on("finish", async () => {
      try {
        await rename(tempPath, destinationPath);
        onProgress(1, `Copied ${basename(sourcePath)}`);
        resolve();
      } catch (error) {
        await cleanup(error);
      }
    });

    input.pipe(output);
  });
}
