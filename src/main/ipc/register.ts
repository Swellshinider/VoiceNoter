import { BrowserWindow, ipcMain } from "electron";
import { ipcChannels } from "../../shared/ipc";
import {
  importPathsSchema,
  itemIdSchema,
  itemListQuerySchema,
  itemMetadataUpdateSchema,
  jobIdSchema,
  libraryPathSchema,
  librarySettingsPatchSchema,
  markdownSchema,
  modelIdSchema,
  queueListQuerySchema,
  searchQuerySchema,
} from "../../shared/validation";
import type { AppServices } from "../services/app-services";

export function registerIpcHandlers(services: AppServices): void {
  ipcMain.handle(ipcChannels.library.getCurrent, () => services.getCurrentLibrary());
  ipcMain.handle(ipcChannels.library.getLast, () => services.getLastLibrary());
  ipcMain.handle(ipcChannels.library.choose, () => services.chooseLibrary());
  ipcMain.handle(ipcChannels.library.openLast, () => services.openLastLibrary());
  ipcMain.handle(ipcChannels.library.validate, (_event, path: unknown) => services.validateLibrary(libraryPathSchema.parse(path)));
  ipcMain.handle(ipcChannels.library.openFolder, () => services.openLibraryFolder());
  ipcMain.handle(ipcChannels.library.rescan, () => services.rescanLibrary());
  ipcMain.handle(ipcChannels.library.getSettings, () => services.getSettings());
  ipcMain.handle(ipcChannels.library.updateSettings, (_event, patch: unknown) => services.updateSettings(librarySettingsPatchSchema.parse(patch)));

  ipcMain.handle(ipcChannels.import.chooseFiles, () => services.chooseFilesForImport());
  ipcMain.handle(ipcChannels.import.files, (_event, paths: unknown) => services.importFiles(importPathsSchema.parse(paths)));

  ipcMain.handle(ipcChannels.queue.listJobs, (_event, query: unknown) => services.listJobs(queueListQuerySchema.parse(query ?? {})));
  ipcMain.handle(ipcChannels.queue.getSummary, () => services.getQueueSummary());
  ipcMain.handle(ipcChannels.queue.retryJob, (_event, jobId: unknown) => services.retryJob(jobIdSchema.parse(jobId)));
  ipcMain.handle(ipcChannels.queue.cancelJob, (_event, jobId: unknown) => services.cancelJob(jobIdSchema.parse(jobId)));

  ipcMain.handle(ipcChannels.items.list, (_event, query: unknown) => services.listItems(itemListQuerySchema.parse(query ?? {})));
  ipcMain.handle(ipcChannels.items.getFacets, () => services.getItemFacets());
  ipcMain.handle(ipcChannels.items.get, (_event, itemId: unknown) => services.getItem(itemIdSchema.parse(itemId)));
  ipcMain.handle(ipcChannels.items.readNote, (_event, itemId: unknown) => services.readNote(itemIdSchema.parse(itemId)));
  ipcMain.handle(ipcChannels.items.saveNote, (_event, itemId: unknown, markdown: unknown) =>
    services.saveNote(itemIdSchema.parse(itemId), markdownSchema.parse(markdown)),
  );
  ipcMain.handle(ipcChannels.items.updateMetadata, (_event, itemId: unknown, metadata: unknown) =>
    services.updateItemMetadata(itemIdSchema.parse(itemId), itemMetadataUpdateSchema.parse(metadata)),
  );

  ipcMain.handle(ipcChannels.search.search, (_event, query: unknown) => services.search(searchQuerySchema.parse(query)));
  ipcMain.handle(ipcChannels.search.reindex, () => services.reindex());

  ipcMain.handle(ipcChannels.dashboard.getSummary, () => services.getDashboardSummary());
  ipcMain.handle(ipcChannels.dashboard.getStorageBreakdown, () => services.getDashboardStorageBreakdown());

  ipcMain.handle(ipcChannels.models.list, () => services.listModels());
  ipcMain.handle(ipcChannels.models.download, (_event, modelId: unknown) => services.downloadModel(modelIdSchema.parse(modelId)));
  ipcMain.handle(ipcChannels.models.delete, (_event, modelId: unknown) => services.deleteModel(modelIdSchema.parse(modelId)));
  ipcMain.handle(ipcChannels.models.setDefault, (_event, modelId: unknown) => services.setDefaultModel(modelIdSchema.parse(modelId)));

  services.onJobsChanged((jobs) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(ipcChannels.queue.queueUpdated, jobs);
    }
  });
  services.onProcessingEvent((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(ipcChannels.queue.processingEvent, event);
    }
  });
}
