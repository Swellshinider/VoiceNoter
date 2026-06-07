import { Import, Search as SearchIcon } from "lucide-react";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type {
  DashboardStorageBreakdown,
  DashboardSummary,
  ItemDetail,
  ItemFacets,
  ItemSummary,
  Job,
  JobStatus,
  JobType,
  LibrarySettings,
  LibraryState,
  ModelInfo,
  PageResult,
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
import { Sidebar, type FilterState, type ViewKey } from "./components/Sidebar";
import { Button, Input, Toaster, type ToastEntry } from "./components/ui";

const PAGE_SIZE = 50;
const MAX_ITEM_REFRESH = 200;
const MAX_QUEUE_REFRESH = 500;
const selectedRefreshJobTypes = new Set<JobType>(["import_file", "inspect_media", "extract_audio", "transcribe", "generate_markdown", "index_note"]);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function App() {
  const [library, setLibrary] = useState<LibraryState | null>(null);
  const [lastLibraryPath, setLastLibraryPath] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [settings, setSettings] = useState<LibrarySettings | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [dashboardStorage, setDashboardStorage] = useState<DashboardStorageBreakdown | null>(null);
  const [facets, setFacets] = useState<ItemFacets | null>(null);
  const [queueSummary, setQueueSummary] = useState<QueueSummary | null>(null);
  const [itemsPage, setItemsPage] = useState<PageResult<ItemSummary> | null>(null);
  const [queuePage, setQueuePage] = useState<PageResult<Job> | null>(null);
  const [searchPage, setSearchPage] = useState<PageResult<SearchResult> | null>(null);
  const [view, setView] = useState<ViewKey>("dashboard");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemDetail | null>(null);
  const [searchText, setSearchText] = useState("");
  const [jumpToSeconds, setJumpToSeconds] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("Loading...");
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterState>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isLoadingItemsMore, setIsLoadingItemsMore] = useState(false);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [isLoadingQueueMore, setIsLoadingQueueMore] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [isLoadingSearchMore, setIsLoadingSearchMore] = useState(false);
  const [isLoadingDashboardStorage, setIsLoadingDashboardStorage] = useState(false);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => getSystemTheme());
  const selectedItemIdRef = useRef<string | null>(null);
  const previousJobStatusesRef = useRef<Map<string, JobStatus>>(new Map());
  const viewRef = useRef<ViewKey>(view);
  const activeFilterRef = useRef<FilterState>(activeFilter);
  const itemsPageRef = useRef<PageResult<ItemSummary> | null>(itemsPage);
  const queuePageRef = useRef<PageResult<Job> | null>(queuePage);
  const searchPageRef = useRef<PageResult<SearchResult> | null>(searchPage);

  const themePreference = settings?.theme ?? "dark";
  const resolvedTheme = themePreference === "system" ? systemTheme : themePreference;

  function addToast(entry: Omit<ToastEntry, "id">) {
    setToasts((prev) => [...prev, { ...entry, id: crypto.randomUUID() }]);
  }

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }

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
      setDashboardStorage(null);
      setFacets(null);
      setQueueSummary(null);
      setItemsPage(null);
      setQueuePage(null);
      setSearchPage(null);
      setStatusMessage("Choose a library to begin.");
      return;
    }

    const [nextQueueSummary, nextDashboardSummary, nextFacets] = await Promise.all([
      window.voiceNoter.queue.getSummary().catch(() => null),
      window.voiceNoter.dashboard.getSummary().catch(() => null),
      window.voiceNoter.items.getFacets().catch(() => null),
    ]);

    setQueueSummary(nextQueueSummary);
    setDashboardSummary(nextDashboardSummary);
    setFacets(nextFacets);
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
    setIsLoadingDashboardStorage(true);
    try {
      const storage = await window.voiceNoter.dashboard.getStorageBreakdown().catch(() => null);
      startTransition(() => {
        setDashboardStorage(storage);
      });
    } finally {
      setIsLoadingDashboardStorage(false);
    }
  }, [library]);

  const loadItemsPage = useCallback(
    async ({ offset = 0, limit = PAGE_SIZE, append = false }: { offset?: number; limit?: number; append?: boolean } = {}) => {
      if (!library) {
        return;
      }
      if (append) {
        setIsLoadingItemsMore(true);
      } else {
        setIsLoadingItems(true);
      }
      try {
        const query =
          activeFilterRef.current?.type === "category"
            ? { view: "category" as const, categoryId: activeFilterRef.current.id, limit, offset }
            : activeFilterRef.current?.type === "tag"
              ? { view: "tag" as const, tagId: activeFilterRef.current.id, limit, offset }
              : { view: "all" as const, limit, offset };
        const page = await window.voiceNoter.items.listItems(query);
        startTransition(() => {
          setItemsPage((prev) => (append && prev ? { ...page, items: [...prev.items, ...page.items] } : page));
        });
      } finally {
        setIsLoadingItems(false);
        setIsLoadingItemsMore(false);
      }
    },
    [library],
  );

  const loadQueuePage = useCallback(
    async ({ offset = 0, limit = PAGE_SIZE, append = false }: { offset?: number; limit?: number; append?: boolean } = {}) => {
      if (!library) {
        return;
      }
      if (append) {
        setIsLoadingQueueMore(true);
      } else {
        setIsLoadingQueue(true);
      }
      try {
        const page = await window.voiceNoter.queue.listJobs({ limit, offset });
        startTransition(() => {
          setQueuePage((prev) => (append && prev ? { ...page, items: [...prev.items, ...page.items] } : page));
          setQueueSummary((prev) => prev ?? null);
          for (const job of page.items) {
            previousJobStatusesRef.current.set(job.id, job.status);
          }
        });
      } finally {
        setIsLoadingQueue(false);
        setIsLoadingQueueMore(false);
      }
    },
    [library],
  );

  const loadSearchPage = useCallback(
    async ({ offset = 0, limit = PAGE_SIZE, append = false }: { offset?: number; limit?: number; append?: boolean } = {}) => {
      if (!library) {
        return;
      }
      const text = searchText.trim();
      if (!text) {
        setSearchPage(null);
        return;
      }
      if (append) {
        setIsLoadingSearchMore(true);
      } else {
        setIsLoadingSearch(true);
      }
      try {
        const page = await window.voiceNoter.search.search({ text, limit, offset });
        startTransition(() => {
          setSearchPage((prev) => (append && prev ? { ...page, items: [...prev.items, ...page.items] } : page));
        });
      } finally {
        setIsLoadingSearch(false);
        setIsLoadingSearchMore(false);
      }
    },
    [library, searchText],
  );

  const refreshSelectedItemById = useCallback(async (itemId: string) => {
    setIsLoadingDetail(true);
    try {
      const detail = await window.voiceNoter.items.getItem(itemId);
      if (selectedItemIdRef.current === itemId) {
        setSelectedItem(detail);
      }
    } finally {
      if (selectedItemIdRef.current === itemId) {
        setIsLoadingDetail(false);
      }
    }
  }, []);

  const refreshSelectedItem = useCallback(async () => {
    if (!selectedItemIdRef.current) {
      setSelectedItem(null);
      return;
    }
    await refreshSelectedItemById(selectedItemIdRef.current);
  }, [refreshSelectedItemById]);

  const reloadSelectedItemAndVisibleList = useCallback(async () => {
    await refreshSelectedItem();
    if (viewRef.current === "all" && itemsPageRef.current) {
      await loadItemsPage({ offset: 0, limit: Math.min(itemsPageRef.current.items.length, MAX_ITEM_REFRESH) });
    }
    if (viewRef.current === "queue" && queuePageRef.current) {
      await loadQueuePage({ offset: 0, limit: Math.min(queuePageRef.current.items.length, MAX_QUEUE_REFRESH) });
    }
  }, [loadItemsPage, loadQueuePage, refreshSelectedItem]);

  useEffect(() => {
    selectedItemIdRef.current = selectedItemId;
  }, [selectedItemId]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    activeFilterRef.current = activeFilter;
  }, [activeFilter]);

  useEffect(() => {
    itemsPageRef.current = itemsPage;
  }, [itemsPage]);

  useEffect(() => {
    queuePageRef.current = queuePage;
  }, [queuePage]);

  useEffect(() => {
    searchPageRef.current = searchPage;
  }, [searchPage]);

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
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.classList.toggle("light", resolvedTheme === "light");
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    void refreshShellData().catch(() => setStatusMessage("Choose a library to begin."));
  }, [refreshShellData]);

  useEffect(() => {
    if (!library) {
      return;
    }
    if (view === "dashboard" && dashboardSummary && !dashboardStorage) {
      void loadDashboardStorage();
    }
    if (view === "all") {
      void loadItemsPage({ offset: 0, limit: PAGE_SIZE });
    }
    if (view === "queue") {
      void loadQueuePage({ offset: 0, limit: PAGE_SIZE });
    }
  }, [dashboardStorage, dashboardSummary, library, loadDashboardStorage, loadItemsPage, loadQueuePage, view]);

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
      setSelectedItem(null);
      return;
    }
    void refreshSelectedItemById(selectedItemId);
  }, [refreshSelectedItemById, selectedItemId]);

  async function chooseLibrary() {
    setStatusMessage("Choosing library");
    try {
      await window.voiceNoter.library.chooseLibrary();
      setView("dashboard");
      setActiveFilter(null);
      setSelectedItemId(null);
      setSelectedItem(null);
      setJumpToSeconds(null);
      setSearchText("");
      setSearchPage(null);
      setItemsPage(null);
      setQueuePage(null);
      setDashboardStorage(null);
      await refreshShellData();
    } catch (error) {
      const err = error as { title?: string; message?: string; technicalDetails?: string } | undefined;
      addToast({ variant: "error", title: err?.title ?? "Library setup failed", message: err?.message ?? "VoiceNoter could not set up the library.", technicalDetails: err?.technicalDetails });
    }
  }

  async function openLastLibrary() {
    setStatusMessage("Opening last library");
    try {
      await window.voiceNoter.library.openLastLibrary();
      setView("dashboard");
      setActiveFilter(null);
      setSelectedItemId(null);
      setSelectedItem(null);
      setJumpToSeconds(null);
      setSearchText("");
      setSearchPage(null);
      setItemsPage(null);
      setQueuePage(null);
      setDashboardStorage(null);
      await refreshShellData();
    } catch (error) {
      const err = error as { title?: string; message?: string; technicalDetails?: string } | undefined;
      addToast({ variant: "error", title: err?.title ?? "Library setup failed", message: err?.message ?? "VoiceNoter could not open the last library.", technicalDetails: err?.technicalDetails });
    }
  }

  async function importFiles(paths?: string[]) {
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
        void loadItemsPage({ offset: 0, limit: itemsPageRef.current?.items.length ? itemsPageRef.current.items.length : PAGE_SIZE });
      }
      await refreshShellData();
      if (result.rejectedFiles.length > 0) {
        for (const rejected of result.rejectedFiles) {
          addToast({ variant: "error", title: rejected.error.title, message: rejected.error.message, technicalDetails: rejected.error.technicalDetails });
        }
      }
    } catch (error) {
      const err = error as { title?: string; message?: string; technicalDetails?: string } | undefined;
      addToast({ variant: "error", title: err?.title ?? "Import failed", message: err?.message ?? "VoiceNoter could not complete the import.", technicalDetails: err?.technicalDetails });
    }
  }

  async function runSearch() {
    const text = searchText.trim();
    if (!text) {
      setSearchPage(null);
      setView("search");
      return;
    }
    try {
      const page = await window.voiceNoter.search.search({ text, limit: PAGE_SIZE, offset: 0 });
      setSearchPage(page);
      setView("search");
      setStatusMessage(`${page.total} search results`);
    } catch (error) {
      const err = error as { title?: string; message?: string; technicalDetails?: string } | undefined;
      addToast({ variant: "error", title: err?.title ?? "Search failed", message: err?.message ?? "VoiceNoter could not complete the search.", technicalDetails: err?.technicalDetails });
    }
  }

  function selectItem(itemId: string, startSeconds?: number | null) {
    setSelectedItemId(itemId);
    setJumpToSeconds(startSeconds ?? null);
  }

  function handleFilterSelect(filter: FilterState) {
    setActiveFilter(filter);
    setView("all");
  }

  async function handleLoadMoreItems() {
    if (!itemsPage || itemsPage.nextOffset === null) {
      return;
    }
    await loadItemsPage({ offset: itemsPage.nextOffset, limit: PAGE_SIZE, append: true });
  }

  async function handleLoadMoreQueue() {
    if (!queuePage || queuePage.nextOffset === null) {
      return;
    }
    await loadQueuePage({ offset: queuePage.nextOffset, limit: PAGE_SIZE, append: true });
  }

  async function handleLoadMoreSearch() {
    if (!searchPage || searchPage.nextOffset === null) {
      return;
    }
    await loadSearchPage({ offset: searchPage.nextOffset, limit: PAGE_SIZE, append: true });
  }

  if (!library) {
    return <SetupView lastLibraryPath={lastLibraryPath} onChooseLibrary={() => void chooseLibrary()} onOpenLastLibrary={lastLibraryPath ? () => void openLastLibrary() : undefined} />;
  }

  const currentSearchResults = searchPage?.items ?? [];
  const searchItems: ItemSummary[] =
    view === "search"
      ? currentSearchResults.map((result) => ({
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
        }))
      : [];
  const currentItemList = view === "all" ? itemsPage?.items ?? [] : [];
  const currentQueueJobs = view === "queue" ? queuePage?.items ?? [] : [];

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
      <Sidebar view={view} facets={facets} activeFilter={activeFilter} onViewChange={setView} onFilterSelect={handleFilterSelect} />
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
          <Button onClick={() => void importFiles()}>
            <Import data-icon="inline-start" />
            Import
          </Button>
          <button className="rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground" onClick={() => setView("queue")}>
            {(queueSummary?.activeJobs ?? 0) > 0 ? queueSummary?.activeJobs : 0} active jobs
          </button>
        </header>
        {view === "queue" ? (
          <QueueView
            jobs={currentQueueJobs}
            summary={queueSummary}
            isLoading={isLoadingQueue}
            isLoadingMore={isLoadingQueueMore}
            hasMore={queuePage?.nextOffset !== null}
            onLoadMore={() => void handleLoadMoreQueue()}
            onRetry={(jobId) => void window.voiceNoter.queue.retryJob(jobId).then(refreshShellData).catch((error: { title?: string; message?: string; technicalDetails?: string }) => addToast({ variant: "error", title: error?.title ?? "Retry failed", message: error?.message ?? "Could not retry job.", technicalDetails: error?.technicalDetails }))}
            onCancel={(jobId) => void window.voiceNoter.queue.cancelJob(jobId).then(refreshShellData).catch((error: { title?: string; message?: string; technicalDetails?: string }) => addToast({ variant: "error", title: error?.title ?? "Cancel failed", message: error?.message ?? "Could not cancel job.", technicalDetails: error?.technicalDetails }))}
          />
        ) : view === "models" ? (
          <ModelManager
            models={models}
            onDownload={(modelId) => void window.voiceNoter.models.downloadModel(modelId).then(refreshShellData).catch((error: { title?: string; message?: string; technicalDetails?: string }) => addToast({ variant: "error", title: error?.title ?? "Download failed", message: error?.message ?? "Could not download model.", technicalDetails: error?.technicalDetails }))}
            onDelete={(modelId) => void window.voiceNoter.models.deleteModel(modelId).then(refreshShellData).catch((error: { title?: string; message?: string; technicalDetails?: string }) => addToast({ variant: "error", title: error?.title ?? "Delete failed", message: error?.message ?? "Could not delete model.", technicalDetails: error?.technicalDetails }))}
            onSelect={(modelId) => void window.voiceNoter.models.setDefaultModel(modelId).then(refreshShellData).catch((error: { title?: string; message?: string; technicalDetails?: string }) => addToast({ variant: "error", title: error?.title ?? "Selection failed", message: error?.message ?? "Could not set default model.", technicalDetails: error?.technicalDetails }))}
          />
        ) : view === "settings" ? (
          <SettingsView
            library={library}
            settings={settings}
            models={models}
            onOpenFolder={() => void window.voiceNoter.library.openLibraryFolder()}
            onRescan={() => void window.voiceNoter.library.rescanLibrary().then(refreshShellData).catch((error: { title?: string; message?: string; technicalDetails?: string }) => addToast({ variant: "error", title: error?.title ?? "Rescan failed", message: error?.message ?? "Could not rescan library.", technicalDetails: error?.technicalDetails }))}
            onReindex={() => void window.voiceNoter.search.reindex().then(refreshShellData).catch((error: { title?: string; message?: string; technicalDetails?: string }) => addToast({ variant: "error", title: error?.title ?? "Reindex failed", message: error?.message ?? "Could not reindex search.", technicalDetails: error?.technicalDetails }))}
            onUpdateSettings={(patch) =>
              void window.voiceNoter.library
                .updateSettings(patch)
                .then((nextSettings) => {
                  setSettings(nextSettings);
                })
                .catch((error) => {
                  const err = error as { title?: string; message?: string; technicalDetails?: string } | undefined;
                  addToast({ variant: "error", title: err?.title ?? "Settings update failed", message: err?.message ?? "Could not save settings.", technicalDetails: err?.technicalDetails });
                })
            }
          />
        ) : view === "dashboard" ? (
          <div className="flex min-h-0 flex-1">
            <DashboardView
              summary={dashboardSummary}
              storage={dashboardStorage}
              isLoading={!dashboardSummary}
              isLoadingStorage={isLoadingDashboardStorage}
              onSelectItem={selectItem}
              onOpenQueue={() => setView("queue")}
            />
            <ItemDetailView item={selectedItem} jumpToSeconds={jumpToSeconds} isLoading={isLoadingDetail} onReload={() => void reloadSelectedItemAndVisibleList()} />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <ItemList
              items={view === "search" ? searchItems : currentItemList}
              selectedItemId={selectedItemId}
              searchResults={currentSearchResults}
              activeFilterLabel={activeFilter?.name}
              isLoading={view === "search" ? isLoadingSearch : isLoadingItems}
              isLoadingMore={view === "search" ? isLoadingSearchMore : isLoadingItemsMore}
              hasMore={view === "search" ? searchPage?.nextOffset !== null : itemsPage?.nextOffset !== null}
              onLoadMore={() => void (view === "search" ? handleLoadMoreSearch() : handleLoadMoreItems())}
              onSelectItem={selectItem}
            />
            <ItemDetailView item={selectedItem} jumpToSeconds={jumpToSeconds} isLoading={isLoadingDetail} onReload={() => void reloadSelectedItemAndVisibleList()} />
          </div>
        )}
        <footer className="h-7 shrink-0 border-t border-border bg-card px-3 py-1 text-xs text-muted-foreground">{statusMessage}</footer>
      </main>
      <Toaster toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
