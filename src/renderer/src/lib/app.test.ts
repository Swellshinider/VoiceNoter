import { describe, expect, it } from "vitest";
import type { PageResult, SearchResult } from "../../../shared/types";
import { mapSearchResultToItemSummary, mergePageResults, normalizeToastError } from "./app";

describe("renderer app helpers", () => {
  it("merges paged results when appending", () => {
    const previous: PageResult<{ id: string }> = {
      items: [{ id: "a" }],
      total: 2,
      limit: 1,
      offset: 0,
      nextOffset: 1,
    };
    const next: PageResult<{ id: string }> = {
      items: [{ id: "b" }],
      total: 2,
      limit: 1,
      offset: 1,
      nextOffset: null,
    };

    expect(mergePageResults(previous, next, true)).toEqual({
      ...next,
      items: [{ id: "a" }, { id: "b" }],
    });
  });

  it("replaces paged results when not appending", () => {
    const previous: PageResult<{ id: string }> = {
      items: [{ id: "a" }],
      total: 1,
      limit: 1,
      offset: 0,
      nextOffset: null,
    };
    const next: PageResult<{ id: string }> = {
      items: [{ id: "b" }],
      total: 2,
      limit: 1,
      offset: 1,
      nextOffset: null,
    };

    expect(mergePageResults(previous, next, false)).toBe(next);
  });

  it("normalizes unknown errors into toast payloads", () => {
    expect(normalizeToastError(new Error("boom"), "Fallback", "Fallback body")).toEqual({
      variant: "error",
      title: "Fallback",
      message: "boom",
      technicalDetails: undefined,
    });
  });

  it("maps a search result into an item summary shell", () => {
    const result: SearchResult = {
      itemId: "item-1",
      notePath: "/tmp/test.md",
      title: "Test Recording",
      snippet: "hello world",
      source: "note",
      sourceType: "audio",
      status: "ready",
      startSeconds: 12,
    };

    expect(mapSearchResultToItemSummary(result)).toMatchObject({
      id: "item-1",
      title: "Test Recording",
      sourceType: "audio",
      status: "ready",
      notePath: "/tmp/test.md",
    });
  });
});
