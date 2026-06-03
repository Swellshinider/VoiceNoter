import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ModelDownloadJob, ModelId, ModelInfo } from "../../shared/types";
import { parseModelId } from "../../shared/validation";
import { userError, VoiceNoterError } from "../../shared/errors";
import type { VoiceNoterDatabase } from "./database";
import type { QueueService } from "./queue";

const modelDefinitions: Record<ModelId, { name: string; sizeLabel: string; url: string }> = {
  tiny: {
    name: "Tiny",
    sizeLabel: "fastest, lowest accuracy",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
  },
  base: {
    name: "Base",
    sizeLabel: "balanced default",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
  },
  small: {
    name: "Small",
    sizeLabel: "slower, better accuracy",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
  },
};

type ModelRow = {
  id: ModelId;
  name: string;
  size_label: string;
  local_path: string | null;
  status: ModelInfo["status"];
  downloaded_at: string | null;
  selected_at: string | null;
};

export class ModelService {
  constructor(
    private readonly libraryRoot: string,
    private readonly db: VoiceNoterDatabase,
    private readonly queue?: QueueService,
  ) {}

  listModels(): ModelInfo[] {
    return (this.db.prepare("SELECT * FROM models ORDER BY CASE id WHEN 'tiny' THEN 1 WHEN 'base' THEN 2 ELSE 3 END").all() as ModelRow[]).map(
      mapModel,
    );
  }

  async downloadModel(modelIdInput: string): Promise<ModelDownloadJob> {
    const modelId = parseModelId(modelIdInput);
    const definition = modelDefinitions[modelId];
    const jobId = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
          INSERT INTO jobs (
            id, item_id, type, status, payload_json, progress, error_message, created_at, started_at, completed_at
          )
          VALUES (?, NULL, 'download_model', 'running', ?, 0, NULL, ?, ?, NULL)
        `,
      )
      .run(jobId, JSON.stringify({ modelId }), now, now);
    this.db.prepare("UPDATE models SET status = 'downloading' WHERE id = ?").run(modelId);

    void this.downloadModelFile(modelId, definition.url, jobId);
    return { modelId, jobId };
  }

  async deleteModel(modelIdInput: string): Promise<void> {
    const modelId = parseModelId(modelIdInput);
    this.db
      .prepare("UPDATE models SET status = 'available', local_path = NULL, downloaded_at = NULL, selected_at = NULL WHERE id = ?")
      .run(modelId);
  }

  async setDefaultModel(modelIdInput: string): Promise<ModelInfo> {
    const modelId = parseModelId(modelIdInput);
    const row = this.getModelRow(modelId);
    if (row.status !== "installed" || !row.local_path) {
      throw new VoiceNoterError(
        userError("Model is not installed", `Download the ${row.name} model before making it the default.`, {
          retryable: true,
        }),
      );
    }
    this.db.transaction(() => {
      this.db.prepare("UPDATE models SET selected_at = NULL").run();
      this.db.prepare("UPDATE models SET selected_at = ? WHERE id = ?").run(new Date().toISOString(), modelId);
    })();
    return mapModel(this.getModelRow(modelId));
  }

  async resolveSelectedModel(): Promise<{ id: ModelId; path: string }> {
    const row = this.db.prepare("SELECT * FROM models WHERE selected_at IS NOT NULL ORDER BY selected_at DESC LIMIT 1").get() as
      | ModelRow
      | undefined;
    if (!row) {
      throw new VoiceNoterError(
        userError("No transcription model selected", "Download and select a local transcription model before transcribing.", {
          retryable: true,
        }),
      );
    }
    if (row.status !== "installed" || !row.local_path) {
      throw new VoiceNoterError(
        userError("Model file missing", `The selected ${row.name} model is not installed in this library.`, {
          retryable: true,
        }),
      );
    }
    try {
      const result = await stat(row.local_path);
      if (!result.isFile()) {
        throw new Error(`${row.local_path} is not a file`);
      }
    } catch (error) {
      throw new VoiceNoterError(
        userError("Model file missing", `VoiceNoter could not find the selected ${row.name} model file.`, {
          technicalDetails: error instanceof Error ? error.message : String(error),
          retryable: true,
        }),
      );
    }
    return { id: row.id, path: row.local_path };
  }

  private getModelRow(modelId: ModelId): ModelRow {
    const row = this.db.prepare("SELECT * FROM models WHERE id = ?").get(modelId) as ModelRow | undefined;
    if (!row) {
      throw new Error(`Unknown model: ${modelId}`);
    }
    return row;
  }

  private async downloadModelFile(modelId: ModelId, url: string, jobId: string): Promise<void> {
    try {
      await mkdir(join(this.libraryRoot, "models"), { recursive: true });
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const localPath = join(this.libraryRoot, "models", `ggml-${modelId}.bin`);
      await writeFile(localPath, buffer);
      this.db
        .prepare("UPDATE models SET status = 'installed', local_path = ?, downloaded_at = ? WHERE id = ?")
        .run(localPath, new Date().toISOString(), modelId);
      this.db.prepare("UPDATE jobs SET status = 'completed', progress = 1, completed_at = ? WHERE id = ?").run(new Date().toISOString(), jobId);
      this.queue?.completeJob(jobId);
    } catch (error) {
      const failed = userError("Model download failed", `VoiceNoter could not download the ${modelDefinitions[modelId].name} model.`, {
        technicalDetails: error instanceof Error ? error.stack ?? error.message : String(error),
        retryable: true,
      });
      this.db.prepare("UPDATE models SET status = 'failed' WHERE id = ?").run(modelId);
      this.db
        .prepare("UPDATE jobs SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?")
        .run(JSON.stringify(failed), new Date().toISOString(), jobId);
    }
  }
}

function mapModel(row: ModelRow): ModelInfo {
  return {
    id: row.id,
    name: row.name,
    sizeLabel: row.size_label,
    status: row.status,
    localPath: row.local_path,
    selected: row.selected_at !== null,
  };
}
