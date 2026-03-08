import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LOADING_MESSAGES = [
  "Digging through the crates… hold please.",
  "Flipping through records…",
  "Looking for the perfect next track…",
  "Checking the back room for something good…",
  "Pulling a few records off the shelf…",
  "Finding something that fits the vibe…",
  "Cueing something you might like…",
  "Lining up the next record…",
  "Searching for the right groove…",
  "Dusting off a few hidden gems…",
  "Looking for a deep cut…",
  "Spinning up a few possibilities…",
  "Seeing what pairs well with this…",
  "Finding the next track in the chain…",
  "Putting together something interesting…",
];

const RotatingMessage = () => {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * LOADING_MESSAGES.length));

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={index}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        className="text-muted-foreground text-sm"
      >
        🎵 {LOADING_MESSAGES[index]}
      </motion.p>
    </AnimatePresence>
  );
};

const PageSkeleton = ({ generating }: { generating?: boolean }) => (
  <div className="min-h-screen px-4 py-12 max-w-3xl mx-auto space-y-10">
    <div className="space-y-4">
      <div className="h-4 w-16 rounded bg-secondary animate-pulse" />
      <div className="h-10 w-3/4 rounded bg-secondary animate-pulse" />
      <div className="h-5 w-1/2 rounded bg-secondary animate-pulse" />
    </div>
    {generating && <RotatingMessage />}
    {[1, 2, 3].map((i) => (
      <div key={i} className="space-y-3">
        <div className="h-6 w-48 rounded bg-secondary animate-pulse" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 rounded-lg bg-secondary animate-pulse" />
          <div className="h-24 rounded-lg bg-secondary animate-pulse" />
        </div>
      </div>
    ))}
  </div>
);

export default PageSkeleton;
