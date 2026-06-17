import { describe, expect, test } from "vitest";
import {
  getImportCandidate,
  isSupportedMediaExtension,
  itemIdSchema,
  itemListQuerySchema,
  itemMetadataUpdateSchema,
  jobIdSchema,
  libraryPathSchema,
  librarySettingsPatchSchema,
  markdownSchema,
  modelIdSchema,
  queueListQuerySchema,
  searchQuerySchema,
  transcriptUpdateSchema,
} from "./validation";

describe("media import validation", () => {
  test("marks supported audio and video files as importable", () => {
    expect(isSupportedMediaExtension(".mp3")).toBe(true);
    expect(isSupportedMediaExtension(".MP4")).toBe(true);
    expect(getImportCandidate("/recordings/Lecture One.MP4")).toEqual({
      path: "/recordings/Lecture One.MP4",
      filename: "Lecture One.MP4",
      extension: ".mp4",
      supported: true,
    });
  });

  test("rejects unsupported files with normalized extension metadata", () => {
    expect(isSupportedMediaExtension(".txt")).toBe(false);
    expect(getImportCandidate("/recordings/notes.txt")).toEqual({
      path: "/recordings/notes.txt",
      filename: "notes.txt",
      extension: ".txt",
      supported: false,
    });
  });
});

describe("ipc validation schemas", () => {
  test("accepts and rejects the expected ids and payloads", () => {
    expect(modelIdSchema.parse("base")).toBe("base");
    expect(itemIdSchema.parse("item-1")).toBe("item-1");
    expect(jobIdSchema.parse("job-1")).toBe("job-1");
    expect(libraryPathSchema.parse("/tmp/library")).toBe("/tmp/library");
    expect(markdownSchema.parse("# note")).toBe("# note");

    expect(() => itemIdSchema.parse(" ")).toThrow();
    expect(() => jobIdSchema.parse("")).toThrow();
  });

  test("validates page and update payloads", () => {
    expect(queueListQuerySchema.parse({ limit: 25, offset: 50, status: ["failed"] })).toEqual({
      limit: 25,
      offset: 50,
      status: ["failed"],
    });
    expect(itemListQuerySchema.parse({ view: "tag", tagId: "tag-1" })).toEqual({ view: "tag", tagId: "tag-1" });
    expect(searchQuerySchema.parse({ text: "hello world", limit: 25 })).toEqual({ text: "hello world", limit: 25 });
    expect(itemMetadataUpdateSchema.parse({ title: "Updated", tagIds: ["tag-1"] })).toEqual({ title: "Updated", tagIds: ["tag-1"] });
    expect(
      transcriptUpdateSchema.parse({
        segments: [
          { startSeconds: 0, endSeconds: 4.5, text: " Intro " },
          { startSeconds: 4.5, endSeconds: 8, text: "Second segment" },
        ],
      }),
    ).toEqual({
      segments: [
        { startSeconds: 0, endSeconds: 4.5, text: "Intro" },
        { startSeconds: 4.5, endSeconds: 8, text: "Second segment" },
      ],
    });
    expect(librarySettingsPatchSchema.parse({ theme: "dark", transcriptionLanguage: "auto" })).toEqual({
      theme: "dark",
      transcriptionLanguage: "auto",
    });
  });

  test("rejects transcript updates with blank segment text", () => {
    expect(() =>
      transcriptUpdateSchema.parse({
        segments: [{ startSeconds: 0, endSeconds: 4, text: "   " }],
      }),
    ).toThrow();
  });
});
