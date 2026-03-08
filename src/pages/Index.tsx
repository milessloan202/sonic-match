import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, AlertCircle } from "lucide-react";
import SegmentedSelector, { type SearchMode } from "../components/SegmentedSelector";
import SearchChip from "../components/SearchChip";
import ResultSection from "../components/ResultSection";
import RelatedPages from "../components/RelatedPages";
import SEOHead from "../components/SEOHead";
import { supabase } from "@/integrations/supabase/client";

const exampleChips: Record<SearchMode, string[]> = {
  song: ["Redbone – Childish Gambino", "Ivy – Frank Ocean", "Electric Feel – MGMT"],
  artist: ["Tame Impala", "SZA", "Bon Iver"],
  vibe: ["Late night drive", "Golden hour chill", "Rainy lo-fi"],
};

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

interface SeoResult {
  heading: string;
  summary: string | null;
  closest_matches: { title: string; subtitle?: string; tag?: string }[];
  same_energy: { title: string; subtitle?: string }[];
  related_artists: { title: string; subtitle?: string }[];
  why_these_work: { title: string; subtitle?: string }[];
  related_songs: { name: string; slug: string }[];
  related_vibes: { name: string; slug: string }[];
  related_artist_links: { name: string; slug: string }[];
}

const Index = () => {
  const [mode, setMode] = useState<SearchMode>("song");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeoResult | null>(null);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;

    const slug = slugify(q);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Check DB first
      const { data: page } = await supabase
        .from("seo_pages")
        .select("*")
        .eq("slug", slug)
        .eq("page_type", mode)
        .maybeSingle();

      if (page) {
        setResult({
          heading: page.heading,
          summary: page.summary,
          closest_matches: (page.closest_matches as any[]) || [],
          same_energy: (page.same_energy as any[]) || [],
          related_artists: (page.related_artists as any[]) || [],
          why_these_work: (page.why_these_work as any[]) || [],
          related_songs: (page.related_songs as any[]) || [],
          related_vibes: (page.related_vibes as any[]) || [],
          related_artist_links: (page.related_artist_links as any[]) || [],
        });
        setLoading(false);
        return;
      }

      // Generate via edge function
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "generate-seo-page",
        { body: { slug, page_type: mode } }
      );

      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      // Re-fetch the newly created page
      const { data: newPage } = await supabase
        .from("seo_pages")
        .select("*")
        .eq("slug", slug)
        .eq("page_type", mode)
        .maybeSingle();

      if (newPage) {
        setResult({
          heading: newPage.heading,
          summary: newPage.summary,
          closest_matches: (newPage.closest_matches as any[]) || [],
          same_energy: (newPage.same_energy as any[]) || [],
          related_artists: (newPage.related_artists as any[]) || [],
          why_these_work: (newPage.why_these_work as any[]) || [],
          related_songs: (newPage.related_songs as any[]) || [],
          related_vibes: (newPage.related_vibes as any[]) || [],
          related_artist_links: (newPage.related_artist_links as any[]) || [],
        });
      } else {
        throw new Error("Page was created but could not be loaded.");
      }
    } catch (e: any) {
      console.error("Search error:", e);
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChip = (chip: string) => {
    setQuery(chip);
    // Trigger search after state update
    setTimeout(() => {
      const slug = slugify(chip);
      setLoading(true);
      setError(null);
      setResult(null);

      (async () => {
        try {
          const { data: page } = await supabase
            .from("seo_pages")
            .select("*")
            .eq("slug", slug)
            .eq("page_type", mode)
            .maybeSingle();

          if (page) {
            setResult({
              heading: page.heading,
              summary: page.summary,
              closest_matches: (page.closest_matches as any[]) || [],
              same_energy: (page.same_energy as any[]) || [],
              related_artists: (page.related_artists as any[]) || [],
              why_these_work: (page.why_these_work as any[]) || [],
              related_songs: (page.related_songs as any[]) || [],
              related_vibes: (page.related_vibes as any[]) || [],
              related_artist_links: (page.related_artist_links as any[]) || [],
            });
            setLoading(false);
            return;
          }

          const { data: fnData, error: fnError } = await supabase.functions.invoke(
            "generate-seo-page",
            { body: { slug, page_type: mode } }
          );

          if (fnError) throw fnError;
          if (fnData?.error) throw new Error(fnData.error);

          const { data: newPage } = await supabase
            .from("seo_pages")
            .select("*")
            .eq("slug", slug)
            .eq("page_type", mode)
            .maybeSingle();

          if (newPage) {
            setResult({
              heading: newPage.heading,
              summary: newPage.summary,
              closest_matches: (newPage.closest_matches as any[]) || [],
              same_energy: (newPage.same_energy as any[]) || [],
              related_artists: (newPage.related_artists as any[]) || [],
              why_these_work: (newPage.why_these_work as any[]) || [],
              related_songs: (newPage.related_songs as any[]) || [],
              related_vibes: (newPage.related_vibes as any[]) || [],
              related_artist_links: (newPage.related_artist_links as any[]) || [],
            });
          } else {
            throw new Error("Page was created but could not be loaded.");
          }
        } catch (e: any) {
          setError(e?.message || "Something went wrong. Please try again.");
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-16 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl animate-pulse-glow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/5 blur-3xl animate-pulse-glow pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-xl text-center space-y-8"
      >
        <SEOHead
          title="SoundAlike – Discover Music With the Same Sonic DNA"
          description="Find songs, artists, and moods that sound alike. AI-powered music discovery engine."
          path="/"
        />

        <div className="space-y-3">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
            <span className="text-gradient">SoundAlike</span>
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
                mode === "song"
                  ? "Enter a song name..."
                  : mode === "artist"
                  ? "Enter an artist name..."
                  : "Describe a vibe..."
              }
              className="w-full h-12 pl-12 pr-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="h-12 px-6 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 glow-primary transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        {!result && !loading && !error && (
          <div className="flex flex-wrap justify-center gap-2">
            {exampleChips[mode].map((chip) => (
              <SearchChip key={chip} label={chip} onClick={() => handleChip(chip)} />
            ))}
          </div>
        )}
      </motion.div>

      {/* Loading state */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative z-10 w-full max-w-xl mt-10 text-center space-y-3"
        >
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Generating recommendations with Claude...</p>
        </motion.div>
      )}

      {/* Error state */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-xl mt-10 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Something went wrong</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Results */}
      {result && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-3xl mt-10 space-y-10 text-left"
        >
          <div className="space-y-2">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{result.heading}</h2>
            {result.summary && <p className="text-muted-foreground">{result.summary}</p>}
          </div>

          {result.closest_matches.length > 0 && (
            <ResultSection title="🎯 Closest Matches" items={result.closest_matches} />
          )}
          {result.same_energy.length > 0 && (
            <ResultSection title="⚡ Same Energy" items={result.same_energy} />
          )}
          {result.related_artists.length > 0 && (
            <ResultSection title="🎤 Related Artists" items={result.related_artists} />
          )}
          {result.why_these_work.length > 0 && (
            <ResultSection title="💡 Why These Work" items={result.why_these_work} />
          )}

          <RelatedPages
            relatedSongs={result.related_songs}
            relatedArtists={result.related_artist_links}
            relatedVibes={result.related_vibes}
          />
        </motion.div>
      )}
    </div>
  );
};

export default Index;
