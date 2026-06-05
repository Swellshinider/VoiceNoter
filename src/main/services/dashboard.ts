import { stat, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type {
  DashboardCounts,
  DashboardItemStatus,
  DashboardLatestItem,
  DashboardQueueHealth,
  DashboardStorageBreakdown,
  DashboardSummary,
  DashboardTrendPoint,
} from "../../shared/types";
import type { VoiceNoterDatabase } from "./database";

type DashboardCountsRow = {
  totalItems: number;
  audioItems: number;
  videoItems: number;
  pendingItems: number;
  failedItems: number;
  cancelledItems: number;
};

type DashboardLatestRow = {
  itemId: string;
  title: string;
  sourceType: DashboardLatestItem["sourceType"];
  itemStatus: string;
  hasTranscript: number;
  date: string;
};

type DashboardQueueHealthRow = {
  pendingJobs: number;
  runningJobs: number;
  failedJobs: number;
  oldestPendingAt: string | null;
};

type StorageBuckets = Omit<DashboardStorageBreakdown, "totalBytes">;

const STORAGE_ROOTS = {
  originalMedia: join("media", "original"),
  extractedAudio: join("media", "extracted"),
  notes: "notes",
  models: "models",
  indexes: "indexes",
} as const;

export async function getDashboardSummary(libraryRoot: string, db: VoiceNoterDatabase): Promise<DashboardSummary> {
  const [counts, storage, trend, latestItems, queueHealth] = await Promise.all([
    getDashboardCounts(db),
    getLibraryStorageBreakdown(libraryRoot),
    getTranscriptionTrend(db),
    getLatestPipelineItems(db),
    getQueueHealth(db),
  ]);

  return {
    counts,
    storage,
    trend,
    latestItems,
    queueHealth,
  };
}

async function getDashboardCounts(db: VoiceNoterDatabase): Promise<DashboardCounts> {
  const row = db
    .prepare(
      `
        SELECT
          COUNT(*) AS totalItems,
          COALESCE(SUM(CASE WHEN source_type = 'audio' THEN 1 ELSE 0 END), 0) AS audioItems,
          COALESCE(SUM(CASE WHEN source_type = 'video' THEN 1 ELSE 0 END), 0) AS videoItems,
          COALESCE(SUM(CASE WHEN status = 'importing' OR status = 'processing' THEN 1 ELSE 0 END), 0) AS pendingItems,
          COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failedItems,
          COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelledItems
        FROM items
      `,
    )
    .get() as DashboardCountsRow;

  const transcribedItems = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM items
        WHERE status = 'ready'
          OR EXISTS (SELECT 1 FROM transcripts WHERE transcripts.item_id = items.id)
      `,
    )
    .get() as { count: number };

  return {
    totalItems: row.totalItems,
    audioItems: row.audioItems,
    videoItems: row.videoItems,
    transcribedItems: transcribedItems.count,
    pendingItems: row.pendingItems,
    failedItems: row.failedItems,
    cancelledItems: row.cancelledItems,
  };
}

async function getLibraryStorageBreakdown(libraryRoot: string): Promise<DashboardStorageBreakdown> {
  const buckets: StorageBuckets = {
    originalMediaBytes: 0,
    extractedAudioBytes: 0,
    notesBytes: 0,
    modelsBytes: 0,
    databaseBytes: 0,
    indexesBytes: 0,
    otherBytes: 0,
  };

  await walkLibraryFiles(libraryRoot, async (absolutePath, relativePath) => {
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) {
      return;
    }
    const size = fileStat.size;
    const normalizedRelativePath = normalizeRelativePath(relativePath);
    if (normalizedRelativePath === "voicenoter.db") {
      buckets.databaseBytes += size;
      return;
    }
    if (normalizedRelativePath.startsWith(`${STORAGE_ROOTS.originalMedia}/`)) {
      buckets.originalMediaBytes += size;
      return;
    }
    if (normalizedRelativePath.startsWith(`${STORAGE_ROOTS.extractedAudio}/`)) {
      buckets.extractedAudioBytes += size;
      return;
    }
    if (normalizedRelativePath.startsWith(`${STORAGE_ROOTS.notes}/`)) {
      buckets.notesBytes += size;
      return;
    }
    if (normalizedRelativePath.startsWith(`${STORAGE_ROOTS.models}/`)) {
      buckets.modelsBytes += size;
      return;
    }
    if (normalizedRelativePath.startsWith(`${STORAGE_ROOTS.indexes}/`)) {
      buckets.indexesBytes += size;
      return;
    }
    buckets.otherBytes += size;
  });

  const totalBytes =
    buckets.originalMediaBytes +
    buckets.extractedAudioBytes +
    buckets.notesBytes +
    buckets.modelsBytes +
    buckets.databaseBytes +
    buckets.indexesBytes +
    buckets.otherBytes;

  return {
    totalBytes,
    ...buckets,
  };
}

async function getTranscriptionTrend(db: VoiceNoterDatabase): Promise<DashboardTrendPoint[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 13);
  since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const rows = db
    .prepare(
      `
        SELECT date(created_at) AS day, COUNT(*) AS completedTranscriptions
        FROM transcripts
        WHERE created_at >= ?
        GROUP BY date(created_at)
      `,
    )
    .all(sinceIso) as Array<{ day: string; completedTranscriptions: number }>;

  const countsByDay = new Map(rows.map((row) => [row.day, row.completedTranscriptions]));
  const trend: DashboardTrendPoint[] = [];

  for (let offset = 0; offset < 14; offset += 1) {
    const day = new Date(since);
    day.setUTCDate(day.getUTCDate() + offset);
    const key = day.toISOString().slice(0, 10);
    trend.push({
      date: key,
      completedTranscriptions: countsByDay.get(key) ?? 0,
    });
  }

  return trend;
}

async function getLatestPipelineItems(db: VoiceNoterDatabase): Promise<DashboardLatestItem[]> {
  const rows = db
    .prepare(
      `
        SELECT
          items.id AS itemId,
          items.title,
          items.source_type AS sourceType,
          items.status AS itemStatus,
          COALESCE(MAX(transcripts.created_at), items.updated_at) AS date,
          CASE WHEN COUNT(transcripts.id) > 0 THEN 1 ELSE 0 END AS hasTranscript
        FROM items
        LEFT JOIN transcripts ON transcripts.item_id = items.id
        GROUP BY items.id
        ORDER BY datetime(date) DESC, datetime(items.imported_at) DESC
        LIMIT 10
      `,
    )
    .all() as DashboardLatestRow[];

  return rows.map((row) => ({
    itemId: row.itemId,
    title: row.title,
    sourceType: row.sourceType,
    status: getDashboardItemStatus(row.itemStatus, row.hasTranscript === 1),
    date: row.date,
  }));
}

async function getQueueHealth(db: VoiceNoterDatabase): Promise<DashboardQueueHealth> {
  const row = db
    .prepare(
      `
        SELECT
          COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pendingJobs,
          COALESCE(SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END), 0) AS runningJobs,
          COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failedJobs,
          MIN(CASE WHEN status = 'pending' THEN created_at END) AS oldestPendingAt
        FROM jobs
      `,
    )
    .get() as DashboardQueueHealthRow;

  return {
    pendingJobs: row.pendingJobs,
    runningJobs: row.runningJobs,
    failedJobs: row.failedJobs,
    activeJobs: row.pendingJobs + row.runningJobs,
    oldestPendingAt: row.oldestPendingAt,
  };
}

function getDashboardItemStatus(itemStatus: string, hasTranscript: boolean): DashboardItemStatus {
  if (itemStatus === "failed") {
    return "failed";
  }
  if (itemStatus === "cancelled") {
    return "cancelled";
  }
  if (itemStatus === "ready" || hasTranscript) {
    return "transcribed";
  }
  return "pending";
}

async function walkLibraryFiles(
  root: string,
  visit: (absolutePath: string, relativePath: string) => Promise<void>,
  currentRelativePath = "",
): Promise<void> {
  const currentRoot = currentRelativePath ? join(root, currentRelativePath) : root;
  const entries = await readdir(currentRoot, { withFileTypes: true });
  for (const entry of entries) {
    const nextRelativePath = currentRelativePath ? join(currentRelativePath, entry.name) : entry.name;
    const absolutePath = join(root, nextRelativePath);
    if (entry.isDirectory()) {
      await walkLibraryFiles(root, visit, nextRelativePath);
      continue;
    }
    if (entry.isFile()) {
      await visit(absolutePath, normalizeRelativePath(relative(root, absolutePath)));
    }
  }
}

function normalizeRelativePath(pathname: string): string {
  return pathname.split(sep).join("/");
}
