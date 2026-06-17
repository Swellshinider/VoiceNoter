import { useMemo } from "react";
import type { ItemSummary, SearchResult } from "../../../shared/types";
import { Badge, Button, Spinner } from "./ui";

export function ItemList({
  items,
  selectedItemId,
  selectedItemIds,
  searchResults,
  searchText,
  activeFilterLabel,
  isLoading,
  isLoadingMore,
  hasMore,
  isSelectionMode,
  selectionEnabled,
  onLoadMore,
  onToggleSelectionMode,
  onToggleSelectAllVisible,
  onToggleItemSelection,
  onOpenBulkAssign,
  onOpenBulkRemove,
  onSelectItem,
  fullWidth,
}: {
  items: ItemSummary[];
  selectedItemId: string | null;
  selectedItemIds: string[];
  searchResults: SearchResult[];
  searchText?: string;
  activeFilterLabel?: string;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  isSelectionMode?: boolean;
  selectionEnabled?: boolean;
  onLoadMore?: () => void;
  onToggleSelectionMode?: () => void;
  onToggleSelectAllVisible?: () => void;
  onToggleItemSelection?: (itemId: string) => void;
  onOpenBulkAssign?: () => void;
  onOpenBulkRemove?: () => void;
  onSelectItem: (itemId: string, startSeconds?: number | null) => void;
  fullWidth?: boolean;
}) {
  const searchByItem = useMemo(() => new Map(searchResults.map((result) => [result.itemId, result])), [searchResults]);
  const resultCount = searchText ? searchResults.length : null;
  return (
    <section className={`flex h-full flex-col bg-background ${fullWidth ? "w-full" : "w-80 shrink-0 border-r border-border"}`}>
      <div className="sticky top-0 z-10 border-b border-border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">All Items</div>
          {selectionEnabled ? (
            <div className="flex flex-wrap gap-2">
              {isSelectionMode ? (
                <>
                  <Button variant="secondary" onClick={() => onToggleSelectAllVisible?.()}>
                    Select visible
                  </Button>
                  <Button disabled={selectedItemIds.length === 0} onClick={() => onOpenBulkAssign?.()}>
                    Assign tags
                  </Button>
                  <Button variant="secondary" disabled={selectedItemIds.length === 0} onClick={() => onOpenBulkRemove?.()}>
                    Remove tags
                  </Button>
                  <Button variant="secondary" onClick={() => onToggleSelectionMode?.()}>
                    Done
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => onToggleSelectionMode?.()}>
                  Select
                </Button>
              )}
            </div>
          ) : null}
        </div>
        {activeFilterLabel || searchText ? (
          <div className="mt-1 text-xs text-muted-foreground">
            {activeFilterLabel ? `Tag: ${activeFilterLabel}` : null}
            {activeFilterLabel && searchText ? " · " : null}
            {searchText ? `${resultCount ?? 0} results for "${searchText}"` : null}
          </div>
        ) : null}
        {isSelectionMode ? <div className="mt-1 text-xs text-muted-foreground">{selectedItemIds.length} selected</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col">
          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading items...
            </div>
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No items yet.</div>
          ) : (
            items.map((item) => {
              const result = searchByItem.get(item.id);
              return (
                <button
                  key={item.id}
                  className={`border-b border-border p-3 text-left transition hover:bg-secondary ${
                    selectedItemId === item.id ? "bg-secondary" : "bg-background"
                  }`}
                  onClick={() => {
                    if (isSelectionMode) {
                      onToggleItemSelection?.(item.id);
                      return;
                    }
                    onSelectItem(item.id, result?.startSeconds);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {isSelectionMode ? (
                        <input
                          checked={selectedItemIds.includes(item.id)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => onToggleItemSelection?.(item.id)}
                          type="checkbox"
                        />
                      ) : null}
                      <div className="truncate text-sm font-medium">{item.title}</div>
                    </div>
                    <Badge tone={item.status === "ready" ? "success" : item.status === "failed" ? "danger" : "warning"}>{item.status}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.sourceType} {item.durationSeconds ? `· ${item.durationSeconds}s` : ""}
                  </div>
                  {result ? <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">{result.snippet}</div> : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <Badge key={tag.id}>{tag.name}</Badge>
                    ))}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
      {hasMore || isLoadingMore ? (
        <div className="border-t border-border p-3">
          <Button variant="secondary" className="w-full" disabled={!hasMore || isLoadingMore} onClick={() => onLoadMore?.()}>
            {isLoadingMore ? (
              <>
                <Spinner className="size-4" />
                Loading more
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
