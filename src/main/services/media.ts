import { spawn } from "node:child_process";
import { basename, join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { userError, VoiceNoterError } from "../../shared/errors";

export type MediaInspection = {
  durationSeconds: number | null;
  hasVideo: boolean;
};

export class MediaService {
  getFfmpegStatus(): "available" | "missing" | "failed" {
    return ffmpegPath && ffprobe.path ? "available" : "missing";
  }

  async inspectMedia(path: string): Promise<MediaInspection> {
    if (!ffprobe.path) {
      throw new VoiceNoterError(
        userError("FFmpeg execution failed", "The bundled FFprobe executable is missing.", {
          retryable: true,
        }),
      );
    }
    const result = await runProcess(ffprobe.path, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path]);
    const parsed = JSON.parse(result.stdout) as {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string }>;
    };
    return {
      durationSeconds: parsed.format?.duration ? Math.round(Number(parsed.format.duration)) : null,
      hasVideo: parsed.streams?.some((stream) => stream.codec_type === "video") ?? false,
    };
  }

  async extractAudio(sourcePath: string, itemId: string, libraryRoot: string): Promise<string> {
    if (!ffmpegPath) {
      throw new VoiceNoterError(
        userError("Audio extraction failed", "The bundled FFmpeg executable is missing.", {
          retryable: true,
        }),
      );
    }
    const outputPath = join(libraryRoot, "media", "extracted", `${itemId}-${basename(sourcePath)}.wav`);
    await runProcess(ffmpegPath, ["-y", "-i", sourcePath, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", outputPath]);
    return outputPath;
  }
}

function runProcess(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new VoiceNoterError(
            userError("FFmpeg execution failed", `The bundled media process exited with code ${code}.`, {
              technicalDetails: stderr,
              retryable: true,
            }),
          ),
        );
      }
    });
  });
}
