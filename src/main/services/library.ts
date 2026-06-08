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
    return this.normalizeSettings(path, JSON.parse(raw) as Partial<LibrarySettings>);
  }

  async writeSettings(path: string, patch: Partial<Pick<LibrarySettings, "transcriptionLanguage" | "theme">>): Promise<LibrarySettings> {
    const current = await this.readSettings(path);
    const next = this.normalizeSettings(path, { ...current, ...patch });
    await writeFile(join(path, "settings.json"), `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return next;
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
      const settings = this.defaultSettings(path);
      await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    }
  }

  private defaultSettings(path: string): LibrarySettings {
    return {
      libraryPath: path,
      theme: "dark",
      defaultImportBehavior: "copy",
      defaultModelId: null,
      transcriptionLanguage: "auto",
    };
  }

  private normalizeSettings(path: string, settings: Partial<LibrarySettings>): LibrarySettings {
    return {
      ...this.defaultSettings(path),
      ...settings,
      libraryPath: path,
      theme: this.normalizeTheme(settings.theme),
    };
  }

  private normalizeTheme(theme: LibrarySettings["theme"] | undefined): LibrarySettings["theme"] {
    if (theme === "light" || theme === "dark" || theme === "system") {
      return theme;
    }
    return "dark";
  }

  private getSelectedModelId(db: import("./database").VoiceNoterDatabase): ModelId | null {
    const row = db.prepare("SELECT id FROM models WHERE selected_at IS NOT NULL ORDER BY selected_at DESC LIMIT 1").get() as
      | { id: ModelId }
      | undefined;
    return row?.id ?? null;
  }
}
