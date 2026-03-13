import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Loader2, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import SegmentedSelector, { type SearchMode } from "../components/SegmentedSelector";
import AlbumCarousel from "../components/AlbumCarousel";
import SEOHead from "../components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { clearDiscoveryPath } from "../hooks/useDiscoveryPath";
import { CATEGORY_HOVER_COLORS } from "../components/DescriptorTag";


const slugify = (text: string) =>
text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const routePrefixes: Record<SearchMode, string> = {
  song: "/songs-like",
  artist: "/artists-like",
  producer: "/producers-like",
  vibe: "/vibes"
};

const DEEP_CUT_KEY = "deep-cut-mode";

// ── Homepage descriptor exploration ───────────────────────────────────────────
// Descriptors are grouped by category so the random picker can guarantee
// 2 emotional / 2 texture / 2 groove on every page load.

const HOMEPAGE_DESCRIPTOR_POOL = {
  emotional: ["nocturnal", "dreamy", "melancholic", "euphoric", "cold", "playful"],
  texture:   ["metallic", "hazy", "lush", "widescreen", "airless", "glassy"],
  groove:    ["stomping", "gliding", "punchy", "driving", "swaggering", "pulsing"],
} as const;

const STARTER_MIXES: { label: string; descriptors: string[] }[] = [
  { label: "Night Drive",   descriptors: ["nocturnal", "glossy", "driving"] },
  { label: "Cold Pressure", descriptors: ["metallic", "airless", "stomping"] },
  { label: "Velvet Fog",    descriptors: ["hazy", "lush", "late-night-walk"] },
  { label: "Victory Lap",   descriptors: ["swaggering", "punchy", "widescreen"] },
];

function pickRandom<T>(arr: readonly T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

type DescriptorChip = { slug: string; cssCategory: string };

function buildDescriptorChips(): DescriptorChip[] {
  return [
    ...pickRandom(HOMEPAGE_DESCRIPTOR_POOL.emotional, 2).map(slug => ({ slug, cssCategory: "emotional_tone" })),
    ...pickRandom(HOMEPAGE_DESCRIPTOR_POOL.texture, 2).map(slug => ({ slug, cssCategory: "texture" })),
    ...pickRandom(HOMEPAGE_DESCRIPTOR_POOL.groove, 2).map(slug => ({ slug, cssCategory: "groove_character" })),
  ];
}

// ──────────────────────────────────────────────────────────────────────────────

const Index = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<SearchMode>("song");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deepCut, setDeepCut] = useState(() => localStorage.getItem(DEEP_CUT_KEY) === "true");

  // Initialised once per mount — gives a fresh random set on each page load.
  const [descriptorChips] = useState<DescriptorChip[]>(() => buildDescriptorChips());
  const [hoveredChip, setHoveredChip] = useState<string | null>(null);

  const toggleDeepCut = (checked: boolean) => {
    setDeepCut(checked);
    localStorage.setItem(DEEP_CUT_KEY, String(checked));
  };

  const performSearch = async (q: string, searchMode: SearchMode) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    clearDiscoveryPath();

    setLoading(true);
    setError(null);

    try {
      let slug = deepCut ? `${slugify(trimmed)}-deep` : slugify(trimmed);

      // For song searches, resolve via Spotify to get canonical slug
      if (searchMode === "song") {
        try {
          const { data: resolveData, error: resolveError } = await supabase.functions.invoke(
            "resolve-song",
            { body: { query: trimmed } }
          );

          if (!resolveError && resolveData?.slug) {
            // Use the resolved slug with artist name
            slug = deepCut ? `${resolveData.slug}-deep` : resolveData.slug;
          }
        } catch (e) {
          console.warn("Song resolution failed, using basic slug:", e);
          // Continue with basic slug if resolution fails
        }
      }

      // Check if page already exists
      const { data: page } = await supabase.
      from("seo_pages").
      select("id").
      eq("slug", slug).
      eq("page_type", searchMode).
      maybeSingle();

      if (page) {
        navigate(`${routePrefixes[searchMode]}/${slug}`);
        return;
      }

      // Generate new page
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "generate-seo-page",
        { body: { slug, page_type: searchMode, deep_cut_mode: deepCut } }
      );

      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      navigate(`${routePrefixes[searchMode]}/${slug}`);
    } catch (e: any) {
      console.error("Search error:", e);
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => performSearch(query, mode);


  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-16 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl animate-pulse-glow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/5 blur-3xl animate-pulse-glow pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-xl text-center space-y-8">

        <SEOHead
          title="SOUNDDNA – Discover Music With the Same Sonic DNA"
          description="Find songs, artists, and moods with the same sonic DNA. AI-powered music discovery engine."
          path="/" />


        <div className="space-y-3">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
            <span className="text-gradient">SOUND.DNA</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Find songs, artists, and moods with the same sonic DNA
          </p>
        </div>

        <SegmentedSelector value={mode} onChange={setMode} />

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              disabled={loading}
              placeholder={
              mode === "song" ?
              "Enter a song name..." :
              mode === "artist" ?
              "Enter an artist name..." :
              mode === "producer" ?
              "Enter a producer name..." :
              "Describe a vibe..."
              }
              className="w-full h-12 pl-12 pr-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all disabled:opacity-50" />

          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="h-12 px-6 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 glow-primary transition-all disabled:opacity-50 flex items-center gap-2">

            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Deep Cut Mode toggle */}
        <div className="flex items-center justify-center gap-3">
          <Switch
            id="deep-cut"
            checked={deepCut}
            onCheckedChange={toggleDeepCut} />

          <label htmlFor="deep-cut" className="cursor-pointer text-left">
            <span className="text-sm font-medium text-foreground">Deep Cut Mode</span>
            <span className="block text-xs text-muted-foreground">Find hidden gems and lesser-known tracks</span>
          </label>
        </div>
      </motion.div>

      {loading &&
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative z-10 w-full max-w-xl mt-10 text-center space-y-3">

          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">
            {deepCut ? "Digging for hidden gems..." : "Generating recommendations..."}
          </p>
        </motion.div>
      }

      {error &&
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-xl mt-10 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">

          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Something went wrong</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </motion.div>
      }

      {!loading && !error && (
        <>
          {/* Section 1 — Explore a Sound */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative z-10 w-full max-w-xl mt-10 space-y-3 text-left"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 pl-0.5">
              Explore a Sound
            </p>
            <div className="flex flex-wrap gap-2">
              {descriptorChips.map(({ slug, cssCategory }) => {
                const isHovered = hoveredChip === slug;
                const colorClass = isHovered
                  ? (CATEGORY_HOVER_COLORS[cssCategory] ?? "bg-white/20 text-white border-white/40")
                  : "border-border/60 bg-secondary/40 text-muted-foreground";
                return (
                  <Link
                    key={slug}
                    to={`/search?descriptors=${slug}&mode=descriptor`}
                    className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 ${colorClass}`}
                    onMouseEnter={() => setHoveredChip(slug)}
                    onMouseLeave={() => setHoveredChip(null)}
                  >
                    {slug.replace(/-/g, "\u00a0")}
                  </Link>
                );
              })}
            </div>
          </motion.div>

          {/* Section 2 — Starter Mixes */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="relative z-10 w-full max-w-xl mt-8 space-y-3 text-left"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 pl-0.5">
              Starter Mixes
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {STARTER_MIXES.map(mix => (
                <Link
                  key={mix.label}
                  to={`/search?descriptors=${mix.descriptors.join(",")}&mode=descriptor`}
                  className="rounded-xl border border-border/60 bg-card/40 p-3.5 hover:border-primary/40 hover:bg-card/70 transition-all space-y-2 group"
                >
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {mix.label}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {mix.descriptors.map(d => (
                      <span
                        key={d}
                        className="text-[10px] text-muted-foreground/60 bg-secondary/50 rounded px-1.5 py-0.5 tracking-wide"
                      >
                        {d.replace(/-/g, "\u00a0")}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Album Carousel at the bottom */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="relative z-10 w-full mt-12">
            <p className="text-sm text-muted-foreground mb-4 pl-1">📀 Pull one from the shelf.</p>
            <AlbumCarousel />
          </motion.div>
        </>
      )}
    </div>);

};

export default Index;
