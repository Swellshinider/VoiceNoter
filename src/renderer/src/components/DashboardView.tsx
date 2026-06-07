import { Activity, ArrowRight, AudioLines, Clock3, HardDrive, TriangleAlert, Video } from "lucide-react";
import type { ReactNode } from "react";
import type { DashboardItemStatus, DashboardSummary } from "../../../shared/types";
import { Badge, Button, Panel, Spinner } from "./ui";

export function DashboardView({
  summary,
  isLoading,
  onSelectItem,
  onOpenQueue,
}: {
  summary: DashboardSummary | null;
  isLoading?: boolean;
  onSelectItem: (itemId: string) => void;
  onOpenQueue: () => void;
}) {
  if (!summary) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <Panel className="flex w-full max-w-2xl items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
          {isLoading ? <Spinner className="size-4" /> : <Activity className="size-4" />}
          {isLoading ? "Loading dashboard..." : "Dashboard will appear after a library is ready."}
        </Panel>
      </div>
    );
  }

  const storageBreakdown = [
    { key: "originalMediaBytes", label: "Original media", color: "bg-sky-500" },
    { key: "extractedAudioBytes", label: "Extracted audio", color: "bg-cyan-500" },
    { key: "notesBytes", label: "Notes", color: "bg-emerald-500" },
    { key: "modelsBytes", label: "Models", color: "bg-violet-500" },
    { key: "databaseBytes", label: "Database", color: "bg-amber-500" },
    { key: "indexesBytes", label: "Indexes", color: "bg-orange-500" },
    { key: "otherBytes", label: "Other", color: "bg-slate-500" },
  ] as const;
  const maxTrend = Math.max(...summary.trend.map((point) => point.completedTranscriptions), 1);

  return (
    <div className="flex min-h-0 flex-1 overflow-auto p-4">
      <div className="w-full space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-wide text-muted-foreground">Dashboard</div>
            <h1 className="text-2xl font-semibold">Library health at a glance</h1>
            <p className="mt-1 text-sm text-muted-foreground">See how many files are transcribed, waiting, failed, and how much storage the library is using.</p>
          </div>
          <Button variant="secondary" onClick={onOpenQueue}>
            <ArrowRight data-icon="inline-start" />
            Open queue
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StatCard icon={<HardDrive />} label="Total files" value={summary.counts.totalItems} helper="Audio and video files in the library" />
          <StatCard icon={<AudioLines />} label="Audio files" value={summary.counts.audioItems} helper={`${pct(summary.counts.audioItems, summary.counts.totalItems)} of library media`} />
          <StatCard icon={<Video />} label="Video files" value={summary.counts.videoItems} helper={`${pct(summary.counts.videoItems, summary.counts.totalItems)} of library media`} />
          <StatCard icon={<Activity />} label="Transcribed" value={summary.counts.transcribedItems} helper="Files with transcript rows or completed processing" />
          <StatCard icon={<Clock3 />} label="Pending" value={summary.counts.pendingItems} helper="Files still importing or processing" />
          <StatCard icon={<TriangleAlert />} label="Failed" value={summary.counts.failedItems} helper={`${summary.counts.cancelledItems} cancelled`} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            <Panel className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Storage footprint</div>
                  <div className="mt-1 text-3xl font-semibold">{formatBytes(summary.storage.totalBytes)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Total library size split by source media, derived files, and app data.</div>
                </div>
                <Badge>{summary.storage.modelsBytes > 0 ? "Assets on disk" : "Mostly media"}</Badge>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
                <div className="flex h-full w-full">
                  {storageBreakdown
                    .filter((bucket) => summary.storage[bucket.key] > 0)
                    .map((bucket) => {
                      const value = summary.storage[bucket.key];
                      const width = summary.storage.totalBytes > 0 ? `${(value / summary.storage.totalBytes) * 100}%` : "0%";
                      return <div key={bucket.key} className={bucket.color} style={{ width }} />;
                    })}
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {storageBreakdown.map((bucket) => (
                  <StorageRow key={bucket.key} label={bucket.label} value={summary.storage[bucket.key]} total={summary.storage.totalBytes} color={bucket.color} />
                ))}
              </div>
            </Panel>

            <Panel className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Transcription trend</div>
                  <div className="mt-1 text-xs text-muted-foreground">Completed transcriptions over the last 14 days.</div>
                </div>
                <Badge tone={summary.trend.some((point) => point.completedTranscriptions > 0) ? "success" : "muted"}>
                  {summary.trend.reduce((total, point) => total + point.completedTranscriptions, 0)} total
                </Badge>
              </div>

              <div className="mt-4">
                <svg viewBox="0 0 560 220" className="h-56 w-full overflow-visible">
                  <defs>
                    <linearGradient id="dashboard-trend-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <g className="text-border">
                    {[0, 1, 2, 3].map((line) => (
                      <line key={line} x1="0" x2="560" y1={40 + line * 40} y2={40 + line * 40} stroke="currentColor" strokeDasharray="4 6" strokeWidth="1" />
                    ))}
                  </g>
                  <TrendGraph trend={summary.trend} maxValue={maxTrend} />
                </svg>
                <div className="mt-2 grid gap-1 text-[10px] uppercase tracking-wide text-muted-foreground" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
                  {summary.trend.map((point) => (
                    <span key={point.date} className="truncate text-center">
                      {formatTrendLabel(point.date)}
                    </span>
                  ))}
                </div>
              </div>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Queue health</div>
                  <div className="mt-1 text-xs text-muted-foreground">Watch for bottlenecks and failed jobs.</div>
                </div>
                <Badge tone={summary.queueHealth.failedJobs > 0 ? "danger" : summary.queueHealth.activeJobs > 0 ? "warning" : "success"}>
                  {summary.queueHealth.activeJobs} active
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                <Metric label="Pending" value={summary.queueHealth.pendingJobs} />
                <Metric label="Running" value={summary.queueHealth.runningJobs} />
                <Metric label="Failed" value={summary.queueHealth.failedJobs} />
              </div>

              <div className="mt-4 rounded-md border border-border bg-background p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Oldest pending</div>
                <div className="mt-1 font-medium">{summary.queueHealth.oldestPendingAt ? formatDateTime(summary.queueHealth.oldestPendingAt) : "No pending jobs"}</div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {summary.queueHealth.failedJobs > 0 ? <Badge tone="danger">{summary.queueHealth.failedJobs} failed jobs</Badge> : null}
                {summary.queueHealth.pendingJobs > 0 ? <Badge tone="warning">{summary.queueHealth.pendingJobs} waiting</Badge> : null}
                {summary.queueHealth.activeJobs === 0 ? <Badge tone="success">Queue idle</Badge> : null}
              </div>
            </Panel>

            <Panel className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Latest transcriptions</div>
                  <div className="mt-1 text-xs text-muted-foreground">Recent files with their current pipeline status.</div>
                </div>
                <Badge>{summary.latestItems.length} items</Badge>
              </div>

              <div className="mt-3 space-y-2 overflow-auto pr-1">
                {summary.latestItems.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No imported files yet.</div>
                ) : (
                  summary.latestItems.map((item) => (
                    <button
                      key={item.itemId}
                      className="w-full rounded-md border border-border bg-background p-3 text-left transition hover:border-primary/50 hover:bg-secondary"
                      onClick={() => onSelectItem(item.itemId)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{item.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.sourceType} · {formatDateTime(item.date)}
                          </div>
                        </div>
                        <Badge tone={statusTone(item.status)}>{formatStatus(item.status)}</Badge>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
        </div>
        <div className="rounded-md border border-border bg-background p-2 text-muted-foreground [&_svg]:size-4">{icon}</div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">{helper}</div>
    </Panel>
  );
}

function StorageRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${color}`} />
          <span className="font-medium">{label}</span>
        </div>
        <span className="tabular-nums text-muted-foreground">{formatBytes(value)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: total > 0 ? `${(value / total) * 100}%` : "0%" }} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background p-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function TrendGraph({ trend, maxValue }: { trend: DashboardSummary["trend"]; maxValue: number }) {
  const width = 560;
  const height = 220;
  const paddingX = 18;
  const paddingTop = 18;
  const paddingBottom = 26;
  const plotHeight = height - paddingTop - paddingBottom;
  const step = trend.length > 1 ? (width - paddingX * 2) / (trend.length - 1) : 0;

  const points = trend.map((point, index) => {
    const x = paddingX + step * index;
    const y = paddingTop + (1 - point.completedTranscriptions / maxValue) * plotHeight;
    return { ...point, x, y };
  });

  const linePath = points.length
    ? `M ${points.map((point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" L ")}`
    : "";
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1]!.x.toFixed(1)} ${height - paddingBottom} L ${points[0]!.x.toFixed(1)} ${height - paddingBottom} Z`
    : "";

  return (
    <g className="text-primary">
      <path d={areaPath} fill="url(#dashboard-trend-fill)" />
      <path d={linePath} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point) => (
        <g key={point.date}>
          <circle cx={point.x} cy={point.y} r="4.5" fill="currentColor" />
          <circle cx={point.x} cy={point.y} r="8.5" fill="currentColor" fillOpacity="0.12" />
        </g>
      ))}
    </g>
  );
}

function statusTone(status: DashboardItemStatus): "muted" | "success" | "warning" | "danger" {
  switch (status) {
    case "transcribed":
      return "success";
    case "pending":
      return "warning";
    case "failed":
      return "danger";
    case "cancelled":
      return "muted";
  }
}

function formatStatus(status: DashboardItemStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTrendLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00Z`));
}

function pct(part: number, total: number): string {
  if (total === 0) {
    return "0%";
  }
  return `${Math.round((part / total) * 100)}%`;
}
