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
      const [inspectJob, transcribeJob] = await listJobsFlat(queue).then((jobs) => [
        jobs.find((job) => job.type === "inspect_media")!,
        jobs.find((job) => job.type === "transcribe")!,
      ]);

      queue.failJob(inspectJob.id, userError("FFmpeg execution failed", "The bundled FFmpeg process exited with code 1.", {
        technicalDetails: "exit code 1",
        retryable: true,
      }));

      expect((await listJobsFlat(queue)).find((job) => job.id === inspectJob.id)).toEqual(
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

  test("fails later pending jobs when an upstream item job fails", async () => {
    const { db } = await createLibraryWithImportedItem();
    try {
      const queue = new QueueService(db);
      const inspectJob = (await listJobsFlat(queue)).find((job) => job.type === "inspect_media")!;

      queue.failJob(inspectJob.id, userError("FFmpeg execution failed", "The bundled media process exited with code 1.", {
        retryable: true,
      }));

      expect(db.prepare("SELECT status FROM items").get()).toEqual({ status: "failed" });
      expect(db.prepare("SELECT type, status FROM jobs ORDER BY rowid").all()).toEqual([
        { type: "import_file", status: "pending" },
        { type: "inspect_media", status: "failed" },
        { type: "transcribe", status: "failed" },
        { type: "generate_markdown", status: "failed" },
        { type: "index_note", status: "failed" },
      ]);
      const downstream = (await listJobsFlat(queue)).filter((job) => job.type !== "import_file" && job.type !== "inspect_media");
      expect(downstream).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "transcribe",
            error: expect.objectContaining({ title: "Previous processing step failed", retryable: true }),
          }),
          expect.objectContaining({
            type: "generate_markdown",
            error: expect.objectContaining({ title: "Previous processing step failed", retryable: true }),
          }),
          expect.objectContaining({
            type: "index_note",
            error: expect.objectContaining({ title: "Previous processing step failed", retryable: true }),
          }),
        ]),
      );
    } finally {
      db.close();
    }
  });

  test("cancels later pending jobs when an upstream item job is cancelled", async () => {
    const { db } = await createLibraryWithImportedItem();
    try {
      const queue = new QueueService(db);
      const inspectJob = (await listJobsFlat(queue)).find((job) => job.type === "inspect_media")!;

      await queue.cancelJob(inspectJob.id);

      expect(db.prepare("SELECT status FROM items").get()).toEqual({ status: "cancelled" });
      expect(db.prepare("SELECT type, status FROM jobs ORDER BY rowid").all()).toEqual([
        { type: "import_file", status: "pending" },
        { type: "inspect_media", status: "cancelled" },
        { type: "transcribe", status: "cancelled" },
        { type: "generate_markdown", status: "cancelled" },
        { type: "index_note", status: "cancelled" },
      ]);
    } finally {
      db.close();
    }
  });

  test("retrying an upstream item job resets downstream jobs", async () => {
    const { db } = await createLibraryWithImportedItem();
    try {
      const now = new Date().toISOString();
      db.prepare("UPDATE items SET status = 'failed'").run();
      db.prepare(
        `
          UPDATE jobs
          SET status = 'failed', progress = 1, error_message = ?, started_at = ?, completed_at = ?
          WHERE type IN ('inspect_media', 'transcribe', 'generate_markdown', 'index_note')
        `,
      ).run(JSON.stringify(userError("Previous processing step failed", "A previous step failed.", { retryable: true })), now, now);
      const queue = new QueueService(db);
      const inspectJob = (await listJobsFlat(queue)).find((job) => job.type === "inspect_media")!;

      await queue.retryJob(inspectJob.id);

      expect(db.prepare("SELECT status FROM items").get()).toEqual({ status: "processing" });
      expect(db.prepare("SELECT type, status, progress, error_message, started_at, completed_at FROM jobs ORDER BY rowid").all()).toEqual([
        { type: "import_file", status: "pending", progress: 0, error_message: null, started_at: null, completed_at: null },
        { type: "inspect_media", status: "pending", progress: 0, error_message: null, started_at: null, completed_at: null },
        { type: "transcribe", status: "pending", progress: 0, error_message: null, started_at: null, completed_at: null },
        { type: "generate_markdown", status: "pending", progress: 0, error_message: null, started_at: null, completed_at: null },
        { type: "index_note", status: "pending", progress: 0, error_message: null, started_at: null, completed_at: null },
      ]);
    } finally {
      db.close();
    }
  });

  test("recovers unfinished running jobs on restart", async () => {
    const { db } = await createLibraryWithImportedItem();
    try {
      const queue = new QueueService(db);
      const inspectJob = (await listJobsFlat(queue)).find((job) => job.type === "inspect_media")!;
      queue.startJob(inspectJob.id);

      const recovered = queue.recoverUnfinishedJobs();

      expect(recovered).toHaveLength(1);
      expect((await listJobsFlat(queue)).find((job) => job.id === inspectJob.id)).toEqual(
        expect.objectContaining({ status: "pending", startedAt: null }),
      );
    } finally {
      db.close();
    }
  });

  test("paginates jobs and summarizes queue state", async () => {
    const { db } = await createLibraryWithImportedItem();
    try {
      const queue = new QueueService(db);
      db.prepare(
        `
          INSERT INTO jobs (
            id, item_id, type, status, payload_json, progress, error_message, created_at, started_at, completed_at
          )
          VALUES ('job-system-1', NULL, 'download_model', 'pending', '{}', 0, NULL, ?, NULL, NULL)
        `,
      ).run(new Date().toISOString());

      const firstPage = await (queue as unknown as {
        listJobs(query?: { limit?: number; offset?: number }): Promise<{
          items: Array<{ kind: string; label: string; jobs: Array<{ type: string }> }>;
          total: number;
          limit: number;
          offset: number;
          nextOffset: number | null;
        }>;
      }).listJobs({ limit: 1, offset: 0 });
      const secondPage = await (queue as unknown as {
        listJobs(query?: { limit?: number; offset?: number }): Promise<{
          items: Array<{ kind: string; label: string; jobs: Array<{ type: string }> }>;
          total: number;
          limit: number;
          offset: number;
          nextOffset: number | null;
        }>;
      }).listJobs({ limit: 1, offset: 1 });
      const summary = await queue.getSummary();

      expect(firstPage.total).toBeGreaterThan(0);
      expect(firstPage.items).toHaveLength(1);
      expect(firstPage.items[0]).toMatchObject({
        kind: "item",
        label: "Lecture One",
        jobs: [
          { type: "import_file" },
          { type: "inspect_media" },
          { type: "transcribe" },
          { type: "generate_markdown" },
          { type: "index_note" },
        ],
      });
      expect(firstPage.nextOffset).toBe(1);
      expect(secondPage.offset).toBe(1);
      expect(firstPage.total).toBe(2);
      expect(summary.totalJobs).toBeGreaterThan(firstPage.total);
      expect(summary.pendingJobs).toBeGreaterThan(0);
      expect(summary.activeJobs).toBeGreaterThan(0);
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

async function listJobsFlat(queue: QueueService): Promise<ReturnType<typeof flattenGroups>> {
  const page = await queue.listJobs();
  return flattenGroups(page.items as Array<{ jobs: ReturnType<typeof flattenGroups> }>);
}

function flattenGroups(groups: Array<{ jobs: { id: string; itemId: string | null; type: string; status: string; progress: number; error: unknown; createdAt: string; startedAt: string | null; completedAt: string | null }[] }>) {
  return groups.flatMap((group) => group.jobs);
}
