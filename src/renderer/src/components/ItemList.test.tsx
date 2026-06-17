// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemList } from "./ItemList";
import { mockItemSummary, mockSearchResult } from "./test-utils";

describe("ItemList", () => {
  it("shows empty state when no items", () => {
    render(<ItemList items={[]} selectedItemId={null} selectedItemIds={[]} searchResults={[]} onSelectItem={vi.fn()} hasMore={false} />);
    expect(screen.getAllByText("No items yet.")[0]).toBeInTheDocument();
  });

  it("renders item rows with title and status badge", () => {
    render(<ItemList items={[mockItemSummary]} selectedItemId={null} selectedItemIds={[]} searchResults={[]} onSelectItem={vi.fn()} hasMore={false} />);
    expect(screen.getAllByText("Test Recording")[0]).toBeInTheDocument();
    expect(screen.getAllByText("ready")[0]).toBeInTheDocument();
  });

  it("clicking an item calls onSelectItem with item ID", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ItemList items={[mockItemSummary]} selectedItemId={null} selectedItemIds={[]} searchResults={[]} onSelectItem={onSelect} hasMore={false} />);
    await user.click(screen.getAllByRole("button", { name: /Test Recording/ })[0]);
    expect(onSelect).toHaveBeenCalledWith("item-1", undefined);
  });

  it("shows search result snippets when provided", () => {
    render(
      <ItemList items={[{ ...mockItemSummary, ...mockSearchResult }]} selectedItemId={null} selectedItemIds={[]} searchResults={[mockSearchResult]} onSelectItem={vi.fn()} hasMore={false} />,
    );
    expect(screen.getAllByText("matching text")[0]).toBeInTheDocument();
  });

  it("clicking a search result passes startSeconds", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const results = [{ ...mockSearchResult, startSeconds: 42, snippet: "match" }];
    render(
      <ItemList items={[{ ...mockItemSummary, ...results[0] }]} selectedItemId={null} selectedItemIds={[]} searchResults={results} onSelectItem={onSelect} hasMore={false} />,
    );
    await user.click(screen.getAllByRole("button", { name: /Test Recording/ })[0]);
    expect(onSelect).toHaveBeenCalledWith("item-1", 42);
  });

  it("shows loading spinner when isLoading is true and no items", () => {
    render(<ItemList items={[]} selectedItemId={null} selectedItemIds={[]} searchResults={[]} isLoading onSelectItem={vi.fn()} hasMore={false} />);
    expect(screen.getAllByText("Loading items...")[0]).toBeInTheDocument();
  });

  it("shows active filter label", () => {
    render(<ItemList items={[]} selectedItemId={null} selectedItemIds={[]} searchResults={[]} activeFilterLabel="my tag" onSelectItem={vi.fn()} hasMore={false} />);
    expect(screen.getByText("Tag: my tag")).toBeInTheDocument();
  });

  it("shows load more when more items are available", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(<ItemList items={[mockItemSummary]} selectedItemId={null} selectedItemIds={[]} searchResults={[]} onSelectItem={vi.fn()} hasMore onLoadMore={onLoadMore} />);
    await user.click(screen.getByRole("button", { name: /Load more/i }));
    expect(onLoadMore).toHaveBeenCalled();
  });
});
