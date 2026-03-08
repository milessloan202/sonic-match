import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Loader2, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import SegmentedSelector, { type SearchMode } from "../components/SegmentedSelector";
import SearchChip from "../components/SearchChip";
import SEOHead from "../components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { clearDiscoveryPath } from "../hooks/useDiscoveryPath";

const exampleChips: Record<SearchMode, string[]> = {
  song: ["Redbone – Childish Gambino", "Ivy – Frank Ocean", "Electric Feel – MGMT"],
  artist: ["Tame Impala", "SZA", "Bon Iver"],
  producer: ["Pharrell", "Madlib", "Brian Eno"],
  vibe: ["Late night drive", "Golden hour chill", "Rainy lo-fi"],
};

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const routePrefixes: Record<SearchMode, string> = {
  song: "/songs-like",
  artist: "/artists-like",
  producer: "/producers-like",
  vibe: "/vibes",
};

const DEEP_CUT_KEY = "deep-cut-mode";

const Index = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<SearchMode>("song");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deepCut, setDeepCut] = useState(() => localStorage.getItem(DEEP_CUT_KEY) === "true");

  const toggleDeepCut = (checked: boolean) => {
    setDeepCut(checked);
    localStorage.setItem(DEEP_CUT_KEY, String(checked));
  };

  const performSearch = async (q: string, searchMode: SearchMode) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    clearDiscoveryPath();

    const slug = deepCut ? `${slugify(trimmed)}-deep` : slugify(trimmed);
    setLoading(true);
    setError(null);

    try {
      const { data: page } = await supabase
        .from("seo_pages")
        .select("id")
        .eq("slug", slug)
        .eq("page_type", searchMode)
        .maybeSingle();

      if (page) {
        navigate(`${routePrefixes[searchMode]}/${slug}`);
        return;
      }

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

  const handleChip = (chip: string) => {
    setQuery(chip);
    performSearch(chip, mode);
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-16 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl animate-pulse-glow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/5 blur-3xl animate-pulse-glow pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-xl text-center space-y-8"
      >
        <SEOHead
          title="SOUNDDNA – Discover Music With the Same Sonic DNA"
          description="Find songs, artists, and moods with the same sonic DNA. AI-powered music discovery engine."
          path="/"
        />

        <div className="space-y-3">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
            <span className="text-gradient">SOUNDDNA</span>
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
                  : mode === "producer"
                  ? "Enter a producer name..."
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

        {/* Deep Cut Mode toggle */}
        <div className="flex items-center justify-center gap-3">
          <Switch
            id="deep-cut"
            checked={deepCut}
            onCheckedChange={toggleDeepCut}
          />
          <label htmlFor="deep-cut" className="cursor-pointer text-left">
            <span className="text-sm font-medium text-foreground">Deep Cut Mode</span>
            <span className="block text-xs text-muted-foreground">Find hidden gems and lesser-known tracks</span>
          </label>
        </div>

        {!loading && !error && (
          <div className="flex flex-wrap justify-center gap-2">
            {exampleChips[mode].map((chip) => (
              <SearchChip key={chip} label={chip} onClick={() => handleChip(chip)} />
            ))}
          </div>
        )}
      </motion.div>

      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative z-10 w-full max-w-xl mt-10 text-center space-y-3"
        >
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">
            {deepCut ? "Digging for hidden gems..." : "Generating recommendations..."}
          </p>
        </motion.div>
      )}

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
    </div>
  );
};

export default Index;
