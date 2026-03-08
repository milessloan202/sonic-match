import { motion } from "framer-motion";

interface ResultCardProps {
  title: string;
  subtitle?: string;
  tag?: string;
  index?: number;
}

const ResultCard = ({ title, subtitle, tag, index = 0 }: ResultCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className="group flex items-start justify-between gap-3 p-4 rounded-lg border border-border/50 hover:border-border hover:bg-card/50 transition-colors cursor-pointer"
    >
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{subtitle}</p>
        )}
      </div>
      {tag && (
        <span className="shrink-0 text-[11px] font-mono text-muted-foreground">{tag}</span>
      )}
    </motion.div>
  );
};

export default ResultCard;
