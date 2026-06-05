import { pathToFileURL } from "node:url";

export const mediaProtocolScheme = "voicenoter-media";

type ProtocolApi = {
  registerSchemesAsPrivileged(schemes: Array<{ scheme: string; privileges: Record<string, boolean> }>): void;
  handle(scheme: string, handler: (request: Request) => Response | Promise<Response>): void;
};

type NetApi = {
  fetch(url: string): Promise<Response>;
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
  netApi: NetApi,
  resolveMediaPath: (itemId: string) => string | Promise<string>,
): void {
  protocolApi.handle(mediaProtocolScheme, async (request) => {
    const itemId = parseMediaProtocolUrl(request.url);
    if (!itemId) {
      return new Response("Not found", { status: 404 });
    }
    try {
      const mediaPath = await resolveMediaPath(itemId);
      return netApi.fetch(pathToFileURL(mediaPath).toString());
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}
