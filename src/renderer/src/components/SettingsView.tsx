import { FolderOpen, RefreshCw, Search } from "lucide-react";
import type { LibrarySettings, LibraryState, ModelInfo } from "../../../shared/types";
import { Button, Panel, Select } from "./ui";

const WHISPER_LANGUAGES = [
  { code: "auto", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "it", label: "Italian" },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

export function SettingsView({
  library,
  settings,
  models,
  onOpenFolder,
  onRescan,
  onReindex,
  onUpdateSettings,
}: {
  library: LibraryState | null;
  settings: LibrarySettings | null;
  models: ModelInfo[];
  onOpenFolder: () => void;
  onRescan: () => void;
  onReindex: () => void;
  onUpdateSettings?: (patch: Partial<Pick<LibrarySettings, "transcriptionLanguage" | "theme">>) => void;
}) {
  const selectedModel = models.find((m) => m.selected);
  const theme = settings?.theme ?? "dark";
  return (
    <div className="flex-1 overflow-auto p-4">
      <Panel className="p-4">
        <div className="text-sm font-medium">Settings</div>
        <div className="mt-4 grid gap-3 text-sm">
          <SettingRow label="Library path" value={library?.path ?? "No library selected"} />
          <div className="grid grid-cols-[180px_1fr] gap-3 rounded-md border border-border bg-background p-3">
            <label className="text-muted-foreground" htmlFor="theme-select">
              Theme
            </label>
            <Select
              id="theme-select"
              value={theme}
              onChange={(e) => onUpdateSettings?.({ theme: e.target.value as LibrarySettings["theme"] })}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </Select>
          </div>
          <SettingRow label="Default import behavior" value="Copy into library" />
          <SettingRow label="Default model" value={selectedModel ? `${selectedModel.name} (${selectedModel.sizeLabel})` : "None selected"} />
          <div className="grid grid-cols-[180px_1fr] gap-3 rounded-md border border-border bg-background p-3">
            <div className="text-muted-foreground">Transcription language</div>
            <Select
              value={settings?.transcriptionLanguage ?? "auto"}
              onChange={(e) => onUpdateSettings?.({ transcriptionLanguage: e.target.value })}
            >
              {WHISPER_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </Select>
          </div>
          <SettingRow label="FFmpeg status" value={library?.ffmpegStatus ?? "unknown"} />
          <SettingRow
            label="Model storage"
            value={settings ? `${formatBytes(settings.modelStorageBytes ?? 0)} (${settings.installedModelCount ?? 0} models)` : "—"}
          />
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
