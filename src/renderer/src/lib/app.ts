import type { ItemSummary, PageResult, SearchResult } from "../../../shared/types";
import type { ToastEntry } from "../components/ui";

type ToastableError = {
  title?: string;
  message?: string;
  technicalDetails?: string;
};

export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function normalizeToastError(
  error: unknown,
  fallbackTitle: string,
  fallbackMessage: string,
): Omit<ToastEntry, "id"> {
  const maybeError = error as ToastableError | undefined;
  return {
    variant: "error",
    title: maybeError?.title ?? fallbackTitle,
    message: maybeError?.message ?? fallbackMessage,
    technicalDetails: maybeError?.technicalDetails,
  };
}

export function mapSearchResultToItemSummary(result: SearchResult): ItemSummary {
  return {
    id: result.itemId,
    title: result.title,
    sourceType: result.sourceType,
    status: result.status,
    notePath: result.notePath,
    durationSeconds: null,
    category: null,
    tags: [],
    importedAt: "",
    updatedAt: "",
  };
}

export function mergePageResults<T>(previous: PageResult<T> | null, next: PageResult<T>, append: boolean): PageResult<T> {
  if (!append || !previous) {
    return next;
  }
  return {
    ...next,
    items: [...previous.items, ...next.items],
  };
}

