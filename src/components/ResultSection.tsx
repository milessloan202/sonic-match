import { motion } from "framer-motion";
import ResultCard from "./ResultCard";

interface ResultSectionProps {
  title: string;
  items: { title: string; subtitle?: string; tag?: string }[];
  linkPrefix?: string;
  imageType?: "song" | "artist";
  images?: Record<string, string | null>;
}

const ResultSection = ({ title, items, linkPrefix, imageType, images }: ResultSectionProps) => {
  return (
    <section className="space-y-4">
      <motion.h2
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-xl font-semibold text-foreground"
      >
        {title}
      </motion.h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item, i) => (
          <ResultCard
            key={item.title}
            {...item}
            index={i}
            linkPrefix={linkPrefix}
            imageType={imageType}
            imageUrl={images?.[item.title] ?? undefined}
          />
        ))}
      </div>
    </section>
  );
};

export default ResultSection;
