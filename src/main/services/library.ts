import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import type { LibrarySettings as SharedLibrarySettings, LibraryState, LibraryValidationResult, ModelId } from "../../shared/types";
import { userError } from "../../shared/errors";
import { openVoiceNoterDatabase } from "./database";

export const libraryFolders = [
  join("media", "original"),
  join("media", "extracted"),
  "notes",
  "models",
  "indexes",
  "temp",
] as const;

type LibrarySettings = SharedLibrarySettings;

export class LibraryService {
  async initializeLibrary(path: string): Promise<LibraryState> {
    await this.ensureWritableDirectory(path);
    for (const folder of libraryFolders) {
      await mkdir(join(path, folder), { recursive: true });
    }

    const db = openVoiceNoterDatabase(join(path, "voicenoter.db"));
    try {
      await this.ensureSettings(path);
      return {
        path,
        isInitialized: true,
        ffmpegStatus: ffmpegPath ? "available" : "missing",
        selectedModelId: this.getSelectedModelId(db),
      };
    } finally {
      db.close();
    }
  }

  async validateLibrary(path: string): Promise<LibraryValidationResult> {
    const errors: LibraryValidationResult["errors"] = [];

    try {
      await this.ensureWritableDirectory(path);
    } catch (error) {
      errors.push(
        userError("Library folder is not writable", "Choose a folder VoiceNoter can read and write.", {
          technicalDetails: error instanceof Error ? error.message : String(error),
          retryable: true,
        }),
      );
    }

    for (const folder of libraryFolders) {
      try {
        const result = await stat(join(path, folder));
        if (!result.isDirectory()) {
          errors.push(userError("Library structure is incomplete", `${folder} exists but is not a folder.`));
        }
      } catch {
        errors.push(userError("Library structure is incomplete", `Missing required folder: ${folder}.`));
      }
    }

    try {
      await access(join(path, "voicenoter.db"), constants.R_OK | constants.W_OK);
    } catch {
      errors.push(userError("Library database is missing", "VoiceNoter could not find a writable voicenoter.db file."));
    }

    return {
      ok: errors.length === 0,
      path,
      errors,
    };
  }

  async readSettings(path: string): Promise<LibrarySettings> {
    const raw = await readFile(join(path, "settings.json"), "utf8");
    return JSON.parse(raw) as LibrarySettings;
  }

  async writeSettings(path: string, patch: Partial<Pick<LibrarySettings, "transcriptionLanguage">>): Promise<LibrarySettings> {
    const current = await this.readSettings(path);
    const next = { ...current, ...patch };
    await writeFile(join(path, "settings.json"), `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return next;
  }

  async getSettingsWithStorage(path: string): Promise<LibrarySettings> {
    const settings = await this.readSettings(path);
    const modelsDir = join(path, "models");
    let totalBytes = 0;
    let installedCount = 0;
    try {
      const { readdir } = await import("node:fs/promises");
      const files = await readdir(modelsDir);
      for (const file of files) {
        if (file.endsWith(".bin")) {
          const filePath = join(modelsDir, file);
          const fileStat = await stat(filePath);
          totalBytes += fileStat.size;
          installedCount++;
        }
      }
    } catch {
      // models dir may not exist yet
    }
    return { ...settings, modelStorageBytes: totalBytes, installedModelCount: installedCount };
  }

  private async ensureWritableDirectory(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
    const result = await stat(path);
    if (!result.isDirectory()) {
      throw new Error(`${path} is not a directory`);
    }
    await access(path, constants.R_OK | constants.W_OK);
  }

  private async ensureSettings(path: string): Promise<void> {
    const settingsPath = join(path, "settings.json");
    try {
      await access(settingsPath, constants.R_OK | constants.W_OK);
      return;
    } catch {
      const settings: LibrarySettings = {
        libraryPath: path,
        theme: "system",
        defaultImportBehavior: "copy",
        defaultModelId: null,
        transcriptionLanguage: "auto",
      };
      await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    }
  }

  private getSelectedModelId(db: import("./database").VoiceNoterDatabase): ModelId | null {
    const row = db.prepare("SELECT id FROM models WHERE selected_at IS NOT NULL ORDER BY selected_at DESC LIMIT 1").get() as
      | { id: ModelId }
      | undefined;
    return row?.id ?? null;
  }
}
