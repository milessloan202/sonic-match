import { motion } from "framer-motion";

type SearchMode = "song" | "artist" | "vibe";

interface SegmentedSelectorProps {
  value: SearchMode;
  onChange: (value: SearchMode) => void;
}

const options: { value: SearchMode; label: string }[] = [
  { value: "song", label: "Song" },
  { value: "artist", label: "Artist" },
  { value: "vibe", label: "Vibe" },
];

const SegmentedSelector = ({ value, onChange }: SegmentedSelectorProps) => {
  return (
    <div className="inline-flex gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className="relative px-5 py-1.5 text-sm rounded-full transition-colors"
        >
          {value === option.value && (
            <motion.div
              layoutId="segment-active"
              className="absolute inset-0 rounded-full bg-secondary border border-border"
              transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
            />
          )}
          <span className={`relative z-10 ${value === option.value ? "text-foreground" : "text-muted-foreground"}`}>
            {option.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default SegmentedSelector;
export type { SearchMode };
