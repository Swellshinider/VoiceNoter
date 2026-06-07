import { RotateCw, X } from "lucide-react";
import type { Job, QueueSummary } from "../../../shared/types";
import { Badge, Button, Panel, Spinner } from "./ui";

export function QueueView({
  jobs,
  summary,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  onRetry,
  onCancel,
}: {
  jobs: Job[];
  summary: QueueSummary | null;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRetry: (jobId: string) => void;
  onCancel: (jobId: string) => void;
}) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <Panel>
        <div className="border-b border-border p-3 text-sm font-medium">Processing Queue</div>
        {summary ? (
          <div className="grid grid-cols-2 gap-2 border-b border-border p-3 text-sm md:grid-cols-4">
            <Metric label="Pending" value={summary.pendingJobs} />
            <Metric label="Running" value={summary.runningJobs} />
            <Metric label="Completed" value={summary.completedJobs} />
            <Metric label="Failed" value={summary.failedJobs} />
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-2 border-b border-border p-3 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Loading queue...
          </div>
        ) : null}
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
        {hasMore || isLoadingMore ? (
          <div className="border-t border-border p-3">
            <Button variant="secondary" className="w-full" disabled={!hasMore || isLoadingMore} onClick={() => onLoadMore?.()}>
              {isLoadingMore ? (
                <>
                  <Spinner className="size-4" />
                  Loading more
                </>
              ) : (
                "Load more"
              )}
            </Button>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background p-2 text-center">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
