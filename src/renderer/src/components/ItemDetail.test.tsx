// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemDetail } from "./ItemDetail";
import { mockItemDetail, createMockApi } from "./test-utils";

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string; onChange: (val: string) => void }) => (
    <textarea data-testid="codemirror-mock" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

describe("ItemDetail", () => {
  beforeEach(() => {
    window.voiceNoter = createMockApi();
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

  it("shows markdown editor when note exists", () => {
    render(<ItemDetail item={mockItemDetail} jumpToSeconds={null} onReload={vi.fn()} />);
    expect(screen.getAllByTestId("codemirror-mock")[0]).toBeInTheDocument();
  });

  it("title input is rendered with item title", () => {
    render(<ItemDetail item={mockItemDetail} jumpToSeconds={null} onReload={vi.fn()} />);
    expect(screen.getAllByDisplayValue("Test Recording")[0]).toBeInTheDocument();
  });
});
