import { contextBridge, ipcRenderer } from "electron";
import { ipcChannels } from "../shared/ipc";
import type {
  ImportApi,
  ItemsApi,
  LibraryApi,
  ModelsApi,
  QueueApi,
  SearchApi,
  VoiceNoterApi,
} from "../shared/types";

const library: LibraryApi = {
  getCurrentLibrary: () => ipcRenderer.invoke(ipcChannels.library.getCurrent),
  chooseLibrary: () => ipcRenderer.invoke(ipcChannels.library.choose),
  validateLibrary: (path) => ipcRenderer.invoke(ipcChannels.library.validate, path),
  openLibraryFolder: () => ipcRenderer.invoke(ipcChannels.library.openFolder),
  rescanLibrary: () => ipcRenderer.invoke(ipcChannels.library.rescan),
};

const importApi: ImportApi = {
  chooseFilesForImport: () => ipcRenderer.invoke(ipcChannels.import.chooseFiles),
  importFiles: (paths) => ipcRenderer.invoke(ipcChannels.import.files, paths),
};

const queue: QueueApi = {
  listJobs: () => ipcRenderer.invoke(ipcChannels.queue.listJobs),
  retryJob: (jobId) => ipcRenderer.invoke(ipcChannels.queue.retryJob, jobId),
  cancelJob: (jobId) => ipcRenderer.invoke(ipcChannels.queue.cancelJob, jobId),
  subscribeToJobs: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, jobs: Parameters<typeof callback>[0]) => callback(jobs);
    ipcRenderer.on(ipcChannels.queue.jobsChanged, listener);
    return () => ipcRenderer.off(ipcChannels.queue.jobsChanged, listener);
  },
  subscribeToProcessingEvents: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, event: Parameters<typeof callback>[0]) => callback(event);
    ipcRenderer.on(ipcChannels.queue.processingEvent, listener);
    return () => ipcRenderer.off(ipcChannels.queue.processingEvent, listener);
  },
};

const items: ItemsApi = {
  listItems: (query) => ipcRenderer.invoke(ipcChannels.items.list, query),
  getItem: (itemId) => ipcRenderer.invoke(ipcChannels.items.get, itemId),
  readNote: (itemId) => ipcRenderer.invoke(ipcChannels.items.readNote, itemId),
  saveNote: (itemId, markdown) => ipcRenderer.invoke(ipcChannels.items.saveNote, itemId, markdown),
  updateItemMetadata: (itemId, metadata) => ipcRenderer.invoke(ipcChannels.items.updateMetadata, itemId, metadata),
};

const search: SearchApi = {
  search: (query) => ipcRenderer.invoke(ipcChannels.search.search, query),
  reindex: () => ipcRenderer.invoke(ipcChannels.search.reindex),
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
  models,
};

contextBridge.exposeInMainWorld("voiceNoter", api);
