export const ipcChannels = {
  library: {
    getCurrent: "library:getCurrent",
    getLast: "library:getLast",
    choose: "library:choose",
    openLast: "library:openLast",
    validate: "library:validate",
    openFolder: "library:openFolder",
    rescan: "library:rescan",
    getSettings: "library:getSettings",
    updateSettings: "library:updateSettings",
  },
  import: {
    chooseFiles: "import:chooseFiles",
    files: "import:files",
  },
  queue: {
    listJobs: "queue:listJobs",
    retryJob: "queue:retryJob",
    cancelJob: "queue:cancelJob",
    jobsChanged: "queue:jobsChanged",
    processingEvent: "queue:processingEvent",
  },
  items: {
    list: "items:list",
    get: "items:get",
    readNote: "items:readNote",
    saveNote: "items:saveNote",
    updateMetadata: "items:updateMetadata",
  },
  search: {
    search: "search:search",
    reindex: "search:reindex",
  },
  dashboard: {
    getSummary: "dashboard:getSummary",
  },
  models: {
    list: "models:list",
    download: "models:download",
    delete: "models:delete",
    setDefault: "models:setDefault",
  },
} as const;
