import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import type { PageResult, ReindexResult, SearchQuery, SearchResult, TranscriptSegment } from "../../shared/types";
import type { VoiceNoterDatabase } from "./database";
import type { ItemRow } from "./items";
import { getItemTags } from "./items";

type TranscriptRow = {
  raw_text: string;
  segments_json: string;
};

export class SearchService {
  constructor(private readonly db: VoiceNoterDatabase) {}

  async indexItem(itemId: string): Promise<void> {
    const item = this.getItemRow(itemId);
    const tags = getItemTags(this.db, itemId).map((tag) => tag.name).join(" ");
    const category = item.category_name ?? "";
    const noteMarkdown = item.note_path ? await readFile(item.note_path, "utf8") : "";
    const noteBody = stripTranscriptSection(matter(noteMarkdown).content);
    const transcriptRow = this.db
      .prepare("SELECT raw_text, segments_json FROM transcripts WHERE item_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(itemId) as TranscriptRow | undefined;
    const transcriptSegments = transcriptRow ? (JSON.parse(transcriptRow.segments_json) as TranscriptSegment[]) : [];

    const index = this.db.transaction(() => {
      this.db.prepare("DELETE FROM search_entries_fts WHERE item_id = ?").run(itemId);
      this.insertSearchEntry(item, "title", null, { title: item.title });
      if (noteBody.trim()) {
        this.insertSearchEntry(item, "note", null, { note: noteBody });
      }
      if (category) {
        this.insertSearchEntry(item, "category", null, { category });
      }
      if (tags) {
        this.insertSearchEntry(item, "tag", null, { tags });
      }
      for (const segment of transcriptSegments) {
        this.insertSearchEntry(item, "transcript", segment.startSeconds, { transcript: segment.text });
      }
    });
    index();
  }

  async search(query: SearchQuery): Promise<PageResult<SearchResult>> {
    const text = query.text.trim();
    if (!text) {
      return { items: [], total: 0, limit: query.limit ?? 50, offset: query.offset ?? 0, nextOffset: null };
    }

    const ftsQuery = toFtsPhrase(text);
    const { whereClause, params } = buildSearchWhereClause(query, ftsQuery);
    const { limit, offset } = normalizePageRequest(query);

    const totalRow = this.db
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM search_entries_fts
          INNER JOIN items ON items.id = search_entries_fts.item_id
          ${whereClause}
        `,
      )
      .get(...params) as { count: number };

    const rows = this.db
      .prepare(
        `
          SELECT
            search_entries_fts.item_id,
            search_entries_fts.note_path,
            search_entries_fts.source,
            search_entries_fts.start_seconds,
            items.title AS item_title,
            items.source_type AS item_source_type,
            items.status AS item_status,
            snippet(search_entries_fts, -1, '', '', '...', 18) AS snippet
          FROM search_entries_fts
          INNER JOIN items ON items.id = search_entries_fts.item_id
          ${whereClause}
          ORDER BY bm25(search_entries_fts)
          LIMIT ? OFFSET ?
        `,
      )
      .all(...params, limit, offset) as Array<{
      item_id: string;
      note_path: string | null;
      source: SearchResult["source"];
      start_seconds: string | null;
      item_title: string;
      item_source_type: SearchResult["sourceType"];
      item_status: SearchResult["status"];
      snippet: string;
    }>;

    return {
      items: rows.map((row) => ({
        itemId: row.item_id,
        notePath: row.note_path ?? "",
        title: row.item_title,
        snippet: row.snippet,
        source: row.source,
        sourceType: row.item_source_type,
        status: row.item_status,
        startSeconds: row.start_seconds ? Number(row.start_seconds) : null,
      })),
      total: totalRow.count,
      limit,
      offset,
      nextOffset: offset + rows.length < totalRow.count ? offset + rows.length : null,
    };
  }

  async reindex(): Promise<ReindexResult> {
    const rows = this.db.prepare("SELECT id FROM items").all() as Array<{ id: string }>;
    const errors: ReindexResult["errors"] = [];
    let indexedItems = 0;
    for (const row of rows) {
      try {
        await this.indexItem(row.id);
        indexedItems += 1;
      } catch (error) {
        errors.push({
          title: "FTS indexing failed",
          message: `VoiceNoter could not index item ${row.id}.`,
          technicalDetails: error instanceof Error ? error.stack ?? error.message : String(error),
          retryable: true,
        });
      }
    }
    return { indexedItems, errors };
  }

  private getItemRow(itemId: string): ItemRow {
    const row = this.db
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
    return row;
  }

  private insertSearchEntry(
    item: ItemRow,
    source: SearchResult["source"],
    startSeconds: number | null,
    fields: Partial<Record<"title" | "note" | "transcript" | "category" | "tags", string>>,
  ): void {
    this.db
      .prepare(
        `
          INSERT INTO search_entries_fts (
            item_id, note_path, source, start_seconds, title, note, transcript, category, tags
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        item.id,
        item.note_path,
        source,
        startSeconds === null ? null : String(startSeconds),
        fields.title ?? "",
        fields.note ?? "",
        fields.transcript ?? "",
        fields.category ?? "",
        fields.tags ?? "",
      );
  }
}

function stripTranscriptSection(markdownBody: string): string {
  const marker = "\n## Transcript";
  const index = markdownBody.indexOf(marker);
  return index === -1 ? markdownBody : markdownBody.slice(0, index);
}

function toFtsPhrase(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

function buildSearchWhereClause(query: SearchQuery, ftsQuery: string): { whereClause: string; params: unknown[] } {
  const clauses = ["search_entries_fts MATCH ?"];
  const params: unknown[] = [ftsQuery];
  if (query.categoryId) {
    clauses.push("items.category_id = ?");
    params.push(query.categoryId);
  }
  if (query.tagId) {
    clauses.push("items.id IN (SELECT item_id FROM item_tags WHERE tag_id = ?)");
    params.push(query.tagId);
  }
  return { whereClause: `WHERE ${clauses.join(" AND ")}`, params };
}

function normalizePageRequest(query: SearchQuery): { limit: number; offset: number } {
  return {
    limit: clampPageSize(query.limit),
    offset: Math.max(0, Math.floor(query.offset ?? 0)),
  };
}

function clampPageSize(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return 50;
  }
  return Math.min(Math.floor(value), 200);
}
