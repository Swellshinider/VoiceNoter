import { FolderOpen, HardDrive, RadioTower } from "lucide-react";
import type { LibraryState, ModelInfo } from "../../../shared/types";
import { Button } from "./ui";

export function SetupView({
  library,
  models,
  onChooseLibrary,
}: {
  library: LibraryState | null;
  models: ModelInfo[];
  onChooseLibrary: () => void;
}) {
  const selectedModel = models.find((model) => model.selected);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-2xl rounded-md border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">VoiceNoter</h1>
          <p className="text-sm text-muted-foreground">
            Choose a local library to import media, transcribe it locally, and write Markdown notes.
          </p>
        </div>
        <div className="mt-8 grid gap-3">
          <SetupRow
            icon={<FolderOpen />}
            title="Library folder"
            value={library?.path ?? "No library selected"}
            ready={Boolean(library?.isInitialized)}
          />
          <SetupRow
            icon={<HardDrive />}
            title="FFmpeg"
            value={library?.ffmpegStatus ?? "Checked after library selection"}
            ready={library?.ffmpegStatus === "available"}
          />
          <SetupRow
            icon={<RadioTower />}
            title="Transcription model"
            value={selectedModel ? selectedModel.name : "Download and select a model in Model Manager"}
            ready={Boolean(selectedModel)}
          />
        </div>
        <div className="mt-8 flex justify-end">
          <Button onClick={onChooseLibrary}>
            <FolderOpen data-icon="inline-start" />
            Choose Library
          </Button>
        </div>
      </div>
    </main>
  );
}

function SetupRow({ icon, title, value, ready }: { icon: React.ReactNode; title: string; value: string; ready: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
      <div className="flex size-9 items-center justify-center rounded-md bg-secondary text-muted-foreground [&_svg]:size-4">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{value}</div>
      </div>
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
        {ready ? "Ready" : "Needed"}
      </span>
    </div>
  );
}
