import { Import, Search as SearchIcon } from "lucide-react";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type {
  CountedTag,
  DashboardStorageBreakdown,
  DashboardSummary,
  ItemDetail,
  ItemFacets,
  ItemSummary,
  Job,
  JobStatus,
  JobType,
  LibrarySettingsWithStats,
  LibraryState,
  ModelInfo,
  PageResult,
  ProcessingStatusGroup,
  QueueSummary,
  SearchResult,
} from "../../shared/types";
import { DashboardView } from "./components/DashboardView";
import { ItemDetail as ItemDetailView } from "./components/ItemDetail";
import { ItemList } from "./components/ItemList";
import { ModelManager } from "./components/ModelManager";
import { QueueView } from "./components/QueueView";
import { SettingsView } from "./components/SettingsView";
import { SetupView } from "./components/SetupView";
import { Sidebar, type ViewKey } from "./components/Sidebar";
import { TagInput } from "./components/TagInput";
import { TagManager } from "./components/TagManager";
import { Button, Input, Modal, Panel, Toaster } from "./components/ui";
import { useDocumentTheme } from "./hooks/useDocumentTheme";
import { useToasts } from "./hooks/useToasts";
import { getSystemTheme, mapSearchResultToItemSummary, mergePageResults, normalizeToastError } from "./lib/app";
import { createPagedState, type PagedState } from "./lib/pagination";

const PAGE_SIZE = 50;
const MAX_ITEM_REFRESH = 200;
const MAX_QUEUE_REFRESH = 500;
const IMPORT_BLOCKED_MESSAGE = "Select a transcription model in Model Manager before importing.";
const DISCARD_TRANSCRIPT_CHANGES_MESSAGE = "Discard unsaved transcript changes?";
const selectedRefreshJobTypes = new Set<JobType>(["import_file", "inspect_media", "extract_audio", "transcribe", "generate_markdown", "index_note"]);

type AsyncState<T> = {
  value: T | null;
  isLoading: boolean;
};

type FocusState = {
  itemId: string;
  originView: ViewKey;
};

type ImportTaggingState = {
  items: ItemSummary[];
  sharedTagNames: string[];
  additionalTagNamesByItemId: Record<string, string[]>;
};

type BulkTagDialogState = {
  mode: "assign" | "remove";
  itemIds: string[];
  tagNames: string[];
};

export function App() {
  const [library, setLibrary] = useState<LibraryState | null>(null);
  const [lastLibraryPath, setLastLibraryPath] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [settings, setSettings] = useState<LibrarySettingsWithStats | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [dashboardStorage, setDashboardStorage] = useState<AsyncState<DashboardStorageBreakdown>>({ value: null, isLoading: false });
  const [facets, setFacets] = useState<ItemFacets | null>(null);
  const [allTags, setAllTags] = useState<CountedTag[]>([]);
  const [queueSummary, setQueueSummary] = useState<QueueSummary | null>(null);
  const [itemsState, setItemsState] = useState<PagedState<ItemSummary>>(createPagedState<ItemSummary>());
  const [queueState, setQueueState] = useState<PagedState<ProcessingStatusGroup>>(createPagedState<ProcessingStatusGroup>());
  const [searchState, setSearchState] = useState<PagedState<SearchResult>>(createPagedState<SearchResult>());
  const [view, setView] = useState<ViewKey>("dashboard");
  const [focusState, setFocusState] = useState<FocusState | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<AsyncState<ItemDetail>>({ value: null, isLoading: false });
  const [searchText, setSearchText] = useState("");
  const [submittedSearchText, setSubmittedSearchText] = useState("");
  const [jumpToSeconds, setJumpToSeconds] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("Loading...");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedBulkItemIds, setSelectedBulkItemIds] = useState<string[]>([]);
  const [importTaggingState, setImportTaggingState] = useState<ImportTaggingState | null>(null);
  const [bulkTagDialog, setBulkTagDialog] = useState<BulkTagDialogState | null>(null);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => getSystemTheme());
  const [hasUnsavedTranscriptChanges, setHasUnsavedTranscriptChanges] = useState(false);
  const { toasts, addToast, removeToast } = useToasts();
  const selectedItemIdRef = useRef<string | null>(null);
  const previousJobStatusesRef = useRef<Map<string, JobStatus>>(new Map());
  const viewRef = useRef<ViewKey>(view);
  const selectedTagIdsRef = useRef<string[]>(selectedTagIds);
  const itemsPageRef = useRef<PageResult<ItemSummary> | null>(itemsState.page);
  const queuePageRef = useRef<PageResult<ProcessingStatusGroup> | null>(queueState.page);

  const themePreference = settings?.theme ?? "dark";
  const resolvedTheme = themePreference === "system" ? systemTheme : themePreference;
  const isImportBlocked = Boolean(library && !library.selectedModelId);
  useDocumentTheme(resolvedTheme);

  const refreshShellData = useCallback(async () => {
    const [nextLibrary, nextLastLibraryPath, nextModels, nextSettings] = await Promise.all([
      window.voiceNoter.library.getCurrentLibrary().catch(() => null),
      window.voiceNoter.library.getLastLibrary().catch(() => null),
      window.voiceNoter.models.listModels().catch(() => []),
      window.voiceNoter.library.getSettings().catch(() => null),
    ]);

    setLibrary(nextLibrary);
    setLastLibraryPath(nextLastLibraryPath);
    setModels(nextModels);
    setSettings(nextSettings);

    if (!nextLibrary) {
      setDashboardSummary(null);
      setDashboardStorage({ value: null, isLoading: false });
      setFacets(null);
      setAllTags([]);
      setQueueSummary(null);
      setItemsState(createPagedState<ItemSummary>());
      setQueueState(createPagedState<ProcessingStatusGroup>());
      setSearchState(createPagedState<SearchResult>());
      setSelectedItem({ value: null, isLoading: false });
      setSubmittedSearchText("");
      setStatusMessage("Choose a library to begin.");
      return;
    }

    const [nextQueueSummary, nextDashboardSummary, nextFacets, nextTags] = await Promise.all([
      window.voiceNoter.queue.getSummary().catch(() => null),
      window.voiceNoter.dashboard.getSummary().catch(() => null),
      window.voiceNoter.items.getFacets().catch(() => null),
      window.voiceNoter.tags.listTags().catch(() => []),
    ]);

    setQueueSummary(nextQueueSummary);
    setDashboardSummary(nextDashboardSummary);
    setFacets(nextFacets);
    setAllTags(nextTags);
    if (!nextLibrary.selectedModelId) {
      setView("models");
      setStatusMessage(IMPORT_BLOCKED_MESSAGE);
      return;
    }
    setStatusMessage("Library ready");
  }, []);

  const refreshDashboardSummary = useCallback(async () => {
    if (!library) {
      return;
    }
    const nextDashboardSummary = await window.voiceNoter.dashboard.getSummary().catch(() => null);
    startTransition(() => {
      setDashboardSummary(nextDashboardSummary);
    });
  }, [library]);

  const loadDashboardStorage = useCallback(async () => {
    if (!library) {
      return;
    }
    setDashboardStorage((previous) => ({ ...previous, isLoading: true }));
    try {
      const storage = await window.voiceNoter.dashboard.getStorageBreakdown().catch(() => null);
      startTransition(() => {
        setDashboardStorage({ value: storage, isLoading: false });
      });
    } finally {
      setDashboardStorage((previous) => ({ ...previous, isLoading: false }));
    }
  }, [library]);

  const loadItemsPage = useCallback(
    async ({ offset = 0, limit = PAGE_SIZE, append = false }: { offset?: number; limit?: number; append?: boolean } = {}) => {
      if (!library) {
        return;
      }
      setItemsState((previous) => ({ ...previous, isLoading: !append, isLoadingMore: append }));
      try {
        const query =
          selectedTagIdsRef.current.length > 0
            ? { view: "tag" as const, tagIds: selectedTagIdsRef.current, limit, offset }
            : { view: "all" as const, limit, offset };
        const page = await window.voiceNoter.items.listItems(query);
        startTransition(() => {
          setItemsState((previous) => ({
            ...previous,
            page: mergePageResults(previous.page, page, append),
          }));
        });
      } finally {
        setItemsState((previous) => ({ ...previous, isLoading: false, isLoadingMore: false }));
      }
    },
    [library],
  );

  const loadQueuePage = useCallback(
    async ({ offset = 0, limit = PAGE_SIZE, append = false }: { offset?: number; limit?: number; append?: boolean } = {}) => {
      if (!library) {
        return;
      }
      setQueueState((previous) => ({ ...previous, isLoading: !append, isLoadingMore: append }));
      try {
        const page = await window.voiceNoter.queue.listJobs({ limit, offset });
        startTransition(() => {
          setQueueState((previous) => ({
            ...previous,
            page: mergePageResults(previous.page, page, append),
          }));
          for (const group of page.items) {
            for (const job of group.jobs) {
              previousJobStatusesRef.current.set(job.id, job.status);
            }
          }
        });
      } finally {
        setQueueState((previous) => ({ ...previous, isLoading: false, isLoadingMore: false }));
      }
    },
    [library],
  );

  const loadSearchPage = useCallback(
    async ({ offset = 0, limit = PAGE_SIZE, append = false }: { offset?: number; limit?: number; append?: boolean } = {}) => {
      if (!library) {
        return;
      }
      const text = submittedSearchText.trim();
      if (!text) {
        setSearchState(createPagedState<SearchResult>());
        return;
      }
      setSearchState((previous) => ({ ...previous, isLoading: !append, isLoadingMore: append }));
      try {
        const page = await window.voiceNoter.search.search({
          text,
          tagIds: selectedTagIdsRef.current.length > 0 ? selectedTagIdsRef.current : undefined,
          limit,
          offset,
        });
        startTransition(() => {
          setSearchState((previous) => ({
            ...previous,
            page: mergePageResults(previous.page, page, append),
          }));
        });
      } finally {
        setSearchState((previous) => ({ ...previous, isLoading: false, isLoadingMore: false }));
      }
    },
    [library, submittedSearchText],
  );

  const refreshSelectedItemById = useCallback(async (itemId: string) => {
    setSelectedItem((previous) => ({ ...previous, isLoading: true }));
    try {
      const detail = await window.voiceNoter.items.getItem(itemId);
      if (selectedItemIdRef.current === itemId) {
        setSelectedItem({ value: detail, isLoading: false });
      }
    } finally {
      if (selectedItemIdRef.current === itemId) {
        setSelectedItem((previous) => ({ ...previous, isLoading: false }));
      }
    }
  }, []);

  const refreshSelectedItem = useCallback(async () => {
    if (!selectedItemIdRef.current) {
      setSelectedItem({ value: null, isLoading: false });
      return;
    }
    await refreshSelectedItemById(selectedItemIdRef.current);
  }, [refreshSelectedItemById]);

  const reloadSelectedItemAndVisibleList = useCallback(async () => {
    await refreshShellData();
    await refreshSelectedItem();
    if (viewRef.current === "all" && submittedSearchText) {
      await loadSearchPage({ offset: 0, limit: PAGE_SIZE });
    } else if (viewRef.current === "all" && itemsPageRef.current) {
      await loadItemsPage({ offset: 0, limit: Math.min(itemsPageRef.current.items.length, MAX_ITEM_REFRESH) });
    }
    if (viewRef.current === "queue" && queuePageRef.current) {
      await loadQueuePage({ offset: 0, limit: Math.min(queuePageRef.current.items.length, MAX_QUEUE_REFRESH) });
    }
  }, [loadItemsPage, loadQueuePage, loadSearchPage, refreshSelectedItem, refreshShellData, submittedSearchText]);

  useEffect(() => {
    selectedItemIdRef.current = selectedItemId;
  }, [selectedItemId]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    selectedTagIdsRef.current = selectedTagIds;
  }, [selectedTagIds]);

  useEffect(() => {
    itemsPageRef.current = itemsState.page;
  }, [itemsState.page]);

  useEffect(() => {
    queuePageRef.current = queueState.page;
  }, [queueState.page]);

  useEffect(() => {
    if (themePreference !== "system" || typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(media.matches ? "dark" : "light");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [themePreference]);

  useEffect(() => {
    void refreshShellData().catch(() => setStatusMessage("Choose a library to begin."));
  }, [refreshShellData]);

  useEffect(() => {
    if (!library) {
      return;
    }
    if (view === "dashboard" && dashboardSummary && !dashboardStorage.value && !dashboardStorage.isLoading) {
      void loadDashboardStorage();
    }
    if (view === "all" && submittedSearchText) {
      void loadSearchPage({ offset: 0, limit: PAGE_SIZE });
    } else if (view === "all") {
      void loadItemsPage({ offset: 0, limit: PAGE_SIZE });
    }
    if (view === "queue") {
      void loadQueuePage({ offset: 0, limit: PAGE_SIZE });
    }
  }, [
    dashboardStorage.isLoading,
    dashboardStorage.value,
    dashboardSummary,
    library,
    loadDashboardStorage,
    loadItemsPage,
    loadQueuePage,
    loadSearchPage,
    selectedTagIds,
    submittedSearchText,
    view,
  ]);

  useEffect(() => {
    setIsSelectionMode(false);
    setSelectedBulkItemIds([]);
  }, [selectedTagIds, submittedSearchText, view]);

  useEffect(() => {
    if (!library) {
      return;
    }
    const unsubscribeQueue = window.voiceNoter.queue.subscribeToQueueUpdates((update) => {
      const previousStatuses = previousJobStatusesRef.current;
      const selected = selectedItemIdRef.current;
      const shouldRefreshSelected =
        selected !== null &&
        update.changedJobs.some(
          (job) =>
            job.itemId === selected &&
            selectedRefreshJobTypes.has(job.type) &&
            job.status === "completed" &&
            previousStatuses.get(job.id) !== "completed",
        );

      for (const job of update.changedJobs) {
        previousStatuses.set(job.id, job.status);
      }

      setQueueSummary(update.summary);
      void refreshDashboardSummary();

      if (viewRef.current === "queue" && queuePageRef.current) {
        void loadQueuePage({ offset: 0, limit: Math.min(queuePageRef.current.items.length, MAX_QUEUE_REFRESH) });
      }
      if (shouldRefreshSelected) {
        void refreshSelectedItemById(selected);
      }
    });
    const unsubscribeProcessing = window.voiceNoter.queue.subscribeToProcessingEvents((event) => {
      setStatusMessage(`${event.stage}: ${event.message} (${Math.round(event.progress * 100)}%)`);
    });
    return () => {
      unsubscribeQueue();
      unsubscribeProcessing();
    };
  }, [library, loadQueuePage, refreshDashboardSummary, refreshSelectedItemById]);

  useEffect(() => {
    if (!selectedItemId) {
      setSelectedItem({ value: null, isLoading: false });
      return;
    }
    void refreshSelectedItemById(selectedItemId);
  }, [refreshSelectedItemById, selectedItemId]);

  function resetWorkspaceViewState() {
    setView("dashboard");
    setFocusState(null);
    setSelectedTagIds([]);
    setSelectedItemId(null);
    setSelectedItem({ value: null, isLoading: false });
    setJumpToSeconds(null);
    setSearchText("");
    setSubmittedSearchText("");
    setSearchState(createPagedState<SearchResult>());
    setItemsState(createPagedState<ItemSummary>());
      setQueueState(createPagedState<ProcessingStatusGroup>());
    setDashboardSummary(null);
    setQueueSummary(null);
    setFacets(null);
    setAllTags([]);
    setDashboardStorage({ value: null, isLoading: false });
    setHasUnsavedTranscriptChanges(false);
    setIsSelectionMode(false);
    setSelectedBulkItemIds([]);
    setImportTaggingState(null);
    setBulkTagDialog(null);
  }

  function confirmFocusExit(): boolean {
    if (!focusState || !hasUnsavedTranscriptChanges) {
      return true;
    }
    return window.confirm(DISCARD_TRANSCRIPT_CHANGES_MESSAGE);
  }

  function closeFocusView(): boolean {
    if (!confirmFocusExit()) {
      return false;
    }
    setFocusState(null);
    setJumpToSeconds(null);
    setHasUnsavedTranscriptChanges(false);
    return true;
  }

  function navigateToView(nextView: ViewKey) {
    if (!closeFocusView()) {
      return;
    }
    setView(nextView);
    setIsSelectionMode(false);
    setSelectedBulkItemIds([]);
    if (nextView !== "all") {
      setSubmittedSearchText("");
      setSearchState(createPagedState<SearchResult>());
    }
  }

  function openItemFocus(itemId: string, startSeconds?: number | null, originView: ViewKey = viewRef.current) {
    if (!closeFocusView()) {
      return;
    }
    setSelectedItemId(itemId);
    setJumpToSeconds(startSeconds ?? null);
    setFocusState({ itemId, originView });
  }

  async function chooseLibrary() {
    setStatusMessage("Choosing library");
    try {
      await window.voiceNoter.library.chooseLibrary();
      resetWorkspaceViewState();
      await refreshShellData();
    } catch (error) {
      addToast(normalizeToastError(error, "Library setup failed", "VoiceNoter could not set up the library."));
    }
  }

  async function openLastLibrary() {
    setStatusMessage("Opening last library");
    try {
      await window.voiceNoter.library.openLastLibrary();
      resetWorkspaceViewState();
      await refreshShellData();
    } catch (error) {
      addToast(normalizeToastError(error, "Library setup failed", "VoiceNoter could not open the last library."));
    }
  }

  async function importFiles(paths?: string[]) {
    if (isImportBlocked) {
      setStatusMessage(IMPORT_BLOCKED_MESSAGE);
      addToast({ variant: "info", title: "Import blocked", message: IMPORT_BLOCKED_MESSAGE });
      return;
    }
    const importPaths =
      paths ??
      (await window.voiceNoter.import.chooseFilesForImport()).filter((candidate) => candidate.supported).map((candidate) => candidate.path);
    if (importPaths.length === 0) {
      return;
    }
    setStatusMessage("Importing media");
    try {
      const result = await window.voiceNoter.import.importFiles(importPaths);
      setStatusMessage(
        result.rejectedFiles.length
          ? `Imported ${result.importedItems.length}; rejected ${result.rejectedFiles.length}`
          : `Imported ${result.importedItems.length}`,
      );
      if (viewRef.current === "all") {
        if (submittedSearchText) {
          void loadSearchPage({ offset: 0, limit: PAGE_SIZE });
        } else {
          void loadItemsPage({ offset: 0, limit: itemsPageRef.current?.items.length ? itemsPageRef.current.items.length : PAGE_SIZE });
        }
      }
      await refreshShellData();
      if (result.importedItems.length > 0) {
        setImportTaggingState({
          items: result.importedItems,
          sharedTagNames: [],
          additionalTagNamesByItemId: Object.fromEntries(result.importedItems.map((item) => [item.id, []])),
        });
      }
      if (result.rejectedFiles.length > 0) {
        for (const rejected of result.rejectedFiles) {
          addToast({ variant: "error", title: rejected.error.title, message: rejected.error.message, technicalDetails: rejected.error.technicalDetails });
        }
      }
    } catch (error) {
      addToast(normalizeToastError(error, "Import failed", "VoiceNoter could not complete the import."));
    }
  }

  async function runSearch() {
    const text = searchText.trim();
    if (!closeFocusView()) {
      return;
    }
    if (!text) {
      setSubmittedSearchText("");
      setSearchState(createPagedState<SearchResult>());
      setView("all");
      setStatusMessage(selectedTagIdsRef.current.length > 0 ? `Showing ${selectedTagIdsRef.current.length} tag filters` : "All items");
      return;
    }
    try {
      const page = await window.voiceNoter.search.search({
        text,
        tagIds: selectedTagIdsRef.current.length > 0 ? selectedTagIdsRef.current : undefined,
        limit: PAGE_SIZE,
        offset: 0,
      });
      setSubmittedSearchText(text);
      setSearchState({ page, isLoading: false, isLoadingMore: false });
      setView("all");
      setStatusMessage(`${page.total} search results`);
    } catch (error) {
      addToast(normalizeToastError(error, "Search failed", "VoiceNoter could not complete the search."));
    }
  }

  function openDashboardItem(itemId: string) {
    openItemFocus(itemId, null, "dashboard");
  }

  function handleToggleTagFilter(tagId: string) {
    if (!closeFocusView()) {
      return;
    }
    setSelectedTagIds((previous) => (previous.includes(tagId) ? previous.filter((id) => id !== tagId) : [...previous, tagId]));
    setView("all");
  }

  function clearTagFilters() {
    if (!closeFocusView()) {
      return;
    }
    setSelectedTagIds([]);
    setView("all");
  }

  async function handleLoadMoreItems() {
    if (!itemsState.page || itemsState.page.nextOffset === null) {
      return;
    }
    await loadItemsPage({ offset: itemsState.page.nextOffset, limit: PAGE_SIZE, append: true });
  }

  async function handleLoadMoreQueue() {
    if (!queueState.page || queueState.page.nextOffset === null) {
      return;
    }
    await loadQueuePage({ offset: queueState.page.nextOffset, limit: PAGE_SIZE, append: true });
  }

  async function handleLoadMoreSearch() {
    if (!searchState.page || searchState.page.nextOffset === null || !submittedSearchText) {
      return;
    }
    await loadSearchPage({ offset: searchState.page.nextOffset, limit: PAGE_SIZE, append: true });
  }

  async function refreshTagDrivenViews() {
    await refreshShellData();
    await reloadSelectedItemAndVisibleList();
  }

  function toggleSelectionMode() {
    setIsSelectionMode((previous) => !previous);
    setSelectedBulkItemIds([]);
  }

  function toggleSelectAllVisible() {
    setSelectedBulkItemIds((previous) => {
      const visibleIds = currentItemList.map((item) => item.id);
      const allSelected = visibleIds.every((id) => previous.includes(id));
      return allSelected ? previous.filter((id) => !visibleIds.includes(id)) : [...new Set([...previous, ...visibleIds])];
    });
  }

  function toggleItemSelection(itemId: string) {
    setSelectedBulkItemIds((previous) => (previous.includes(itemId) ? previous.filter((id) => id !== itemId) : [...previous, itemId]));
  }

  async function createTag(name: string) {
    try {
      await window.voiceNoter.tags.createTag(name);
      await refreshTagDrivenViews();
    } catch (error) {
      addToast(normalizeToastError(error, "Tag creation failed", "Could not create tag."));
    }
  }

  async function renameTag(tagId: string, name: string) {
    try {
      const result = await window.voiceNoter.tags.renameTag(tagId, name);
      await refreshTagDrivenViews();
      if (result.mergedTagId) {
        setSelectedTagIds((previous) => previous.map((id) => (id === tagId ? result.tag.id : id)));
      }
    } catch (error) {
      addToast(normalizeToastError(error, "Tag rename failed", "Could not rename tag."));
    }
  }

  async function deleteTag(tagId: string) {
    try {
      await window.voiceNoter.tags.deleteTag(tagId);
      setSelectedTagIds((previous) => previous.filter((id) => id !== tagId));
      await refreshTagDrivenViews();
    } catch (error) {
      addToast(normalizeToastError(error, "Tag delete failed", "Could not delete tag."));
    }
  }

  async function saveBulkTagDialog() {
    if (!bulkTagDialog || bulkTagDialog.tagNames.length === 0) {
      setBulkTagDialog(null);
      return;
    }
    try {
      if (bulkTagDialog.mode === "assign") {
        await window.voiceNoter.tags.assignTagsToItems(bulkTagDialog.itemIds, bulkTagDialog.tagNames);
      } else {
        await window.voiceNoter.tags.removeTagsFromItems(bulkTagDialog.itemIds, bulkTagDialog.tagNames);
      }
      setBulkTagDialog(null);
      setSelectedBulkItemIds([]);
      setIsSelectionMode(false);
      await refreshTagDrivenViews();
    } catch (error) {
      addToast(normalizeToastError(error, "Bulk tag update failed", "Could not update tags for the selected files."));
    }
  }

  async function saveImportTags() {
    if (!importTaggingState) {
      return;
    }

    try {
      if (importTaggingState.sharedTagNames.length > 0) {
        await window.voiceNoter.tags.assignTagsToItems(
          importTaggingState.items.map((item) => item.id),
          importTaggingState.sharedTagNames,
        );
      }

      for (const item of importTaggingState.items) {
        const extraTagNames = importTaggingState.additionalTagNamesByItemId[item.id] ?? [];
        if (extraTagNames.length > 0) {
          await window.voiceNoter.tags.assignTagsToItems([item.id], extraTagNames);
        }
      }

      setImportTaggingState(null);
      await refreshTagDrivenViews();
    } catch (error) {
      addToast(normalizeToastError(error, "Tagging failed", "Could not save tags for the imported files."));
    }
  }

  if (!library) {
    return <SetupView lastLibraryPath={lastLibraryPath} onChooseLibrary={() => void chooseLibrary()} onOpenLastLibrary={lastLibraryPath ? () => void openLastLibrary() : undefined} />;
  }

  const selectedTagNames = selectedTagIds
    .map((tagId) => allTags.find((tag) => tag.id === tagId)?.name)
    .filter((tagName): tagName is string => Boolean(tagName));
  const availableTagNames = allTags.map((tag) => tag.name);
  const currentSearchResults = submittedSearchText ? (searchState.page?.items ?? []) : [];
  const searchItems: ItemSummary[] = currentSearchResults.map(mapSearchResultToItemSummary);
  const currentItemList = view === "all" ? (submittedSearchText ? searchItems : itemsState.page?.items ?? []) : [];
  const currentQueueGroups = view === "queue" ? queueState.page?.items ?? [] : [];

  return (
    <div
      className="flex h-screen overflow-hidden bg-background text-foreground"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const paths = Array.from(event.dataTransfer.files)
          .map((file) => (file as File & { path?: string }).path)
          .filter((path): path is string => Boolean(path));
        void importFiles(paths);
      }}
    >
      <Sidebar
        view={view}
        facets={facets}
        selectedTagIds={selectedTagIds}
        onViewChange={navigateToView}
        onToggleTagFilter={handleToggleTagFilter}
        onClearTagFilters={clearTagFilters}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void runSearch();
            }}
          >
            <Input className="min-w-0 flex-1" placeholder="Search notes and transcripts" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
            <Button variant="secondary" type="submit">
              <SearchIcon data-icon="inline-start" />
              Search
            </Button>
          </form>
          {isImportBlocked ? <div className="hidden max-w-64 text-xs text-muted-foreground xl:block">{IMPORT_BLOCKED_MESSAGE}</div> : null}
          <Button disabled={isImportBlocked} onClick={() => void importFiles()}>
            <Import data-icon="inline-start" />
            Import
          </Button>
          <button className="rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground" onClick={() => navigateToView("queue")}>
            {(queueSummary?.activeJobs ?? 0) > 0 ? queueSummary?.activeJobs : 0} active jobs
          </button>
        </header>
        {focusState ? (
          <ItemDetailView
            item={selectedItem.value}
            availableTagNames={availableTagNames}
            jumpToSeconds={jumpToSeconds}
            isLoading={selectedItem.isLoading}
            onReload={() => void reloadSelectedItemAndVisibleList()}
            onBack={() => {
              void closeFocusView();
            }}
            onDirtyChange={setHasUnsavedTranscriptChanges}
            onItemUpdated={(nextItem) => {
              setSelectedItem({ value: nextItem, isLoading: false });
            }}
          />
        ) : view === "queue" ? (
          <QueueView
            groups={currentQueueGroups}
            summary={queueSummary}
            isLoading={queueState.isLoading}
            isLoadingMore={queueState.isLoadingMore}
            hasMore={queueState.page?.nextOffset !== null}
            onLoadMore={() => void handleLoadMoreQueue()}
            onRetry={(jobId) =>
              void window.voiceNoter.queue
                .retryJob(jobId)
                .then(refreshShellData)
                .catch((error: unknown) => addToast(normalizeToastError(error, "Retry failed", "Could not retry job.")))
            }
            onCancel={(jobId) =>
              void window.voiceNoter.queue
                .cancelJob(jobId)
                .then(refreshShellData)
                .catch((error: unknown) => addToast(normalizeToastError(error, "Cancel failed", "Could not cancel job.")))
            }
          />
        ) : view === "models" ? (
          <ModelManager
            models={models}
            onDownload={(modelId) =>
              void window.voiceNoter.models
                .downloadModel(modelId)
                .then(refreshShellData)
                .catch((error: unknown) => addToast(normalizeToastError(error, "Download failed", "Could not download model.")))
            }
            onDelete={(modelId) =>
              void window.voiceNoter.models
                .deleteModel(modelId)
                .then(refreshShellData)
                .catch((error: unknown) => addToast(normalizeToastError(error, "Delete failed", "Could not delete model.")))
            }
            onSelect={(modelId) =>
              void window.voiceNoter.models
                .setDefaultModel(modelId)
                .then(refreshShellData)
                .catch((error: unknown) => addToast(normalizeToastError(error, "Selection failed", "Could not set default model.")))
            }
          />
        ) : view === "settings" ? (
          <SettingsView
            library={library}
            settings={settings}
            models={models}
            onOpenFolder={() => void window.voiceNoter.library.openLibraryFolder()}
            onRescan={() =>
              void window.voiceNoter.library
                .rescanLibrary()
                .then(refreshShellData)
                .catch((error: unknown) => addToast(normalizeToastError(error, "Rescan failed", "Could not rescan library.")))
            }
            onReindex={() =>
              void window.voiceNoter.search
                .reindex()
                .then(refreshShellData)
                .catch((error: unknown) => addToast(normalizeToastError(error, "Reindex failed", "Could not reindex search.")))
            }
            onUpdateSettings={(patch) =>
              void window.voiceNoter.library
                .updateSettings(patch)
                .then((nextSettings) => {
                  setSettings(nextSettings);
                })
                .catch((error) => {
                  addToast(normalizeToastError(error, "Settings update failed", "Could not save settings."));
                })
            }
          />
        ) : view === "dashboard" ? (
          <DashboardView
            summary={dashboardSummary}
            storage={dashboardStorage.value}
            isLoading={!dashboardSummary}
            isLoadingStorage={dashboardStorage.isLoading}
            onSelectItem={openDashboardItem}
            onOpenQueue={() => navigateToView("queue")}
          />
        ) : view === "tags" ? (
          <TagManager
            tags={allTags}
            selectedTagIds={selectedTagIds}
            onCreateTag={(name) => void createTag(name)}
            onRenameTag={(tagId, name) => void renameTag(tagId, name)}
            onDeleteTag={(tagId) => void deleteTag(tagId)}
            onToggleFilter={(tagId) => handleToggleTagFilter(tagId)}
          />
        ) : (
          <ItemList
            items={currentItemList}
            selectedItemId={selectedItemId}
            selectedItemIds={selectedBulkItemIds}
            searchResults={currentSearchResults}
            searchText={submittedSearchText}
            activeFilterLabel={selectedTagNames.length > 0 ? selectedTagNames.join(", ") : undefined}
            isLoading={submittedSearchText ? searchState.isLoading : itemsState.isLoading}
            isLoadingMore={submittedSearchText ? searchState.isLoadingMore : itemsState.isLoadingMore}
            hasMore={submittedSearchText ? searchState.page?.nextOffset !== null : itemsState.page?.nextOffset !== null}
            isSelectionMode={isSelectionMode}
            selectionEnabled
            onLoadMore={() => void (submittedSearchText ? handleLoadMoreSearch() : handleLoadMoreItems())}
            onToggleSelectionMode={toggleSelectionMode}
            onToggleSelectAllVisible={toggleSelectAllVisible}
            onToggleItemSelection={toggleItemSelection}
            onOpenBulkAssign={() =>
              setBulkTagDialog({
                mode: "assign",
                itemIds: selectedBulkItemIds,
                tagNames: [],
              })
            }
            onOpenBulkRemove={() =>
              setBulkTagDialog({
                mode: "remove",
                itemIds: selectedBulkItemIds,
                tagNames: [],
              })
            }
            onSelectItem={(itemId, startSeconds) => openItemFocus(itemId, startSeconds, viewRef.current)}
            fullWidth
          />
        )}
        <footer className="h-7 shrink-0 border-t border-border bg-card px-3 py-1 text-xs text-muted-foreground">{statusMessage}</footer>
      </main>
      {importTaggingState ? (
        <Modal
          title={importTaggingState.items.length === 1 ? "Tag imported file" : "Tag imported files"}
          description="Type tags separated by commas. Existing tags autocomplete, and new tags are created automatically."
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setImportTaggingState(null)}>
                Skip for now
              </Button>
              <Button onClick={() => void saveImportTags()}>Save tags</Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-medium">Apply to every imported file</div>
              <TagInput
                placeholder="team, planning, follow up"
                suggestions={availableTagNames}
                value={importTaggingState.sharedTagNames}
                onChange={(sharedTagNames) => setImportTaggingState((previous) => (previous ? { ...previous, sharedTagNames } : previous))}
              />
            </div>
            <div className="space-y-3">
              {importTaggingState.items.map((item) => (
                <Panel key={item.id} className="p-4">
                  <div className="mb-2 text-sm font-medium">{item.title}</div>
                  <div className="mb-2 text-xs text-muted-foreground">Additional tags for this file</div>
                  <TagInput
                    placeholder="customer, urgent"
                    suggestions={availableTagNames}
                    value={importTaggingState.additionalTagNamesByItemId[item.id] ?? []}
                    onChange={(nextTagNames) =>
                      setImportTaggingState((previous) =>
                        previous
                          ? {
                              ...previous,
                              additionalTagNamesByItemId: {
                                ...previous.additionalTagNamesByItemId,
                                [item.id]: nextTagNames,
                              },
                            }
                          : previous,
                      )
                    }
                  />
                </Panel>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}
      {bulkTagDialog ? (
        <Modal
          title={bulkTagDialog.mode === "assign" ? "Assign tags" : "Remove tags"}
          description={
            bulkTagDialog.mode === "assign"
              ? `Update ${bulkTagDialog.itemIds.length} selected files.`
              : `Remove selected tags from ${bulkTagDialog.itemIds.length} files.`
          }
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setBulkTagDialog(null)}>
                Cancel
              </Button>
              <Button onClick={() => void saveBulkTagDialog()}>
                {bulkTagDialog.mode === "assign" ? "Assign tags" : "Remove tags"}
              </Button>
            </div>
          }
        >
          <TagInput
            allowCreate={bulkTagDialog.mode === "assign"}
            placeholder={bulkTagDialog.mode === "assign" ? "follow up, work, review" : "Type existing tags to remove"}
            suggestions={availableTagNames}
            value={bulkTagDialog.tagNames}
            onChange={(tagNames) => setBulkTagDialog((previous) => (previous ? { ...previous, tagNames } : previous))}
          />
        </Modal>
      ) : null}
      <Toaster toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
