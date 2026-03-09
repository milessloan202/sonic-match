import { motion } from "framer-motion";
import ResultCard from "./ResultCard";
import type { SongMeta, SongMetaMap } from "@/hooks/useSpotifyImages";
import { songKey } from "@/hooks/useSpotifyImages";

interface ResultSectionProps {
  title: string;
  items: { title: string; subtitle?: string; tag?: string; spotify_id?: string | null }[];
  linkPrefix?: string;
  imageType?: "song" | "artist";
  images?: Record<string, string | null>;
  songMetaMap?: SongMetaMap;
  variant?: "default" | "explanation";
  metaLoaded?: boolean;
}

const ResultSection = ({ title, items, linkPrefix, imageType, images, songMetaMap, variant = "default", metaLoaded }: ResultSectionProps) => {
  return (
    <section className="space-y-4">
      <motion.h2
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-xl font-semibold text-foreground"
      >
        {title}
      </motion.h2>
      <div className={variant === "explanation" ? "space-y-2" : "grid gap-3 sm:grid-cols-2"}>
        {items.map((item, i) => {
          const key = songKey(item.title, item.subtitle);
          return (
            <ResultCard
              key={key + i}
              {...item}
              index={i}
              linkPrefix={linkPrefix}
              variant={variant}
              imageType={variant === "explanation" ? undefined : imageType}
              imageUrl={images?.[key] ?? undefined}
              songMeta={songMetaMap?.[key]}
            />
          );
        })}
      </div>
    </section>
  );
};

export default ResultSection;
