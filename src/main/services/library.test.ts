import { mkdtemp, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { afterEach, describe, expect, test } from "vitest";
import { LibraryService } from "./library";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    try {
      new Database(join(root, "voicenoter.db")).close();
    } catch {
      // ignore cleanup-only failures
    }
  }
});

describe("LibraryService", () => {
  test("creates the required library folders, settings, schema, and model rows", async () => {
    const root = await tempLibraryRoot();
    const service = new LibraryService();

    const state = await service.initializeLibrary(root);

    expect(state.path).toBe(root);
    expect(state.isInitialized).toBe(true);
    await expect(stat(join(root, "media", "original"))).resolves.toMatchObject({ isDirectory: expect.any(Function) });
    await expect(stat(join(root, "media", "extracted"))).resolves.toMatchObject({ isDirectory: expect.any(Function) });
    await expect(stat(join(root, "notes"))).resolves.toMatchObject({ isDirectory: expect.any(Function) });
    await expect(stat(join(root, "models"))).resolves.toMatchObject({ isDirectory: expect.any(Function) });
    await expect(stat(join(root, "indexes"))).resolves.toMatchObject({ isDirectory: expect.any(Function) });
    await expect(stat(join(root, "temp"))).resolves.toMatchObject({ isDirectory: expect.any(Function) });

    const db = new Database(join(root, "voicenoter.db"));
    try {
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'items'").get()).toBeTruthy();
      expect(db.prepare("SELECT COUNT(*) AS count FROM models").get()).toEqual({ count: 3 });
      expect(db.prepare("SELECT id, status FROM models ORDER BY id").all()).toEqual([
        { id: "base", status: "available" },
        { id: "small", status: "available" },
        { id: "tiny", status: "available" },
      ]);
    } finally {
      db.close();
    }
  });

  test("validates an initialized library", async () => {
    const root = await tempLibraryRoot();
    const service = new LibraryService();
    await service.initializeLibrary(root);

    await expect(service.validateLibrary(root)).resolves.toEqual({
      ok: true,
      path: root,
      errors: [],
    });
  });
});

async function tempLibraryRoot() {
  const root = await mkdtemp(join(tmpdir(), "voicenoter-library-"));
  tempRoots.push(root);
  return root;
}
