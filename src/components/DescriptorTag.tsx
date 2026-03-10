import { useNavigate } from "react-router-dom";
import { CanonicalDescriptor } from "@/hooks/useSonicProfile";

// =============================================================================
// DescriptorTag
//
// Renders a single sonic descriptor as a styled pill.
// Clickable tags navigate to /search?descriptors={slug}.
//
// Usage:
//   <DescriptorTag slug="nocturnal" label="Nocturnal" clickable />
//   <DescriptorTag slug="driving" label="Driving" />
// =============================================================================

// Category → color mapping for visual differentiation
const CATEGORY_COLORS: Record<string, string> = {
  emotional_tone:          "bg-purple-500/15 text-purple-300 border-purple-500/30",
  texture:                 "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  era_lineage:             "bg-amber-500/15 text-amber-300 border-amber-500/30",
  environment_imagery:     "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  listener_use_case:       "bg-rose-500/15 text-rose-300 border-rose-500/30",
  tempo_feel:              "bg-blue-500/15 text-blue-300 border-blue-500/30",
  groove:                  "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  drum_character:          "bg-orange-500/15 text-orange-300 border-orange-500/30",
  bass_character:          "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  harmonic_color:          "bg-teal-500/15 text-teal-300 border-teal-500/30",
  melodic_character:       "bg-pink-500/15 text-pink-300 border-pink-500/30",
  vocal_character:         "bg-violet-500/15 text-violet-300 border-violet-500/30",
  arrangement_energy_arc:  "bg-lime-500/15 text-lime-300 border-lime-500/30",
};

const DEFAULT_COLOR = "bg-white/10 text-white/70 border-white/20";

interface DescriptorTagProps {
  slug: string;
  label?: string;
  category?: string;
  clickable?: boolean;
  size?: "sm" | "md";
  className?: string;
  onClick?: () => void;
}

export function DescriptorTag({
  slug,
  label,
  category,
  clickable = false,
  size = "sm",
  className = "",
  onClick,
}: DescriptorTagProps) {
  const navigate = useNavigate();

  const displayLabel = label || slug.replace(/-/g, " ");
  const colorClass   = category ? (CATEGORY_COLORS[category] || DEFAULT_COLOR) : DEFAULT_COLOR;

  const sizeClass = size === "md"
    ? "px-3 py-1.5 text-xs"
    : "px-2 py-0.5 text-[10px]";

  const baseClass = `inline-flex items-center rounded-full border font-medium tracking-wide transition-all select-none ${sizeClass} ${colorClass} ${className}`;

  if (clickable) {
    return (
      <button
        onClick={() => onClick ? onClick() : navigate(`/search?descriptors=${slug}&mode=descriptor`)}
        className={`${baseClass} cursor-pointer hover:brightness-125 hover:scale-105 active:scale-95`}
        title={`Find songs with ${displayLabel} →`}
      >
        {displayLabel}
      </button>
    );
  }

  return (
    <span className={`${baseClass} cursor-default`}>
      {displayLabel}
    </span>
  );
}

// ── DescriptorTagGroup ────────────────────────────────────────────────────────
// Renders a group of tags from a sonic profile category

interface DescriptorTagGroupProps {
  slugs: string[];
  category?: string;
  clickable?: boolean;
  size?: "sm" | "md";
  limit?: number;
  // Lookup map from descriptor_registry for labels
  labelMap?: Record<string, string>;
}

export function DescriptorTagGroup({
  slugs,
  category,
  clickable = false,
  size = "sm",
  limit,
  labelMap = {},
}: DescriptorTagGroupProps) {
  const visible = limit ? slugs.slice(0, limit) : slugs;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((slug) => (
        <DescriptorTag
          key={slug}
          slug={slug}
          label={labelMap[slug]}
          category={category}
          clickable={clickable}
          size={size}
        />
      ))}
    </div>
  );
}

// ── CanonicalDescriptorTags ───────────────────────────────────────────────────
// Renders canonical descriptors from a CanonicalDescriptorPayload — all clickable.

interface CanonicalDescriptorTagsProps {
  descriptors: CanonicalDescriptor[];
  size?: "sm" | "md";
  onClick?: (descriptor: CanonicalDescriptor) => void;
}

export function CanonicalDescriptorTags({
  descriptors,
  size = "sm",
  onClick,
}: CanonicalDescriptorTagsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {descriptors.map((d) => (
        <DescriptorTag
          key={d.slug}
          slug={d.slug}
          label={d.label}
          category={d.category}
          clickable
          size={size}
          onClick={onClick ? () => onClick(d) : undefined}
        />
      ))}
    </div>
  );
}
