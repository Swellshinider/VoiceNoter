import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type RecentLibraryStore = {
  lastLibraryPath?: string;
};

export class RecentLibraryService {
  constructor(private readonly storePath: string) {}

  async getLastLibraryPath(): Promise<string | null> {
    try {
      const store = JSON.parse(await readFile(this.storePath, "utf8")) as RecentLibraryStore;
      return typeof store.lastLibraryPath === "string" && store.lastLibraryPath.trim() ? store.lastLibraryPath : null;
    } catch {
      return null;
    }
  }

  async setLastLibraryPath(path: string): Promise<void> {
    await mkdir(dirname(this.storePath), { recursive: true });
    await writeFile(this.storePath, `${JSON.stringify({ lastLibraryPath: path }, null, 2)}\n`, "utf8");
  }
}
