import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl animate-pulse-glow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/5 blur-3xl animate-pulse-glow pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-xl text-center space-y-8"
      >
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
              placeholder={
                mode === "song"
                  ? "Enter a song name..."
                  : mode === "artist"
                  ? "Enter an artist name..."
                  : "Describe a vibe..."
              }
              className="w-full h-12 pl-12 pr-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            className="h-12 px-6 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 glow-primary transition-all"
          >
            Search
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
