import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { openVoiceNoterDatabase } from "./database";
import { ImportService } from "./import-service";
import { LibraryService } from "./library";
import { NoteService } from "./note";
import { ProcessingService } from "./processing";
import { QueueService } from "./queue";

describe("ProcessingService", () => {
  test("missing selected model fails transcription with a readable error", async () => {
    const sourceRoot = await mkdtemp(join(tmpdir(), "voicenoter-source-"));
    const libraryRoot = await mkdtemp(join(tmpdir(), "voicenoter-library-"));
    const mediaPath = join(sourceRoot, "Lecture One.mp3");
    await writeFile(mediaPath, "fake audio content", "utf8");
    await new LibraryService().initializeLibrary(libraryRoot);
    const db = openVoiceNoterDatabase(join(libraryRoot, "voicenoter.db"));
    try {
      await new ImportService(libraryRoot, db).importFiles([mediaPath]);
      db.prepare("UPDATE jobs SET status = 'completed', progress = 1 WHERE type = 'inspect_media'").run();

      const queue = new QueueService(db);
      const service = new ProcessingService(libraryRoot, db, queue);
      const processed = await service.processNextPendingJob();

      expect(processed?.type).toBe("transcribe");
      const transcribeJob = (await queue.listJobs()).find((job) => job.type === "transcribe");
      expect(transcribeJob).toEqual(
        expect.objectContaining({
          status: "failed",
          error: expect.objectContaining({
            title: "No transcription model selected",
            retryable: true,
          }),
        }),
      );
      expect((await queue.listJobs()).find((job) => job.type === "generate_markdown")).toEqual(
        expect.objectContaining({
          status: "failed",
          error: expect.objectContaining({
            title: "Previous processing step failed",
            retryable: true,
          }),
        }),
      );
      expect((await queue.listJobs()).find((job) => job.type === "index_note")).toEqual(
        expect.objectContaining({
          status: "failed",
          error: expect.objectContaining({
            title: "Previous processing step failed",
            retryable: true,
          }),
        }),
      );
      expect(db.prepare("SELECT status FROM items").get()).toEqual({ status: "failed" });
    } finally {
      db.close();
    }
  });

  test("retrying index_note restores a ready item after indexing succeeds", async () => {
    const sourceRoot = await mkdtemp(join(tmpdir(), "voicenoter-source-"));
    const libraryRoot = await mkdtemp(join(tmpdir(), "voicenoter-library-"));
    const mediaPath = join(sourceRoot, "Lecture One.mp3");
    await writeFile(mediaPath, "fake audio content", "utf8");
    await new LibraryService().initializeLibrary(libraryRoot);
    const db = openVoiceNoterDatabase(join(libraryRoot, "voicenoter.db"));
    try {
      const importResult = await new ImportService(libraryRoot, db).importFiles([mediaPath]);
      const itemId = importResult.importedItems[0]!.id;
      db.prepare(
        `
          INSERT INTO transcripts (
            id, item_id, engine, model, language, raw_text, segments_json, created_at
          )
          VALUES ('transcript-1', ?, 'local-whisper-compatible', 'base', 'en', 'Indexed words.', ?, ?)
        `,
      ).run(itemId, JSON.stringify([{ startSeconds: 0, endSeconds: 2, text: "Indexed words." }]), new Date().toISOString());
      await new NoteService(libraryRoot, db).generateMarkdownNote(itemId, "base");
      db.prepare("UPDATE jobs SET status = 'completed', progress = 1 WHERE type != 'index_note'").run();
      db.prepare("UPDATE jobs SET status = 'failed', error_message = '{}', completed_at = ? WHERE type = 'index_note'").run(
        new Date().toISOString(),
      );
      db.prepare("UPDATE items SET status = 'failed' WHERE id = ?").run(itemId);

      const queue = new QueueService(db);
      const indexJob = (await queue.listJobs()).find((job) => job.type === "index_note")!;
      await queue.retryJob(indexJob.id);
      const processed = await new ProcessingService(libraryRoot, db, queue).processNextPendingJob();

      expect(processed).toEqual(expect.objectContaining({ type: "index_note", status: "completed" }));
      expect(db.prepare("SELECT status FROM items WHERE id = ?").get(itemId)).toEqual({ status: "ready" });
    } finally {
      db.close();
    }
  });
});
