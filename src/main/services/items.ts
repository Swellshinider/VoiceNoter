import type { Category, ItemDetail, ItemSummary, SourceType, Tag } from "../../shared/types";
import type { VoiceNoterDatabase } from "./database";
import { randomUUID } from "node:crypto";

export type ItemRow = {
  id: string;
  title: string;
  source_type: SourceType;
  original_path: string;
  library_media_path: string;
  extracted_audio_path: string | null;
  note_path: string | null;
  category_id: string | null;
  category_name: string | null;
  duration_seconds: number | null;
  language: string | null;
  status: ItemSummary["status"];
  created_at: string;
  updated_at: string;
  imported_at: string;
};

export function getItemSummary(db: VoiceNoterDatabase, itemId: string): ItemSummary {
  const row = db
    .prepare(
      `
        SELECT items.*, categories.name AS category_name
        FROM items
        LEFT JOIN categories ON categories.id = items.category_id
        WHERE items.id = ?
      `,
    )
    .get(itemId) as ItemRow | undefined;

  if (!row) {
    throw new Error(`Item not found: ${itemId}`);
  }

  return mapItemSummary(db, row);
}

export function mapItemSummary(db: VoiceNoterDatabase, row: ItemRow): ItemSummary {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    status: row.status,
    notePath: row.note_path,
    durationSeconds: row.duration_seconds,
    category: row.category_id ? { id: row.category_id, name: row.category_name ?? "" } : null,
    tags: getItemTags(db, row.id),
    importedAt: row.imported_at,
    updatedAt: row.updated_at,
  };
}

export function mapItemDetail(db: VoiceNoterDatabase, row: ItemRow): Omit<ItemDetail, "transcript" | "note"> {
  return {
    ...mapItemSummary(db, row),
    libraryMediaPath: row.library_media_path,
    extractedAudioPath: row.extracted_audio_path,
  };
}

export function getItemTags(db: VoiceNoterDatabase, itemId: string): Tag[] {
  return db
    .prepare(
      `
        SELECT tags.id, tags.name
        FROM tags
        INNER JOIN item_tags ON item_tags.tag_id = tags.id
        WHERE item_tags.item_id = ?
        ORDER BY tags.name
      `,
    )
    .all(itemId) as Tag[];
}

export function getOrCreateCategory(db: VoiceNoterDatabase, name: string): Category {
  const normalized = name.trim();
  const existing = db.prepare("SELECT id, name FROM categories WHERE name = ?").get(normalized) as Category | undefined;
  if (existing) {
    return existing;
  }
  const id = randomUUID();
  db.prepare("INSERT INTO categories (id, name, created_at) VALUES (?, ?, ?)").run(id, normalized, new Date().toISOString());
  return { id, name: normalized };
}

export function getOrCreateTag(db: VoiceNoterDatabase, name: string): Tag {
  const normalized = name.trim();
  const existing = db.prepare("SELECT id, name FROM tags WHERE name = ?").get(normalized) as Tag | undefined;
  if (existing) {
    return existing;
  }
  const id = randomUUID();
  db.prepare("INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)").run(id, normalized, new Date().toISOString());
  return { id, name: normalized };
}
