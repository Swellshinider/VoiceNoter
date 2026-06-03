import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { TranscriptSegment } from "../../shared/types";
import { userError, VoiceNoterError } from "../../shared/errors";
import type { VoiceNoterDatabase } from "./database";
import type { QueueService } from "./queue";
import { ModelService } from "./model";

export type TranscriptionResult = {
  id: string;
  itemId: string;
  engine: "local-whisper-compatible";
  model: string;
  language: string | null;
  rawText: string;
  segments: TranscriptSegment[];
};

type WhisperJson = {
  transcription?: Array<{
    timestamps?: { from?: string; to?: string };
    text?: string;
  }>;
  result?: { language?: string };
};

export class TranscriptionService {
  constructor(
    private readonly libraryRoot: string,
    private readonly db: VoiceNoterDatabase,
    private readonly queue: QueueService,
  ) {}

  async transcribe(jobId: string, itemId: string, inputPath: string, language?: string): Promise<TranscriptionResult> {
    const selectedModel = await new ModelService(this.libraryRoot, this.db, this.queue).resolveSelectedModel();
    const whisperCli = await resolveWhisperCli();
    const outputBase = join(this.libraryRoot, "temp", `${itemId}-${Date.now()}`);
    await runWhisper(whisperCli, selectedModel.path, inputPath, outputBase, language, (progress) => {
      this.queue.updateProgress(jobId, progress, {
        itemId,
        stage: "transcribe",
        message: "Transcribing locally",
      });
    });
    const parsed = JSON.parse(await readFile(`${outputBase}.json`, "utf8")) as WhisperJson;
    const segments =
      parsed.transcription?.map((segment) => ({
        startSeconds: parseWhisperTimestamp(segment.timestamps?.from ?? "00:00:00.000"),
        endSeconds: parseWhisperTimestamp(segment.timestamps?.to ?? "00:00:00.000"),
        text: segment.text?.trim() ?? "",
      })) ?? [];
    return {
      id: randomUUID(),
      itemId,
      engine: "local-whisper-compatible",
      model: selectedModel.id,
      language: parsed.result?.language ?? null,
      rawText: segments.map((segment) => segment.text).join(" ").trim(),
      segments,
    };
  }
}

async function resolveWhisperCli(): Promise<string> {
  const candidates = [
    process.env.VOICENOTER_WHISPER_CLI,
    process.resourcesPath ? join(process.resourcesPath, "bin", "whisper", "whisper-cli") : undefined,
    join(process.cwd(), "vendor", "whisper.cpp", "build", "bin", "whisper-cli"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // try next candidate
    }
  }

  throw new VoiceNoterError(
    userError("Transcription process failed", "VoiceNoter could not find the local whisper.cpp executable.", {
      technicalDetails: `Checked: ${candidates.join(", ")}.`,
      retryable: true,
    }),
  );
}

function runWhisper(
  whisperCli: string,
  modelPath: string,
  inputPath: string,
  outputBase: string,
  language: string | undefined,
  onProgress: (progress: number) => void,
): Promise<void> {
  const args = ["-m", modelPath, "-f", inputPath, "-oj", "-of", outputBase, "-pp"];
  if (language && language !== "auto") {
    args.push("-l", language);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(whisperCli, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderr += text;
      const match = text.match(/(\d{1,3})%/);
      if (match) {
        onProgress(Number(match[1]) / 100);
      }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        onProgress(1);
        resolve();
      } else {
        reject(
          new VoiceNoterError(
            userError("Transcription process failed", `whisper.cpp exited with code ${code}.`, {
              technicalDetails: stderr,
              retryable: true,
            }),
          ),
        );
      }
    });
  });
}

function parseWhisperTimestamp(timestamp: string): number {
  const [hours = "0", minutes = "0", seconds = "0"] = timestamp.split(":");
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}
