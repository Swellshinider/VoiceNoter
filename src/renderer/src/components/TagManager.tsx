import { useState } from "react";
import type { CountedTag } from "../../../shared/types";
import { Button, Input, Panel } from "./ui";

export function TagManager({
  tags,
  selectedTagIds,
  onCreateTag,
  onRenameTag,
  onDeleteTag,
  onToggleFilter,
}: {
  tags: CountedTag[];
  selectedTagIds: string[];
  onCreateTag: (name: string) => void;
  onRenameTag: (tagId: string, name: string) => void;
  onDeleteTag: (tagId: string) => void;
  onToggleFilter: (tagId: string) => void;
}) {
  const [newTagName, setNewTagName] = useState("");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
      <Panel className="p-4">
        <div className="mb-3 text-sm font-medium">Create tag</div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!newTagName.trim()) {
              return;
            }
            onCreateTag(newTagName);
            setNewTagName("");
          }}
        >
          <Input className="flex-1" placeholder="example, customer, follow up" value={newTagName} onChange={(event) => setNewTagName(event.target.value)} />
          <Button type="submit">Create</Button>
        </form>
      </Panel>

      <Panel className="min-h-0 p-4">
        <div className="mb-3 text-sm font-medium">Tag library</div>
        {tags.length === 0 ? (
          <div className="text-sm text-muted-foreground">No tags yet.</div>
        ) : (
          <div className="space-y-3">
            {tags.map((tag) => {
              const isEditing = editingTagId === tag.id;
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <div key={tag.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {isEditing ? (
                      <Input className="min-w-[14rem] flex-1" value={editingName} onChange={(event) => setEditingName(event.target.value)} />
                    ) : (
                      <div className="min-w-[14rem] flex-1 text-sm font-medium">{tag.name}</div>
                    )}
                    <div className="text-xs text-muted-foreground">{tag.itemCount} files</div>
                    <Button variant={isSelected ? "primary" : "secondary"} onClick={() => onToggleFilter(tag.id)} type="button">
                      {isSelected ? "Filtered" : "Filter"}
                    </Button>
                    {isEditing ? (
                      <>
                        <Button
                          onClick={() => {
                            if (!editingName.trim()) {
                              return;
                            }
                            onRenameTag(tag.id, editingName);
                            setEditingTagId(null);
                            setEditingName("");
                          }}
                          type="button"
                        >
                          Save
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditingTagId(null);
                            setEditingName("");
                          }}
                          type="button"
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditingTagId(tag.id);
                          setEditingName(tag.name);
                        }}
                        type="button"
                      >
                        Rename
                      </Button>
                    )}
                    <Button variant="danger" onClick={() => onDeleteTag(tag.id)} type="button">
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </section>
  );
}
