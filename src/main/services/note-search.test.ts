import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import Database from "better-sqlite3";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { openVoiceNoterDatabase } from "./database";
import { ImportService } from "./import-service";
import { LibraryService, libraryFolders } from "./library";
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

      await expect(searchService.search({ text: "neural retrieval" })).resolves.toMatchObject({
        total: 1,
        items: [
          expect.objectContaining({
            itemId,
            title: "Lecture One",
            source: "transcript",
            startSeconds: 84,
          }),
        ],
      });
    } finally {
      db.close();
    }
  });

  test("migrating a legacy library removes categories from notes, schema, and search", async () => {
    const { itemId, libraryRoot, notePath } = await createLegacyLibraryWithCategoryNote();
    try {
      const migratedDb = openVoiceNoterDatabase(join(libraryRoot, "voicenoter.db"));
      const migratedSearch = new SearchService(migratedDb);
      await migratedSearch.reindex();

      const migratedNote = await readFile(notePath, "utf8");
      expect(migratedNote).not.toContain("\ncategory:");
      expect(migratedNote).toContain("<!-- Legacy category: Operations -->");
      expect(migratedDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'categories'").get()).toBeUndefined();
      expect(
        (migratedDb.prepare("PRAGMA table_info(items)").all() as Array<{ name: string }>).some((column) => column.name === "category_id"),
      ).toBe(false);
      await expect(migratedSearch.search({ text: "Operations" })).resolves.toMatchObject({ total: 0, items: [] });
      await expect(migratedSearch.search({ text: "retrieval" })).resolves.toMatchObject({
        total: 2,
        items: expect.arrayContaining([expect.objectContaining({ itemId, source: "tag" })]),
      });
      migratedDb.close();
    } finally {
      // migration test opens a new connection for verification
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

async function createLegacyLibraryWithCategoryNote() {
  const libraryRoot = await mkdtemp(join(tmpdir(), "voicenoter-legacy-library-"));
  for (const folder of libraryFolders) {
    await mkdir(join(libraryRoot, folder), { recursive: true });
  }
  await writeFile(
    join(libraryRoot, "settings.json"),
    `${JSON.stringify(
      {
        libraryPath: libraryRoot,
        theme: "dark",
        defaultImportBehavior: "copy",
        defaultModelId: null,
        transcriptionLanguage: "auto",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const dbPath = join(libraryRoot, "voicenoter.db");
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE schema_migrations (
      id INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      size_label TEXT NOT NULL,
      local_path TEXT,
      status TEXT NOT NULL,
      downloaded_at TEXT,
      selected_at TEXT
    );

    CREATE TABLE items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source_type TEXT NOT NULL,
      original_path TEXT NOT NULL,
      library_media_path TEXT NOT NULL,
      extracted_audio_path TEXT,
      note_path TEXT,
      category_id TEXT,
      duration_seconds INTEGER,
      language TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE transcripts (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      engine TEXT NOT NULL,
      model TEXT NOT NULL,
      language TEXT,
      raw_text TEXT NOT NULL,
      segments_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES items(id)
    );

    CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      path TEXT NOT NULL,
      title TEXT NOT NULL,
      frontmatter_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES items(id)
    );

    CREATE TABLE item_tags (
      item_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (item_id, tag_id),
      FOREIGN KEY (item_id) REFERENCES items(id),
      FOREIGN KEY (tag_id) REFERENCES tags(id)
    );

    CREATE TABLE jobs (
      id TEXT PRIMARY KEY,
      item_id TEXT,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      progress REAL NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      FOREIGN KEY (item_id) REFERENCES items(id)
    );

    CREATE VIRTUAL TABLE search_entries_fts USING fts5(
      item_id UNINDEXED,
      note_path UNINDEXED,
      source UNINDEXED,
      start_seconds UNINDEXED,
      title,
      note,
      transcript,
      category,
      tags
    );

    INSERT INTO schema_migrations (id, applied_at) VALUES (1, '2026-06-17T00:00:00.000Z');
  `);

  const notePath = join(libraryRoot, "notes", "legacy-note.md");
  const itemId = "item-legacy-1";
  const now = "2026-06-17T00:00:00.000Z";
  const legacyMarkdown = `---
id: "${itemId}"
title: "Legacy Interview"
created_at: "${now}"
source_file: "legacy.mp3"
library_media_path: "${join(libraryRoot, "media", "original", "legacy.mp3")}"
duration_seconds: 0
type: "audio"
language: "en"
category: "Operations"
tags: ["retrieval", "voice"]
transcription_engine: "local-whisper-compatible"
transcription_model: "base"
---

# Legacy Interview

## Summary

Summary not generated in VoiceNoter V1.

## Notes

Keep the body intact.

## Transcript

### 00:00:00

We discuss neural retrieval systems.
`;
  await writeFile(notePath, legacyMarkdown, "utf8");

  db.prepare("INSERT INTO categories (id, name, created_at) VALUES ('cat-1', 'Operations', ?)").run(now);
  db.prepare("INSERT INTO tags (id, name, created_at) VALUES ('tag-1', 'retrieval', ?), ('tag-2', 'voice', ?)").run(now, now);
  db.prepare(
    `
      INSERT INTO items (
        id, title, source_type, original_path, library_media_path, extracted_audio_path,
        note_path, category_id, duration_seconds, language, status, created_at, updated_at, imported_at
      )
      VALUES (?, 'Legacy Interview', 'audio', ?, ?, NULL, ?, 'cat-1', 0, 'en', 'ready', ?, ?, ?)
    `,
  ).run(itemId, "/tmp/source/legacy.mp3", join(libraryRoot, "media", "original", "legacy.mp3"), notePath, now, now, now);
  db.prepare(
    `
      INSERT INTO notes (
        id, item_id, path, title, frontmatter_json, content_hash, created_at, updated_at
      )
      VALUES ('note-1', ?, ?, 'Legacy Interview', ?, 'hash', ?, ?)
    `,
  ).run(itemId, notePath, JSON.stringify({ id: itemId, title: "Legacy Interview", category: "Operations", tags: ["retrieval", "voice"] }), now, now);
  db.prepare(
    `
      INSERT INTO transcripts (
        id, item_id, engine, model, language, raw_text, segments_json, created_at
      )
      VALUES ('transcript-1', ?, 'local-whisper-compatible', 'base', 'en', ?, ?, ?)
    `,
  ).run(itemId, "We discuss neural retrieval systems.", JSON.stringify([{ startSeconds: 0, endSeconds: 10, text: "We discuss neural retrieval systems." }]), now);
  db.prepare("INSERT INTO item_tags (item_id, tag_id) VALUES (?, 'tag-1'), (?, 'tag-2')").run(itemId, itemId);
  db.close();

  return { itemId, libraryRoot, notePath };
}
