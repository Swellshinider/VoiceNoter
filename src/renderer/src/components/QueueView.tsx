import { RotateCw, X } from "lucide-react";
import type { Job } from "../../../shared/types";
import { Badge, Button, Panel } from "./ui";

export function QueueView({ jobs, onRetry, onCancel }: { jobs: Job[]; onRetry: (jobId: string) => void; onCancel: (jobId: string) => void }) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <Panel>
        <div className="border-b border-border p-3 text-sm font-medium">Processing Queue</div>
        {jobs.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No jobs yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {jobs.map((job) => (
              <div key={job.id} className="grid grid-cols-[1fr_120px_160px] items-center gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium">{job.type}</div>
                    <Badge tone={job.status === "completed" ? "success" : job.status === "failed" ? "danger" : "warning"}>{job.status}</Badge>
                  </div>
                  {job.error ? <div className="mt-1 text-xs text-destructive">{job.error.title}: {job.error.message}</div> : null}
                  <div className="mt-2 h-1.5 rounded bg-muted">
                    <div className="h-1.5 rounded bg-primary" style={{ width: `${Math.round(job.progress * 100)}%` }} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{Math.round(job.progress * 100)}%</div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" disabled={job.status !== "failed" && job.status !== "cancelled"} onClick={() => onRetry(job.id)}>
                    <RotateCw data-icon="inline-start" />
                    Retry
                  </Button>
                  <Button variant="ghost" disabled={job.status !== "pending" && job.status !== "running"} onClick={() => onCancel(job.id)}>
                    <X data-icon="inline-start" />
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
