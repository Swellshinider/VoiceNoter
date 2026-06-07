import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createMediaResponse, createMediaUrl, parseMediaProtocolUrl } from "./media-protocol";

describe("media protocol URL helpers", () => {
  it("creates and parses item media URLs", () => {
    expect(createMediaUrl("item-1")).toBe("voicenoter-media://items/item-1/media");
    expect(parseMediaProtocolUrl("voicenoter-media://items/item-1/media")).toBe("item-1");
    expect(parseMediaProtocolUrl("voicenoter-media://items/item%201/media")).toBe("item 1");
  });

  it("rejects non-item media URLs and arbitrary paths", () => {
    expect(parseMediaProtocolUrl("file:///tmp/source.mp4")).toBeNull();
    expect(parseMediaProtocolUrl("voicenoter-media://items/item-1/../../etc/passwd")).toBeNull();
    expect(parseMediaProtocolUrl("voicenoter-media://items/item-1/media/extra")).toBeNull();
    expect(parseMediaProtocolUrl("voicenoter-media://paths/item-1/media")).toBeNull();
    expect(parseMediaProtocolUrl("voicenoter-media://items//media")).toBeNull();
  });

  it("serves the full file with range-friendly headers", async () => {
    const root = await mkdtemp(join(tmpdir(), "voicenoter-media-"));
    const mediaPath = join(root, "clip.mp4");
    await writeFile(mediaPath, "abcdefghij", "utf8");

    const response = await createMediaResponse(new Request("voicenoter-media://items/item-1/media"), mediaPath);

    expect(response.status).toBe(200);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-length")).toBe("10");
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe("abcdefghij");
  });

  it("serves a byte range with partial content", async () => {
    const root = await mkdtemp(join(tmpdir(), "voicenoter-media-"));
    const mediaPath = join(root, "clip.mp4");
    await writeFile(mediaPath, "abcdefghij", "utf8");

    const request = new Request("voicenoter-media://items/item-1/media", {
      headers: { Range: "bytes=2-4" },
    });
    const response = await createMediaResponse(request, mediaPath);

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-4/10");
    expect(response.headers.get("content-length")).toBe("3");
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe("cde");
  });

  it("rejects unsatisfiable byte ranges", async () => {
    const root = await mkdtemp(join(tmpdir(), "voicenoter-media-"));
    const mediaPath = join(root, "clip.mp4");
    await writeFile(mediaPath, "abcdefghij", "utf8");

    const request = new Request("voicenoter-media://items/item-1/media", {
      headers: { Range: "bytes=100-200" },
    });
    const response = await createMediaResponse(request, mediaPath);

    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */10");
    expect(await response.text()).toBe("");
  });
});
