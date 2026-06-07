// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardView } from "./DashboardView";
import { mockDashboardSummary } from "./test-utils";

describe("DashboardView", () => {
  it("renders summary cards and latest items", () => {
    render(<DashboardView summary={mockDashboardSummary} onSelectItem={vi.fn()} onOpenQueue={vi.fn()} />);

    expect(screen.getByText("Library health at a glance")).toBeInTheDocument();
    expect(screen.getByText("Total files")).toBeInTheDocument();
    expect(screen.getByText("1.4 GB")).toBeInTheDocument();
    expect(screen.getByText("Latest transcriptions")).toBeInTheDocument();
    expect(screen.getByText("Test Recording")).toBeInTheDocument();
  });

  it("calls onSelectItem when a recent file is clicked", async () => {
    const user = userEvent.setup();
    const onSelectItem = vi.fn();

    render(<DashboardView summary={mockDashboardSummary} onSelectItem={onSelectItem} onOpenQueue={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Queued Interview/i }));

    expect(onSelectItem).toHaveBeenCalledWith("item-2");
  });
});
