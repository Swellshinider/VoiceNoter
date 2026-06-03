import { EventEmitter } from "node:events";
import type { Job, JobStatus, JobType, ProcessingEvent, UserFacingError } from "../../shared/types";
import { toUserFacingError } from "../../shared/errors";
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

type QueueEvents = {
  jobsChanged: [Job[]];
  processingEvent: [ProcessingEvent];
};

export class QueueService {
  private readonly events = new EventEmitter();

  constructor(private readonly db: VoiceNoterDatabase) {}

  async listJobs(): Promise<Job[]> {
    return this.getJobs();
  }

  async retryJob(jobId: string): Promise<Job> {
    const job = this.getJob(jobId);
    if (job.status !== "failed" && job.status !== "cancelled") {
      return job;
    }
    this.db
      .prepare(
        `
          UPDATE jobs
          SET status = 'pending', progress = 0, error_message = NULL, started_at = NULL, completed_at = NULL
          WHERE id = ?
        `,
      )
      .run(jobId);
    this.emitJobsChanged();
    return this.getJob(jobId);
  }

  async cancelJob(jobId: string): Promise<Job> {
    const job = this.getJob(jobId);
    if (job.status !== "pending" && job.status !== "running") {
      return job;
    }
    this.db
      .prepare("UPDATE jobs SET status = 'cancelled', completed_at = ?, progress = ? WHERE id = ?")
      .run(new Date().toISOString(), job.progress, jobId);
    this.emitJobsChanged();
    return this.getJob(jobId);
  }

  startJob(jobId: string): Job {
    this.db
      .prepare("UPDATE jobs SET status = 'running', started_at = ?, completed_at = NULL, error_message = NULL WHERE id = ?")
      .run(new Date().toISOString(), jobId);
    this.emitJobsChanged();
    return this.getJob(jobId);
  }

  completeJob(jobId: string): Job {
    this.db
      .prepare("UPDATE jobs SET status = 'completed', progress = 1, completed_at = ?, error_message = NULL WHERE id = ?")
      .run(new Date().toISOString(), jobId);
    this.emitJobsChanged();
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
    this.emitJobsChanged();
    return job;
  }

  failJob(jobId: string, error: UserFacingError | unknown): Job {
    const userFacingError = toUserFacingError(error);
    this.db
      .prepare("UPDATE jobs SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?")
      .run(JSON.stringify(userFacingError), new Date().toISOString(), jobId);
    this.emitJobsChanged();
    return this.getJob(jobId);
  }

  recoverUnfinishedJobs(): Job[] {
    const rows = this.db.prepare("SELECT id FROM jobs WHERE status = 'running'").all() as Array<{ id: string }>;
    this.db.prepare("UPDATE jobs SET status = 'pending', started_at = NULL WHERE status = 'running'").run();
    this.emitJobsChanged();
    return rows.map((row) => this.getJob(row.id));
  }

  onJobsChanged(callback: (jobs: Job[]) => void): () => void {
    const listener = (jobs: Job[]) => callback(jobs);
    this.events.on("jobsChanged", listener);
    return () => this.events.off("jobsChanged", listener);
  }

  onProcessingEvent(callback: (event: ProcessingEvent) => void): () => void {
    const listener = (event: ProcessingEvent) => callback(event);
    this.events.on("processingEvent", listener);
    return () => this.events.off("processingEvent", listener);
  }

  private emitJobsChanged(): void {
    this.events.emit("jobsChanged", this.getJobs());
  }

  private getJobs(): Job[] {
    return (
      this.db
        .prepare("SELECT * FROM jobs ORDER BY created_at DESC, rowid DESC")
        .all() as JobRow[]
    ).map(mapJob);
  }

  private getJob(jobId: string): Job {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as JobRow | undefined;
    if (!row) {
      throw new Error(`Job not found: ${jobId}`);
    }
    return mapJob(row);
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
