// @vitest-environment jsdom
import { render, type RenderResult } from "@testing-library/react";
import { vi } from "vitest";
import type { VoiceNoterApi } from "../../../shared/types";

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
        theme: "system",
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
      listJobs: vi.fn().mockResolvedValue([]),
      retryJob: vi.fn(),
      cancelJob: vi.fn(),
      subscribeToJobs: vi.fn().mockReturnValue(() => {}),
      subscribeToProcessingEvents: vi.fn().mockReturnValue(() => {}),
    },
    items: {
      listItems: vi.fn().mockResolvedValue([]),
      getItem: vi.fn(),
      readNote: vi.fn(),
      saveNote: vi.fn(),
      updateItemMetadata: vi.fn(),
    },
    search: {
      search: vi.fn().mockResolvedValue([]),
      reindex: vi.fn(),
    },
    models: {
      listModels: vi.fn().mockResolvedValue([]),
      downloadModel: vi.fn(),
      deleteModel: vi.fn(),
      setDefaultModel: vi.fn(),
    },
  };
}

export const mockItemSummary = {
  id: "item-1",
  title: "Test Recording",
  sourceType: "audio" as const,
  status: "ready" as const,
  notePath: "/tmp/notes/test.md",
  durationSeconds: 120,
  category: null,
  tags: [],
  importedAt: "2026-06-03T00:00:00.000Z",
  updatedAt: "2026-06-03T00:00:00.000Z",
};

export const mockItemDetail = {
  ...mockItemSummary,
  libraryMediaPath: "/tmp/media/original/test.mp3",
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

export const mockJob = {
  id: "job-1",
  itemId: "item-1",
  type: "transcribe" as const,
  status: "running" as const,
  progress: 0.5,
  error: null,
  createdAt: "2026-06-03T00:00:00.000Z",
  startedAt: "2026-06-03T00:00:01.000Z",
  completedAt: null,
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

export function renderWithApi(ui: React.ReactElement): RenderResult {
  return render(ui);
}
