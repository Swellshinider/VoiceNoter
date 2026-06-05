import { Download, FolderOpen, HardDrive, History, RadioTower } from "lucide-react";
import type { LibraryState, ModelId, ModelInfo } from "../../../shared/types";
import { Badge, Button } from "./ui";

export function SetupView({
  library,
  models,
  lastLibraryPath,
  onChooseLibrary,
  onOpenLastLibrary,
  onDownloadModel,
}: {
  library: LibraryState | null;
  models: ModelInfo[];
  lastLibraryPath?: string | null;
  onChooseLibrary: () => void;
  onOpenLastLibrary?: () => void;
  onDownloadModel?: (modelId: ModelId) => void;
}) {
  const selectedModel = models.find((model) => model.selected);
  const ffmpegValue =
    library?.ffmpegStatus === "available"
      ? "Available"
      : library?.ffmpegStatus === "missing"
        ? "Not available — media inspection and video audio extraction will not work"
        : "Checked after library selection";
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
            value={ffmpegValue}
            ready={library?.ffmpegStatus === "available"}
          />
          <SetupRow
            icon={<RadioTower />}
            title="Transcription model"
            value={selectedModel ? selectedModel.name : "No model selected"}
            ready={Boolean(selectedModel)}
          />
        </div>
        {library?.isInitialized && !selectedModel && onDownloadModel && (
          <div className="mt-6">
            <div className="mb-2 text-sm font-medium">Download a transcription model to get started</div>
            <div className="grid gap-2">
              {models.map((model) => (
                <div key={model.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{model.name}</span>
                    <span className="text-xs text-muted-foreground">{model.sizeLabel}</span>
                    {model.id === "base" && <Badge tone="success">recommended</Badge>}
                  </div>
                  <Button
                    variant="secondary"
                    disabled={model.status === "downloading"}
                    onClick={() => onDownloadModel(model.id)}
                  >
                    <Download data-icon="inline-start" />
                    {model.status === "downloading" ? "Downloading..." : "Download"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        {lastLibraryPath && onOpenLastLibrary ? (
          <div className="mt-6 flex items-center gap-3 rounded-md border border-border bg-background p-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-secondary text-muted-foreground [&_svg]:size-4">
              <History />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Last library</div>
              <div className="truncate text-xs text-muted-foreground">{lastLibraryPath}</div>
            </div>
          </div>
        ) : null}
        <div className="mt-8 flex justify-end gap-2">
          {lastLibraryPath && onOpenLastLibrary ? (
            <Button variant="secondary" onClick={onOpenLastLibrary}>
              <History data-icon="inline-start" />
              Open Last Library
            </Button>
          ) : null}
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
      <Badge tone={ready ? "success" : "warning"}>{ready ? "Ready" : "Needed"}</Badge>
    </div>
  );
}
