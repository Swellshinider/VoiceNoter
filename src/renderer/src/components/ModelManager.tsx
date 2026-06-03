import { Download, Trash2 } from "lucide-react";
import type { ModelInfo } from "../../../shared/types";
import { Badge, Button, Panel } from "./ui";

export function ModelManager({
  models,
  onDownload,
  onDelete,
  onSelect,
}: {
  models: ModelInfo[];
  onDownload: (modelId: ModelInfo["id"]) => void;
  onDelete: (modelId: ModelInfo["id"]) => void;
  onSelect: (modelId: ModelInfo["id"]) => void;
}) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <Panel>
        <div className="border-b border-border p-3">
          <div className="text-sm font-medium">Model Manager</div>
          <div className="text-xs text-muted-foreground">Download one local model before transcription.</div>
        </div>
        <div className="divide-y divide-border">
          {models.map((model) => (
            <div key={model.id} className="grid grid-cols-[1fr_120px_260px] items-center gap-3 p-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {model.name}
                  {model.selected ? <Badge tone="success">default</Badge> : null}
                </div>
                <div className="text-xs text-muted-foreground">{model.sizeLabel}</div>
                {model.localPath ? <div className="mt-1 truncate text-xs text-muted-foreground">{model.localPath}</div> : null}
              </div>
              <Badge tone={model.status === "installed" ? "success" : model.status === "failed" ? "danger" : "muted"}>{model.status}</Badge>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" disabled={model.status === "downloading"} onClick={() => onDownload(model.id)}>
                  <Download data-icon="inline-start" />
                  Download
                </Button>
                <Button variant="secondary" disabled={model.status !== "installed"} onClick={() => onSelect(model.id)}>
                  Select
                </Button>
                <Button variant="ghost" disabled={model.status !== "installed"} onClick={() => onDelete(model.id)}>
                  <Trash2 data-icon="inline-start" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
