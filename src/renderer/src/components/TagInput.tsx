import { useMemo, useState } from "react";
import { Badge, Input } from "./ui";

export function TagInput({
  value,
  suggestions,
  placeholder = "Add tags",
  allowCreate = true,
  disabled = false,
  onChange,
}: {
  value: string[];
  suggestions: string[];
  placeholder?: string;
  allowCreate?: boolean;
  disabled?: boolean;
  onChange: (value: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const normalizedSelected = useMemo(() => new Set(value.map(normalizeTagName)), [value]);
  const filteredSuggestions = useMemo(() => {
    const query = normalizeTagName(draft);
    return suggestions
      .filter((tag) => !normalizedSelected.has(normalizeTagName(tag)))
      .filter((tag) => (query ? normalizeTagName(tag).includes(query) : true))
      .slice(0, 6);
  }, [draft, normalizedSelected, suggestions]);

  function applyToken(token: string, currentValue = value): string[] {
    const normalized = normalizeTagName(token);
    if (!normalized) {
      return currentValue;
    }

    const suggestion = suggestions.find((item) => normalizeTagName(item) === normalized);
    const nextTag = suggestion ?? (allowCreate ? normalized : null);
    if (!nextTag) {
      return currentValue;
    }
    if (currentValue.some((item) => normalizeTagName(item) === normalizeTagName(nextTag))) {
      return currentValue;
    }
    return [...currentValue, nextTag];
  }

  function commitDraft() {
    const nextValue = applyToken(draft);
    if (nextValue !== value) {
      onChange(nextValue);
    }
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-md border border-input bg-card px-2 py-2">
        {value.map((tag) => (
          <button
            key={tag}
            className="inline-flex items-center gap-1 rounded"
            disabled={disabled}
            onClick={() => onChange(value.filter((item) => item !== tag))}
            type="button"
          >
            <Badge>{tag}</Badge>
          </button>
        ))}
        <Input
          className="h-7 min-w-[12rem] flex-1 border-0 bg-transparent px-1 focus:ring-0"
          disabled={disabled}
          placeholder={placeholder}
          value={draft}
          onBlur={commitDraft}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (!nextValue.includes(",")) {
              setDraft(nextValue);
              return;
            }

            const parts = nextValue.split(",");
            let currentValue = value;
            for (const token of parts.slice(0, -1)) {
              currentValue = applyToken(token, currentValue);
            }
            if (currentValue !== value) {
              onChange(currentValue);
            }
            setDraft(parts.at(-1) ?? "");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commitDraft();
              return;
            }
            if (event.key === "Backspace" && draft.length === 0 && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
        />
      </div>
      {filteredSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {filteredSuggestions.map((tag) => (
            <button
              key={tag}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(applyToken(tag));
                setDraft("");
              }}
              type="button"
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
