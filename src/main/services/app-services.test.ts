import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test, vi } from "vitest";
import type { TranscriptSegment } from "../../shared/types";
import { AppServices } from "./app-services";
import { openVoiceNoterDatabase } from "./database";
import { hashContent } from "./note";
import { SearchService } from "./search";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => join(tmpdir(), "voicenoter-tests-userdata")),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  shell: {
    openPath: vi.fn(),
  },
}));

describe("AppServices", () => {
  test("rejects imports before creating items or jobs when no model is selected", async () => {
    const libraryRoot = await mkdtemp(join(tmpdir(), "voicenoter-library-"));
    const sourceRoot = await mkdtemp(join(tmpdir(), "voicenoter-source-"));
    const mediaPath = join(sourceRoot, "Lecture One.mp3");
    await writeFile(mediaPath, "fake audio content", "utf8");

    const services = new AppServices();
    await services.openLibrary(libraryRoot);

    await expect(services.importFiles([mediaPath])).rejects.toMatchObject({
      userFacingError: {
        title: "No transcription model selected",
      },
    });

    const db = openVoiceNoterDatabase(join(libraryRoot, "voicenoter.db"));
    try {
      expect(db.prepare("SELECT COUNT(*) AS count FROM items").get()).toEqual({ count: 0 });
      expect(db.prepare("SELECT COUNT(*) AS count FROM jobs").get()).toEqual({ count: 0 });
    } finally {
      db.close();
    }
  });

  test("updates the current transcript row in place, rewrites only the note transcript section, and refreshes transcript search", async () => {
    const { services, db, itemId, notePath, transcriptId } = await createSeededServices();
    try {
      const searchService = new SearchService(db);
      await searchService.indexItem(itemId);

      const originalNote = await readFile(notePath, "utf8");
      expect(originalNote).toContain("Existing summary stays put.");
      expect(originalNote).toContain("Legacy transcript text.");

      const updatedSegments: TranscriptSegment[] = [
        { startSeconds: 0, endSeconds: 5, text: "Corrected opening line." },
        { startSeconds: 5, endSeconds: 10, text: "Corrected retrieval terminology." },
      ];

      const updated = await (
        services as unknown as {
          updateTranscript(itemId: string, update: { segments: TranscriptSegment[] }): Promise<{ transcript: { rawText: string; segments: TranscriptSegment[] } | null }>;
        }
      ).updateTranscript(itemId, { segments: updatedSegments });

      expect(updated.transcript?.rawText).toBe("Corrected opening line. Corrected retrieval terminology.");
      expect(updated.transcript?.segments).toEqual(updatedSegments);

      expect(
        db.prepare("SELECT id, raw_text, segments_json FROM transcripts WHERE item_id = ?").all(itemId),
      ).toEqual([
        {
          id: transcriptId,
          raw_text: "Corrected opening line. Corrected retrieval terminology.",
          segments_json: JSON.stringify(updatedSegments),
        },
      ]);

      const updatedNote = await readFile(notePath, "utf8");
      expect(updatedNote).toContain("Existing summary stays put.");
      expect(updatedNote).toContain("## Notes\n\nKeep this custom note content.");
      expect(updatedNote).not.toContain("Legacy transcript text.");
      expect(updatedNote).toContain("### 00:00:00\n\nCorrected opening line.");
      expect(updatedNote).toContain("### 00:00:05\n\nCorrected retrieval terminology.");

      const noteRow = db.prepare("SELECT content_hash, updated_at FROM notes WHERE item_id = ?").get(itemId) as {
        content_hash: string;
        updated_at: string;
      };
      expect(noteRow.content_hash).toBe(hashContent(updatedNote));
      expect(noteRow.updated_at).not.toBe("2026-06-16T10:00:00.000Z");

      await expect(searchService.search({ text: "Corrected retrieval terminology." })).resolves.toMatchObject({
        total: 1,
        items: [expect.objectContaining({ itemId, source: "transcript", startSeconds: 5 })],
      });
      await expect(searchService.search({ text: "Legacy transcript text." })).resolves.toMatchObject({
        total: 0,
        items: [],
      });
    } finally {
      db.close();
    }
  });

  test("appends a transcript section when a note exists without one", async () => {
    const { services, db, itemId, notePath } = await createSeededServices({
      noteMarkdown: `---
id: "item-1"
title: "Test Recording"
---

# Test Recording

## Summary

Summary without transcript heading.
`,
    });

    try {
      await (
        services as unknown as {
          updateTranscript(itemId: string, update: { segments: TranscriptSegment[] }): Promise<unknown>;
        }
      ).updateTranscript(itemId, {
        segments: [
          { startSeconds: 0, endSeconds: 5, text: "Appended transcript line." },
          { startSeconds: 5, endSeconds: 10, text: "Second appended transcript line." },
        ],
      });

      const updatedNote = await readFile(notePath, "utf8");
      expect(updatedNote).toContain("Summary without transcript heading.");
      expect(updatedNote.trimEnd()).toMatch(
        /## Transcript\n\n### 00:00:00\n\nAppended transcript line\.\n\n### 00:00:05\n\nSecond appended transcript line\.$/,
      );
    } finally {
      db.close();
    }
  });
});

async function createSeededServices(options: { noteMarkdown?: string } = {}) {
  const libraryRoot = await mkdtemp(join(tmpdir(), "voicenoter-library-"));
  const services = new AppServices();
  await services.openLibrary(libraryRoot);

  const db = openVoiceNoterDatabase(join(libraryRoot, "voicenoter.db"));
  const now = "2026-06-16T10:00:00.000Z";
  const itemId = "item-1";
  const transcriptId = "transcript-1";
  const notePath = join(libraryRoot, "notes", "test-recording.md");

  db.prepare(
    `
      INSERT INTO items (
        id, title, source_type, original_path, library_media_path, extracted_audio_path,
        note_path, duration_seconds, language, status, created_at, updated_at, imported_at
      )
      VALUES (?, ?, 'audio', ?, ?, NULL, ?, 10, 'en', 'ready', ?, ?, ?)
    `,
  ).run(itemId, "Test Recording", "/tmp/source/test-recording.mp3", join(libraryRoot, "media", "original", "test-recording.mp3"), notePath, now, now, now);

  const initialSegments: TranscriptSegment[] = [
    { startSeconds: 0, endSeconds: 5, text: "Legacy transcript text." },
    { startSeconds: 5, endSeconds: 10, text: "Old retrieval wording." },
  ];
  db.prepare(
    `
      INSERT INTO transcripts (
        id, item_id, engine, model, language, raw_text, segments_json, created_at
      )
      VALUES (?, ?, 'local-whisper-compatible', 'base', 'en', ?, ?, ?)
    `,
  ).run(
    transcriptId,
    itemId,
    "Legacy transcript text. Old retrieval wording.",
    JSON.stringify(initialSegments),
    now,
  );

  const noteMarkdown =
    options.noteMarkdown ??
    `---
id: "item-1"
title: "Test Recording"
---

# Test Recording

## Summary

Existing summary stays put.

## Notes

Keep this custom note content.

## Transcript

### 00:00:00

Legacy transcript text.

### 00:00:05

Old retrieval wording.
`;
  await writeFile(notePath, noteMarkdown, "utf8");
  db.prepare(
    `
      INSERT INTO notes (
        id, item_id, path, title, frontmatter_json, content_hash, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    "note-1",
    itemId,
    notePath,
    "Test Recording",
    JSON.stringify({ id: itemId, title: "Test Recording" }),
    hashContent(noteMarkdown),
    now,
    now,
  );

  return { services, db, itemId, notePath, transcriptId };
}
