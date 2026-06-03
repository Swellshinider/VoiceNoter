export type ISODateTime = string;

export type ModelId = "tiny" | "base" | "small";

export type LibraryState = {
  path: string;
  isInitialized: boolean;
  ffmpegStatus: "available" | "missing" | "failed";
  selectedModelId: ModelId | null;
};

export type UserFacingError = {
  title: string;
  message: string;
  technicalDetails?: string;
  retryable: boolean;
};

export type LibraryValidationResult = {
  ok: boolean;
  path: string;
  errors: UserFacingError[];
};

export type ImportCandidate = {
  path: string;
  filename: string;
  extension: string;
  supported: boolean;
};

export type ImportResult = {
  importedItems: ItemSummary[];
  rejectedFiles: Array<{
    path: string;
    error: UserFacingError;
  }>;
};

export type ItemStatus = "importing" | "processing" | "ready" | "failed" | "cancelled";

export type SourceType = "audio" | "video";

export type ItemSummary = {
  id: string;
  title: string;
  sourceType: SourceType;
  status: ItemStatus;
  notePath: string | null;
  durationSeconds: number | null;
  category: Category | null;
  tags: Tag[];
  importedAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type ItemDetail = ItemSummary & {
  libraryMediaPath: string;
  extractedAudioPath: string | null;
  transcript: Transcript | null;
  note: NoteContent | null;
};

export type Transcript = {
  id: string;
  itemId: string;
  engine: string;
  model: string;
  language: string | null;
  rawText: string;
  segments: TranscriptSegment[];
  createdAt: ISODateTime;
};

export type TranscriptSegment = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export type NoteContent = {
  itemId: string;
  path: string;
  markdown: string;
  frontmatter: Record<string, unknown>;
  contentHash: string;
  updatedAt: ISODateTime;
};

export type Category = {
  id: string;
  name: string;
};

export type Tag = {
  id: string;
  name: string;
};

export type ItemMetadataUpdate = {
  title?: string;
  categoryId?: string | null;
  tagIds?: string[];
};

export type ItemListQuery = {
  view?: "inbox" | "all" | "category" | "tag";
  categoryId?: string;
  tagId?: string;
};

export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type JobType =
  | "import_file"
  | "inspect_media"
  | "extract_audio"
  | "transcribe"
  | "generate_markdown"
  | "index_note"
  | "download_model";

export type Job = {
  id: string;
  itemId: string | null;
  type: JobType;
  status: JobStatus;
  progress: number;
  error: UserFacingError | null;
  createdAt: ISODateTime;
  startedAt: ISODateTime | null;
  completedAt: ISODateTime | null;
};

export type ProcessingEvent = {
  itemId: string;
  jobId: string;
  stage: JobType;
  progress: number;
  message: string;
  partialSegments?: TranscriptSegment[];
};

export type SearchQuery = {
  text: string;
  categoryId?: string;
  tagId?: string;
};

export type SearchResult = {
  itemId: string;
  notePath: string;
  title: string;
  snippet: string;
  source: "title" | "note" | "transcript" | "category" | "tag";
  startSeconds: number | null;
};

export type ModelInfo = {
  id: ModelId;
  name: string;
  sizeLabel: string;
  status: "available" | "downloading" | "installed" | "failed";
  localPath: string | null;
  selected: boolean;
};

export type ModelDownloadJob = {
  modelId: ModelId;
  jobId: string;
};

export type RescanResult = {
  scannedNotes: number;
  updatedNotes: number;
  errors: UserFacingError[];
};

export type ReindexResult = {
  indexedItems: number;
  errors: UserFacingError[];
};

export type Unsubscribe = () => void;

export type LibrarySettings = {
  libraryPath: string;
  theme: "system" | "light" | "dark";
  defaultImportBehavior: "copy";
  defaultModelId: ModelId | null;
  transcriptionLanguage: "auto" | string;
  modelStorageBytes?: number;
  installedModelCount?: number;
};

export type LibraryApi = {
  getCurrentLibrary(): Promise<LibraryState | null>;
  getLastLibrary(): Promise<string | null>;
  chooseLibrary(): Promise<LibraryState>;
  openLastLibrary(): Promise<LibraryState>;
  validateLibrary(path: string): Promise<LibraryValidationResult>;
  openLibraryFolder(): Promise<void>;
  rescanLibrary(): Promise<RescanResult>;
  getSettings(): Promise<LibrarySettings>;
  updateSettings(patch: Partial<Pick<LibrarySettings, "transcriptionLanguage">>): Promise<LibrarySettings>;
};

export type ImportApi = {
  chooseFilesForImport(): Promise<ImportCandidate[]>;
  importFiles(paths: string[]): Promise<ImportResult>;
};

export type QueueApi = {
  listJobs(): Promise<Job[]>;
  retryJob(jobId: string): Promise<Job>;
  cancelJob(jobId: string): Promise<Job>;
  subscribeToJobs(callback: (jobs: Job[]) => void): Unsubscribe;
  subscribeToProcessingEvents(callback: (event: ProcessingEvent) => void): Unsubscribe;
};

export type ItemsApi = {
  listItems(query?: ItemListQuery): Promise<ItemSummary[]>;
  getItem(itemId: string): Promise<ItemDetail>;
  readNote(itemId: string): Promise<NoteContent>;
  saveNote(itemId: string, markdown: string): Promise<NoteContent>;
  updateItemMetadata(itemId: string, metadata: ItemMetadataUpdate): Promise<ItemDetail>;
};

export type SearchApi = {
  search(query: SearchQuery): Promise<SearchResult[]>;
  reindex(): Promise<ReindexResult>;
};

export type ModelsApi = {
  listModels(): Promise<ModelInfo[]>;
  downloadModel(modelId: ModelId): Promise<ModelDownloadJob>;
  deleteModel(modelId: string): Promise<void>;
  setDefaultModel(modelId: string): Promise<ModelInfo>;
};

export type VoiceNoterApi = {
  library: LibraryApi;
  import: ImportApi;
  queue: QueueApi;
  items: ItemsApi;
  search: SearchApi;
  models: ModelsApi;
};

declare global {
  interface Window {
    voiceNoter: VoiceNoterApi;
  }
}
