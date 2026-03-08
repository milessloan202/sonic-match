import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Disc3, User } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ResultCardProps {
  title: string;
  subtitle?: string;
  tag?: string;
  index?: number;
  linkPrefix?: string;
  imageUrl?: string | null;
  imageType?: "song" | "artist";
}

const toSlug = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function parseSubtitle(subtitle?: string) {
  if (!subtitle) return { artist: "", year: "" };
  const match = subtitle.match(/^(.+?)\s*\((\d{4})\)\s*$/);
  if (match) return { artist: match[1], year: match[2] };
  return { artist: subtitle, year: "" };
}

const Thumbnail = ({
  url,
  type,
  alt,
}: {
  url?: string | null;
  type?: "song" | "artist";
  alt: string;
}) => {
  const isArtist = type === "artist";
  const size = "w-12 h-12";
  const shape = isArtist ? "rounded-full" : "rounded-md";

  if (url) {
    return (
      <img
        src={url}
        alt={alt}
        loading="lazy"
        className={`${size} ${shape} object-cover shrink-0 bg-muted`}
      />
    );
  }

  // Fallback
  return (
    <div
      className={`${size} ${shape} shrink-0 bg-muted flex items-center justify-center text-muted-foreground`}
    >
      {isArtist ? <User className="w-5 h-5" /> : <Disc3 className="w-5 h-5" />}
    </div>
  );
};

const ResultCard = ({
  title,
  subtitle,
  tag,
  index = 0,
  linkPrefix,
  imageUrl,
  imageType,
}: ResultCardProps) => {
  const { artist, year } = parseSubtitle(subtitle);
  const showImage = imageType === "song" || imageType === "artist";

  const cardContent = (
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
      <div className="flex items-center gap-3">
        {showImage && <Thumbnail url={imageUrl} type={imageType} alt={title} />}
        <div className="min-w-0 flex-1">
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
        </div>
      </div>
    </motion.div>
  );

  // Wrap with tooltip if we have metadata
  const tooltipText =
    imageType === "song" && artist
      ? `${title} — ${artist}${year ? `\n${year}` : ""}`
      : imageType === "artist"
      ? `${title}${subtitle ? `\n${subtitle}` : ""}`
      : null;

  const wrappedContent = tooltipText ? (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs whitespace-pre-line text-xs"
        >
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    cardContent
  );

  if (linkPrefix) {
    return <Link to={`${linkPrefix}/${toSlug(title)}`}>{wrappedContent}</Link>;
  }

  return wrappedContent;
};

export default ResultCard;
