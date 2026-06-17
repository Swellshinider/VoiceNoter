import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import matter from "gray-matter";
import type { ModelId, NoteContent, Transcript, TranscriptSegment } from "../../shared/types";
import type { VoiceNoterDatabase } from "./database";
import type { ItemRow } from "./items";
import { getOrCreateCategory, getOrCreateTag } from "./items";

type TranscriptRow = {
  id: string;
  item_id: string;
  engine: string;
  model: string;
  language: string | null;
  raw_text: string;
  segments_json: string;
  created_at: string;
};

export class NoteService {
  constructor(
    private readonly libraryRoot: string,
    private readonly db: VoiceNoterDatabase,
  ) {}

  async generateMarkdownNote(itemId: string, transcriptionModel: ModelId): Promise<NoteContent> {
    const item = this.getItemRow(itemId);
    const transcript = this.getTranscript(itemId);
    const existing = this.findNoteRow(itemId);
    const now = new Date().toISOString();
    const createdAt = existing?.created_at ?? now;
    const notePath = existing?.path ?? join(this.libraryRoot, "notes", `${now.slice(0, 10)}-${safeSlug(item.title)}.md`);
    const frontmatter = {
      id: item.id,
      title: item.title,
      created_at: createdAt,
      source_file: basename(item.original_path),
      library_media_path: item.library_media_path,
      duration_seconds: item.duration_seconds ?? 0,
      type: item.source_type,
      language: transcript?.language ?? "auto",
      category: "",
      tags: [] as string[],
      transcription_engine: "local-whisper-compatible",
      transcription_model: transcriptionModel,
    };
    const markdown = renderMarkdown(frontmatter, transcript?.segments ?? []);

    await mkdir(join(this.libraryRoot, "notes"), { recursive: true });
    await writeFile(notePath, markdown, "utf8");
    const contentHash = hashContent(markdown);

    const save = this.db.transaction(() => {
      if (existing) {
        this.db
          .prepare("UPDATE notes SET title = ?, frontmatter_json = ?, content_hash = ?, updated_at = ? WHERE id = ?")
          .run(item.title, JSON.stringify(frontmatter), contentHash, now, existing.id);
      } else {
        this.db
          .prepare(
            `
              INSERT INTO notes (
                id, item_id, path, title, frontmatter_json, content_hash, created_at, updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
          )
          .run(randomUUID(), itemId, notePath, item.title, JSON.stringify(frontmatter), contentHash, now, now);
      }
      this.db
        .prepare("UPDATE items SET note_path = ?, status = 'ready', updated_at = ? WHERE id = ?")
        .run(notePath, now, itemId);
    });
    save();

    return {
      itemId,
      path: notePath,
      markdown,
      frontmatter,
      contentHash,
      updatedAt: now,
    };
  }

  async readNote(itemId: string): Promise<NoteContent> {
    const row = this.getNoteRow(itemId);
    const markdown = await readFile(row.path, "utf8");
    return {
      itemId,
      path: row.path,
      markdown,
      frontmatter: JSON.parse(row.frontmatter_json) as Record<string, unknown>,
      contentHash: row.content_hash,
      updatedAt: row.updated_at,
    };
  }

  async saveNote(itemId: string, markdown: string): Promise<NoteContent> {
    const existing = this.getNoteRow(itemId);
    const parsed = matter(markdown);
    const frontmatter = parsed.data as Record<string, unknown>;
    const title = typeof frontmatter.title === "string" && frontmatter.title.trim() ? frontmatter.title.trim() : existing.title;
    const categoryName = typeof frontmatter.category === "string" ? frontmatter.category.trim() : "";
    const tagNames = Array.isArray(frontmatter.tags)
      ? frontmatter.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
      : [];
    const now = new Date().toISOString();
    const contentHash = hashContent(markdown);

    await writeFile(existing.path, markdown, "utf8");

    const save = this.db.transaction(() => {
      let categoryId: string | null = null;
      if (categoryName) {
        categoryId = getOrCreateCategory(this.db, categoryName).id;
      }
      this.db
        .prepare("UPDATE items SET title = ?, category_id = ?, updated_at = ? WHERE id = ?")
        .run(title, categoryId, now, itemId);
      this.db.prepare("DELETE FROM item_tags WHERE item_id = ?").run(itemId);
      for (const tagName of tagNames) {
        const tag = getOrCreateTag(this.db, tagName);
        this.db.prepare("INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)").run(itemId, tag.id);
      }
      this.db
        .prepare("UPDATE notes SET title = ?, frontmatter_json = ?, content_hash = ?, updated_at = ? WHERE item_id = ?")
        .run(title, JSON.stringify(frontmatter), contentHash, now, itemId);
    });
    save();

    return {
      itemId,
      path: existing.path,
      markdown,
      frontmatter,
      contentHash,
      updatedAt: now,
    };
  }

  async syncTranscriptSection(itemId: string, segments: TranscriptSegment[]): Promise<NoteContent | null> {
    const existing = this.findNoteRow(itemId);
    if (!existing) {
      return null;
    }

    const markdown = replaceTranscriptSection(await readFile(existing.path, "utf8"), segments);
    const now = new Date().toISOString();
    const contentHash = hashContent(markdown);

    await writeFile(existing.path, markdown, "utf8");
    this.db
      .prepare("UPDATE notes SET content_hash = ?, updated_at = ? WHERE item_id = ?")
      .run(contentHash, now, itemId);

    return {
      itemId,
      path: existing.path,
      markdown,
      frontmatter: JSON.parse(existing.frontmatter_json) as Record<string, unknown>,
      contentHash,
      updatedAt: now,
    };
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

  private getTranscript(itemId: string): Transcript | null {
    const row = this.db.prepare("SELECT * FROM transcripts WHERE item_id = ? ORDER BY created_at DESC LIMIT 1").get(itemId) as
      | TranscriptRow
      | undefined;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      itemId: row.item_id,
      engine: row.engine,
      model: row.model,
      language: row.language,
      rawText: row.raw_text,
      segments: JSON.parse(row.segments_json) as TranscriptSegment[],
      createdAt: row.created_at,
    };
  }

  private getNoteRow(itemId: string): {
    id: string;
    path: string;
    title: string;
    frontmatter_json: string;
    content_hash: string;
    created_at: string;
    updated_at: string;
  } {
    const row = this.findNoteRow(itemId);
    if (!row) {
      throw new Error(`Note not found for item: ${itemId}`);
    }
    return row;
  }

  private findNoteRow(itemId: string): {
    id: string;
    path: string;
    title: string;
    frontmatter_json: string;
    content_hash: string;
    created_at: string;
    updated_at: string;
  } | null {
    const row = this.db.prepare("SELECT * FROM notes WHERE item_id = ? ORDER BY updated_at DESC, rowid DESC LIMIT 1").get(itemId) as
      | {
          id: string;
          path: string;
          title: string;
          frontmatter_json: string;
          content_hash: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;
    return row ?? null;
  }
}

function renderMarkdown(frontmatter: Record<string, unknown>, segments: TranscriptSegment[]): string {
  return `---
id: "${escapeYaml(String(frontmatter.id))}"
title: "${escapeYaml(String(frontmatter.title))}"
created_at: "${escapeYaml(String(frontmatter.created_at))}"
source_file: "${escapeYaml(String(frontmatter.source_file))}"
library_media_path: "${escapeYaml(String(frontmatter.library_media_path))}"
duration_seconds: ${frontmatter.duration_seconds}
type: "${escapeYaml(String(frontmatter.type))}"
language: "${escapeYaml(String(frontmatter.language))}"
category: ""
tags: []
transcription_engine: "local-whisper-compatible"
transcription_model: "${escapeYaml(String(frontmatter.transcription_model))}"
---

# ${frontmatter.title}

## Summary

Summary not generated in VoiceNoter V1.

## Notes


## Transcript

${renderTranscript(segments)}
`;
}

function renderTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map((segment) => `### ${formatTimestamp(segment.startSeconds)}\n\n${segment.text.trim()}\n`)
    .join("\n");
}

export function renderTranscriptSection(segments: TranscriptSegment[]): string {
  return `## Transcript\n\n${renderTranscript(segments)}`.trimEnd();
}

export function replaceTranscriptSection(markdown: string, segments: TranscriptSegment[]): string {
  const transcriptSection = renderTranscriptSection(segments);
  const normalized = markdown.replace(/\r\n/g, "\n");
  const transcriptHeadingPattern = /^## Transcript\s*$/m;

  if (transcriptHeadingPattern.test(normalized)) {
    return normalized.replace(/^## Transcript\s*$[\s\S]*$/m, transcriptSection).trimEnd() + "\n";
  }

  return `${normalized.trimEnd()}\n\n${transcriptSection}\n`;
}

export function formatTimestamp(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function safeSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) || "untitled"
  );
}

function escapeYaml(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
