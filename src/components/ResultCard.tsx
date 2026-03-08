import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface ResultCardProps {
  title: string;
  subtitle?: string;
  tag?: string;
  index?: number;
  linkPrefix?: string;
}

const toSlug = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const ResultCard = ({ title, subtitle, tag, index = 0, linkPrefix }: ResultCardProps) => {
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={`group surface-glass rounded-lg p-5 transition-all duration-300 ${
        linkPrefix
          ? "hover:border-primary/30 hover:glow-primary hover:scale-[1.02] cursor-pointer"
          : "hover:border-primary/30 hover:glow-primary cursor-default"
      }`}
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

  if (linkPrefix) {
    return <Link to={`${linkPrefix}/${toSlug(title)}`}>{content}</Link>;
  }

  return content;
};

export default ResultCard;
