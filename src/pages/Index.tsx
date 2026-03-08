import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ArrowRight } from "lucide-react";
import SegmentedSelector, { type SearchMode } from "../components/SegmentedSelector";
import SearchChip from "../components/SearchChip";

const exampleChips: Record<SearchMode, string[]> = {
  song: ["Redbone – Childish Gambino", "Ivy – Frank Ocean", "Electric Feel – MGMT"],
  artist: ["Tame Impala", "SZA", "Bon Iver"],
  vibe: ["Late night drive", "Golden hour chill", "Rainy lo-fi"],
};

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const routePrefix: Record<SearchMode, string> = {
  song: "/songs-like",
  artist: "/artists-like",
  vibe: "/vibes",
};

const Index = () => {
  const [mode, setMode] = useState<SearchMode>("song");
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = () => {
    if (!query.trim()) return;
    navigate(`${routePrefix[mode]}/${slugify(query)}`);
  };

  const handleChip = (chip: string) => {
    setQuery(chip);
    navigate(`${routePrefix[mode]}/${slugify(chip)}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md text-center space-y-8"
      >
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            SoundAlike
          </h1>
          <p className="text-sm text-muted-foreground">
            Find songs, artists, and moods with the same sonic DNA
          </p>
        </div>

        <SegmentedSelector value={mode} onChange={setMode} />

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={
                mode === "song" ? "Enter a song..." : mode === "artist" ? "Enter an artist..." : "Describe a vibe..."
              }
              className="w-full h-10 pl-10 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/20 transition-colors"
            />
          </div>
          <button
            onClick={handleSearch}
            className="h-10 w-10 shrink-0 rounded-lg bg-foreground text-background flex items-center justify-center hover:opacity-80 transition-opacity"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {exampleChips[mode].map((chip) => (
            <SearchChip key={chip} label={chip} onClick={() => handleChip(chip)} />
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Index;
