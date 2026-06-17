import { Boxes, LayoutDashboard, List, Settings, Tags, Workflow } from "lucide-react";
import type { ItemFacets } from "../../../shared/types";

export type ViewKey = "dashboard" | "all" | "queue" | "models" | "tags" | "settings";

export function Sidebar({
  view,
  facets,
  selectedTagIds,
  onViewChange,
  onToggleTagFilter,
  onClearTagFilters,
}: {
  view: ViewKey;
  facets: ItemFacets | null;
  selectedTagIds: string[];
  onViewChange: (view: ViewKey) => void;
  onToggleTagFilter: (tagId: string) => void;
  onClearTagFilters: () => void;
}) {
  const tags = facets?.tags ?? [];
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-4">
        <div className="text-lg font-semibold">VoiceNoter</div>
        <div className="text-xs text-muted-foreground">Local media notes</div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-auto p-3">
        <NavButton icon={<LayoutDashboard />} label="Dashboard" selected={view === "dashboard"} onClick={() => onViewChange("dashboard")} />
        <NavButton icon={<List />} label="All Items" selected={view === "all"} onClick={() => onViewChange("all")} />
        <NavButton icon={<Workflow />} label="Processing Status" selected={view === "queue"} onClick={() => onViewChange("queue")} />
        <NavButton icon={<Boxes />} label="Model Manager" selected={view === "models"} onClick={() => onViewChange("models")} />
        <NavButton icon={<Tags />} label="Tag Manager" selected={view === "tags"} onClick={() => onViewChange("tags")} />
        <NavButton icon={<Settings />} label="Settings" selected={view === "settings"} onClick={() => onViewChange("settings")} />
        <SidebarGroup
          icon={<Tags />}
          label="Tags"
          items={tags}
          selectedIds={selectedTagIds}
          onClear={onClearTagFilters}
          onItemClick={(id) => onToggleTagFilter(id)}
        />
      </nav>
    </aside>
  );
}

function NavButton({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex h-9 items-center gap-2 rounded-md px-3 text-sm text-left transition [&_svg]:size-4 ${
        selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function SidebarGroup({
  icon,
  label,
  items,
  selectedIds,
  onItemClick,
  onClear,
}: {
  icon: React.ReactNode;
  label: string;
  items: Array<{ id: string; name: string; itemCount: number }>;
  selectedIds: string[];
  onItemClick: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-3 text-xs font-medium uppercase text-muted-foreground [&_svg]:size-3">
        <div className="flex items-center gap-2">
          {icon}
          {label}
        </div>
        {selectedIds.length > 0 ? (
          <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={onClear}>
            Clear
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="px-3 text-xs text-muted-foreground">None yet</div>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <button
              key={item.id}
              className={`flex h-8 w-full items-center justify-between rounded-md px-3 text-left text-sm transition ${
                selectedIds.includes(item.id)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
              onClick={() => onItemClick(item.id)}
            >
              <span className="truncate">{item.name}</span>
              <span className="ml-2 text-[10px] tabular-nums opacity-70">{item.itemCount}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
