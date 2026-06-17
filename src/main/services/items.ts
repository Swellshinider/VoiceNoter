import { createMediaUrl } from "../media-protocol";
import type {
  ItemDetail,
  ItemFacets,
  ItemListQuery,
  ItemSummary,
  PageResult,
  SourceType,
  Tag,
} from "../../shared/types";
import type { VoiceNoterDatabase } from "./database";
import { listTags } from "./tags";

export type ItemRow = {
  id: string;
  title: string;
  source_type: SourceType;
  original_path: string;
  library_media_path: string;
  extracted_audio_path: string | null;
  note_path: string | null;
  duration_seconds: number | null;
  language: string | null;
  status: ItemSummary["status"];
  created_at: string;
  updated_at: string;
  imported_at: string;
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export function getItemSummary(db: VoiceNoterDatabase, itemId: string): ItemSummary {
  const row = db.prepare("SELECT * FROM items WHERE id = ?").get(itemId) as ItemRow | undefined;

  if (!row) {
    throw new Error(`Item not found: ${itemId}`);
  }

  return mapItemSummary(db, row);
}

export function listItemSummaries(db: VoiceNoterDatabase, query: ItemListQuery = {}): PageResult<ItemSummary> {
  const { limit, offset } = normalizePageRequest(query);
  const { whereClause, params } = buildItemWhereClause(query);

  const totalRow = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM items
        ${whereClause}
      `,
    )
    .get(...params) as { count: number };

  const rows = db
    .prepare(
      `
        SELECT *
        FROM items
        ${whereClause}
        ORDER BY datetime(imported_at) DESC, rowid DESC
        LIMIT ? OFFSET ?
      `,
    )
    .all(...params, limit, offset) as ItemRow[];

  const tagsByItemId = getItemTagsByItemIds(db, rows.map((row) => row.id));

  return {
    items: rows.map((row) => mapItemSummary(db, row, tagsByItemId.get(row.id) ?? [])),
    total: totalRow.count,
    limit,
    offset,
    nextOffset: offset + rows.length < totalRow.count ? offset + rows.length : null,
  };
}

export function getItemFacets(db: VoiceNoterDatabase): ItemFacets {
  return { tags: listTags(db).filter((tag) => tag.itemCount > 0) };
}

export function mapItemSummary(db: VoiceNoterDatabase, row: ItemRow, tags = getItemTags(db, row.id)): ItemSummary {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    status: row.status,
    notePath: row.note_path,
    durationSeconds: row.duration_seconds,
    tags,
    importedAt: row.imported_at,
    updatedAt: row.updated_at,
  };
}

export function mapItemDetail(db: VoiceNoterDatabase, row: ItemRow): Omit<ItemDetail, "transcript" | "note"> {
  return {
    ...mapItemSummary(db, row),
    libraryMediaPath: row.library_media_path,
    mediaUrl: createMediaUrl(row.id),
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

function getItemTagsByItemIds(db: VoiceNoterDatabase, itemIds: string[]): Map<string, Tag[]> {
  if (itemIds.length === 0) {
    return new Map();
  }
  const placeholders = itemIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `
        SELECT item_tags.item_id, tags.id, tags.name
        FROM item_tags
        INNER JOIN tags ON tags.id = item_tags.tag_id
        WHERE item_tags.item_id IN (${placeholders})
        ORDER BY tags.name
      `,
    )
    .all(...itemIds) as Array<{ item_id: string } & Tag>;

  const grouped = new Map<string, Tag[]>();
  for (const row of rows) {
    const tags = grouped.get(row.item_id) ?? [];
    tags.push({ id: row.id, name: row.name });
    grouped.set(row.item_id, tags);
  }
  return grouped;
}

function buildItemWhereClause(query: ItemListQuery): { whereClause: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (query.view === "tag" && query.tagIds && query.tagIds.length > 0) {
    const placeholders = query.tagIds.map(() => "?").join(", ");
    clauses.push(`items.id IN (SELECT DISTINCT item_id FROM item_tags WHERE tag_id IN (${placeholders}))`);
    params.push(...query.tagIds);
  }
  return {
    whereClause: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

function normalizePageRequest(query: ItemListQuery): { limit: number; offset: number } {
  return {
    limit: clampPageSize(query.limit),
    offset: Math.max(0, Math.floor(query.offset ?? 0)),
  };
}

function clampPageSize(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(Math.floor(value), MAX_PAGE_SIZE);
}
