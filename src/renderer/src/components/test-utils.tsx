// @vitest-environment jsdom
import { render, type RenderResult } from "@testing-library/react";
import { vi } from "vitest";
import type {
  DashboardStorageBreakdown,
  DashboardSummary,
  ItemFacets,
  ItemSummary,
  Job,
  PageResult,
  SearchResult,
  VoiceNoterApi,
} from "../../../shared/types";

export function createMockApi(): VoiceNoterApi {
  return {
    library: {
      getCurrentLibrary: vi.fn().mockResolvedValue(null),
      getLastLibrary: vi.fn().mockResolvedValue(null),
      chooseLibrary: vi.fn(),
      openLastLibrary: vi.fn(),
      validateLibrary: vi.fn(),
      openLibraryFolder: vi.fn(),
      rescanLibrary: vi.fn(),
      getSettings: vi.fn().mockResolvedValue({
        libraryPath: "/tmp/test-library",
        theme: "dark",
        defaultImportBehavior: "copy",
        defaultModelId: null,
        transcriptionLanguage: "auto",
        modelStorageBytes: 0,
        installedModelCount: 0,
      }),
      updateSettings: vi.fn(),
    },
    import: {
      chooseFilesForImport: vi.fn().mockResolvedValue([]),
      importFiles: vi.fn().mockResolvedValue({ importedItems: [], rejectedFiles: [] }),
    },
    queue: {
      listJobs: vi.fn().mockResolvedValue(mockQueuePage),
      getSummary: vi.fn().mockResolvedValue(mockQueueSummary),
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      subscribeToQueueUpdates: vi.fn().mockReturnValue(() => {}),
      subscribeToProcessingEvents: vi.fn().mockReturnValue(() => {}),
    },
    items: {
      listItems: vi.fn().mockResolvedValue(mockItemPage),
      getFacets: vi.fn().mockResolvedValue(mockItemFacets),
      getItem: vi.fn(),
      readNote: vi.fn(),
      saveNote: vi.fn(),
      updateItemMetadata: vi.fn(),
      updateTranscript: vi.fn(),
    },
    search: {
      search: vi.fn().mockResolvedValue(mockSearchPage),
      reindex: vi.fn(),
    },
    dashboard: {
      getSummary: vi.fn().mockResolvedValue(mockDashboardSummary),
      getStorageBreakdown: vi.fn().mockResolvedValue(mockStorageBreakdown),
    },
    models: {
      listModels: vi.fn().mockResolvedValue([]),
      downloadModel: vi.fn(),
      deleteModel: vi.fn(),
      setDefaultModel: vi.fn(),
    },
  };
}

export const mockItemSummary: ItemSummary = {
  id: "item-1",
  title: "Test Recording",
  sourceType: "audio",
  status: "ready",
  notePath: "/tmp/notes/test.md",
  durationSeconds: 120,
  category: null,
  tags: [],
  importedAt: "2026-06-03T00:00:00.000Z",
  updatedAt: "2026-06-03T00:00:00.000Z",
};

export const mockItemPage: PageResult<ItemSummary> = {
  items: [mockItemSummary],
  total: 1,
  limit: 50,
  offset: 0,
  nextOffset: null,
};

export const mockItemDetail = {
  ...mockItemSummary,
  libraryMediaPath: "/tmp/media/original/test.mp3",
  mediaUrl: "voicenoter-media://items/item-1/media",
  extractedAudioPath: null,
  transcript: {
    id: "transcript-1",
    itemId: "item-1",
    engine: "local-whisper-compatible",
    model: "base",
    language: "en",
    rawText: "Hello world this is a test.",
    segments: [
      { startSeconds: 0, endSeconds: 5, text: "Hello world" },
      { startSeconds: 5, endSeconds: 10, text: "this is a test." },
    ],
    createdAt: "2026-06-03T00:00:00.000Z",
  },
  note: {
    itemId: "item-1",
    path: "/tmp/notes/test.md",
    markdown: "---\nid: item-1\n---\n# Test Recording\n\n## Transcript\n\n### 00:00:00\n\nHello world\n\n### 00:00:05\n\nthis is a test.\n",
    frontmatter: { id: "item-1", title: "Test Recording" },
    contentHash: "abc123",
    updatedAt: "2026-06-03T00:00:00.000Z",
  },
};

export const mockJob: Job = {
  id: "job-1",
  itemId: "item-1",
  type: "transcribe",
  status: "running",
  progress: 0.5,
  error: null,
  createdAt: "2026-06-03T00:00:00.000Z",
  startedAt: "2026-06-03T00:00:01.000Z",
  completedAt: null,
};

export const mockQueuePage: PageResult<Job> = {
  items: [mockJob],
  total: 1,
  limit: 50,
  offset: 0,
  nextOffset: null,
};

export const mockQueueSummary = {
  totalJobs: 3,
  pendingJobs: 1,
  runningJobs: 1,
  completedJobs: 1,
  failedJobs: 0,
  cancelledJobs: 0,
  activeJobs: 2,
  oldestPendingAt: "2026-06-03T00:00:00.000Z",
};

export const mockSearchResult: SearchResult = {
  itemId: "item-1",
  notePath: "/tmp/notes/test.md",
  title: "Test Recording",
  snippet: "matching text",
  source: "transcript",
  sourceType: "audio",
  status: "ready",
  startSeconds: 5,
};

export const mockSearchPage: PageResult<SearchResult> = {
  items: [mockSearchResult],
  total: 1,
  limit: 50,
  offset: 0,
  nextOffset: null,
};

export const mockModelInfo = {
  id: "base" as const,
  name: "base",
  sizeLabel: "~142 MB",
  status: "available" as const,
  localPath: null,
  selected: false,
};

export const mockLibraryState = {
  path: "/tmp/test-library",
  isInitialized: true,
  ffmpegStatus: "available" as const,
  selectedModelId: "base" as const,
};

export const mockStorageBreakdown: DashboardStorageBreakdown = {
  totalBytes: 1_500_000_000,
  originalMediaBytes: 1_000_000_000,
  extractedAudioBytes: 250_000_000,
  notesBytes: 80_000_000,
  modelsBytes: 120_000_000,
  databaseBytes: 20_000_000,
  indexesBytes: 10_000_000,
  otherBytes: 20_000_000,
};

export const mockItemFacets: ItemFacets = {
  categories: [{ id: "cat-1", name: "Meetings", itemCount: 2 }],
  tags: [{ id: "tag-1", name: "Follow-up", itemCount: 1 }],
};

export const mockDashboardSummary: DashboardSummary = {
  counts: {
    totalItems: 3,
    audioItems: 2,
    videoItems: 1,
    transcribedItems: 2,
    pendingItems: 1,
    failedItems: 0,
    cancelledItems: 0,
  },
  trend: [
    { date: "2026-06-01", completedTranscriptions: 0 },
    { date: "2026-06-02", completedTranscriptions: 1 },
    { date: "2026-06-03", completedTranscriptions: 0 },
    { date: "2026-06-04", completedTranscriptions: 2 },
    { date: "2026-06-05", completedTranscriptions: 1 },
    { date: "2026-06-06", completedTranscriptions: 0 },
    { date: "2026-06-07", completedTranscriptions: 0 },
    { date: "2026-06-08", completedTranscriptions: 1 },
    { date: "2026-06-09", completedTranscriptions: 0 },
    { date: "2026-06-10", completedTranscriptions: 0 },
    { date: "2026-06-11", completedTranscriptions: 3 },
    { date: "2026-06-12", completedTranscriptions: 1 },
    { date: "2026-06-13", completedTranscriptions: 2 },
    { date: "2026-06-14", completedTranscriptions: 0 },
  ],
  latestItems: [
    {
      itemId: "item-1",
      title: "Test Recording",
      sourceType: "audio",
      status: "transcribed",
      date: "2026-06-13T10:00:00.000Z",
    },
    {
      itemId: "item-2",
      title: "Queued Interview",
      sourceType: "video",
      status: "pending",
      date: "2026-06-13T12:00:00.000Z",
    },
    {
      itemId: "item-3",
      title: "Failed Clip",
      sourceType: "audio",
      status: "failed",
      date: "2026-06-12T09:00:00.000Z",
    },
  ],
  queueHealth: {
    pendingJobs: 2,
    runningJobs: 1,
    failedJobs: 1,
    activeJobs: 3,
    oldestPendingAt: "2026-06-12T08:30:00.000Z",
  },
};

export function renderWithApi(ui: React.ReactElement): RenderResult {
  return render(ui);
}
