import { List, GitBranch } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface ViewToggleProps {
  view: "list" | "map";
  onChange: (view: "list" | "map") => void;
}

const ViewToggle = ({ view, onChange }: ViewToggleProps) => {
  const isMobile = useIsMobile();

  // Hide toggle on mobile — always list
  if (isMobile) return null;

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-secondary/50 p-1 gap-1">
      <button
        onClick={() => onChange("list")}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          view === "list"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <List className="w-3.5 h-3.5" />
        List View
      </button>
      <button
        onClick={() => onChange("map")}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          view === "map"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <GitBranch className="w-3.5 h-3.5" />
        Music Map
      </button>
    </div>
  );
};

export default ViewToggle;
