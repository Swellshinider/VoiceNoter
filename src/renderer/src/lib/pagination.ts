import type { PageResult } from "../../../shared/types";

export type PagedState<T> = {
  page: PageResult<T> | null;
  isLoading: boolean;
  isLoadingMore: boolean;
};

export function createPagedState<T>(): PagedState<T> {
  return {
    page: null,
    isLoading: false,
    isLoadingMore: false,
  };
}
