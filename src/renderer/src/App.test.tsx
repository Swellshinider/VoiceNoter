// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Job, ModelInfo, QueueUpdate } from "../../shared/types";
import { App } from "./App";
import {
  createMockApi,
  mockItemDetail,
  mockItemPage,
  mockItemSummary,
  mockJob,
  mockLibraryState,
  mockModelInfo,
  mockQueuePage,
  mockQueueSummary,
} from "./components/test-utils";

describe("App", () => {
  beforeEach(() => {
    window.voiceNoter = createMockApi();
    document.documentElement.className = "";
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reloads the selected item when its transcription job completes", async () => {
    const initialJob = { ...mockJob, status: "running" as const, progress: 0.5 };
    const completedJob: Job = {
      ...initialJob,
      status: "completed",
      progress: 1,
      completedAt: "2026-06-03T00:01:00.000Z",
    };
    let queueListener: ((update: QueueUpdate) => void) | null = null;
    const detailWithoutTranscript = { ...mockItemDetail, status: "processing" as const, transcript: null, note: null };
    const detailWithTranscript = { ...mockItemDetail, status: "ready" as const };

    window.voiceNoter.library.getCurrentLibrary = vi.fn().mockResolvedValue(mockLibraryState);
    window.voiceNoter.library.getLastLibrary = vi.fn().mockResolvedValue(mockLibraryState.path);
    window.voiceNoter.queue.listJobs = vi.fn().mockResolvedValue({ ...mockQueuePage, items: [initialJob] });
    window.voiceNoter.queue.getSummary = vi.fn().mockResolvedValue(mockQueueSummary);
    window.voiceNoter.queue.subscribeToQueueUpdates = vi.fn((callback: (update: QueueUpdate) => void) => {
      queueListener = callback;
      return () => {};
    });
    window.voiceNoter.items.getItem = vi.fn().mockResolvedValueOnce(detailWithoutTranscript).mockResolvedValueOnce(detailWithTranscript);

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: /Test Recording/i }));
    await waitFor(() => expect(window.voiceNoter.items.getItem).toHaveBeenCalledTimes(1));

    act(() => {
      queueListener?.({
        changedJobs: [initialJob],
        summary: mockQueueSummary,
      });
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(window.voiceNoter.items.getItem).toHaveBeenCalledTimes(1);

    act(() => {
      queueListener?.({
        changedJobs: [completedJob],
        summary: { ...mockQueueSummary, completedJobs: 2, activeJobs: 1 },
      });
    });
    await waitFor(() => expect(window.voiceNoter.items.getItem).toHaveBeenCalledTimes(2));
  });

  it("defaults the renderer to dark theme when no library settings are available", async () => {
    window.voiceNoter.library.getCurrentLibrary = vi.fn().mockResolvedValue(null);
    window.voiceNoter.library.getSettings = vi.fn().mockResolvedValue(null);

    render(<App />);

    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    expect(document.documentElement).not.toHaveClass("light");
  });

  it("applies the saved light theme to the document root", async () => {
    window.voiceNoter.library.getCurrentLibrary = vi.fn().mockResolvedValue(mockLibraryState);
    window.voiceNoter.library.getLastLibrary = vi.fn().mockResolvedValue(mockLibraryState.path);
    window.voiceNoter.library.getSettings = vi.fn().mockResolvedValue({
      libraryPath: mockLibraryState.path,
      theme: "light" as const,
      defaultImportBehavior: "copy" as const,
      defaultModelId: null,
      transcriptionLanguage: "auto",
      modelStorageBytes: 0,
      installedModelCount: 0,
    });
    window.voiceNoter.queue.getSummary = vi.fn().mockResolvedValue(mockQueueSummary);
    window.voiceNoter.items.getFacets = vi.fn().mockResolvedValue({ tags: [] });

    render(<App />);

    await waitFor(() => expect(document.documentElement).toHaveClass("light"));
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("starts on the dashboard without eagerly loading the full item list", async () => {
    window.voiceNoter.library.getCurrentLibrary = vi.fn().mockResolvedValue(mockLibraryState);
    window.voiceNoter.library.getLastLibrary = vi.fn().mockResolvedValue(mockLibraryState.path);
    window.voiceNoter.queue.getSummary = vi.fn().mockResolvedValue(mockQueueSummary);
    window.voiceNoter.items.getFacets = vi.fn().mockResolvedValue({ tags: [] });

    render(<App />);

    expect(await screen.findByText("Library health at a glance")).toBeInTheDocument();
    expect(window.voiceNoter.items.listItems).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^Inbox$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /^Dashboard$/i })).toBeInTheDocument();
  });

  it("opens dashboard items in the focus page and back returns to the dashboard without loading All Items", async () => {
    const user = userEvent.setup();
    const dashboardItemDetail = {
      ...mockItemDetail,
      id: "item-2",
      title: "Queued Interview",
      sourceType: "video" as const,
      note: {
        ...mockItemDetail.note,
        itemId: "item-2",
        frontmatter: { id: "item-2", title: "Queued Interview" },
      },
      transcript: {
        ...mockItemDetail.transcript,
        itemId: "item-2",
      },
    };

    window.voiceNoter.library.getCurrentLibrary = vi.fn().mockResolvedValue(mockLibraryState);
    window.voiceNoter.library.getLastLibrary = vi.fn().mockResolvedValue(mockLibraryState.path);
    window.voiceNoter.queue.getSummary = vi.fn().mockResolvedValue(mockQueueSummary);
    window.voiceNoter.items.getFacets = vi.fn().mockResolvedValue({ tags: [] });
    window.voiceNoter.items.getItem = vi.fn().mockResolvedValue(dashboardItemDetail);

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /Queued Interview/i }));

    expect(await screen.findByRole("button", { name: /^Back$/i })).toBeInTheDocument();
    expect(screen.getByText("Full transcript")).toBeInTheDocument();
    expect(window.voiceNoter.items.listItems).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^Back$/i }));

    expect(await screen.findByText("Library health at a glance")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Back$/i })).toBeNull();
  });

  it("loads the first paged item list only when All Items is opened", async () => {
    const user = userEvent.setup();
    window.voiceNoter.library.getCurrentLibrary = vi.fn().mockResolvedValue(mockLibraryState);
    window.voiceNoter.library.getLastLibrary = vi.fn().mockResolvedValue(mockLibraryState.path);
    window.voiceNoter.queue.getSummary = vi.fn().mockResolvedValue(mockQueueSummary);
    window.voiceNoter.items.getFacets = vi.fn().mockResolvedValue({ tags: [] });
    window.voiceNoter.items.listItems = vi.fn().mockResolvedValue({ ...mockItemPage, items: [mockItemSummary] });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /^All Items$/i }));
    await waitFor(() =>
      expect(window.voiceNoter.items.listItems).toHaveBeenCalledWith(expect.objectContaining({ view: "all", limit: 50, offset: 0 })),
    );
  });

  it("keeps search inside All Items and scopes submitted searches to the active tag", async () => {
    const user = userEvent.setup();
    window.voiceNoter.library.getCurrentLibrary = vi.fn().mockResolvedValue(mockLibraryState);
    window.voiceNoter.library.getLastLibrary = vi.fn().mockResolvedValue(mockLibraryState.path);
    window.voiceNoter.queue.getSummary = vi.fn().mockResolvedValue(mockQueueSummary);
    window.voiceNoter.items.getFacets = vi.fn().mockResolvedValue({ tags: [{ id: "tag-1", name: "Follow-up", itemCount: 1 }] });
    window.voiceNoter.items.listItems = vi.fn().mockResolvedValue({ ...mockItemPage, items: [mockItemSummary] });
    window.voiceNoter.search.search = vi.fn().mockResolvedValue({
      items: [
        {
          itemId: "item-1",
          notePath: "/tmp/notes/test.md",
          title: "Test Recording",
          snippet: "matching text",
          source: "transcript",
          sourceType: "audio",
          status: "ready",
          startSeconds: 5,
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
      nextOffset: null,
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /Follow-up/i }));
    await waitFor(() =>
      expect(window.voiceNoter.items.listItems).toHaveBeenCalledWith(expect.objectContaining({ view: "tag", tagId: "tag-1", limit: 50, offset: 0 })),
    );

    await user.type(screen.getByPlaceholderText(/Search notes and transcripts/i), "matching text");
    await user.click(screen.getByRole("button", { name: /^Search$/i }));

    await waitFor(() =>
      expect(window.voiceNoter.search.search).toHaveBeenCalledWith(expect.objectContaining({ text: "matching text", tagId: "tag-1", limit: 50, offset: 0 })),
    );
    expect(screen.queryByRole("button", { name: /^Search Results$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /^All Items$/i })).toBeInTheDocument();
  });

  it("clearing search restores the active tag list instead of a separate search view", async () => {
    const user = userEvent.setup();
    window.voiceNoter.library.getCurrentLibrary = vi.fn().mockResolvedValue(mockLibraryState);
    window.voiceNoter.library.getLastLibrary = vi.fn().mockResolvedValue(mockLibraryState.path);
    window.voiceNoter.queue.getSummary = vi.fn().mockResolvedValue(mockQueueSummary);
    window.voiceNoter.items.getFacets = vi.fn().mockResolvedValue({ tags: [{ id: "tag-1", name: "Follow-up", itemCount: 1 }] });
    window.voiceNoter.items.listItems = vi
      .fn()
      .mockResolvedValueOnce({ ...mockItemPage, items: [mockItemSummary] })
      .mockResolvedValueOnce({ ...mockItemPage, items: [mockItemSummary] });
    window.voiceNoter.search.search = vi.fn().mockResolvedValue({
      items: [
        {
          itemId: "item-1",
          notePath: "/tmp/notes/test.md",
          title: "Test Recording",
          snippet: "matching text",
          source: "transcript",
          sourceType: "audio",
          status: "ready",
          startSeconds: 5,
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
      nextOffset: null,
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /Follow-up/i }));
    await waitFor(() =>
      expect(window.voiceNoter.items.listItems).toHaveBeenCalledWith(expect.objectContaining({ view: "tag", tagId: "tag-1", limit: 50, offset: 0 })),
    );

    const searchInput = screen.getByPlaceholderText(/Search notes and transcripts/i);
    await user.type(searchInput, "matching text");
    await user.click(screen.getByRole("button", { name: /^Search$/i }));
    await waitFor(() => expect(window.voiceNoter.search.search).toHaveBeenCalled());

    await user.clear(searchInput);
    await user.click(screen.getByRole("button", { name: /^Search$/i }));

    await waitFor(() =>
      expect(window.voiceNoter.items.listItems).toHaveBeenLastCalledWith(expect.objectContaining({ view: "tag", tagId: "tag-1", limit: 50, offset: 0 })),
    );
    expect(screen.queryByRole("button", { name: /^Search Results$/i })).toBeNull();
  });

  it("opens search results in the focus page and back preserves the search text", async () => {
    const user = userEvent.setup();
    window.voiceNoter.library.getCurrentLibrary = vi.fn().mockResolvedValue(mockLibraryState);
    window.voiceNoter.library.getLastLibrary = vi.fn().mockResolvedValue(mockLibraryState.path);
    window.voiceNoter.queue.getSummary = vi.fn().mockResolvedValue(mockQueueSummary);
    window.voiceNoter.items.getFacets = vi.fn().mockResolvedValue({ tags: [] });
    window.voiceNoter.search.search = vi.fn().mockResolvedValue({
      items: [{ itemId: "item-1", notePath: "/tmp/notes/test.md", title: "Test Recording", snippet: "matching text", source: "transcript", sourceType: "audio", status: "ready", startSeconds: 5 }],
      total: 1,
      limit: 50,
      offset: 0,
      nextOffset: null,
    });
    window.voiceNoter.items.getItem = vi.fn().mockResolvedValue(mockItemDetail);

    render(<App />);

    await user.type(await screen.findByPlaceholderText(/Search notes and transcripts/i), "matching text");
    await user.click(screen.getByRole("button", { name: /^Search$/i }));
    await user.click(await screen.findByRole("button", { name: /Test Recording/i }));

    expect(await screen.findByRole("button", { name: /^Back$/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Back$/i }));

    await waitFor(() => expect(screen.getAllByText("All Items").length).toBeGreaterThan(0));
    expect(screen.getByDisplayValue("matching text")).toBeInTheDocument();
  });

  it("opens a library without a selected model on Model Manager and blocks imports until selection succeeds", async () => {
    const user = userEvent.setup();
    let selectedModelId: "base" | null = null;
    const installedModel: ModelInfo = {
      ...mockModelInfo,
      id: "base",
      name: "Base",
      status: "installed",
      localPath: "/tmp/test-library/models/ggml-base.bin",
      selected: false,
    };

    window.voiceNoter.library.getCurrentLibrary = vi.fn().mockImplementation(async () => ({
      ...mockLibraryState,
      selectedModelId,
    }));
    window.voiceNoter.library.getLastLibrary = vi.fn().mockResolvedValue(mockLibraryState.path);
    window.voiceNoter.models.listModels = vi.fn().mockImplementation(async () => [
      {
        ...installedModel,
        selected: selectedModelId === "base",
      },
    ]);
    window.voiceNoter.models.setDefaultModel = vi.fn().mockImplementation(async () => {
      selectedModelId = "base";
      return {
        ...installedModel,
        selected: true,
      };
    });

    const renderResult = render(<App />);

    expect(await screen.findByText("Download one local model before transcription.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Import$/i })).toBeDisabled();
    expect(screen.getAllByText(/Select a transcription model in Model Manager before importing\./i).length).toBeGreaterThan(0);

    fireEvent.drop(renderResult.container.firstElementChild as Element, {
      dataTransfer: {
        files: [{ path: "/tmp/drop/lecture.mp3" }],
      },
    });

    expect(window.voiceNoter.import.importFiles).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Select a transcription model in Model Manager before importing\./i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /^Select$/i }));

    await waitFor(() => expect(window.voiceNoter.models.setDefaultModel).toHaveBeenCalledWith("base"));
    await waitFor(() => expect(screen.getByRole("button", { name: /^Import$/i })).toBeEnabled());
    expect(screen.getAllByText("Model Manager").length).toBeGreaterThan(0);
  });

  it("confirms before leaving the focus page with unsaved transcript edits", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    window.voiceNoter.library.getCurrentLibrary = vi.fn().mockResolvedValue(mockLibraryState);
    window.voiceNoter.library.getLastLibrary = vi.fn().mockResolvedValue(mockLibraryState.path);
    window.voiceNoter.queue.getSummary = vi.fn().mockResolvedValue(mockQueueSummary);
    window.voiceNoter.items.getFacets = vi.fn().mockResolvedValue({ tags: [] });
    window.voiceNoter.items.getItem = vi.fn().mockResolvedValue(mockItemDetail);
    window.voiceNoter.items.listItems = vi.fn().mockResolvedValue({ ...mockItemPage, items: [mockItemSummary] });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /^All Items$/i }));
    await user.click(await screen.findByRole("button", { name: /Test Recording/i }));
    const transcriptEditor = (await screen.findByDisplayValue("Hello world")) as HTMLTextAreaElement;
    await user.clear(transcriptEditor);
    await user.type(transcriptEditor, "Edited transcript line");

    await user.click(screen.getByRole("button", { name: /^Dashboard$/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^Back$/i })).toBeInTheDocument();

    confirmSpy.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: /^Dashboard$/i }));

    expect(confirmSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(await screen.findByText("Library health at a glance")).toBeInTheDocument();
  });
});
