// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job, QueueUpdate } from "../../shared/types";
import { App } from "./App";
import { createMockApi, mockItemDetail, mockItemPage, mockItemSummary, mockJob, mockLibraryState, mockQueuePage, mockQueueSummary } from "./components/test-utils";

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string; onChange: (val: string) => void }) => (
    <textarea data-testid="codemirror-mock" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

describe("App", () => {
  beforeEach(() => {
    window.voiceNoter = createMockApi();
    document.documentElement.className = "";
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
    window.voiceNoter.items.listItems = vi.fn().mockResolvedValue({ ...mockItemPage, items: [{ ...mockItemSummary, status: "processing" }] });
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

    act(() => {
      queueListener?.({
        changedJobs: [completedJob],
        summary: { ...mockQueueSummary, completedJobs: 2, activeJobs: 1 },
      });
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(window.voiceNoter.items.getItem).toHaveBeenCalledTimes(2);
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
    window.voiceNoter.items.getFacets = vi.fn().mockResolvedValue({ categories: [], tags: [] });

    render(<App />);

    await waitFor(() => expect(document.documentElement).toHaveClass("light"));
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("starts on the dashboard without eagerly loading the full item list", async () => {
    window.voiceNoter.library.getCurrentLibrary = vi.fn().mockResolvedValue(mockLibraryState);
    window.voiceNoter.library.getLastLibrary = vi.fn().mockResolvedValue(mockLibraryState.path);
    window.voiceNoter.queue.getSummary = vi.fn().mockResolvedValue(mockQueueSummary);
    window.voiceNoter.items.getFacets = vi.fn().mockResolvedValue({ categories: [], tags: [] });

    render(<App />);

    expect(await screen.findByText("Library health at a glance")).toBeInTheDocument();
    expect(window.voiceNoter.items.listItems).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^Inbox$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /^Dashboard$/i })).toBeInTheDocument();
  });

  it("opens dashboard items in All Items and keeps the dashboard overview-only", async () => {
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
    window.voiceNoter.items.getFacets = vi.fn().mockResolvedValue({ categories: [], tags: [] });
    window.voiceNoter.items.listItems = vi.fn().mockResolvedValue({ ...mockItemPage, items: [{ ...mockItemSummary, id: "item-2", title: "Queued Interview", sourceType: "video", status: "pending" }] });
    window.voiceNoter.items.getItem = vi.fn().mockResolvedValue(dashboardItemDetail);

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /Queued Interview/i }));

    await waitFor(() => expect(window.voiceNoter.items.listItems).toHaveBeenCalledWith(expect.objectContaining({ view: "all", limit: 50, offset: 0 })));
    expect(screen.getByText("Transcript")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Dashboard$/i }));

    expect(screen.getByText("Library health at a glance")).toBeInTheDocument();
    expect(screen.queryByText("Transcript")).toBeNull();
  });

  it("loads the first paged item list only when All Items is opened", async () => {
    const user = userEvent.setup();
    window.voiceNoter.library.getCurrentLibrary = vi.fn().mockResolvedValue(mockLibraryState);
    window.voiceNoter.library.getLastLibrary = vi.fn().mockResolvedValue(mockLibraryState.path);
    window.voiceNoter.queue.getSummary = vi.fn().mockResolvedValue(mockQueueSummary);
    window.voiceNoter.items.getFacets = vi.fn().mockResolvedValue({ categories: [], tags: [] });
    window.voiceNoter.items.listItems = vi.fn().mockResolvedValue({ ...mockItemPage, items: [mockItemSummary] });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /^All Items$/i }));
    await waitFor(() => expect(window.voiceNoter.items.listItems).toHaveBeenCalledWith(expect.objectContaining({ view: "all", limit: 50, offset: 0 })));
  });
});
