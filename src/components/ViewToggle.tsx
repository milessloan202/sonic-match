import { List, GitBranch, LayoutGrid } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export type ViewMode = "list" | "cards" | "map";

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

const options: { value: ViewMode; label: string; icon: typeof List }[] = [
  { value: "list", label: "List", icon: List },
  { value: "cards", label: "Cards", icon: LayoutGrid },
  { value: "map", label: "Map", icon: GitBranch },
];

const ViewToggle = ({ view, onChange }: ViewToggleProps) => {
  const isMobile = useIsMobile();

  if (isMobile) return null;

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-secondary/50 p-1 gap-1">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = view === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default ViewToggle;
