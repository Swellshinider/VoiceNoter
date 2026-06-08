// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetupView } from "./SetupView";

describe("SetupView", () => {
  it("shows the app purpose and the two main actions", () => {
    render(<SetupView lastLibraryPath={null} onChooseLibrary={vi.fn()} />);

    expect(screen.getByText("VoiceNoter")).toBeInTheDocument();
    expect(screen.getByText(/Open a library to manage local media imports/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Choose Library/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open Last Library/i })).not.toBeInTheDocument();
  });

  it("shows and opens the last library when available", async () => {
    const user = userEvent.setup();
    const onOpenLastLibrary = vi.fn();

    render(<SetupView lastLibraryPath="/tmp/voice-library" onChooseLibrary={vi.fn()} onOpenLastLibrary={onOpenLastLibrary} />);

    expect(screen.getByText("/tmp/voice-library")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Open Last Library/i }));

    expect(onOpenLastLibrary).toHaveBeenCalled();
  });

  it("calls onChooseLibrary when the primary action is clicked", async () => {
    const user = userEvent.setup();
    const onChooseLibrary = vi.fn();

    render(<SetupView lastLibraryPath={null} onChooseLibrary={onChooseLibrary} />);
    await user.click(screen.getByRole("button", { name: /Choose Library/i }));

    expect(onChooseLibrary).toHaveBeenCalled();
  });
});
