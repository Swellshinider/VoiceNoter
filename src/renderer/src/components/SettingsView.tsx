import { FolderOpen, RefreshCw, Search } from "lucide-react";
import type { LibraryState } from "../../../shared/types";
import { Button, Panel } from "./ui";

export function SettingsView({
  library,
  onOpenFolder,
  onRescan,
  onReindex,
}: {
  library: LibraryState | null;
  onOpenFolder: () => void;
  onRescan: () => void;
  onReindex: () => void;
}) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <Panel className="p-4">
        <div className="text-sm font-medium">Settings</div>
        <div className="mt-4 grid gap-3 text-sm">
          <SettingRow label="Library path" value={library?.path ?? "No library selected"} />
          <SettingRow label="Theme" value="System" />
          <SettingRow label="Default import behavior" value="Copy into library" />
          <SettingRow label="FFmpeg status" value={library?.ffmpegStatus ?? "unknown"} />
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" onClick={onOpenFolder}>
            <FolderOpen data-icon="inline-start" />
            Open Folder
          </Button>
          <Button variant="secondary" onClick={onRescan}>
            <RefreshCw data-icon="inline-start" />
            Rescan
          </Button>
          <Button variant="secondary" onClick={onReindex}>
            <Search data-icon="inline-start" />
            Reindex
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 rounded-md border border-border bg-background p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="truncate font-medium">{value}</div>
    </div>
  );
}
