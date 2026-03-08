import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { DiscoveryStep } from "../hooks/useDiscoveryPath";

interface DiscoveryPathProps {
  steps: DiscoveryStep[];
}

const DiscoveryPath = ({ steps }: DiscoveryPathProps) => {
  if (steps.length <= 1) return null;

  return (
    <nav aria-label="Discovery path" className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
      <span className="font-medium text-muted-foreground/70 mr-1">Discovery Path:</span>
      {steps.map((step, i) => (
        <span key={step.path} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
          {i === steps.length - 1 ? (
            <span className="text-foreground/80 font-medium">{step.label}</span>
          ) : (
            <Link
              to={step.path}
              className="hover:text-foreground transition-colors underline underline-offset-2 decoration-muted-foreground/30 hover:decoration-foreground/50"
            >
              {step.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
};

export default DiscoveryPath;
