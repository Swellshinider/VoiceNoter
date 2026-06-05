import { Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import type { ItemDetail as ItemDetailType } from "../../../shared/types";
import { Button, Input, Panel, Spinner } from "./ui";

export function ItemDetail({
  item,
  jumpToSeconds,
  isLoading,
  onReload,
  editorTheme = "dark",
}: {
  item: ItemDetailType | null;
  jumpToSeconds: number | null;
  isLoading?: boolean;
  onReload: () => void;
  editorTheme?: "light" | "dark";
}) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [markdownText, setMarkdownText] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [title, setTitle] = useState("");

  useEffect(() => {
    setMarkdownText(item?.note?.markdown ?? "");
    setTitle(item?.title ?? "");
  }, [item?.id, item?.note?.markdown, item?.title]);

  useEffect(() => {
    if (jumpToSeconds !== null && mediaRef.current) {
      mediaRef.current.currentTime = jumpToSeconds;
      void mediaRef.current.play().catch(() => undefined);
    }
  }, [jumpToSeconds]);

  useEffect(() => {
    if (!item?.note || markdownText === item.note.markdown) {
      return;
    }
    setSaveState("saving");
    const timeout = window.setTimeout(() => {
      void window.voiceNoter.items
        .saveNote(item.id, markdownText)
        .then(() => {
          setSaveState("saved");
          onReload();
        })
        .catch(() => setSaveState("error"));
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [item?.id, item?.note, markdownText, onReload]);

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
          <span className="text-xs text-muted-foreground">{saveState}</span>
          <Button
            variant="secondary"
            disabled={!item.note}
            onClick={() => {
              if (!item.note) return;
              setSaveState("saving");
              void window.voiceNoter.items
                .saveNote(item.id, markdownText)
                .then(() => {
                  setSaveState("saved");
                  onReload();
                })
                .catch(() => setSaveState("error"));
            }}
          >
            <Save data-icon="inline-start" />
            Save
          </Button>
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
          <Panel className="min-h-0 flex-1 overflow-hidden">
            {item.note ? (
              <CodeMirror
                value={markdownText}
                height="100%"
                theme={editorTheme}
                extensions={[markdown()]}
                basicSetup={{ lineNumbers: true, foldGutter: true }}
                onChange={setMarkdownText}
              />
            ) : (
              <div className="p-4 text-sm text-muted-foreground">Markdown note will appear after processing completes.</div>
            )}
          </Panel>
        </div>
        <Panel className="min-h-0 overflow-auto p-3">
          <div className="mb-3 text-sm font-medium">Transcript</div>
          {item.transcript ? (
            <div className="flex flex-col gap-2">
              {item.transcript.segments.map((segment) => (
                <button
                  key={`${segment.startSeconds}-${segment.text}`}
                  className="rounded-md border border-border bg-background p-2 text-left text-sm hover:bg-secondary"
                  onClick={() => {
                    if (mediaRef.current) {
                      mediaRef.current.currentTime = segment.startSeconds;
                      void mediaRef.current.play().catch(() => undefined);
                    }
                  }}
                >
                  <div className="mb-1 text-xs font-medium text-primary">{formatTimestamp(segment.startSeconds)}</div>
                  <div className="text-muted-foreground">{segment.text}</div>
                </button>
              ))}
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
