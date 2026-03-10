import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DescriptorTag } from "@/components/DescriptorTag";
import SEOHead from "@/components/SEOHead";

// =============================================================================
// SearchPage  /search?descriptors=slug1,slug2
//
// Multi-descriptor song search powered by the search-by-descriptors edge fn.
// =============================================================================

// Category display order and labels for the picker
const CATEGORY_ORDER = [
  "emotional_tone", "texture", "era_lineage", "tempo_feel",
  "groove", "harmonic_color", "vocal_character",
  "environment_imagery", "listener_use_case",
];
const CATEGORY_LABELS: Record<string, string> = {
  emotional_tone:      "Emotional Tone",
  texture:             "Texture",
  era_lineage:         "Era / Lineage",
  tempo_feel:          "Tempo Feel",
  groove:              "Groove",
  harmonic_color:      "Harmonic Color",
  vocal_character:     "Vocal Character",
  environment_imagery: "Environment",
  listener_use_case:   "Listener Use Case",
};

// Popular seed descriptors for the empty state
const POPULAR_DESCRIPTORS = [
  { slug: "nocturnal",     label: "Nocturnal",     category: "emotional_tone" },
  { slug: "wistful",       label: "Wistful",        category: "emotional_tone" },
  { slug: "driving",       label: "Driving",        category: "tempo_feel" },
  { slug: "laid-back",     label: "Laid Back",      category: "tempo_feel" },
  { slug: "glossy",        label: "Glossy",         category: "texture" },
  { slug: "lo-fi",         label: "Lo-Fi",          category: "texture" },
  { slug: "neo-soul",      label: "Neo Soul",       category: "era_lineage" },
  { slug: "trap-soul",     label: "Trap Soul",      category: "era_lineage" },
  { slug: "night-drive",   label: "Night Drive",    category: "environment_imagery" },
  { slug: "seductive",     label: "Seductive",      category: "emotional_tone" },
  { slug: "swaggering",    label: "Swaggering",     category: "emotional_tone" },
  { slug: "late-night-walk", label: "Late Night Walk", category: "listener_use_case" },
];

interface RegistryDescriptor {
  slug: string;
  label: string;
  category: string;
}

interface SearchResult {
  spotify_track_id: string;
  song_title: string;
  artist_name: string;
  descriptor_slugs: string[];
  matched_count: number;
  matched_slugs: string[];
  match_ratio: number;
}

function toSlug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeDescriptors = (searchParams.get("descriptors") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const [results, setResults]           = useState<SearchResult[]>([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [pickerOpen, setPickerOpen]     = useState(false);
  const [registry, setRegistry]         = useState<RegistryDescriptor[]>([]);
  const [registryLoaded, setRegistryLoaded] = useState(false);

  // ── Fetch registry when picker opens ─────────────────────────────────────
  useEffect(() => {
    if (!pickerOpen || registryLoaded) return;
    (async () => {
      const { data } = await (supabase
        .from("descriptor_registry" as any)
        .select("slug, label, category")
        .in("category", CATEGORY_ORDER)
        .order("label", { ascending: true }) as any);
      setRegistry((data || []) as RegistryDescriptor[]);
      setRegistryLoaded(true);
    })();
  }, [pickerOpen, registryLoaded]);

  // ── Search ────────────────────────────────────────────────────────────────
  const runSearch = useCallback(async (descriptors: string[]) => {
    if (descriptors.length === 0) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "search-by-descriptors",
        { body: { descriptors, limit: 24 } },
      );
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      setResults((data.results || []) as SearchResult[]);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runSearch(activeDescriptors);
  }, [searchParams]); // re-run whenever URL changes

  // ── Descriptor management ─────────────────────────────────────────────────
  function addDescriptor(slug: string) {
    if (activeDescriptors.includes(slug)) return;
    const next = [...activeDescriptors, slug];
    setSearchParams({ descriptors: next.join(",") });
    setPickerOpen(false);
  }

  function removeDescriptor(slug: string) {
    const next = activeDescriptors.filter((d) => d !== slug);
    if (next.length === 0) {
      setSearchParams({});
    } else {
      setSearchParams({ descriptors: next.join(",") });
    }
  }

  // ── Grouped registry for picker ───────────────────────────────────────────
  const grouped: Record<string, RegistryDescriptor[]> = {};
  for (const d of registry) {
    if (!grouped[d.category]) grouped[d.category] = [];
    grouped[d.category].push(d);
  }

  // ── Primary descriptor label for single-descriptor hint ──────────────────
  const primarySlug = activeDescriptors[0];
  const primaryLabel = registry.find((d) => d.slug === primarySlug)?.label
    || POPULAR_DESCRIPTORS.find((d) => d.slug === primarySlug)?.label
    || primarySlug?.replace(/-/g, " ");

  return (
    <>
      <SEOHead
        title={
          activeDescriptors.length > 0
            ? `Songs with ${activeDescriptors.slice(0, 2).map((s) => s.replace(/-/g, " ")).join(" + ")} sound`
            : "Search by Sonic DNA"
        }
        description="Find songs that match your sonic taste using descriptor-based search."
        path="/search"
      />

      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">

          {/* Header */}
          <div className="space-y-1">
            <button
              onClick={() => navigate(-1)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-foreground">Search by DNA</h1>
          </div>

          {/* Active descriptor pills + add button */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              {activeDescriptors.map((slug) => {
                const meta = registry.find((d) => d.slug === slug)
                  || POPULAR_DESCRIPTORS.find((d) => d.slug === slug);
                return (
                  <span
                    key={slug}
                    className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs font-medium"
                  >
                    {meta?.label || slug.replace(/-/g, " ")}
                    <button
                      onClick={() => removeDescriptor(slug)}
                      className="rounded-full hover:bg-primary/20 p-0.5 transition-colors"
                      aria-label={`Remove ${slug}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}

              <button
                onClick={() => setPickerOpen((o) => !o)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-border text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all"
              >
                + Add descriptor
                {pickerOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {/* Single-descriptor DNA page hint */}
            {activeDescriptors.length === 1 && (
              <p className="text-xs text-muted-foreground">
                About the{" "}
                <button
                  onClick={() => navigate(`/dna/${primarySlug}`)}
                  className="text-primary hover:underline"
                >
                  {primaryLabel} DNA page →
                </button>
              </p>
            )}
          </div>

          {/* Picker panel */}
          <AnimatePresence>
            {pickerOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-border bg-card/50 p-4 space-y-4">
                  {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length > 0).map((cat) => (
                    <div key={cat} className="space-y-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
                        {CATEGORY_LABELS[cat] || cat}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {grouped[cat].map((d) => {
                          const isActive = activeDescriptors.includes(d.slug);
                          return (
                            <button
                              key={d.slug}
                              onClick={() => isActive ? removeDescriptor(d.slug) : addDescriptor(d.slug)}
                              disabled={isActive}
                              className={`px-2.5 py-1 rounded-full border text-[10px] font-medium transition-all ${
                                isActive
                                  ? "opacity-40 cursor-default border-primary/30 bg-primary/10 text-primary"
                                  : "border-border hover:border-primary/50 hover:text-foreground text-muted-foreground"
                              }`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results / empty state */}
          {activeDescriptors.length === 0 ? (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Pick a descriptor above, or start with one of these:
              </p>
              <div className="flex flex-wrap gap-2">
                {POPULAR_DESCRIPTORS.map((d) => (
                  <DescriptorTag
                    key={d.slug}
                    slug={d.slug}
                    label={d.label}
                    category={d.category}
                    clickable
                    size="md"
                    onClick={() => addDescriptor(d.slug)}
                  />
                ))}
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center gap-3 py-8 text-muted-foreground text-sm">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Searching...
            </div>
          ) : error ? (
            <p className="text-destructive text-sm py-8">{error}</p>
          ) : results.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <p className="text-4xl">🎵</p>
              <p className="text-foreground font-medium">No songs found with this DNA</p>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Songs are added as people discover them. Try removing a descriptor to broaden the search.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {total} song{total !== 1 ? "s" : ""} found
                {results.length < total ? `, showing top ${results.length}` : ""}
              </p>

              <div className="grid gap-3">
                {results.map((song, i) => (
                  <motion.div
                    key={song.spotify_track_id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="group flex items-start gap-4 p-4 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors cursor-pointer"
                    onClick={() =>
                      navigate(`/songs-like/${toSlug(song.song_title)}-${toSlug(song.artist_name)}`)
                    }
                  >
                    {/* Index */}
                    <span className="text-xs text-muted-foreground/40 tabular-nums pt-0.5 w-5 shrink-0 text-right">
                      {i + 1}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div>
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {song.song_title}
                        </p>
                        <p className="text-xs text-muted-foreground">{song.artist_name}</p>
                      </div>

                      {/* Matched descriptor tags */}
                      <div className="flex flex-wrap gap-1">
                        {song.matched_slugs.map((slug) => {
                          const meta = registry.find((d) => d.slug === slug);
                          return (
                            <DescriptorTag
                              key={slug}
                              slug={slug}
                              label={meta?.label}
                              category={meta?.category}
                              size="sm"
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Match % */}
                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-primary tabular-nums">
                        {Math.round(song.match_ratio * 100)}%
                      </span>
                      <p className="text-[10px] text-muted-foreground/50">match</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
