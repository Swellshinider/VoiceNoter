import { Import, Search as SearchIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ItemDetail, ItemSummary, Job, LibrarySettings, LibraryState, ModelInfo, SearchResult } from "../../shared/types";
import { ItemDetail as ItemDetailView } from "./components/ItemDetail";
import { ItemList } from "./components/ItemList";
import { ModelManager } from "./components/ModelManager";
import { QueueView } from "./components/QueueView";
import { SettingsView } from "./components/SettingsView";
import { SetupView } from "./components/SetupView";
import { Sidebar, type FilterState, type ViewKey } from "./components/Sidebar";
import { Button, Input, Toaster, type ToastEntry } from "./components/ui";

export function App() {
  const [library, setLibrary] = useState<LibraryState | null>(null);
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [view, setView] = useState<ViewKey>("inbox");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemDetail | null>(null);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [jumpToSeconds, setJumpToSeconds] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterState>(null);
  const [settings, setSettings] = useState<LibrarySettings | null>(null);
  const [lastLibraryPath, setLastLibraryPath] = useState<string | null>(null);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  function addToast(entry: Omit<ToastEntry, "id">) {
    setToasts((prev) => [...prev, { ...entry, id: crypto.randomUUID() }]);
  }

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  const refreshLibraryData = useCallback(async () => {
    const query = activeFilter
      ? { view: activeFilter.type as "category" | "tag", ...(activeFilter.type === "category" ? { categoryId: activeFilter.id } : { tagId: activeFilter.id }) }
      : view === "inbox"
        ? { view: "inbox" as const }
        : { view: "all" as const };
    setIsLoadingItems(true);
    try {
      const [nextLibrary, nextLastLibraryPath, nextJobs, nextModels, nextItems, nextSettings] = await Promise.all([
        window.voiceNoter.library.getCurrentLibrary(),
        window.voiceNoter.library.getLastLibrary().catch(() => null),
        window.voiceNoter.queue.listJobs().catch(() => []),
        window.voiceNoter.models.listModels().catch(() => []),
        window.voiceNoter.items.listItems(query).catch(() => []),
        window.voiceNoter.library.getSettings().catch(() => null),
      ]);
      setLibrary(nextLibrary);
      setLastLibraryPath(nextLastLibraryPath);
      setJobs(nextJobs);
      setModels(nextModels);
      setItems(nextItems);
      setSettings(nextSettings);
    } finally {
      setIsLoadingItems(false);
    }
  }, [view, activeFilter]);

  const refreshSelectedItem = useCallback(async () => {
    if (!selectedItemId) {
      setSelectedItem(null);
      return;
    }
    setIsLoadingDetail(true);
    try {
      const detail = await window.voiceNoter.items.getItem(selectedItemId);
      setSelectedItem(detail);
    } finally {
      setIsLoadingDetail(false);
    }
  }, [selectedItemId]);

  useEffect(() => {
    void refreshLibraryData().catch(() => setStatusMessage("Choose a library to begin."));
  }, [refreshLibraryData]);

  useEffect(() => {
    const unsubscribeJobs = window.voiceNoter.queue.subscribeToJobs((nextJobs) => {
      setJobs(nextJobs);
      void refreshLibraryData();
    });
    const unsubscribeProcessing = window.voiceNoter.queue.subscribeToProcessingEvents((event) => {
      setStatusMessage(`${event.stage}: ${event.message} (${Math.round(event.progress * 100)}%)`);
    });
    return () => {
      unsubscribeJobs();
      unsubscribeProcessing();
    };
  }, [refreshLibraryData]);

  useEffect(() => {
    void refreshSelectedItem();
  }, [refreshSelectedItem]);

  useEffect(() => {
    void refreshLibraryData().catch(() => {});
  }, [view, activeFilter, refreshLibraryData]);

  const visibleItems = useMemo(() => {
    if (view === "search" && searchResults.length) {
      const ids = new Set(searchResults.map((result) => result.itemId));
      return items.filter((item) => ids.has(item.id));
    }
    return items;
  }, [items, searchResults, view]);

  async function chooseLibrary() {
    setStatusMessage("Choosing library");
    try {
      const next = await window.voiceNoter.library.chooseLibrary();
      setLibrary(next);
      setLastLibraryPath(next.path);
      setView("inbox");
      await refreshLibraryData();
      setStatusMessage("Library ready");
    } catch (error) {
      const err = error as { title?: string; message?: string; technicalDetails?: string } | undefined;
      addToast({ variant: "error", title: err?.title ?? "Library setup failed", message: err?.message ?? "VoiceNoter could not set up the library.", technicalDetails: err?.technicalDetails });
    }
  }

  async function openLastLibrary() {
    setStatusMessage("Opening last library");
    try {
      const next = await window.voiceNoter.library.openLastLibrary();
      setLibrary(next);
      setLastLibraryPath(next.path);
      setView("inbox");
      await refreshLibraryData();
      setStatusMessage("Library ready");
    } catch (error) {
      const err = error as { title?: string; message?: string; technicalDetails?: string } | undefined;
      addToast({ variant: "error", title: err?.title ?? "Library setup failed", message: err?.message ?? "VoiceNoter could not open the last library.", technicalDetails: err?.technicalDetails });
      await refreshLibraryData().catch(() => {});
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
      await refreshLibraryData();
      setView("queue");
      setStatusMessage(
        result.rejectedFiles.length
          ? `Imported ${result.importedItems.length}; rejected ${result.rejectedFiles.length}`
          : `Imported ${result.importedItems.length}`,
      );
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
    if (!searchText.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await window.voiceNoter.search.search({ text: searchText.trim() });
      setSearchResults(results);
      setView("search");
      setStatusMessage(`${results.length} search results`);
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
    if (filter) {
      setView(filter.type === "category" ? "all" : "all");
    }
  }

  if (!library) {
    return (
      <SetupView
        library={library}
        models={models}
        lastLibraryPath={lastLibraryPath}
        onChooseLibrary={() => void chooseLibrary()}
        onOpenLastLibrary={() => void openLastLibrary()}
        onDownloadModel={(modelId) => void window.voiceNoter.models.downloadModel(modelId).then(refreshLibraryData).catch((e: { title?: string; message?: string; technicalDetails?: string }) => addToast({ variant: "error", title: e?.title ?? "Download failed", message: e?.message ?? "Could not download model.", technicalDetails: e?.technicalDetails }))}
      />
    );
  }

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
      <Sidebar view={view} items={items} activeFilter={activeFilter} onViewChange={setView} onFilterSelect={handleFilterSelect} />
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
            {jobs.filter((job) => job.status === "running" || job.status === "pending").length} active jobs
          </button>
        </header>
        {view === "queue" ? (
          <QueueView
            jobs={jobs}
            onRetry={(jobId) => void window.voiceNoter.queue.retryJob(jobId).then(refreshLibraryData).catch((e: { title?: string; message?: string; technicalDetails?: string }) => addToast({ variant: "error", title: e?.title ?? "Retry failed", message: e?.message ?? "Could not retry job.", technicalDetails: e?.technicalDetails }))}
            onCancel={(jobId) => void window.voiceNoter.queue.cancelJob(jobId).then(refreshLibraryData).catch((e: { title?: string; message?: string; technicalDetails?: string }) => addToast({ variant: "error", title: e?.title ?? "Cancel failed", message: e?.message ?? "Could not cancel job.", technicalDetails: e?.technicalDetails }))}
          />
        ) : view === "models" ? (
          <ModelManager
            models={models}
            onDownload={(modelId) => void window.voiceNoter.models.downloadModel(modelId).then(refreshLibraryData).catch((e: { title?: string; message?: string; technicalDetails?: string }) => addToast({ variant: "error", title: e?.title ?? "Download failed", message: e?.message ?? "Could not download model.", technicalDetails: e?.technicalDetails }))}
            onDelete={(modelId) => void window.voiceNoter.models.deleteModel(modelId).then(refreshLibraryData).catch((e: { title?: string; message?: string; technicalDetails?: string }) => addToast({ variant: "error", title: e?.title ?? "Delete failed", message: e?.message ?? "Could not delete model.", technicalDetails: e?.technicalDetails }))}
            onSelect={(modelId) => void window.voiceNoter.models.setDefaultModel(modelId).then(refreshLibraryData).catch((e: { title?: string; message?: string; technicalDetails?: string }) => addToast({ variant: "error", title: e?.title ?? "Selection failed", message: e?.message ?? "Could not set default model.", technicalDetails: e?.technicalDetails }))}
          />
        ) : view === "settings" ? (
          <SettingsView
            library={library}
            settings={settings}
            models={models}
            onOpenFolder={() => void window.voiceNoter.library.openLibraryFolder()}
            onRescan={() => void window.voiceNoter.library.rescanLibrary().then(refreshLibraryData).catch((e: { title?: string; message?: string; technicalDetails?: string }) => addToast({ variant: "error", title: e?.title ?? "Rescan failed", message: e?.message ?? "Could not rescan library.", technicalDetails: e?.technicalDetails }))}
            onReindex={() => void window.voiceNoter.search.reindex().then(refreshLibraryData).catch((e: { title?: string; message?: string; technicalDetails?: string }) => addToast({ variant: "error", title: e?.title ?? "Reindex failed", message: e?.message ?? "Could not reindex search.", technicalDetails: e?.technicalDetails }))}
            onUpdateSettings={(patch) =>
              void window.voiceNoter.library
                .updateSettings(patch)
                .then(setSettings)
                .catch((error) => {
                  const err = error as { title?: string; message?: string; technicalDetails?: string } | undefined;
                  addToast({ variant: "error", title: err?.title ?? "Settings update failed", message: err?.message ?? "Could not save settings.", technicalDetails: err?.technicalDetails });
                })
            }
          />
        ) : (
          <div className="flex min-h-0 flex-1">
            <ItemList items={visibleItems} selectedItemId={selectedItemId} searchResults={view === "search" ? searchResults : []} activeFilterLabel={activeFilter ? activeFilter.name : undefined} isLoading={isLoadingItems} onSelectItem={selectItem} />
            <ItemDetailView item={selectedItem} jumpToSeconds={jumpToSeconds} isLoading={isLoadingDetail} onReload={() => void Promise.all([refreshLibraryData(), refreshSelectedItem()])} />
          </div>
        )}
        <footer className="h-7 shrink-0 border-t border-border bg-card px-3 py-1 text-xs text-muted-foreground">{statusMessage}</footer>
      </main>
      <Toaster toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
