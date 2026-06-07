import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { Readable } from "node:stream";

export const mediaProtocolScheme = "voicenoter-media";

type ProtocolApi = {
  registerSchemesAsPrivileged(schemes: Array<{ scheme: string; privileges: Record<string, boolean> }>): void;
  handle(scheme: string, handler: (request: Request) => Response | Promise<Response>): void;
};

export function createMediaUrl(itemId: string): string {
  return `${mediaProtocolScheme}://items/${encodeURIComponent(itemId)}/media`;
}

export function parseMediaProtocolUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== `${mediaProtocolScheme}:` || url.hostname !== "items") {
      return null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length !== 2 || segments[1] !== "media") {
      return null;
    }
    const itemId = decodeURIComponent(segments[0] ?? "");
    if (!itemId || itemId.includes("/") || itemId.includes("\\") || itemId.includes("..")) {
      return null;
    }
    return itemId;
  } catch {
    return null;
  }
}

export function registerVoiceNoterMediaScheme(protocolApi: ProtocolApi): void {
  protocolApi.registerSchemesAsPrivileged([
    {
      scheme: mediaProtocolScheme,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
  ]);
}

export function handleVoiceNoterMediaProtocol(
  protocolApi: ProtocolApi,
  resolveMediaPath: (itemId: string) => string | Promise<string>,
): void {
  protocolApi.handle(mediaProtocolScheme, async (request) => {
    const itemId = parseMediaProtocolUrl(request.url);
    if (!itemId) {
      return new Response("Not found", { status: 404 });
    }
    try {
      const mediaPath = await resolveMediaPath(itemId);
      return createMediaResponse(request, mediaPath);
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

export async function createMediaResponse(request: Request, mediaPath: string): Promise<Response> {
  const fileStat = await stat(mediaPath);
  const contentType = getMediaContentType(mediaPath);
  const rangeHeader = request.headers.get("range");
  const method = request.method.toUpperCase();

  if (rangeHeader) {
    const range = parseByteRange(rangeHeader, fileStat.size);
    if (!range) {
      const headers = buildMediaHeaders(contentType, fileStat.size, null);
      headers.set("content-range", `bytes */${fileStat.size}`);
      headers.set("content-length", "0");
      return new Response("", {
        status: 416,
        headers,
      });
    }
    return new Response(method === "HEAD" ? null : toWebStream(createReadStream(mediaPath, range)), {
      status: 206,
      headers: buildMediaHeaders(contentType, fileStat.size, range),
    });
  }

  return new Response(method === "HEAD" ? null : toWebStream(createReadStream(mediaPath)), {
    status: 200,
    headers: buildMediaHeaders(contentType, fileStat.size, null),
  });
}

type ByteRange = {
  start: number;
  end: number;
};

function buildMediaHeaders(contentType: string, fileSize: number, range: ByteRange | null): Headers {
  const headers = new Headers();
  headers.set("accept-ranges", "bytes");
  headers.set("content-type", contentType);
  headers.set("content-length", String(range ? range.end - range.start + 1 : fileSize));
  if (range) {
    headers.set("content-range", `bytes ${range.start}-${range.end}/${fileSize}`);
  }
  return headers;
}

function parseByteRange(rangeHeader: string, fileSize: number): ByteRange | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }
  const [, startValue = "", endValue = ""] = match;
  if (!startValue && !endValue) {
    return null;
  }
  if (fileSize <= 0) {
    return null;
  }
  if (!startValue) {
    const suffixLength = Number.parseInt(endValue, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }
    const start = Math.max(fileSize - suffixLength, 0);
    return { start, end: fileSize - 1 };
  }
  const start = Number.parseInt(startValue, 10);
  if (!Number.isFinite(start) || start < 0 || start >= fileSize) {
    return null;
  }
  const end = endValue ? Number.parseInt(endValue, 10) : fileSize - 1;
  if (!Number.isFinite(end) || end < start) {
    return null;
  }
  return { start, end: Math.min(end, fileSize - 1) };
}

function getMediaContentType(mediaPath: string): string {
  switch (extname(mediaPath).toLowerCase()) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    case ".aac":
      return "audio/aac";
    case ".flac":
      return "audio/flac";
    case ".ogg":
      return "audio/ogg";
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".mkv":
      return "video/x-matroska";
    case ".webm":
      return "video/webm";
    case ".avi":
      return "video/x-msvideo";
    default:
      return "application/octet-stream";
  }
}

function toWebStream(nodeStream: ReturnType<typeof createReadStream>): ReadableStream<Uint8Array> {
  return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
}
