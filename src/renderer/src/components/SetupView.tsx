import { FolderOpen, History, Sparkles } from "lucide-react";
import { Button } from "./ui";

export function SetupView({
  lastLibraryPath,
  onChooseLibrary,
  onOpenLastLibrary,
}: {
  lastLibraryPath?: string | null;
  onChooseLibrary: () => void;
  onOpenLastLibrary?: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-xl rounded-md border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">
            <Sparkles className="size-4" />
            Local-first workspace
          </div>
          <h1 className="text-3xl font-semibold">VoiceNoter</h1>
          <p className="max-w-lg text-sm leading-6 text-muted-foreground">
            Open a library to manage local media imports, background transcription, Markdown notes, and search without sending data to the cloud.
          </p>
        </div>

        {lastLibraryPath && onOpenLastLibrary ? (
          <div className="mt-6 rounded-md border border-border bg-background p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <History className="size-4" />
              Last opened library
            </div>
            <div className="mt-2 truncate text-sm font-medium">{lastLibraryPath}</div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap justify-end gap-2">
          {lastLibraryPath && onOpenLastLibrary ? (
            <Button variant="secondary" onClick={onOpenLastLibrary}>
              <History data-icon="inline-start" />
              Open Last Library
            </Button>
          ) : null}
          <Button onClick={onChooseLibrary}>
            <FolderOpen data-icon="inline-start" />
            Choose Library
          </Button>
        </div>
      </div>
    </main>
  );
}
