import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { openVoiceNoterDatabase } from "./database";
import { ImportService } from "./import-service";
import { LibraryService } from "./library";
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
    } finally {
      db.close();
    }
  });
});
