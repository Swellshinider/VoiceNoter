// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemDetail } from "./ItemDetail";
import { createMockApi, mockItemDetail } from "./test-utils";

describe("ItemDetail", () => {
  beforeEach(() => {
    window.voiceNoter = createMockApi();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    if (!("fastSeek" in HTMLMediaElement.prototype)) {
      Object.defineProperty(HTMLMediaElement.prototype, "fastSeek", {
        configurable: true,
        value: vi.fn(),
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows placeholder when no item selected", () => {
    render(<ItemDetail item={null} jumpToSeconds={null} onReload={vi.fn()} />);
    expect(screen.getAllByText("Select an item.")[0]).toBeInTheDocument();
  });

  it("shows loading spinner when isLoading and no item", () => {
    render(<ItemDetail item={null} jumpToSeconds={null} isLoading onReload={vi.fn()} />);
    expect(screen.getAllByText("Loading...")[0]).toBeInTheDocument();
  });

  it("keeps timestamps visible and updates the full transcript mirror from draft edits", async () => {
    const user = userEvent.setup();
    render(<ItemDetail item={mockItemDetail} jumpToSeconds={null} onReload={vi.fn()} />);

    expect(screen.getByText("00:00:00")).toBeInTheDocument();
    expect(screen.getByText("00:00:05")).toBeInTheDocument();

    await user.clear(screen.getByDisplayValue("Hello world"));
    await user.type(screen.getByDisplayValue(""), "Hello corrected world");

    expect(screen.getAllByText(/Hello corrected world/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Full transcript")).toBeInTheDocument();
  });

  it("saves edited transcript segments through the shared API", async () => {
    const user = userEvent.setup();
    const updateTranscript = vi.fn().mockResolvedValue({
      ...mockItemDetail,
      transcript: {
        ...mockItemDetail.transcript,
        rawText: "Hello corrected world this is a corrected test.",
        segments: [
          { startSeconds: 0, endSeconds: 5, text: "Hello corrected world" },
          { startSeconds: 5, endSeconds: 10, text: "this is a corrected test." },
        ],
      },
    });
    (window.voiceNoter.items as typeof window.voiceNoter.items & { updateTranscript: typeof updateTranscript }).updateTranscript = updateTranscript;

    render(<ItemDetail item={mockItemDetail} jumpToSeconds={null} onReload={vi.fn()} />);

    await user.clear(screen.getByDisplayValue("Hello world"));
    await user.type(screen.getByDisplayValue(""), "Hello corrected world");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() =>
      expect(updateTranscript).toHaveBeenCalledWith("item-1", {
        segments: [
          { startSeconds: 0, endSeconds: 5, text: "Hello corrected world" },
          { startSeconds: 5, endSeconds: 10, text: "this is a test." },
        ],
      }),
    );
    expect(screen.getAllByText(/Hello corrected world/i).length).toBeGreaterThan(0);
  });

  it("restores the persisted transcript when cancel is pressed", async () => {
    const user = userEvent.setup();
    render(<ItemDetail item={mockItemDetail} jumpToSeconds={null} onReload={vi.fn()} />);

    await user.clear(screen.getByDisplayValue("Hello world"));
    await user.type(screen.getByDisplayValue(""), "Discard me");
    await user.click(screen.getByRole("button", { name: /^Cancel$/i }));

    expect(screen.getByDisplayValue("Hello world")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Discard me")).toBeNull();
  });

  it("disables transcript editing when an item has no transcript yet", () => {
    render(
      <ItemDetail
        item={{
          ...mockItemDetail,
          transcript: null,
        }}
        jumpToSeconds={null}
        onReload={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/Transcript will appear after local transcription completes\./i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^Save$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Cancel$/i })).toBeDisabled();
  });

  it("seeks to the exact segment timestamp and starts playback when a transcript segment is clicked", async () => {
    const user = userEvent.setup();
    const fastSeek = vi.fn();
    Object.defineProperty(HTMLMediaElement.prototype, "fastSeek", {
      configurable: true,
      value: fastSeek,
    });

    render(<ItemDetail item={mockItemDetail} jumpToSeconds={null} onReload={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /00:00:05/i }));

    expect(fastSeek).toHaveBeenCalledWith(5);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it("highlights the transcript segment that matches playback time and jump-to-seconds", () => {
    render(<ItemDetail item={mockItemDetail} jumpToSeconds={5} onReload={vi.fn()} />);
    const audio = document.querySelector("audio");
    expect(audio).not.toBeNull();

    if (!audio) {
      return;
    }

    fireEvent.play(audio);
    audio.currentTime = 5;
    fireEvent.timeUpdate(audio);

    expect(screen.getByRole("button", { name: /00:00:05/i })).toHaveAttribute("aria-current", "true");
  });
});
