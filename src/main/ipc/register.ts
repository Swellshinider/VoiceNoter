import { BrowserWindow, ipcMain } from "electron";
import { ipcChannels } from "../../shared/ipc";
import type { AppServices } from "../services/app-services";

export function registerIpcHandlers(services: AppServices): void {
  ipcMain.handle(ipcChannels.library.getCurrent, () => services.getCurrentLibrary());
  ipcMain.handle(ipcChannels.library.getLast, () => services.getLastLibrary());
  ipcMain.handle(ipcChannels.library.choose, () => services.chooseLibrary());
  ipcMain.handle(ipcChannels.library.openLast, () => services.openLastLibrary());
  ipcMain.handle(ipcChannels.library.validate, (_event, path: string) => services.validateLibrary(path));
  ipcMain.handle(ipcChannels.library.openFolder, () => services.openLibraryFolder());
  ipcMain.handle(ipcChannels.library.rescan, () => services.rescanLibrary());
  ipcMain.handle(ipcChannels.library.getSettings, () => services.getSettings());
  ipcMain.handle(ipcChannels.library.updateSettings, (_event, patch) => services.updateSettings(patch));

  ipcMain.handle(ipcChannels.import.chooseFiles, () => services.chooseFilesForImport());
  ipcMain.handle(ipcChannels.import.files, (_event, paths: string[]) => services.importFiles(paths));

  ipcMain.handle(ipcChannels.queue.listJobs, () => services.listJobs());
  ipcMain.handle(ipcChannels.queue.retryJob, (_event, jobId: string) => services.retryJob(jobId));
  ipcMain.handle(ipcChannels.queue.cancelJob, (_event, jobId: string) => services.cancelJob(jobId));

  ipcMain.handle(ipcChannels.items.list, (_event, query) => services.listItems(query));
  ipcMain.handle(ipcChannels.items.get, (_event, itemId: string) => services.getItem(itemId));
  ipcMain.handle(ipcChannels.items.readNote, (_event, itemId: string) => services.readNote(itemId));
  ipcMain.handle(ipcChannels.items.saveNote, (_event, itemId: string, markdown: string) => services.saveNote(itemId, markdown));
  ipcMain.handle(ipcChannels.items.updateMetadata, (_event, itemId: string, metadata) => services.updateItemMetadata(itemId, metadata));

  ipcMain.handle(ipcChannels.search.search, (_event, query) => services.search(query));
  ipcMain.handle(ipcChannels.search.reindex, () => services.reindex());

  ipcMain.handle(ipcChannels.models.list, () => services.listModels());
  ipcMain.handle(ipcChannels.models.download, (_event, modelId: string) => services.downloadModel(modelId));
  ipcMain.handle(ipcChannels.models.delete, (_event, modelId: string) => services.deleteModel(modelId));
  ipcMain.handle(ipcChannels.models.setDefault, (_event, modelId: string) => services.setDefaultModel(modelId));

  services.onJobsChanged((jobs) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(ipcChannels.queue.jobsChanged, jobs);
    }
  });
  services.onProcessingEvent((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(ipcChannels.queue.processingEvent, event);
    }
  });
}
