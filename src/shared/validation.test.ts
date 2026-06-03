import { describe, expect, test } from "vitest";
import { getImportCandidate, isSupportedMediaExtension } from "./validation";

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
