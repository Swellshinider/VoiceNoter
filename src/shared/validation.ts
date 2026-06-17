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
export const itemIdSchema = z.string().trim().min(1);
export const tagIdSchema = z.string().trim().min(1);
export const jobIdSchema = z.string().trim().min(1);
export const libraryPathSchema = z.string().trim().min(1);
export const markdownSchema = z.string();
export const importPathsSchema = z.array(z.string().trim().min(1));
export const transcriptSegmentSchema = z
  .object({
    startSeconds: z.number().finite().nonnegative(),
    endSeconds: z.number().finite().nonnegative(),
    text: z.string().trim().min(1),
  })
  .strict();
export const transcriptUpdateSchema = z
  .object({
    segments: z.array(transcriptSegmentSchema),
  })
  .strict();
export const pageRequestSchema = z
  .object({
    limit: z.number().int().nonnegative().optional(),
    offset: z.number().int().nonnegative().optional(),
  })
  .strict();
export const itemListQuerySchema = pageRequestSchema
  .extend({
    view: z.enum(["all", "tag"]).optional(),
    tagIds: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();
export const queueListQuerySchema = pageRequestSchema
  .extend({
    status: z.array(z.enum(["pending", "running", "completed", "failed", "cancelled"])).optional(),
  })
  .strict();
export const searchQuerySchema = pageRequestSchema
  .extend({
    text: z.string().trim().min(1),
    tagIds: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();
export const itemMetadataUpdateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    tagNames: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();
export const tagNameSchema = z.string().trim().min(1);
export const tagNamesSchema = z.array(tagNameSchema);
export const itemIdsSchema = z.array(itemIdSchema);
export const librarySettingsPatchSchema = z
  .object({
    transcriptionLanguage: z.string().trim().min(1).optional(),
    theme: z.enum(["system", "light", "dark"]).optional(),
  })
  .strict();

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
