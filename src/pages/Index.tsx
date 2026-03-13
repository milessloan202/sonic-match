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
import {
  STARTER_MIXES,
  DESCRIPTOR_CATEGORY_MAP,
  CATEGORY_GLOW_RGB,
  type DescriptorChip,
  getRotatingHomepageDescriptors,
  getRandomMix,
} from "../lib/exploreSounds";


const slugify = (text: string) =>
text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const routePrefixes: Record<SearchMode, string> = {
  song: "/songs-like",
  artist: "/artists-like",
  producer: "/producers-like",
  vibe: "/vibes"
};

const DEEP_CUT_KEY = "deep-cut-mode";

const Index = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<SearchMode>("song");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deepCut, setDeepCut] = useState(() => localStorage.getItem(DEEP_CUT_KEY) === "true");

  // Initialised once per mount — gives a fresh random set on each page load.
  const [descriptorChips] = useState<DescriptorChip[]>(() => getRotatingHomepageDescriptors());
  const [hoveredChip, setHoveredChip] = useState<string | null>(null);
  const [hoveredMix, setHoveredMix] = useState<string | null>(null);
  const [randomMixPreview, setRandomMixPreview] = useState<string[] | null>(null);

  const handleRandomMix = () => {
    const mix = getRandomMix();
    setRandomMixPreview(mix);
    setTimeout(() => {
      navigate(`/search?descriptors=${mix.join(",")}&mode=descriptor`);
    }, 600);
  };

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
          {/* Explore sounds link */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="relative z-10 w-full max-w-xl mt-8"
          >
            <Link
              to="/explore"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Explore sounds →
            </Link>
          </motion.div>

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
              {STARTER_MIXES.map(mix => {
                const isHovered = hoveredMix === mix.name;
                const firstCategory = DESCRIPTOR_CATEGORY_MAP[mix.descriptors[0]] ?? "groove_character";
                const glowRgb = CATEGORY_GLOW_RGB[firstCategory] ?? "99, 102, 241";
                return (
                  <Link
                    key={mix.name}
                    to={`/search?descriptors=${mix.descriptors.join(",")}&mode=descriptor`}
                    className="rounded-xl border p-3.5 transition-all duration-200 space-y-2"
                    style={{
                      borderColor: isHovered ? `rgba(${glowRgb}, 0.55)` : "rgba(255,255,255,0.1)",
                      backgroundColor: isHovered ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                      transform: isHovered ? "translateY(-3px)" : "translateY(0)",
                      boxShadow: isHovered ? `0 0 12px rgba(${glowRgb}, 0.35)` : "none",
                    }}
                    onMouseEnter={() => setHoveredMix(mix.name)}
                    onMouseLeave={() => setHoveredMix(null)}
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {mix.name}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {mix.descriptors.map(d => {
                        const cat = DESCRIPTOR_CATEGORY_MAP[d];
                        const chipClass = isHovered && cat
                          ? (CATEGORY_HOVER_COLORS[cat] ?? "bg-white/20 text-white border-white/40")
                          : "text-muted-foreground/60 bg-secondary/50 border-transparent";
                        return (
                          <span
                            key={d}
                            className={`text-[10px] rounded border px-1.5 py-0.5 tracking-wide transition-all duration-200 ${chipClass}`}
                          >
                            {d.replace(/-/g, "\u00a0")}
                          </span>
                        );
                      })}
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>

          {/* Album Carousel at the bottom */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="relative z-10 w-full mt-12">
            <div className="mb-4 pl-1 space-y-1">
              <button
                onClick={handleRandomMix}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
              >
                📀 Pull a sound from the shelf.
              </button>
              <p className="text-xs text-muted-foreground/50">Start with a random Sonic DNA mix.</p>
              {randomMixPreview && (
                <span className="text-xs text-muted-foreground/60 italic transition-opacity">
                  {randomMixPreview.join(" • ")}
                </span>
              )}
            </div>
            <AlbumCarousel />
          </motion.div>
        </>
      )}
    </div>);

};

export default Index;
