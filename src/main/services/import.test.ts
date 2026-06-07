import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { describe, expect, test } from "vitest";
import { LibraryService } from "./library";
import { ImportService } from "./import-service";
import { openVoiceNoterDatabase } from "./database";

describe("ImportService", () => {
  test("queues supported media for background copy and processing", async () => {
    const sourceRoot = await mkdtemp(join(tmpdir(), "voicenoter-source-"));
    const libraryRoot = await mkdtemp(join(tmpdir(), "voicenoter-library-"));
    const mediaPath = join(sourceRoot, "Lecture One.mp3");
    await writeFile(mediaPath, "fake audio content", "utf8");
    await new LibraryService().initializeLibrary(libraryRoot);

    const db = openVoiceNoterDatabase(join(libraryRoot, "voicenoter.db"));
    try {
      const result = await new ImportService(libraryRoot, db).importFiles([mediaPath, join(sourceRoot, "notes.txt")]);

      expect(result.rejectedFiles).toHaveLength(1);
      expect(result.rejectedFiles[0]?.error.title).toBe("Unsupported file format");
      expect(result.importedItems).toHaveLength(1);
      expect(result.importedItems[0]?.title).toBe("Lecture One");
      expect(result.importedItems[0]?.status).toBe("importing");

      expect(db.prepare("SELECT title, source_type, status FROM items").all()).toEqual([
        { title: "Lecture One", source_type: "audio", status: "importing" },
      ]);
      expect(db.prepare("SELECT type, status, progress FROM jobs ORDER BY rowid").all()).toEqual([
        { type: "import_file", status: "pending", progress: 0 },
        { type: "inspect_media", status: "pending", progress: 0 },
        { type: "transcribe", status: "pending", progress: 0 },
        { type: "generate_markdown", status: "pending", progress: 0 },
        { type: "index_note", status: "pending", progress: 0 },
      ]);
    } finally {
      db.close();
    }
  });

  test("adds video extraction before transcription for video files", async () => {
    const sourceRoot = await mkdtemp(join(tmpdir(), "voicenoter-source-"));
    const libraryRoot = await mkdtemp(join(tmpdir(), "voicenoter-library-"));
    await mkdir(sourceRoot, { recursive: true });
    const mediaPath = join(sourceRoot, "Interview.mov");
    await writeFile(mediaPath, "fake video content", "utf8");
    await new LibraryService().initializeLibrary(libraryRoot);

    const db = openVoiceNoterDatabase(join(libraryRoot, "voicenoter.db"));
    try {
      await new ImportService(libraryRoot, db).importFiles([mediaPath]);

      expect(db.prepare("SELECT source_type FROM items").get()).toEqual({ source_type: "video" });
      expect(db.prepare("SELECT type FROM jobs ORDER BY rowid").all()).toEqual([
        { type: "import_file" },
        { type: "inspect_media" },
        { type: "extract_audio" },
        { type: "transcribe" },
        { type: "generate_markdown" },
        { type: "index_note" },
      ]);
    } finally {
      db.close();
    }
  });
});
