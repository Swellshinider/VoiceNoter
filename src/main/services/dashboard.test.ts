import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { openVoiceNoterDatabase } from "./database";
import { getDashboardSummary } from "./dashboard";
import { ImportService } from "./import-service";
import { LibraryService } from "./library";

describe("getDashboardSummary", () => {
  test("summarizes counts, storage, trend, latest items, and queue health", async () => {
    const libraryRoot = await mkdtemp(join(tmpdir(), "voicenoter-dashboard-"));
    const sourceRoot = await mkdtemp(join(tmpdir(), "voicenoter-dashboard-source-"));
    const now = new Date();
    const dayAgo = isoDateDaysAgo(now, 1);
    const twoDaysAgo = isoDateDaysAgo(now, 2);
    const threeDaysAgo = isoDateDaysAgo(now, 3);

    try {
      await new LibraryService().initializeLibrary(libraryRoot);

      const audioPath = join(sourceRoot, "Morning Notes.mp3");
      const videoPath = join(sourceRoot, "Team Update.mp4");
      const pendingPath = join(sourceRoot, "Later Draft.wav");
      await writeFile(audioPath, "audio-audio-audio", "utf8");
      await writeFile(videoPath, "video-video-video", "utf8");
      await writeFile(pendingPath, "pending-pending", "utf8");

      const db = openVoiceNoterDatabase(join(libraryRoot, "voicenoter.db"));
      try {
        const importResult = await new ImportService(libraryRoot, db).importFiles([audioPath, videoPath, pendingPath]);
        const [readyItem, pendingItem, failedItem] = importResult.importedItems;

        if (!readyItem || !pendingItem || !failedItem) {
          throw new Error("Expected three imported items in the dashboard fixture.");
        }

        const transcriptAt = `${dayAgo}T10:00:00.000Z`;
        const notePath = join(libraryRoot, "notes", `${dayAgo}-morning-notes.md`);
        await writeFile(notePath, "# Morning Notes\n", "utf8");
        db.prepare(
          `
            INSERT INTO transcripts (id, item_id, engine, model, language, raw_text, segments_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          randomUUID(),
          readyItem.id,
          "local-whisper-compatible",
          "base",
          "en",
          "Morning notes transcript.",
          JSON.stringify([{ startSeconds: 0, endSeconds: 5, text: "Morning notes transcript." }]),
          transcriptAt,
        );
        db.prepare(
          `
            INSERT INTO notes (id, item_id, path, title, frontmatter_json, content_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          randomUUID(),
          readyItem.id,
          notePath,
          readyItem.title,
          JSON.stringify({ id: readyItem.id, title: readyItem.title }),
          "content-hash",
          transcriptAt,
          transcriptAt,
        );
        db.prepare("UPDATE items SET note_path = ?, status = 'ready', updated_at = ? WHERE id = ?").run(notePath, transcriptAt, readyItem.id);
        db.prepare("UPDATE items SET status = 'processing', updated_at = ? WHERE id = ?").run(`${twoDaysAgo}T09:00:00.000Z`, pendingItem.id);
        db.prepare("UPDATE items SET status = 'failed', updated_at = ? WHERE id = ?").run(`${threeDaysAgo}T08:00:00.000Z`, failedItem.id);

        await writeFile(join(libraryRoot, "media", "extracted", "extra.wav"), "extracted", "utf8");
        await writeFile(join(libraryRoot, "models", "model.bin"), "model", "utf8");
        await writeFile(join(libraryRoot, "indexes", "index.bin"), "index", "utf8");
        await writeFile(join(libraryRoot, "temp", "cache.tmp"), "cache", "utf8");

        const summary = await getDashboardSummary(libraryRoot, db);

        expect(summary.counts).toEqual({
          totalItems: 3,
          audioItems: 2,
          videoItems: 1,
          transcribedItems: 1,
          pendingItems: 1,
          failedItems: 1,
          cancelledItems: 0,
        });
        expect(summary.storage.totalBytes).toBeGreaterThan(0);
        expect(summary.storage.originalMediaBytes).toBeGreaterThan(0);
        expect(summary.storage.extractedAudioBytes).toBeGreaterThan(0);
        expect(summary.storage.notesBytes).toBeGreaterThan(0);
        expect(summary.storage.modelsBytes).toBeGreaterThan(0);
        expect(summary.storage.databaseBytes).toBeGreaterThan(0);
        expect(summary.storage.indexesBytes).toBeGreaterThan(0);
        expect(summary.storage.otherBytes).toBeGreaterThan(0);
        expect(summary.trend).toHaveLength(14);
        expect(summary.trend.find((point) => point.date === dayAgo)?.completedTranscriptions).toBe(1);
        expect(summary.latestItems.map((item) => item.status)).toEqual(["transcribed", "pending", "failed"]);
        expect(summary.latestItems[0]).toMatchObject({ itemId: readyItem.id, title: readyItem.title, status: "transcribed" });
        expect(summary.queueHealth.pendingJobs).toBeGreaterThan(0);
        expect(summary.queueHealth.activeJobs).toBeGreaterThan(0);
      } finally {
        db.close();
      }
    } finally {
      // temp directories are cleaned up by the OS after the test process ends
    }
  });
});

function isoDateDaysAgo(now: Date, daysAgo: number): string {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}
