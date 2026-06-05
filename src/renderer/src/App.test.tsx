// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../../shared/types";
import { App } from "./App";
import { createMockApi, mockItemDetail, mockItemSummary, mockJob, mockLibraryState } from "./components/test-utils";

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
    let jobsListener: ((jobs: Job[]) => void) | null = null;
    const detailWithoutTranscript = { ...mockItemDetail, status: "processing" as const, transcript: null, note: null };
    const detailWithTranscript = { ...mockItemDetail, status: "ready" as const };

    window.voiceNoter.library.getCurrentLibrary = vi.fn().mockResolvedValue(mockLibraryState);
    window.voiceNoter.library.getLastLibrary = vi.fn().mockResolvedValue(mockLibraryState.path);
    window.voiceNoter.queue.listJobs = vi.fn().mockResolvedValue([initialJob]);
    window.voiceNoter.queue.subscribeToJobs = vi.fn((callback: (jobs: Job[]) => void) => {
      jobsListener = callback;
      return () => {};
    });
    window.voiceNoter.items.listItems = vi.fn().mockResolvedValue([{ ...mockItemSummary, status: "processing" }]);
    window.voiceNoter.items.getItem = vi.fn().mockResolvedValueOnce(detailWithoutTranscript).mockResolvedValueOnce(detailWithTranscript);

    render(<App />);

    await userEvent.click(await screen.findByText("Test Recording"));
    await waitFor(() => expect(window.voiceNoter.items.getItem).toHaveBeenCalledTimes(1));

    act(() => {
      jobsListener?.([initialJob]);
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(window.voiceNoter.items.getItem).toHaveBeenCalledTimes(1);

    act(() => {
      jobsListener?.([completedJob]);
    });
    await waitFor(() => expect(window.voiceNoter.items.getItem).toHaveBeenCalledTimes(2));

    act(() => {
      jobsListener?.([completedJob]);
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

    render(<App />);

    await waitFor(() => expect(document.documentElement).toHaveClass("light"));
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("lands on the dashboard instead of the inbox view", async () => {
    window.voiceNoter.library.getCurrentLibrary = vi.fn().mockResolvedValue(mockLibraryState);
    window.voiceNoter.library.getLastLibrary = vi.fn().mockResolvedValue(mockLibraryState.path);

    render(<App />);

    expect(await screen.findByText("Library health at a glance")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Inbox$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /^Dashboard$/i })).toBeInTheDocument();
  });
});
