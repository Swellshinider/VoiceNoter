import { useMemo } from "react";
import type { ItemSummary, SearchResult } from "../../../shared/types";
import { Badge, Button, Spinner } from "./ui";

export function ItemList({
  items,
  selectedItemId,
  searchResults,
  activeFilterLabel,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  onSelectItem,
}: {
  items: ItemSummary[];
  selectedItemId: string | null;
  searchResults: SearchResult[];
  activeFilterLabel?: string;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onSelectItem: (itemId: string, startSeconds?: number | null) => void;
}) {
  const searchByItem = useMemo(() => new Map(searchResults.map((result) => [result.itemId, result])), [searchResults]);
  return (
    <section className="flex h-full w-80 shrink-0 flex-col border-r border-border bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background p-3 text-sm font-medium">
        {searchResults.length ? "Search Results" : activeFilterLabel ?? "Items"}
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
                  onClick={() => onSelectItem(item.id, result?.startSeconds)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-medium">{item.title}</div>
                    <Badge tone={item.status === "ready" ? "success" : item.status === "failed" ? "danger" : "warning"}>{item.status}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.sourceType} {item.durationSeconds ? `· ${item.durationSeconds}s` : ""}
                  </div>
                  {result ? <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">{result.snippet}</div> : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.category ? <Badge>{item.category.name}</Badge> : null}
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
