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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="group surface-glass rounded-lg p-5 hover:border-primary/30 hover:glow-primary transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-foreground truncate">{title}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{subtitle}</p>
          )}
        </div>
        {tag && (
          <span className="shrink-0 text-xs font-mono px-2 py-1 rounded-md bg-primary/10 text-primary">
            {tag}
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default ResultCard;
