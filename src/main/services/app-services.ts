import { app, dialog, shell } from "electron";
import { EventEmitter } from "node:events";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type {
  ImportCandidate,
  ImportResult,
  ItemDetail,
  ItemListQuery,
  ItemFacets,
  ItemMetadataUpdate,
  ItemSummary,
  Job,
  LibrarySettings,
  LibrarySettingsWithStats,
  LibraryState,
  LibraryValidationResult,
  ModelDownloadJob,
  ModelInfo,
  NoteContent,
  ProcessingEvent,
  ReindexResult,
  RescanResult,
  DashboardStorageBreakdown,
  SearchQuery,
  SearchResult,
  DashboardSummary,
  PageResult,
  QueueListQuery,
  QueueSummary,
  QueueUpdate,
} from "../../shared/types";
import { userError, VoiceNoterError } from "../../shared/errors";
import { getImportCandidate } from "../../shared/validation";
import { openVoiceNoterDatabase, type VoiceNoterDatabase } from "./database";
import { ImportService } from "./import-service";
import { getItemFacets, listItemSummaries, mapItemDetail, type ItemRow } from "./items";
import { LibraryService } from "./library";
import { ModelService } from "./model";
import { NoteService, hashContent } from "./note";
import { ProcessingService } from "./processing";
import { QueueService } from "./queue";
import { RecentLibraryService } from "./recent-library";
import { SearchService } from "./search";
import { getDashboardStorageBreakdown, getDashboardSummary } from "./dashboard";

function logBackgroundError(message: string, error: unknown): void {
  console.error(`[app-services] ${message}`, error);
}

export class AppServices {
  private readonly libraryService = new LibraryService();
  private readonly recentLibraryService = new RecentLibraryService(join(app.getPath("userData"), "recent-library.json"));
  private libraryPath: string | null = null;
  private db: VoiceNoterDatabase | null = null;
  private queue: QueueService | null = null;
  private processing: ProcessingService | null = null;
  private readonly events = new EventEmitter();
  private unsubscribeQueueEvents: Array<() => void> = [];

  async getCurrentLibrary(): Promise<LibraryState | null> {
    if (!this.libraryPath || !this.db) {
      return null;
    }
    return {
      path: this.libraryPath,
      isInitialized: true,
      ffmpegStatus: "available",
      selectedModelId:
        (this.db.prepare("SELECT id FROM models WHERE selected_at IS NOT NULL ORDER BY selected_at DESC LIMIT 1").get() as
          | { id: LibraryState["selectedModelId"] }
          | undefined)?.id ?? null,
    };
  }

  async chooseLibrary(): Promise<LibraryState> {
    const result = await dialog.showOpenDialog({
      title: "Choose VoiceNoter Library",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      throw new Error("Library selection cancelled");
    }
    return this.openLibrary(result.filePaths[0]!);
  }

  async getLastLibrary(): Promise<string | null> {
    return this.recentLibraryService.getLastLibraryPath();
  }

  async openLastLibrary(): Promise<LibraryState> {
    const path = await this.recentLibraryService.getLastLibraryPath();
    if (!path) {
      throw new VoiceNoterError(
        userError("No last library", "VoiceNoter does not have a previously opened library path yet.", {
          retryable: false,
        }),
      );
    }
    try {
      const result = await stat(path);
      if (!result.isDirectory()) {
        throw new Error(`${path} is not a directory`);
      }
    } catch (error) {
      throw new VoiceNoterError(
        userError("Last library unavailable", "VoiceNoter could not open the last library path.", {
          technicalDetails: error instanceof Error ? error.message : String(error),
          retryable: true,
        }),
      );
    }
    return this.openLibrary(path);
  }

  async openLibrary(path: string): Promise<LibraryState> {
    const state = await this.libraryService.initializeLibrary(path);
    this.db?.close();
    this.libraryPath = path;
    this.db = openVoiceNoterDatabase(join(path, "voicenoter.db"));
    this.queue = new QueueService(this.db);
    this.queue.recoverUnfinishedJobs();
    this.processing = new ProcessingService(path, this.db, this.queue);
    this.unsubscribeQueueEvents.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeQueueEvents = [
      this.queue.onJobsChanged((update) => this.events.emit("queueUpdated", update)),
      this.queue.onProcessingEvent((event) => this.events.emit("processingEvent", event)),
    ];
    void this.processing.processAllPending().catch((error) => {
      logBackgroundError("Failed to resume pending jobs", error);
    });
    try {
      await this.recentLibraryService.setLastLibraryPath(path);
    } catch (error) {
      logBackgroundError("Failed to save last library path", error);
    }
    return state;
  }

  async validateLibrary(path: string): Promise<LibraryValidationResult> {
    return this.libraryService.validateLibrary(path);
  }

  async openLibraryFolder(): Promise<void> {
    const context = this.requireContext();
    await shell.openPath(context.libraryPath);
  }

  async rescanLibrary(): Promise<RescanResult> {
    const context = this.requireContext();
    const noteRows = context.db.prepare("SELECT item_id, path, content_hash FROM notes").all() as Array<{
      item_id: string;
      path: string;
      content_hash: string;
    }>;
    let scannedNotes = 0;
    let updatedNotes = 0;
    const errors: RescanResult["errors"] = [];
    const noteService = new NoteService(context.libraryPath, context.db);

    for (const row of noteRows) {
      scannedNotes += 1;
      try {
        const markdown = await readFile(row.path, "utf8");
        const nextHash = hashContent(markdown);
        if (nextHash !== row.content_hash) {
          await noteService.saveNote(row.item_id, markdown);
          updatedNotes += 1;
        }
      } catch (error) {
        errors.push({
          title: "Markdown rescan failed",
          message: `VoiceNoter could not rescan ${row.path}.`,
          technicalDetails: error instanceof Error ? error.stack ?? error.message : String(error),
          retryable: true,
        });
      }
    }
    const reindexResult = await new SearchService(context.db).reindex();
    return { scannedNotes, updatedNotes, errors: [...errors, ...reindexResult.errors] };
  }

  async getSettings(): Promise<LibrarySettingsWithStats> {
    if (!this.libraryPath || !this.db) {
      return {
        libraryPath: "",
        theme: "dark",
        defaultImportBehavior: "copy",
        defaultModelId: null,
        transcriptionLanguage: "auto",
        modelStorageBytes: 0,
        installedModelCount: 0,
      };
    }
    const context = { libraryPath: this.libraryPath, db: this.db };
    const settings = await this.libraryService.readSettings(context.libraryPath);
    const models = context.db.prepare("SELECT local_path FROM models WHERE status = 'installed' AND local_path IS NOT NULL").all() as Array<{ local_path: string }>;
    let modelStorageBytes = 0;
    for (const model of models) {
      try {
        const s = await stat(model.local_path);
        modelStorageBytes += s.size;
      } catch {
        // model file may have been deleted
      }
    }
    return { ...settings, modelStorageBytes, installedModelCount: models.length };
  }

  async updateSettings(
    patch: Partial<Pick<LibrarySettings, "transcriptionLanguage" | "theme">>,
  ): Promise<LibrarySettingsWithStats> {
    const context = this.requireContext();
    await this.libraryService.writeSettings(context.libraryPath, patch);
    return this.getSettings();
  }

  async chooseFilesForImport(): Promise<ImportCandidate[]> {
    const result = await dialog.showOpenDialog({
      title: "Import audio or video",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Audio and video", extensions: ["mp3", "wav", "m4a", "flac", "ogg", "aac", "mp4", "mov", "mkv", "webm", "avi"] }],
    });
    if (result.canceled) {
      return [];
    }
    return result.filePaths.map(getImportCandidate);
  }

  async importFiles(paths: string[]): Promise<ImportResult> {
    const context = this.requireContext();
    const result = await new ImportService(context.libraryPath, context.db).importFiles(paths);
    void context.processing.processAllPending().catch((error) => {
      logBackgroundError("Failed to process pending jobs after import", error);
    });
    return result;
  }

  async listJobs(query: QueueListQuery = {}): Promise<PageResult<Job>> {
    if (!this.db || !this.queue) {
      return { items: [], total: 0, limit: query.limit ?? 50, offset: query.offset ?? 0, nextOffset: null };
    }
    return this.queue.listJobs(query);
  }

  async getDashboardSummary(): Promise<DashboardSummary> {
    const context = this.requireContext();
    return getDashboardSummary(context.db);
  }

  async getDashboardStorageBreakdown(): Promise<DashboardStorageBreakdown> {
    const context = this.requireContext();
    return getDashboardStorageBreakdown(context.libraryPath);
  }

  async getQueueSummary(): Promise<QueueSummary> {
    return this.requireContext().queue.getSummary();
  }

  async retryJob(jobId: string): Promise<Job> {
    const context = this.requireContext();
    const job = await context.queue.retryJob(jobId);
    void context.processing.processAllPending().catch((error) => {
      logBackgroundError("Failed to process pending jobs after retry", error);
    });
    return job;
  }

  async cancelJob(jobId: string): Promise<Job> {
    return this.requireContext().queue.cancelJob(jobId);
  }

  onJobsChanged(callback: (update: QueueUpdate) => void): () => void {
    const listener = (update: QueueUpdate) => callback(update);
    this.events.on("queueUpdated", listener);
    return () => this.events.off("queueUpdated", listener);
  }

  onProcessingEvent(callback: Parameters<QueueService["onProcessingEvent"]>[0]): () => void {
    const listener = (event: ProcessingEvent) => callback(event);
    this.events.on("processingEvent", listener);
    return () => this.events.off("processingEvent", listener);
  }

  async listItems(query: ItemListQuery = {}): Promise<PageResult<ItemSummary>> {
    if (!this.db) {
      return { items: [], total: 0, limit: query.limit ?? 50, offset: query.offset ?? 0, nextOffset: null };
    }
    return listItemSummaries(this.db, query);
  }

  async getItemFacets(): Promise<ItemFacets> {
    return getItemFacets(this.requireContext().db);
  }

  async getItem(itemId: string): Promise<ItemDetail> {
    const { db, libraryPath } = this.requireContext();
    const row = db
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
    const transcriptRow = db.prepare("SELECT * FROM transcripts WHERE item_id = ? ORDER BY created_at DESC LIMIT 1").get(itemId) as
      | {
          id: string;
          item_id: string;
          engine: string;
          model: string;
          language: string | null;
          raw_text: string;
          segments_json: string;
          created_at: string;
        }
      | undefined;
    const note = row.note_path ? await new NoteService(libraryPath, db).readNote(itemId) : null;
    return {
      ...mapItemDetail(db, row),
      transcript: transcriptRow
        ? {
            id: transcriptRow.id,
            itemId: transcriptRow.item_id,
            engine: transcriptRow.engine,
            model: transcriptRow.model,
            language: transcriptRow.language,
            rawText: transcriptRow.raw_text,
            segments: JSON.parse(transcriptRow.segments_json),
            createdAt: transcriptRow.created_at,
          }
        : null,
      note,
    };
  }

  getMediaPathForItem(itemId: string): string {
    const { db } = this.requireContext();
    const row = db.prepare("SELECT library_media_path FROM items WHERE id = ?").get(itemId) as
      | { library_media_path: string }
      | undefined;
    if (!row) {
      throw new Error(`Item not found: ${itemId}`);
    }
    return row.library_media_path;
  }

  async readNote(itemId: string): Promise<NoteContent> {
    const context = this.requireContext();
    return new NoteService(context.libraryPath, context.db).readNote(itemId);
  }

  async saveNote(itemId: string, markdown: string): Promise<NoteContent> {
    const context = this.requireContext();
    const note = await new NoteService(context.libraryPath, context.db).saveNote(itemId, markdown);
    await new SearchService(context.db).indexItem(itemId);
    return note;
  }

  async updateItemMetadata(itemId: string, metadata: ItemMetadataUpdate): Promise<ItemDetail> {
    const { db } = this.requireContext();
    const now = new Date().toISOString();
    db.transaction(() => {
      if (metadata.title !== undefined || metadata.categoryId !== undefined) {
        const existing = db.prepare("SELECT title, category_id FROM items WHERE id = ?").get(itemId) as {
          title: string;
          category_id: string | null;
        };
        db.prepare("UPDATE items SET title = ?, category_id = ?, updated_at = ? WHERE id = ?").run(
          metadata.title ?? existing.title,
          metadata.categoryId === undefined ? existing.category_id : metadata.categoryId,
          now,
          itemId,
        );
      }
      if (metadata.tagIds) {
        db.prepare("DELETE FROM item_tags WHERE item_id = ?").run(itemId);
        for (const tagId of metadata.tagIds) {
          db.prepare("INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)").run(itemId, tagId);
        }
      }
    })();
    return this.getItem(itemId);
  }

  async search(query: SearchQuery): Promise<PageResult<SearchResult>> {
    return new SearchService(this.requireContext().db).search(query);
  }

  async reindex(): Promise<ReindexResult> {
    return new SearchService(this.requireContext().db).reindex();
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.libraryPath || !this.db || !this.queue) return [];
    return new ModelService(this.libraryPath, this.db, this.queue).listModels();
  }

  async downloadModel(modelId: string): Promise<ModelDownloadJob> {
    const context = this.requireContext();
    return new ModelService(context.libraryPath, context.db, context.queue).downloadModel(modelId);
  }

  async deleteModel(modelId: string): Promise<void> {
    const context = this.requireContext();
    await new ModelService(context.libraryPath, context.db, context.queue).deleteModel(modelId);
  }

  async setDefaultModel(modelId: string): Promise<ModelInfo> {
    const context = this.requireContext();
    return new ModelService(context.libraryPath, context.db, context.queue).setDefaultModel(modelId);
  }

  private requireContext(): {
    libraryPath: string;
    db: VoiceNoterDatabase;
    queue: QueueService;
    processing: ProcessingService;
  } {
    if (!this.libraryPath || !this.db || !this.queue || !this.processing) {
      throw new Error("No VoiceNoter library is open.");
    }
    return {
      libraryPath: this.libraryPath,
      db: this.db,
      queue: this.queue,
      processing: this.processing,
    };
  }
}
