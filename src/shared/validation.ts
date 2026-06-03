import { basename, extname } from "node:path";
import { z } from "zod";
import type { ImportCandidate, ModelId, SourceType } from "./types";

export const supportedAudioExtensions = new Set([".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac"]);
export const supportedVideoExtensions = new Set([".mp4", ".mov", ".mkv", ".webm", ".avi"]);
export const supportedMediaExtensions = new Set([
  ...supportedAudioExtensions,
  ...supportedVideoExtensions,
]);

export const modelIdSchema = z.enum(["tiny", "base", "small"]);

export function isSupportedMediaExtension(extension: string): boolean {
  return supportedMediaExtensions.has(normalizeExtension(extension));
}

export function getImportCandidate(path: string): ImportCandidate {
  const extension = normalizeExtension(extname(path));
  return {
    path,
    filename: basename(path),
    extension,
    supported: isSupportedMediaExtension(extension),
  };
}

export function getSourceType(pathOrExtension: string): SourceType {
  const extension = normalizeExtension(pathOrExtension.startsWith(".") ? pathOrExtension : extname(pathOrExtension));
  return supportedVideoExtensions.has(extension) ? "video" : "audio";
}

export function parseModelId(value: string): ModelId {
  return modelIdSchema.parse(value);
}

function normalizeExtension(extension: string): string {
  if (!extension) {
    return "";
  }
  return extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
}
