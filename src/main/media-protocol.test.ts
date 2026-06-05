import { describe, expect, it } from "vitest";
import { createMediaUrl, parseMediaProtocolUrl } from "./media-protocol";

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
});
