import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ImportResult, JobType } from "../../shared/types";
import { userError } from "../../shared/errors";
import { getImportCandidate, getSourceType } from "../../shared/validation";
import type { VoiceNoterDatabase } from "./database";
import { getItemSummary } from "./items";

export class ImportService {
  constructor(
    private readonly libraryRoot: string,
    private readonly db: VoiceNoterDatabase,
  ) {}

  async importFiles(paths: string[]): Promise<ImportResult> {
    const importedItemIds: string[] = [];
    const rejectedFiles: ImportResult["rejectedFiles"] = [];

    for (const path of paths) {
      const candidate = getImportCandidate(path);
      if (!candidate.supported) {
        rejectedFiles.push({
          path,
          error: userError(
            "Unsupported file format",
            `${candidate.filename} is not a supported VoiceNoter audio or video file.`,
            { retryable: false },
          ),
        });
        continue;
      }

      try {
        await access(path, constants.R_OK);
      } catch (error) {
        rejectedFiles.push({
          path,
          error: userError("Source file missing during import", `VoiceNoter could not read ${candidate.filename}.`, {
            technicalDetails: error instanceof Error ? error.message : String(error),
            retryable: true,
          }),
        });
        continue;
      }

      const itemId = randomUUID();
      const sourceType = getSourceType(candidate.extension);
      const title = titleFromFilename(candidate.filename);
      const libraryMediaPath = join(this.libraryRoot, "media", "original", `${itemId}-${safeFilename(candidate.filename)}`);

      const now = new Date().toISOString();
      const createImportedItem = this.db.transaction(() => {
        this.db
          .prepare(
            `
              INSERT INTO items (
                id, title, source_type, original_path, library_media_path, extracted_audio_path,
                note_path, category_id, duration_seconds, language, status, created_at, updated_at, imported_at
              )
              VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 'importing', ?, ?, ?)
            `,
          )
          .run(itemId, title, sourceType, path, libraryMediaPath, now, now, now);

        this.insertJob(itemId, "import_file", "pending", 0);
        this.insertJob(itemId, "inspect_media", "pending", 0);
        if (sourceType === "video") {
          this.insertJob(itemId, "extract_audio", "pending", 0);
        }
        this.insertJob(itemId, "transcribe", "pending", 0);
        this.insertJob(itemId, "generate_markdown", "pending", 0);
        this.insertJob(itemId, "index_note", "pending", 0);
      });
      createImportedItem();
      importedItemIds.push(itemId);
    }

    return {
      importedItems: importedItemIds.map((id) => getItemSummary(this.db, id)),
      rejectedFiles,
    };
  }

  private insertJob(itemId: string, type: JobType, status: "pending" | "completed", progress: number): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
          INSERT INTO jobs (
            id, item_id, type, status, payload_json, progress, error_message, created_at, started_at, completed_at
          )
          VALUES (?, ?, ?, ?, '{}', ?, NULL, ?, ?, ?)
        `,
      )
      .run(randomUUID(), itemId, type, status, progress, now, status === "completed" ? now : null, status === "completed" ? now : null);
  }
}

function titleFromFilename(filename: string): string {
  return basename(filename, extname(filename)).trim() || filename;
}

function safeFilename(filename: string): string {
  return filename.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, " ").trim();
}
