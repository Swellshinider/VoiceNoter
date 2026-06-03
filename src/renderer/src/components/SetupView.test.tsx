// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetupView } from "./SetupView";
import { mockLibraryState, mockModelInfo } from "./test-utils";

describe("SetupView", () => {
  it("shows library selection button", () => {
    render(<SetupView library={null} models={[]} onChooseLibrary={vi.fn()} />);
    expect(screen.getAllByText("Choose Library")[0]).toBeInTheDocument();
  });

  it("shows needed badges when no library is set", () => {
    render(<SetupView library={null} models={[]} onChooseLibrary={vi.fn()} />);
    const badges = screen.getAllByText("Needed");
    expect(badges.length).toBeGreaterThanOrEqual(3);
  });

  it("shows ready badges when library, ffmpeg, and model are all set", () => {
    const library = { ...mockLibraryState, ffmpegStatus: "available" as const, selectedModelId: "base" as const };
    const model = { ...mockModelInfo, status: "installed" as const, selected: true };
    render(<SetupView library={library} models={[model]} onChooseLibrary={vi.fn()} />);
    const badges = screen.getAllByText("Ready");
    expect(badges.length).toBeGreaterThanOrEqual(3);
  });

  it("calls onChooseLibrary when button is clicked", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<SetupView library={null} models={[]} onChooseLibrary={onChoose} />);
    await user.click(screen.getAllByText("Choose Library")[0]);
    expect(onChoose).toHaveBeenCalled();
  });

  it("shows the last library option when a last library path exists", () => {
    render(
      <SetupView
        library={null}
        models={[]}
        lastLibraryPath="/tmp/voice-library"
        onChooseLibrary={vi.fn()}
        onOpenLastLibrary={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Open Last Library/ })).toBeInTheDocument();
    expect(screen.getByText("/tmp/voice-library")).toBeInTheDocument();
  });

  it("does not show the last library option without a last library path", () => {
    render(<SetupView library={null} models={[]} onChooseLibrary={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /Open Last Library/ })).not.toBeInTheDocument();
  });

  it("calls onOpenLastLibrary when the last library button is clicked", async () => {
    const user = userEvent.setup();
    const onOpenLastLibrary = vi.fn();
    render(
      <SetupView
        library={null}
        models={[]}
        lastLibraryPath="/tmp/voice-library"
        onChooseLibrary={vi.fn()}
        onOpenLastLibrary={onOpenLastLibrary}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Open Last Library/ }));

    expect(onOpenLastLibrary).toHaveBeenCalled();
  });

  it("shows download model prompt when no model is selected", () => {
    const model = { ...mockModelInfo, status: "available" as const, selected: false };
    render(<SetupView library={mockLibraryState} models={[model]} onChooseLibrary={vi.fn()} onDownloadModel={vi.fn()} />);
    expect(screen.getAllByText("Download a transcription model to get started")[0]).toBeInTheDocument();
  });

  it("shows recommended badge on base model", () => {
    const model = { ...mockModelInfo, status: "available" as const, selected: false };
    render(<SetupView library={mockLibraryState} models={[model]} onChooseLibrary={vi.fn()} onDownloadModel={vi.fn()} />);
    expect(screen.getAllByText("recommended")[0]).toBeInTheDocument();
  });

  it("shows ffmpeg unavailable message when missing", () => {
    const library = { ...mockLibraryState, ffmpegStatus: "missing" as const };
    render(<SetupView library={library} models={[]} onChooseLibrary={vi.fn()} />);
    expect(screen.getAllByText(/Not available/)[0]).toBeInTheDocument();
  });
});
