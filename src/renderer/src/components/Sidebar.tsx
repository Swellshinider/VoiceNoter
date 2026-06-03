import { Boxes, Folder, Inbox, List, Search, Settings, Tags, Workflow } from "lucide-react";
import type { ItemSummary } from "../../../shared/types";
import { Button } from "./ui";

export type ViewKey = "inbox" | "all" | "search" | "queue" | "models" | "settings";

export function Sidebar({
  view,
  items,
  onViewChange,
}: {
  view: ViewKey;
  items: ItemSummary[];
  onViewChange: (view: ViewKey) => void;
}) {
  const categories = unique(items.map((item) => item.category?.name).filter(Boolean) as string[]);
  const tags = unique(items.flatMap((item) => item.tags.map((tag) => tag.name)));
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-4">
        <div className="text-lg font-semibold">VoiceNoter</div>
        <div className="text-xs text-muted-foreground">Local media notes</div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-auto p-3">
        <NavButton icon={<Inbox />} label="Inbox" selected={view === "inbox"} onClick={() => onViewChange("inbox")} />
        <NavButton icon={<List />} label="All Items" selected={view === "all"} onClick={() => onViewChange("all")} />
        <NavButton icon={<Search />} label="Search Results" selected={view === "search"} onClick={() => onViewChange("search")} />
        <NavButton icon={<Workflow />} label="Processing Queue" selected={view === "queue"} onClick={() => onViewChange("queue")} />
        <NavButton icon={<Boxes />} label="Model Manager" selected={view === "models"} onClick={() => onViewChange("models")} />
        <NavButton icon={<Settings />} label="Settings" selected={view === "settings"} onClick={() => onViewChange("settings")} />
        <SidebarGroup icon={<Folder />} label="Categories" values={categories} />
        <SidebarGroup icon={<Tags />} label="Tags" values={tags} />
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

function SidebarGroup({ icon, label, values }: { icon: React.ReactNode; label: string; values: string[] }) {
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center gap-2 px-3 text-xs font-medium uppercase text-muted-foreground [&_svg]:size-3">
        {icon}
        {label}
      </div>
      {values.length === 0 ? (
        <div className="px-3 text-xs text-muted-foreground">None yet</div>
      ) : (
        <div className="flex flex-col gap-1">
          {values.map((value) => (
            <Button key={value} variant="ghost" className="justify-start">
              {value}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
