import { RotateCw, X } from "lucide-react";
import type { Job, ProcessingStatusGroup, QueueSummary } from "../../../shared/types";
import { Badge, Button, Panel, Spinner } from "./ui";

export function QueueView({
  groups,
  summary,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  onRetry,
  onCancel,
}: {
  groups: ProcessingStatusGroup[];
  summary: QueueSummary | null;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRetry: (jobId: string) => void;
  onCancel: (jobId: string) => void;
}) {
  const systemGroups = groups.filter((group) => group.kind === "system");
  const itemGroups = groups.filter((group) => group.kind === "item");

  return (
    <div className="flex-1 overflow-auto p-4">
      <Panel>
        <div className="border-b border-border p-3 text-sm font-medium">Processing Status</div>
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
            Loading processing status...
          </div>
        ) : null}
        {groups.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No jobs yet.</div>
        ) : (
          <div className="space-y-4 p-4">
            {itemGroups.length > 0 ? (
              <div className="space-y-3">
                {itemGroups.map((group) => (
                  <StatusCard key={group.itemId ?? group.label} group={group} onRetry={onRetry} onCancel={onCancel} />
                ))}
              </div>
            ) : null}
            {systemGroups.length > 0 ? (
              <div className="space-y-3 border-t border-border pt-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">System Tasks</div>
                {systemGroups.map((group, index) => (
                  <StatusCard key={`system-${index}`} group={group} onRetry={onRetry} onCancel={onCancel} />
                ))}
              </div>
            ) : null}
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

function StatusCard({
  group,
  onRetry,
  onCancel,
}: {
  group: ProcessingStatusGroup;
  onRetry: (jobId: string) => void;
  onCancel: (jobId: string) => void;
}) {
  const expandedByDefault = group.jobs.some((job) => job.status === "pending" || job.status === "running" || job.status === "failed");
  return (
    <details className="rounded-md border border-border bg-background" open={expandedByDefault}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
        <div>
          <div className="text-sm font-medium">{group.label}</div>
          <div className="mt-1 text-xs text-muted-foreground">{describeGroup(group.jobs)}</div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {summarizeStatuses(group.jobs).map(([status, count]) => (
            <Badge key={status} tone={statusTone(status)}>
              {count} {status}
            </Badge>
          ))}
        </div>
      </summary>
      <div className="border-t border-border">
        {group.jobs.map((job) => (
          <JobRow key={job.id} job={job} onRetry={onRetry} onCancel={onCancel} />
        ))}
      </div>
    </details>
  );
}

function JobRow({
  job,
  onRetry,
  onCancel,
}: {
  job: Job;
  onRetry: (jobId: string) => void;
  onCancel: (jobId: string) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_120px_160px] items-center gap-3 border-t border-border p-3 first:border-t-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">{job.type}</div>
          <Badge tone={statusTone(job.status)}>{job.status}</Badge>
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
  );
}

function summarizeStatuses(jobs: Job[]): Array<[Job["status"], number]> {
  const counts = new Map<Job["status"], number>();
  for (const job of jobs) {
    counts.set(job.status, (counts.get(job.status) ?? 0) + 1);
  }
  return Array.from(counts.entries());
}

function describeGroup(jobs: Job[]): string {
  if (jobs.length === 1) {
    return "1 job";
  }
  return `${jobs.length} jobs`;
}

function statusTone(status: Job["status"]): "success" | "danger" | "warning" | "muted" {
  if (status === "completed") {
    return "success";
  }
  if (status === "failed") {
    return "danger";
  }
  if (status === "pending" || status === "running" || status === "cancelled") {
    return "warning";
  }
  return "muted";
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background p-2 text-center">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
