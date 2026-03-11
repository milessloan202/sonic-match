import { useNavigate } from "react-router-dom";
import { CanonicalDescriptor } from "@/hooks/useSonicProfile";
import { CanonicalDescriptorTags } from "@/components/DescriptorTag";

// =============================================================================
// ExploreDNA
//
// A card that lets users explore the sonic fingerprint of a song.
// Shows canonical descriptor tags + a "Find songs with this exact mix" CTA
// plus 2 partial-match pair suggestions.
// =============================================================================

interface ExploreDNAProps {
  descriptors: CanonicalDescriptor[];
  searchUrl: string;
  songTitle?: string;
}

export function ExploreDNA({ descriptors, searchUrl, songTitle }: ExploreDNAProps) {
  const navigate = useNavigate();

  if (descriptors.length === 0) return null;

  // Append mode=lineage so SearchPage shows "Explore This DNA" heading
  const withLineageMode = (url: string) =>
    url.includes("?") ? `${url}&mode=lineage` : `${url}?mode=lineage`;

  const fullSearchUrl = withLineageMode(searchUrl);

  // Build 2 pair suggestions: first descriptor combined with each of the next 2
  const pairSuggestions = descriptors.slice(1, 3).map((d) => ({
    label: `${descriptors[0].label} + ${d.label}`,
    url: withLineageMode(`/search?descriptors=${descriptors[0].slug},${d.slug}`),
  }));

  return (
    <div className="rounded-xl border border-border bg-card/50 p-5 space-y-4">
      {/* Header */}
      <div className="space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Explore this DNA
        </p>
        {songTitle && (
          <p className="text-xs text-muted-foreground">
            What makes <span className="text-foreground font-medium">{songTitle}</span> sound the way it does
          </p>
        )}
      </div>

      {/* Canonical descriptor tags — each chip stacks into a lineage search */}
      <CanonicalDescriptorTags
        descriptors={descriptors}
        size="md"
        onClick={(d) => navigate(withLineageMode(`/search?descriptors=${d.slug}`))}
      />

      {/* Primary CTA */}
      <button
        onClick={() => navigate(fullSearchUrl)}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all active:scale-[0.98]"
      >
        Find songs with this exact mix →
      </button>

      {/* Partial-match pair suggestions */}
      {pairSuggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
            Or narrow it down
          </p>
          <div className="flex flex-wrap gap-2">
            {pairSuggestions.map((pair) => (
              <button
                key={pair.label}
                onClick={() => navigate(pair.url)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                {pair.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
