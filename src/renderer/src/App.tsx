import { Import, Search as SearchIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ItemDetail, ItemSummary, Job, LibraryState, ModelInfo, SearchResult } from "../../shared/types";
import { ItemDetail as ItemDetailView } from "./components/ItemDetail";
import { ItemList } from "./components/ItemList";
import { ModelManager } from "./components/ModelManager";
import { QueueView } from "./components/QueueView";
import { SettingsView } from "./components/SettingsView";
import { SetupView } from "./components/SetupView";
import { Sidebar, type ViewKey } from "./components/Sidebar";
import { Button, Input } from "./components/ui";

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

  const refreshLibraryData = useCallback(async () => {
    const [nextLibrary, nextJobs, nextModels, nextItems] = await Promise.all([
      window.voiceNoter.library.getCurrentLibrary(),
      window.voiceNoter.queue.listJobs().catch(() => []),
      window.voiceNoter.models.listModels().catch(() => []),
      window.voiceNoter.items.listItems({ view: "all" }).catch(() => []),
    ]);
    setLibrary(nextLibrary);
    setJobs(nextJobs);
    setModels(nextModels);
    setItems(nextItems);
  }, []);

  const refreshSelectedItem = useCallback(async () => {
    if (!selectedItemId) {
      setSelectedItem(null);
      return;
    }
    const detail = await window.voiceNoter.items.getItem(selectedItemId);
    setSelectedItem(detail);
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

  const visibleItems = useMemo(() => {
    if (view === "inbox") {
      return items.filter((item) => item.status !== "ready");
    }
    if (view === "search" && searchResults.length) {
      const ids = new Set(searchResults.map((result) => result.itemId));
      return items.filter((item) => ids.has(item.id));
    }
    return items;
  }, [items, searchResults, view]);

  async function chooseLibrary() {
    setStatusMessage("Choosing library");
    const next = await window.voiceNoter.library.chooseLibrary();
    setLibrary(next);
    setView("inbox");
    await refreshLibraryData();
    setStatusMessage("Library ready");
  }

  async function importFiles(paths?: string[]) {
    const importPaths =
      paths ??
      (await window.voiceNoter.import.chooseFilesForImport()).filter((candidate) => candidate.supported).map((candidate) => candidate.path);
    if (importPaths.length === 0) {
      return;
    }
    setStatusMessage("Importing media");
    const result = await window.voiceNoter.import.importFiles(importPaths);
    await refreshLibraryData();
    setView("queue");
    setStatusMessage(
      result.rejectedFiles.length
        ? `Imported ${result.importedItems.length}; rejected ${result.rejectedFiles.length}`
        : `Imported ${result.importedItems.length}`,
    );
  }

  async function runSearch() {
    if (!searchText.trim()) {
      setSearchResults([]);
      return;
    }
    const results = await window.voiceNoter.search.search({ text: searchText.trim() });
    setSearchResults(results);
    setView("search");
    setStatusMessage(`${results.length} search results`);
  }

  function selectItem(itemId: string, startSeconds?: number | null) {
    setSelectedItemId(itemId);
    setJumpToSeconds(startSeconds ?? null);
  }

  if (!library) {
    return <SetupView library={library} models={models} onChooseLibrary={() => void chooseLibrary()} />;
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
      <Sidebar view={view} items={items} onViewChange={setView} />
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
            onRetry={(jobId) => void window.voiceNoter.queue.retryJob(jobId).then(refreshLibraryData)}
            onCancel={(jobId) => void window.voiceNoter.queue.cancelJob(jobId).then(refreshLibraryData)}
          />
        ) : view === "models" ? (
          <ModelManager
            models={models}
            onDownload={(modelId) => void window.voiceNoter.models.downloadModel(modelId).then(refreshLibraryData)}
            onDelete={(modelId) => void window.voiceNoter.models.deleteModel(modelId).then(refreshLibraryData)}
            onSelect={(modelId) => void window.voiceNoter.models.setDefaultModel(modelId).then(refreshLibraryData)}
          />
        ) : view === "settings" ? (
          <SettingsView
            library={library}
            onOpenFolder={() => void window.voiceNoter.library.openLibraryFolder()}
            onRescan={() => void window.voiceNoter.library.rescanLibrary().then(refreshLibraryData)}
            onReindex={() => void window.voiceNoter.search.reindex().then(refreshLibraryData)}
          />
        ) : (
          <div className="flex min-h-0 flex-1">
            <ItemList items={visibleItems} selectedItemId={selectedItemId} searchResults={view === "search" ? searchResults : []} onSelectItem={selectItem} />
            <ItemDetailView item={selectedItem} jumpToSeconds={jumpToSeconds} onReload={() => void Promise.all([refreshLibraryData(), refreshSelectedItem()])} />
          </div>
        )}
        <footer className="h-7 shrink-0 border-t border-border bg-card px-3 py-1 text-xs text-muted-foreground">{statusMessage}</footer>
      </main>
    </div>
  );
}
