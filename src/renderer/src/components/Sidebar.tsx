import { Boxes, Folder, Inbox, List, Search, Settings, Tags, Workflow } from "lucide-react";
import type { ItemSummary } from "../../../shared/types";

export type ViewKey = "inbox" | "all" | "search" | "queue" | "models" | "settings";

export type FilterState = { type: "category" | "tag"; id: string; name: string } | null;

export function Sidebar({
  view,
  items,
  activeFilter,
  onViewChange,
  onFilterSelect,
}: {
  view: ViewKey;
  items: ItemSummary[];
  activeFilter: FilterState;
  onViewChange: (view: ViewKey) => void;
  onFilterSelect: (filter: FilterState) => void;
}) {
  const categories = uniqueById(items.map((item) => item.category).filter(Boolean) as Array<{ id: string; name: string }>);
  const tags = uniqueById(items.flatMap((item) => item.tags));
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-4">
        <div className="text-lg font-semibold">VoiceNoter</div>
        <div className="text-xs text-muted-foreground">Local media notes</div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-auto p-3">
        <NavButton icon={<Inbox />} label="Inbox" selected={view === "inbox" && !activeFilter} onClick={() => { onFilterSelect(null); onViewChange("inbox"); }} />
        <NavButton icon={<List />} label="All Items" selected={view === "all" && !activeFilter} onClick={() => { onFilterSelect(null); onViewChange("all"); }} />
        <NavButton icon={<Search />} label="Search Results" selected={view === "search"} onClick={() => onViewChange("search")} />
        <NavButton icon={<Workflow />} label="Processing Queue" selected={view === "queue"} onClick={() => onViewChange("queue")} />
        <NavButton icon={<Boxes />} label="Model Manager" selected={view === "models"} onClick={() => onViewChange("models")} />
        <NavButton icon={<Settings />} label="Settings" selected={view === "settings"} onClick={() => onViewChange("settings")} />
        <SidebarGroup
          icon={<Folder />}
          label="Categories"
          items={categories}
          selectedId={activeFilter?.type === "category" ? activeFilter.id : null}
          onItemClick={(id, name) => onFilterSelect({ type: "category", id, name })}
        />
        <SidebarGroup
          icon={<Tags />}
          label="Tags"
          items={tags}
          selectedId={activeFilter?.type === "tag" ? activeFilter.id : null}
          onItemClick={(id, name) => onFilterSelect({ type: "tag", id, name })}
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
  selectedId,
  onItemClick,
}: {
  icon: React.ReactNode;
  label: string;
  items: Array<{ id: string; name: string }>;
  selectedId: string | null;
  onItemClick: (id: string, name: string) => void;
}) {
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center gap-2 px-3 text-xs font-medium uppercase text-muted-foreground [&_svg]:size-3">
        {icon}
        {label}
      </div>
      {items.length === 0 ? (
        <div className="px-3 text-xs text-muted-foreground">None yet</div>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <button
              key={item.id}
              className={`flex h-8 w-full items-center rounded-md px-3 text-left text-sm transition ${
                selectedId === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
              onClick={() => onItemClick(item.id, item.name)}
            >
              <span className="truncate">{item.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function uniqueById(items: Array<{ id: string; name: string }>) {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
