import { EventEmitter } from "node:events";
import { toUserFacingError, userError } from "../../shared/errors";
import type {
  Job,
  JobStatus,
  JobType,
  PageResult,
  ProcessingStatusGroup,
  ProcessingEvent,
  QueueListQuery,
  QueueSummary,
  QueueUpdate,
  UserFacingError,
} from "../../shared/types";
import type { VoiceNoterDatabase } from "./database";

type JobRow = {
  id: string;
  item_id: string | null;
  type: JobType;
  status: JobStatus;
  payload_json: string;
  progress: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

export class QueueService {
  private readonly events = new EventEmitter();

  constructor(private readonly db: VoiceNoterDatabase) {}

  async listJobs(query: QueueListQuery = {}): Promise<PageResult<ProcessingStatusGroup>> {
    const { limit, offset } = normalizePageRequest(query);
    const { whereClause, params } = buildWhereClause(query);

    const totalRow = this.db
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM (
            SELECT COALESCE(item_id, '__system__') AS group_key
            FROM jobs
            ${whereClause}
            GROUP BY COALESCE(item_id, '__system__')
          )
        `,
      )
      .get(...params) as { count: number };

    const groupRows = this.db
      .prepare(
        `
          SELECT
            jobs.item_id,
            COALESCE(items.title, 'System Tasks') AS label,
            MAX(datetime(jobs.created_at)) AS latest_created_at
          FROM jobs
          LEFT JOIN items ON items.id = jobs.item_id
          ${whereClause}
          GROUP BY jobs.item_id, label
          ORDER BY datetime(latest_created_at) DESC, label ASC
          LIMIT ? OFFSET ?
        `,
      )
      .all(...params, limit, offset) as Array<{
      item_id: string | null;
      label: string;
    }>;

    return {
      items: groupRows.map((groupRow) => ({
        kind: groupRow.item_id ? "item" : "system",
        itemId: groupRow.item_id,
        label: groupRow.label,
        jobs: this.listGroupJobs(groupRow.item_id, query),
      })),
      total: totalRow.count,
      limit,
      offset,
      nextOffset: offset + groupRows.length < totalRow.count ? offset + groupRows.length : null,
    };
  }

  async getSummary(): Promise<QueueSummary> {
    const row = this.db
      .prepare(
        `
          SELECT
            COUNT(*) AS totalJobs,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pendingJobs,
            COALESCE(SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END), 0) AS runningJobs,
            COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completedJobs,
            COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failedJobs,
            COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelledJobs,
            MIN(CASE WHEN status = 'pending' THEN created_at END) AS oldestPendingAt
          FROM jobs
        `,
      )
      .get() as QueueSummary;

    return {
      ...row,
      activeJobs: row.pendingJobs + row.runningJobs,
    };
  }

  async retryJob(jobId: string): Promise<Job> {
    const job = this.getJob(jobId);
    if (job.status !== "failed" && job.status !== "cancelled") {
      return job;
    }
    const retry = this.db.transaction(() => {
      if (!job.itemId) {
        this.resetJob(jobId);
        return;
      }
      const rowid = this.getJobRowid(jobId);
      this.db
        .prepare(
          `
            UPDATE jobs
            SET status = 'pending', progress = 0, error_message = NULL, started_at = NULL, completed_at = NULL
            WHERE item_id = ?
              AND rowid >= ?
          `,
        )
        .run(job.itemId, rowid);
      this.db.prepare("UPDATE items SET status = 'processing', updated_at = ? WHERE id = ?").run(new Date().toISOString(), job.itemId);
    });
    retry();
    this.emitJobsChanged([jobId]);
    return this.getJob(jobId);
  }

  async cancelJob(jobId: string): Promise<Job> {
    const job = this.getJob(jobId);
    if (job.status !== "pending" && job.status !== "running") {
      return job;
    }
    const now = new Date().toISOString();
    const cancel = this.db.transaction(() => {
      this.db
        .prepare("UPDATE jobs SET status = 'cancelled', completed_at = ?, progress = ? WHERE id = ?")
        .run(now, job.progress, jobId);
      this.cancelDependentJobs(jobId, job.itemId, now);
    });
    cancel();
    this.emitJobsChanged([jobId]);
    return this.getJob(jobId);
  }

  startJob(jobId: string): Job {
    this.db
      .prepare("UPDATE jobs SET status = 'running', started_at = ?, completed_at = NULL, error_message = NULL WHERE id = ?")
      .run(new Date().toISOString(), jobId);
    this.emitJobsChanged([jobId]);
    return this.getJob(jobId);
  }

  completeJob(jobId: string): Job {
    this.db
      .prepare("UPDATE jobs SET status = 'completed', progress = 1, completed_at = ?, error_message = NULL WHERE id = ?")
      .run(new Date().toISOString(), jobId);
    this.emitJobsChanged([jobId]);
    return this.getJob(jobId);
  }

  updateProgress(jobId: string, progress: number, event?: Omit<ProcessingEvent, "jobId" | "progress">): Job {
    const normalized = Math.max(0, Math.min(1, progress));
    this.db.prepare("UPDATE jobs SET progress = ? WHERE id = ?").run(normalized, jobId);
    const job = this.getJob(jobId);
    if (event) {
      this.events.emit("processingEvent", {
        ...event,
        jobId,
        progress: normalized,
      });
    }
    this.emitJobsChanged([jobId]);
    return job;
  }

  failJob(jobId: string, error: UserFacingError | unknown): Job {
    const userFacingError = toUserFacingError(error);
    const job = this.getJob(jobId);
    const now = new Date().toISOString();
    const fail = this.db.transaction(() => {
      this.db
        .prepare("UPDATE jobs SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?")
        .run(JSON.stringify(userFacingError), now, jobId);
      this.failDependentJobs(jobId, job.itemId, now);
    });
    fail();
    this.emitJobsChanged([jobId]);
    return this.getJob(jobId);
  }

  recoverUnfinishedJobs(): Job[] {
    const rows = this.db.prepare("SELECT id FROM jobs WHERE status = 'running'").all() as Array<{ id: string }>;
    this.db.prepare("UPDATE jobs SET status = 'pending', started_at = NULL WHERE status = 'running'").run();
    this.emitJobsChanged(rows.map((row) => row.id));
    return rows.map((row) => this.getJob(row.id));
  }

  onJobsChanged(callback: (update: QueueUpdate) => void): () => void {
    const listener = (update: QueueUpdate) => callback(update);
    this.events.on("jobsChanged", listener);
    return () => this.events.off("jobsChanged", listener);
  }

  onProcessingEvent(callback: (event: ProcessingEvent) => void): () => void {
    const listener = (event: ProcessingEvent) => callback(event);
    this.events.on("processingEvent", listener);
    return () => this.events.off("processingEvent", listener);
  }

  private emitJobsChanged(changedJobIds: string[] = []): void {
    void this.getSummary().then((summary) => {
      this.events.emit("jobsChanged", { changedJobs: this.getJobsByIds(changedJobIds), summary });
    });
  }

  private resetJob(jobId: string): void {
    this.db
      .prepare(
        `
          UPDATE jobs
          SET status = 'pending', progress = 0, error_message = NULL, started_at = NULL, completed_at = NULL
          WHERE id = ?
        `,
      )
      .run(jobId);
  }

  private failDependentJobs(jobId: string, itemId: string | null, completedAt: string): void {
    if (!itemId) {
      return;
    }
    const dependencyError = userError(
      "Previous processing step failed",
      "VoiceNoter stopped later processing steps because an earlier step failed.",
      { retryable: true },
    );
    this.db
      .prepare(
        `
          UPDATE jobs
          SET status = 'failed',
              progress = 0,
              error_message = ?,
              started_at = NULL,
              completed_at = ?
          WHERE item_id = ?
            AND rowid > ?
            AND status IN ('pending', 'running')
        `,
      )
      .run(JSON.stringify(dependencyError), completedAt, itemId, this.getJobRowid(jobId));
    this.db.prepare("UPDATE items SET status = 'failed', updated_at = ? WHERE id = ?").run(completedAt, itemId);
  }

  private cancelDependentJobs(jobId: string, itemId: string | null, completedAt: string): void {
    if (!itemId) {
      return;
    }
    this.db
      .prepare(
        `
          UPDATE jobs
          SET status = 'cancelled',
              progress = 0,
              error_message = NULL,
              started_at = NULL,
              completed_at = ?
          WHERE item_id = ?
            AND rowid > ?
            AND status IN ('pending', 'running')
        `,
      )
      .run(completedAt, itemId, this.getJobRowid(jobId));
    this.db.prepare("UPDATE items SET status = 'cancelled', updated_at = ? WHERE id = ?").run(completedAt, itemId);
  }

  private getJobRowid(jobId: string): number {
    const row = this.db.prepare("SELECT rowid FROM jobs WHERE id = ?").get(jobId) as { rowid: number } | undefined;
    if (!row) {
      throw new Error(`Job not found: ${jobId}`);
    }
    return row.rowid;
  }

  private getJobsByIds(jobIds: string[]): Job[] {
    if (jobIds.length === 0) {
      return [];
    }
    const placeholders = jobIds.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM jobs
          WHERE id IN (${placeholders})
        `,
      )
      .all(...jobIds) as JobRow[];
    const byId = new Map(rows.map((row) => [row.id, mapJob(row)]));
    return jobIds.map((jobId) => byId.get(jobId)).filter((job): job is Job => Boolean(job));
  }

  private getJob(jobId: string): Job {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as JobRow | undefined;
    if (!row) {
      throw new Error(`Job not found: ${jobId}`);
    }
    return mapJob(row);
  }

  private listGroupJobs(itemId: string | null, query: QueueListQuery): Job[] {
    const { whereClause, params } = buildWhereClause(query);
    const itemClause = itemId ? "jobs.item_id = ?" : "jobs.item_id IS NULL";
    const combinedWhere = whereClause ? `${whereClause} AND ${itemClause}` : `WHERE ${itemClause}`;
    const rows = this.db
      .prepare(
        `
          SELECT jobs.*
          FROM jobs
          ${combinedWhere}
          ORDER BY jobs.rowid ASC
        `,
      )
      .all(...params, ...(itemId ? [itemId] : [])) as JobRow[];
    return rows.map(mapJob);
  }
}

function mapJob(row: JobRow): Job {
  return {
    id: row.id,
    itemId: row.item_id,
    type: row.type,
    status: row.status,
    progress: row.progress,
    error: row.error_message ? (JSON.parse(row.error_message) as UserFacingError) : null,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function buildWhereClause(query: QueueListQuery): { whereClause: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (query.status?.length) {
    clauses.push(`status IN (${query.status.map(() => "?").join(", ")})`);
    params.push(...query.status);
  }
  return {
    whereClause: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

function normalizePageRequest(query: QueueListQuery): { limit: number; offset: number } {
  return {
    limit: clampPageSize(query.limit),
    offset: Math.max(0, Math.floor(query.offset ?? 0)),
  };
}

function clampPageSize(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(Math.floor(value), MAX_PAGE_SIZE);
}
