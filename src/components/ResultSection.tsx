import { motion } from "framer-motion";
import ResultCard from "./ResultCard";
import type { SongMetaMap } from "@/hooks/useSpotifyImages";

interface ResultSectionProps {
  title: string;
  items: { title: string; subtitle?: string; tag?: string }[];
  linkPrefix?: string;
  imageType?: "song" | "artist";
  images?: Record<string, string | null>;
  songMetaMap?: SongMetaMap;
  variant?: "default" | "explanation" | "card";
}

const gridClass: Record<string, string> = {
  default: "grid gap-3 sm:grid-cols-2",
  card: "grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  explanation: "space-y-2",
};

const ResultSection = ({ title, items, linkPrefix, imageType, images, songMetaMap, variant = "default" }: ResultSectionProps) => {
  return (
    <section className="space-y-4">
      <motion.h2
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-xl font-semibold text-foreground"
      >
        {title}
      </motion.h2>
      <div className={gridClass[variant] || gridClass.default}>
        {items.map((item, i) => (
          <ResultCard
            key={item.title + i}
            {...item}
            index={i}
            linkPrefix={linkPrefix}
            variant={variant === "explanation" ? "explanation" : variant}
            imageType={variant === "explanation" ? undefined : imageType}
            imageUrl={images?.[item.title] ?? undefined}
            songMeta={songMetaMap?.[item.title]}
          />
        ))}
      </div>
    </section>
  );
};

export default ResultSection;
