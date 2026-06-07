import { useEffect, useRef, useState } from "react";
import type { ItemDetail as ItemDetailType, TranscriptSegment } from "../../../shared/types";
import { Input, Panel, Spinner } from "./ui";

export function ItemDetail({
  item,
  jumpToSeconds,
  isLoading,
  onReload,
}: {
  item: ItemDetailType | null;
  jumpToSeconds: number | null;
  isLoading?: boolean;
  onReload: () => void;
}) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [title, setTitle] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setTitle(item?.title ?? "");
  }, [item?.id, item?.title]);

  useEffect(() => {
    setCurrentTime(jumpToSeconds ?? 0);
    setIsPlaying(false);
  }, [item?.id, jumpToSeconds]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) {
      return;
    }

    const syncCurrentTime = () => setCurrentTime(media.currentTime);
    const markPlaying = () => setIsPlaying(true);
    const markPaused = () => setIsPlaying(false);
    syncCurrentTime();
    media.addEventListener("timeupdate", syncCurrentTime);
    media.addEventListener("seeked", syncCurrentTime);
    media.addEventListener("loadedmetadata", syncCurrentTime);
    media.addEventListener("play", markPlaying);
    media.addEventListener("pause", markPaused);
    media.addEventListener("ended", markPaused);
    return () => {
      media.removeEventListener("timeupdate", syncCurrentTime);
      media.removeEventListener("seeked", syncCurrentTime);
      media.removeEventListener("loadedmetadata", syncCurrentTime);
      media.removeEventListener("play", markPlaying);
      media.removeEventListener("pause", markPaused);
      media.removeEventListener("ended", markPaused);
    };
  }, [item?.id]);

  useEffect(() => {
    if (jumpToSeconds === null) {
      return;
    }
    seekMediaToSeconds(mediaRef.current, jumpToSeconds, setCurrentTime, setIsPlaying);
  }, [jumpToSeconds, item?.id]);

  const activeSegmentIndex = item?.transcript && isPlaying ? getActiveSegmentIndex(item.transcript.segments, currentTime) : null;

  if (!item) {
    if (isLoading) {
      return (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Loading...
        </div>
      );
    }
    return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Select an item.</div>;
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="border-b border-border bg-card p-3">
        <div className="flex items-center gap-3">
          <Input
            className="flex-1 text-base font-medium"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              if (title.trim() && title !== item.title) {
                void window.voiceNoter.items.updateItemMetadata(item.id, { title: title.trim() }).then(onReload);
              }
            }}
          />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(360px,1fr)_320px] gap-3 overflow-hidden p-3">
        <div className="flex min-h-0 flex-col gap-3">
          <Panel className="p-3">
            {item.sourceType === "video" ? (
              <video
                ref={(node) => {
                  mediaRef.current = node;
                }}
                className="aspect-video w-full rounded bg-black"
                controls
                src={item.mediaUrl}
              />
            ) : (
              <audio
                ref={(node) => {
                  mediaRef.current = node;
                }}
                className="w-full"
                controls
                src={item.mediaUrl}
              />
            )}
          </Panel>
        </div>
        <Panel className="min-h-0 overflow-auto p-3">
          <div className="mb-3 text-sm font-medium">Transcript</div>
          {item.transcript ? (
            <div className="flex flex-col gap-2">
              {item.transcript.segments.map((segment, index) => {
                const isActive = activeSegmentIndex === index;
                return (
                  <button
                    key={`${segment.startSeconds}-${segment.text}`}
                    aria-current={isActive ? "true" : undefined}
                    className={`rounded-md border p-2 text-left text-sm transition ${
                      isActive
                        ? "border-primary bg-primary/10 text-foreground shadow-sm"
                        : "border-border bg-background hover:bg-secondary"
                    }`}
                    onClick={() => {
                      seekMediaToSeconds(mediaRef.current, segment.startSeconds, setCurrentTime, setIsPlaying);
                    }}
                  >
                    <div className="mb-1 text-xs font-medium text-primary">{formatTimestamp(segment.startSeconds)}</div>
                    <div className="text-muted-foreground">{segment.text}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Transcript will appear after local transcription completes.</div>
          )}
        </Panel>
      </div>
    </section>
  );
}

function formatTimestamp(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function seekMediaToSeconds(
  media: HTMLMediaElement | null,
  seconds: number,
  onTimeChange: (seconds: number) => void,
  onPlayingChange: (isPlaying: boolean) => void,
): void {
  onTimeChange(seconds);
  onPlayingChange(true);
  if (!media) {
    return;
  }
  const fastSeek = media as HTMLMediaElement & { fastSeek?: (time: number) => void };
  if (typeof fastSeek.fastSeek === "function") {
    fastSeek.fastSeek(seconds);
  } else {
    media.currentTime = seconds;
  }
  void media.play().catch(() => undefined);
}

function getActiveSegmentIndex(segments: TranscriptSegment[], currentTime: number): number | null {
  if (segments.length === 0) {
    return null;
  }
  const directHit = segments.findIndex((segment) => currentTime >= segment.startSeconds && currentTime < segment.endSeconds);
  if (directHit !== -1) {
    return directHit;
  }
  if (currentTime < segments[0]!.startSeconds) {
    return null;
  }
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    if (currentTime >= segments[index]!.startSeconds) {
      return index;
    }
  }
  return null;
}
