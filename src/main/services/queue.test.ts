import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { userError } from "../../shared/errors";
import { openVoiceNoterDatabase } from "./database";
import { ImportService } from "./import-service";
import { LibraryService } from "./library";
import { QueueService } from "./queue";

describe("QueueService", () => {
  test("persists failures, retries failed jobs, and cancels pending jobs", async () => {
    const { db } = await createLibraryWithImportedItem();
    try {
      const queue = new QueueService(db);
      const [inspectJob, transcribeJob] = await queue.listJobs().then((jobs) => [
        jobs.find((job) => job.type === "inspect_media")!,
        jobs.find((job) => job.type === "transcribe")!,
      ]);

      queue.failJob(inspectJob.id, userError("FFmpeg execution failed", "The bundled FFmpeg process exited with code 1.", {
        technicalDetails: "exit code 1",
        retryable: true,
      }));

      expect((await queue.listJobs()).find((job) => job.id === inspectJob.id)).toEqual(
        expect.objectContaining({
          status: "failed",
          error: expect.objectContaining({ title: "FFmpeg execution failed", retryable: true }),
        }),
      );

      await expect(queue.retryJob(inspectJob.id)).resolves.toEqual(
        expect.objectContaining({ id: inspectJob.id, status: "pending", progress: 0, error: null }),
      );
      await expect(queue.cancelJob(transcribeJob.id)).resolves.toEqual(
        expect.objectContaining({ id: transcribeJob.id, status: "cancelled" }),
      );
    } finally {
      db.close();
    }
  });

  test("recovers unfinished running jobs on restart", async () => {
    const { db } = await createLibraryWithImportedItem();
    try {
      const queue = new QueueService(db);
      const inspectJob = (await queue.listJobs()).find((job) => job.type === "inspect_media")!;
      queue.startJob(inspectJob.id);

      const recovered = queue.recoverUnfinishedJobs();

      expect(recovered).toHaveLength(1);
      expect((await queue.listJobs()).find((job) => job.id === inspectJob.id)).toEqual(
        expect.objectContaining({ status: "pending", startedAt: null }),
      );
    } finally {
      db.close();
    }
  });
});

async function createLibraryWithImportedItem() {
  const sourceRoot = await mkdtemp(join(tmpdir(), "voicenoter-source-"));
  const libraryRoot = await mkdtemp(join(tmpdir(), "voicenoter-library-"));
  const mediaPath = join(sourceRoot, "Lecture One.mp3");
  await writeFile(mediaPath, "fake audio content", "utf8");
  await new LibraryService().initializeLibrary(libraryRoot);
  const db = openVoiceNoterDatabase(join(libraryRoot, "voicenoter.db"));
  await new ImportService(libraryRoot, db).importFiles([mediaPath]);
  return { db, libraryRoot };
}
