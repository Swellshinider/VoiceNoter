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
  tags: Tag[];
  importedAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type ItemDetail = ItemSummary & {
  libraryMediaPath: string;
  mediaUrl: string;
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

export type TranscriptUpdate = {
  segments: TranscriptSegment[];
};

export type NoteContent = {
  itemId: string;
  path: string;
  markdown: string;
  frontmatter: Record<string, unknown>;
  contentHash: string;
  updatedAt: ISODateTime;
};

export type Tag = {
  id: string;
  name: string;
};

export type ItemMetadataUpdate = {
  title?: string;
  tagNames?: string[];
};

export type PageRequest = {
  limit?: number;
  offset?: number;
};

export type PageResult<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  nextOffset: number | null;
};

export type CountedTag = Tag & {
  itemCount: number;
};

export type ItemFacets = {
  tags: CountedTag[];
};

export type ItemListQuery = {
  view?: "all" | "tag";
  tagIds?: string[];
} & PageRequest;

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

export type ProcessingStatusGroup = {
  kind: "item" | "system";
  itemId: string | null;
  label: string;
  jobs: Job[];
};

export type QueueListQuery = PageRequest & {
  status?: JobStatus[];
};

export type QueueSummary = {
  totalJobs: number;
  pendingJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  activeJobs: number;
  oldestPendingAt: string | null;
};

export type QueueUpdate = {
  changedJobs: Job[];
  summary: QueueSummary;
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
  tagIds?: string[];
} & PageRequest;

export type TagRenameResult = {
  tag: Tag;
  mergedTagId: string | null;
};

export type SearchResult = {
  itemId: string;
  notePath: string;
  title: string;
  snippet: string;
  source: "title" | "note" | "transcript" | "tag";
  sourceType: SourceType;
  status: ItemStatus;
  startSeconds: number | null;
};

export type DashboardItemStatus = "transcribed" | "pending" | "failed" | "cancelled";

export type DashboardCounts = {
  totalItems: number;
  audioItems: number;
  videoItems: number;
  transcribedItems: number;
  pendingItems: number;
  failedItems: number;
  cancelledItems: number;
};

export type DashboardStorageBreakdown = {
  totalBytes: number;
  originalMediaBytes: number;
  extractedAudioBytes: number;
  notesBytes: number;
  modelsBytes: number;
  databaseBytes: number;
  indexesBytes: number;
  otherBytes: number;
};

export type DashboardTrendPoint = {
  date: string;
  completedTranscriptions: number;
};

export type DashboardLatestItem = {
  itemId: string;
  title: string;
  sourceType: SourceType;
  status: DashboardItemStatus;
  date: string;
};

export type DashboardQueueHealth = {
  pendingJobs: number;
  runningJobs: number;
  failedJobs: number;
  activeJobs: number;
  oldestPendingAt: string | null;
};

export type DashboardSummary = {
  counts: DashboardCounts;
  trend: DashboardTrendPoint[];
  latestItems: DashboardLatestItem[];
  queueHealth: DashboardQueueHealth;
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

export type LibrarySettingsWithStats = LibrarySettings & {
  modelStorageBytes: number;
  installedModelCount: number;
};

export type LibraryApi = {
  getCurrentLibrary(): Promise<LibraryState | null>;
  getLastLibrary(): Promise<string | null>;
  chooseLibrary(): Promise<LibraryState>;
  openLastLibrary(): Promise<LibraryState>;
  validateLibrary(path: string): Promise<LibraryValidationResult>;
  openLibraryFolder(): Promise<void>;
  rescanLibrary(): Promise<RescanResult>;
  getSettings(): Promise<LibrarySettingsWithStats>;
  updateSettings(patch: Partial<Pick<LibrarySettings, "transcriptionLanguage" | "theme">>): Promise<LibrarySettingsWithStats>;
};

export type ImportApi = {
  chooseFilesForImport(): Promise<ImportCandidate[]>;
  importFiles(paths: string[]): Promise<ImportResult>;
};

export type QueueApi = {
  listJobs(query?: QueueListQuery): Promise<PageResult<ProcessingStatusGroup>>;
  getSummary(): Promise<QueueSummary>;
  retryJob(jobId: string): Promise<Job>;
  cancelJob(jobId: string): Promise<Job>;
  subscribeToQueueUpdates(callback: (update: QueueUpdate) => void): Unsubscribe;
  subscribeToProcessingEvents(callback: (event: ProcessingEvent) => void): Unsubscribe;
};

export type ItemsApi = {
  listItems(query?: ItemListQuery): Promise<PageResult<ItemSummary>>;
  getFacets(): Promise<ItemFacets>;
  getItem(itemId: string): Promise<ItemDetail>;
  readNote(itemId: string): Promise<NoteContent>;
  saveNote(itemId: string, markdown: string): Promise<NoteContent>;
  updateItemMetadata(itemId: string, metadata: ItemMetadataUpdate): Promise<ItemDetail>;
  updateTranscript(itemId: string, update: TranscriptUpdate): Promise<ItemDetail>;
};

export type TagsApi = {
  listTags(): Promise<CountedTag[]>;
  createTag(name: string): Promise<Tag>;
  renameTag(tagId: string, name: string): Promise<TagRenameResult>;
  deleteTag(tagId: string): Promise<void>;
  assignTagsToItems(itemIds: string[], tagNames: string[]): Promise<void>;
  removeTagsFromItems(itemIds: string[], tagNames: string[]): Promise<void>;
};

export type SearchApi = {
  search(query: SearchQuery): Promise<PageResult<SearchResult>>;
  reindex(): Promise<ReindexResult>;
};

export type DashboardApi = {
  getSummary(): Promise<DashboardSummary>;
  getStorageBreakdown(): Promise<DashboardStorageBreakdown>;
};

export type ModelsApi = {
  listModels(): Promise<ModelInfo[]>;
  downloadModel(modelId: ModelId): Promise<ModelDownloadJob>;
  deleteModel(modelId: ModelId): Promise<void>;
  setDefaultModel(modelId: ModelId): Promise<ModelInfo>;
};

export type VoiceNoterApi = {
  library: LibraryApi;
  import: ImportApi;
  queue: QueueApi;
  items: ItemsApi;
  tags: TagsApi;
  search: SearchApi;
  dashboard: DashboardApi;
  models: ModelsApi;
};

declare global {
  interface Window {
    voiceNoter: VoiceNoterApi;
  }
}
