import { contextBridge, ipcRenderer } from "electron";
import { ipcChannels } from "../shared/ipc";
import type {
  ImportApi,
  DashboardApi,
  ItemsApi,
  LibraryApi,
  ModelsApi,
  QueueApi,
  SearchApi,
  VoiceNoterApi,
} from "../shared/types";

const library: LibraryApi = {
  getCurrentLibrary: () => ipcRenderer.invoke(ipcChannels.library.getCurrent),
  getLastLibrary: () => ipcRenderer.invoke(ipcChannels.library.getLast),
  chooseLibrary: () => ipcRenderer.invoke(ipcChannels.library.choose),
  openLastLibrary: () => ipcRenderer.invoke(ipcChannels.library.openLast),
  validateLibrary: (path) => ipcRenderer.invoke(ipcChannels.library.validate, path),
  openLibraryFolder: () => ipcRenderer.invoke(ipcChannels.library.openFolder),
  rescanLibrary: () => ipcRenderer.invoke(ipcChannels.library.rescan),
  getSettings: () => ipcRenderer.invoke(ipcChannels.library.getSettings),
  updateSettings: (patch) => ipcRenderer.invoke(ipcChannels.library.updateSettings, patch),
};

const importApi: ImportApi = {
  chooseFilesForImport: () => ipcRenderer.invoke(ipcChannels.import.chooseFiles),
  importFiles: (paths) => ipcRenderer.invoke(ipcChannels.import.files, paths),
};

const queue: QueueApi = {
  listJobs: (query) => ipcRenderer.invoke(ipcChannels.queue.listJobs, query),
  getSummary: () => ipcRenderer.invoke(ipcChannels.queue.getSummary),
  retryJob: (jobId) => ipcRenderer.invoke(ipcChannels.queue.retryJob, jobId),
  cancelJob: (jobId) => ipcRenderer.invoke(ipcChannels.queue.cancelJob, jobId),
  subscribeToQueueUpdates: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, update: Parameters<typeof callback>[0]) => callback(update);
    ipcRenderer.on(ipcChannels.queue.queueUpdated, listener);
    return () => ipcRenderer.off(ipcChannels.queue.queueUpdated, listener);
  },
  subscribeToProcessingEvents: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, event: Parameters<typeof callback>[0]) => callback(event);
    ipcRenderer.on(ipcChannels.queue.processingEvent, listener);
    return () => ipcRenderer.off(ipcChannels.queue.processingEvent, listener);
  },
};

const items: ItemsApi = {
  listItems: (query) => ipcRenderer.invoke(ipcChannels.items.list, query),
  getFacets: () => ipcRenderer.invoke(ipcChannels.items.getFacets),
  getItem: (itemId) => ipcRenderer.invoke(ipcChannels.items.get, itemId),
  readNote: (itemId) => ipcRenderer.invoke(ipcChannels.items.readNote, itemId),
  saveNote: (itemId, markdown) => ipcRenderer.invoke(ipcChannels.items.saveNote, itemId, markdown),
  updateItemMetadata: (itemId, metadata) => ipcRenderer.invoke(ipcChannels.items.updateMetadata, itemId, metadata),
  updateTranscript: (itemId, update) => ipcRenderer.invoke(ipcChannels.items.updateTranscript, itemId, update),
};

const search: SearchApi = {
  search: (query) => ipcRenderer.invoke(ipcChannels.search.search, query),
  reindex: () => ipcRenderer.invoke(ipcChannels.search.reindex),
};

const dashboard: DashboardApi = {
  getSummary: () => ipcRenderer.invoke(ipcChannels.dashboard.getSummary),
  getStorageBreakdown: () => ipcRenderer.invoke(ipcChannels.dashboard.getStorageBreakdown),
};

const models: ModelsApi = {
  listModels: () => ipcRenderer.invoke(ipcChannels.models.list),
  downloadModel: (modelId) => ipcRenderer.invoke(ipcChannels.models.download, modelId),
  deleteModel: (modelId) => ipcRenderer.invoke(ipcChannels.models.delete, modelId),
  setDefaultModel: (modelId) => ipcRenderer.invoke(ipcChannels.models.setDefault, modelId),
};

const api: VoiceNoterApi = {
  library,
  import: importApi,
  queue,
  items,
  search,
  dashboard,
  models,
};

contextBridge.exposeInMainWorld("voiceNoter", api);
