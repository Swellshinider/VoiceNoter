// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemDetail } from "./ItemDetail";
import { mockItemDetail, createMockApi } from "./test-utils";

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

  it("renders item title", () => {
    render(<ItemDetail item={mockItemDetail} jumpToSeconds={null} onReload={vi.fn()} />);
    expect(screen.getAllByDisplayValue("Test Recording")[0]).toBeInTheDocument();
  });

  it("shows transcript segments with timestamps", () => {
    render(<ItemDetail item={mockItemDetail} jumpToSeconds={null} onReload={vi.fn()} />);
    expect(screen.getAllByText("00:00:00")[0]).toBeInTheDocument();
    expect(screen.getAllByText("00:00:05")[0]).toBeInTheDocument();
  });

  it("does not render the markdown editor or save controls", () => {
    render(<ItemDetail item={mockItemDetail} jumpToSeconds={null} onReload={vi.fn()} />);
    expect(screen.queryByTestId("codemirror-mock")).toBeNull();
    expect(screen.queryByRole("button", { name: /save/i })).toBeNull();
  });

  it("uses the main-process media URL for playback", () => {
    render(<ItemDetail item={mockItemDetail} jumpToSeconds={null} onReload={vi.fn()} />);
    expect(document.querySelector("audio")?.getAttribute("src")).toBe("voicenoter-media://items/item-1/media");
  });

  it("title input is rendered with item title", () => {
    render(<ItemDetail item={mockItemDetail} jumpToSeconds={null} onReload={vi.fn()} />);
    expect(screen.getAllByDisplayValue("Test Recording")[0]).toBeInTheDocument();
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

  it("highlights the transcript segment that matches playback time", () => {
    render(<ItemDetail item={mockItemDetail} jumpToSeconds={null} onReload={vi.fn()} />);
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
