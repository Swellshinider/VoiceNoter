import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { LibraryService } from "./library";
import { openVoiceNoterDatabase } from "./database";
import { ImportService } from "./import-service";
import { NoteService } from "./note";
import { SearchService } from "./search";

describe("notes and search", () => {
  test("generates timestamped Markdown and indexes transcript matches with jump metadata", async () => {
    const { db, itemId, libraryRoot } = await createImportedItemWithTranscript();
    try {
      const noteService = new NoteService(libraryRoot, db);
      const searchService = new SearchService(db);

      const note = await noteService.generateMarkdownNote(itemId, "base");
      await searchService.indexItem(itemId);

      expect(note.path).toContain(join(libraryRoot, "notes"));
      expect(note.markdown).toContain('transcription_model: "base"');
      expect(note.markdown).toContain("### 00:01:24");
      expect(note.markdown).toContain("neural retrieval systems");

      await expect(searchService.search({ text: "neural retrieval" })).resolves.toEqual([
        expect.objectContaining({
          itemId,
          title: "Lecture One",
          source: "transcript",
          startSeconds: 84,
        }),
      ]);
    } finally {
      db.close();
    }
  });

  test("saving Markdown makes frontmatter title, category, and tags the metadata source of truth", async () => {
    const { db, itemId, libraryRoot } = await createImportedItemWithTranscript();
    try {
      const noteService = new NoteService(libraryRoot, db);
      const note = await noteService.generateMarkdownNote(itemId, "base");

      const updated = note.markdown
        .replace('title: "Lecture One"', 'title: "Research Interview"')
        .replace('category: ""', 'category: "Research"')
        .replace("tags: []", 'tags: ["retrieval", "voice"]');
      await noteService.saveNote(itemId, updated);

      expect(db.prepare("SELECT title FROM items WHERE id = ?").get(itemId)).toEqual({ title: "Research Interview" });
      expect(db.prepare("SELECT name FROM categories").all()).toEqual([{ name: "Research" }]);
      expect(db.prepare("SELECT name FROM tags ORDER BY name").all()).toEqual([{ name: "retrieval" }, { name: "voice" }]);
    } finally {
      db.close();
    }
  });

  test("regenerates Markdown in place without duplicating note rows", async () => {
    const { db, itemId, libraryRoot } = await createImportedItemWithTranscript();
    try {
      const noteService = new NoteService(libraryRoot, db);
      const first = await noteService.generateMarkdownNote(itemId, "base");
      const existingPath = join(libraryRoot, "notes", "existing-note.md");
      await writeFile(existingPath, first.markdown.replace("### 00:01:24", "### 00:00:00"), "utf8");
      db.prepare("UPDATE notes SET path = ? WHERE item_id = ?").run(existingPath, itemId);
      db.prepare("UPDATE items SET note_path = ? WHERE id = ?").run(existingPath, itemId);

      const regenerated = await noteService.generateMarkdownNote(itemId, "base");

      expect(regenerated.path).toBe(existingPath);
      expect(db.prepare("SELECT COUNT(*) AS count FROM notes WHERE item_id = ?").get(itemId)).toEqual({ count: 1 });
      await expect(readFile(existingPath, "utf8")).resolves.toContain("### 00:01:24");
    } finally {
      db.close();
    }
  });
});

async function createImportedItemWithTranscript() {
  const sourceRoot = await mkdtemp(join(tmpdir(), "voicenoter-source-"));
  const libraryRoot = await mkdtemp(join(tmpdir(), "voicenoter-library-"));
  const mediaPath = join(sourceRoot, "Lecture One.mp3");
  await writeFile(mediaPath, "fake audio content", "utf8");
  await new LibraryService().initializeLibrary(libraryRoot);
  const db = openVoiceNoterDatabase(join(libraryRoot, "voicenoter.db"));
  const importResult = await new ImportService(libraryRoot, db).importFiles([mediaPath]);
  const itemId = importResult.importedItems[0]!.id;
  db.prepare(
    `
      INSERT INTO transcripts (
        id, item_id, engine, model, language, raw_text, segments_json, created_at
      )
      VALUES (?, ?, 'local-whisper-compatible', 'base', 'en', ?, ?, ?)
    `,
  ).run(
    "transcript-1",
    itemId,
    "Intro text. We discuss neural retrieval systems.",
    JSON.stringify([
      { startSeconds: 0, endSeconds: 20, text: "Intro text." },
      { startSeconds: 84, endSeconds: 110, text: "We discuss neural retrieval systems." },
    ]),
    new Date().toISOString(),
  );
  return { db, itemId, libraryRoot };
}
