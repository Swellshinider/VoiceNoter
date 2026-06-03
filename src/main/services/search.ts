import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import type { ReindexResult, SearchQuery, SearchResult, TranscriptSegment } from "../../shared/types";
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

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const text = query.text.trim();
    if (!text) {
      return [];
    }

    const ftsQuery = toFtsPhrase(text);
    const rows = this.db
      .prepare(
        `
          SELECT
            search_entries_fts.item_id,
            search_entries_fts.note_path,
            search_entries_fts.source,
            search_entries_fts.start_seconds,
            items.title AS item_title,
            snippet(search_entries_fts, -1, '', '', '...', 18) AS snippet
          FROM search_entries_fts
          INNER JOIN items ON items.id = search_entries_fts.item_id
          WHERE search_entries_fts MATCH ?
          ORDER BY bm25(search_entries_fts)
          LIMIT 50
        `,
      )
      .all(ftsQuery) as Array<{
      item_id: string;
      note_path: string | null;
      source: SearchResult["source"];
      start_seconds: string | null;
      item_title: string;
      snippet: string;
    }>;

    return rows.map((row) => ({
      itemId: row.item_id,
      notePath: row.note_path ?? "",
      title: row.item_title,
      snippet: row.snippet,
      source: row.source,
      startSeconds: row.start_seconds ? Number(row.start_seconds) : null,
    }));
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
