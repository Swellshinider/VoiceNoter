import Database from "better-sqlite3";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

export type VoiceNoterDatabase = Database.Database;

export function openVoiceNoterDatabase(path: string): VoiceNoterDatabase {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

export function runMigrations(db: VoiceNoterDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare("SELECT id FROM schema_migrations").all().map((row) => (row as { id: number }).id),
  );

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }
    const apply = db.transaction(() => {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(
        migration.id,
        new Date().toISOString(),
      );
    });
    apply();
  }
}

const migrations: Array<{ id: number; sql: string }> = [
  {
    id: 1,
    sql: `
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

      CREATE INDEX idx_items_status ON items(status);
      CREATE INDEX idx_items_imported_at ON items(imported_at);
      CREATE INDEX idx_jobs_status ON jobs(status);
      CREATE INDEX idx_jobs_item_id ON jobs(item_id);
      CREATE INDEX idx_notes_item_id ON notes(item_id);
      CREATE INDEX idx_transcripts_item_id ON transcripts(item_id);

      INSERT INTO models (id, name, size_label, local_path, status, downloaded_at, selected_at)
      VALUES
        ('tiny', 'Tiny', 'fastest, lowest accuracy', NULL, 'available', NULL, NULL),
        ('base', 'Base', 'balanced default', NULL, 'available', NULL, NULL),
        ('small', 'Small', 'slower, better accuracy', NULL, 'available', NULL, NULL);
    `,
  },
];
