import { useState } from "react";
import { motion } from "framer-motion";

type SearchMode = "song" | "artist" | "producer" | "vibe";

interface SegmentedSelectorProps {
  value: SearchMode;
  onChange: (value: SearchMode) => void;
}

const options: { value: SearchMode; label: string }[] = [
  { value: "song", label: "Song" },
  { value: "artist", label: "Artist" },
  { value: "producer", label: "Producer" },
  { value: "vibe", label: "Vibe" },
];

const SegmentedSelector = ({ value, onChange }: SegmentedSelectorProps) => {
  return (
    <div className="inline-flex rounded-lg bg-secondary p-1 gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className="relative px-6 py-2 text-sm font-medium rounded-md transition-colors"
        >
          {value === option.value && (
            <motion.div
              layoutId="segment-active"
              className="absolute inset-0 rounded-md bg-primary glow-primary"
              transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            />
          )}
          <span
            className={`relative z-10 ${
              value === option.value ? "text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {option.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default SegmentedSelector;
export type { SearchMode };
