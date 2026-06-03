// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemList } from "./ItemList";
import { mockItemSummary } from "./test-utils";

describe("ItemList", () => {
  it("shows empty state when no items", () => {
    render(<ItemList items={[]} selectedItemId={null} searchResults={[]} onSelectItem={vi.fn()} />);
    expect(screen.getAllByText("No items yet.")[0]).toBeInTheDocument();
  });

  it("renders item rows with title and status badge", () => {
    render(<ItemList items={[mockItemSummary]} selectedItemId={null} searchResults={[]} onSelectItem={vi.fn()} />);
    expect(screen.getAllByText("Test Recording")[0]).toBeInTheDocument();
    expect(screen.getAllByText("ready")[0]).toBeInTheDocument();
  });

  it("clicking an item calls onSelectItem with item ID", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ItemList items={[mockItemSummary]} selectedItemId={null} searchResults={[]} onSelectItem={onSelect} />);
    await user.click(screen.getAllByRole("button", { name: /Test Recording/ })[0]);
    expect(onSelect).toHaveBeenCalledWith("item-1", undefined);
  });

  it("shows search result snippets when provided", () => {
    const results = [{ itemId: "item-1", notePath: "/tmp/test.md", title: "Test", snippet: "matching text", source: "transcript" as const, startSeconds: 5 }];
    render(<ItemList items={[mockItemSummary]} selectedItemId={null} searchResults={results} onSelectItem={vi.fn()} />);
    expect(screen.getAllByText("matching text")[0]).toBeInTheDocument();
  });

  it("clicking a search result passes startSeconds", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const results = [{ itemId: "item-1", notePath: "/tmp/test.md", title: "Test", snippet: "match", source: "transcript" as const, startSeconds: 42 }];
    render(<ItemList items={[mockItemSummary]} selectedItemId={null} searchResults={results} onSelectItem={onSelect} />);
    await user.click(screen.getAllByRole("button", { name: /Test Recording/ })[0]);
    expect(onSelect).toHaveBeenCalledWith("item-1", 42);
  });

  it("shows loading spinner when isLoading is true and no items", () => {
    render(<ItemList items={[]} selectedItemId={null} searchResults={[]} isLoading onSelectItem={vi.fn()} />);
    expect(screen.getAllByText("Loading items...")[0]).toBeInTheDocument();
  });

  it("shows active filter label", () => {
    render(<ItemList items={[]} selectedItemId={null} searchResults={[]} activeFilterLabel="My Category" onSelectItem={vi.fn()} />);
    expect(screen.getAllByText("My Category")[0]).toBeInTheDocument();
  });
});
