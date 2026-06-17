import { useEffect, useRef, useState } from "react";
import type { ItemDetail as ItemDetailType, TranscriptSegment } from "../../../shared/types";
import { TagInput } from "./TagInput";
import { Button, Input, Panel, Spinner } from "./ui";

export function ItemDetail({
  item,
  availableTagNames,
  jumpToSeconds,
  isLoading,
  onReload,
  onBack,
  onDirtyChange,
  onItemUpdated,
}: {
  item: ItemDetailType | null;
  availableTagNames: string[];
  jumpToSeconds: number | null;
  isLoading?: boolean;
  onReload: () => void;
  onBack?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onItemUpdated?: (item: ItemDetailType) => void;
}) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [localItem, setLocalItem] = useState<ItemDetailType | null>(item);
  const [title, setTitle] = useState("");
  const [tagNames, setTagNames] = useState<string[]>(item?.tags.map((tag) => tag.name) ?? []);
  const [draftSegments, setDraftSegments] = useState<TranscriptSegment[] | null>(cloneSegments(item?.transcript?.segments ?? null));
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);

  useEffect(() => {
    setLocalItem(item);
  }, [item]);

  useEffect(() => {
    setTitle(localItem?.title ?? "");
    setTagNames(localItem?.tags.map((tag) => tag.name) ?? []);
    setDraftSegments(cloneSegments(localItem?.transcript?.segments ?? null));
  }, [localItem]);

  useEffect(() => {
    setCurrentTime(jumpToSeconds ?? 0);
    setIsPlaying(false);
  }, [localItem?.id, jumpToSeconds]);

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
  }, [localItem?.id]);

  useEffect(() => {
    if (jumpToSeconds === null) {
      return;
    }
    seekMediaToSeconds(mediaRef.current, jumpToSeconds, setCurrentTime, setIsPlaying);
  }, [jumpToSeconds, localItem?.id]);

  const transcriptSegments = draftSegments ?? cloneSegments(localItem?.transcript?.segments ?? null) ?? [];
  const persistedSegments = localItem?.transcript?.segments ?? [];
  const hasTranscript = persistedSegments.length > 0;
  const isTranscriptDirty = hasTranscript && !areSegmentsEqual(transcriptSegments, persistedSegments);
  const hasInvalidTranscript = transcriptSegments.some((segment) => segment.text.trim().length === 0);
  const activeSegmentIndex = hasTranscript && isPlaying ? getActiveSegmentIndex(transcriptSegments, currentTime) : null;
  const fullTranscript = transcriptSegments.map((segment) => segment.text).join(" ").trim();

  useEffect(() => {
    onDirtyChange?.(isTranscriptDirty);
  }, [isTranscriptDirty, onDirtyChange]);

  if (!localItem) {
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
  const currentItem = localItem;

  async function persistTitleIfNeeded() {
    if (!title.trim() || title.trim() === currentItem.title) {
      setTitle(currentItem.title);
      return;
    }
    const updated = await window.voiceNoter.items.updateItemMetadata(currentItem.id, { title: title.trim() });
    setLocalItem(updated);
    onItemUpdated?.(updated);
    onReload();
  }

  async function saveTranscript() {
    if (!hasTranscript || !isTranscriptDirty || hasInvalidTranscript || isSavingTranscript) {
      return;
    }
    setIsSavingTranscript(true);
    try {
      const updated = await window.voiceNoter.items.updateTranscript(currentItem.id, {
        segments: transcriptSegments.map((segment) => ({
          ...segment,
          text: segment.text.trim(),
        })),
      });
      setLocalItem(updated);
      onItemUpdated?.(updated);
      onReload();
    } finally {
      setIsSavingTranscript(false);
    }
  }

  async function persistTagNames(nextTagNames: string[]) {
    if (isSavingTags) {
      return;
    }

    const normalizedCurrent = currentItem.tags.map((tag) => tag.name).sort().join(",");
    const normalizedNext = [...nextTagNames].sort().join(",");
    setTagNames(nextTagNames);
    if (normalizedCurrent === normalizedNext) {
      return;
    }

    setIsSavingTags(true);
    try {
      const updated = await window.voiceNoter.items.updateItemMetadata(currentItem.id, {
        tagNames: nextTagNames,
      });
      setLocalItem(updated);
      onItemUpdated?.(updated);
      onReload();
    } finally {
      setIsSavingTags(false);
    }
  }

  function cancelTranscriptDraft() {
    setDraftSegments(cloneSegments(currentItem.transcript?.segments ?? null));
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="border-b border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {onBack ? (
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
          ) : null}
          <Input
            className="min-w-[16rem] flex-1 text-base font-medium"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              void persistTitleIfNeeded();
            }}
          />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Tags</div>
                <div className="text-xs text-muted-foreground">Type tags separated by commas. Existing tags autocomplete as you type.</div>
              </div>
              {isSavingTags ? <div className="text-xs text-muted-foreground">Saving...</div> : null}
            </div>
            <TagInput
              disabled={isSavingTags}
              placeholder="follow up, customer, meeting"
              suggestions={availableTagNames}
              value={tagNames}
              onChange={(nextValue) => {
                void persistTagNames(nextValue);
              }}
            />
          </Panel>

          <Panel className="p-4">
            {currentItem.sourceType === "video" ? (
              <video
                ref={(node) => {
                  mediaRef.current = node;
                }}
                className="aspect-video w-full rounded bg-black"
                controls
                src={currentItem.mediaUrl}
              />
            ) : (
              <audio
                ref={(node) => {
                  mediaRef.current = node;
                }}
                className="w-full"
                controls
                src={currentItem.mediaUrl}
              />
            )}
          </Panel>

          <Panel className="min-h-0 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Transcript segments</div>
                <div className="text-xs text-muted-foreground">Edit text only. Timestamps stay fixed.</div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={!hasTranscript || !isTranscriptDirty || isSavingTranscript} onClick={cancelTranscriptDraft}>
                  Cancel
                </Button>
                <Button disabled={!hasTranscript || !isTranscriptDirty || hasInvalidTranscript || isSavingTranscript} onClick={() => void saveTranscript()}>
                  {isSavingTranscript ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>

            {hasTranscript ? (
              <div className="flex flex-col gap-3">
                {transcriptSegments.map((segment, index) => {
                  const isActive = activeSegmentIndex === index;
                  return (
                    <div
                      key={`${segment.startSeconds}-${segment.endSeconds}`}
                      className={`rounded-md border p-3 transition ${
                        isActive ? "border-primary bg-primary/10" : "border-border bg-background"
                      }`}
                    >
                      <button
                        aria-current={isActive ? "true" : undefined}
                        className="mb-3 text-xs font-medium text-primary"
                        onClick={() => {
                          seekMediaToSeconds(mediaRef.current, segment.startSeconds, setCurrentTime, setIsPlaying);
                        }}
                      >
                        {formatTimestamp(segment.startSeconds)}
                      </button>
                      <textarea
                        className="min-h-24 w-full resize-y rounded-md border border-input bg-card p-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring"
                        value={segment.text}
                        onChange={(event) => {
                          const nextText = event.target.value;
                          setDraftSegments((previous) =>
                            (previous ?? []).map((previousSegment, previousIndex) =>
                              previousIndex === index ? { ...previousSegment, text: nextText } : previousSegment,
                            ),
                          );
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Transcript will appear after local transcription completes.</div>
            )}
          </Panel>
        </div>

        <Panel className="flex min-h-[20rem] flex-col p-4">
          <div className="mb-3">
            <div className="text-sm font-medium">Full transcript</div>
            <div className="text-xs text-muted-foreground">Read-only preview of the saved-or-draft transcript text.</div>
          </div>
          {hasTranscript ? (
            <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">{fullTranscript}</div>
          ) : (
            <div className="text-sm text-muted-foreground">Transcript will appear after local transcription completes.</div>
          )}
        </Panel>
      </div>
    </section>
  );
}

function cloneSegments(segments: TranscriptSegment[] | null): TranscriptSegment[] | null {
  return segments ? segments.map((segment) => ({ ...segment })) : null;
}

function areSegmentsEqual(left: TranscriptSegment[], right: TranscriptSegment[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every(
    (segment, index) =>
      segment.startSeconds === right[index]?.startSeconds &&
      segment.endSeconds === right[index]?.endSeconds &&
      segment.text === right[index]?.text,
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
  const playback = media.play();
  if (playback && typeof playback.catch === "function") {
    void playback.catch(() => undefined);
  }
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
