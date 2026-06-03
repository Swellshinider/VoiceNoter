import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { RecentLibraryService } from "./recent-library";

describe("RecentLibraryService", () => {
  test("returns null when no last library has been stored", async () => {
    const root = await mkdtemp(join(tmpdir(), "voicenoter-recent-"));
    const service = new RecentLibraryService(join(root, "recent-library.json"));

    await expect(service.getLastLibraryPath()).resolves.toBeNull();
  });

  test("stores and returns the last opened library path", async () => {
    const root = await mkdtemp(join(tmpdir(), "voicenoter-recent-"));
    const service = new RecentLibraryService(join(root, "recent-library.json"));
    const libraryPath = join(root, "library");

    await service.setLastLibraryPath(libraryPath);

    await expect(service.getLastLibraryPath()).resolves.toBe(libraryPath);
  });

  test("overwrites the previous last library path", async () => {
    const root = await mkdtemp(join(tmpdir(), "voicenoter-recent-"));
    const service = new RecentLibraryService(join(root, "recent-library.json"));
    const firstPath = join(root, "first-library");
    const secondPath = join(root, "second-library");

    await service.setLastLibraryPath(firstPath);
    await service.setLastLibraryPath(secondPath);

    await expect(service.getLastLibraryPath()).resolves.toBe(secondPath);
  });
});
