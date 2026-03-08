import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Disc3, User, Play, Pause, ExternalLink } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAudio } from "@/contexts/AudioContext";
import type { SongMeta } from "@/hooks/useSpotifyImages";

interface ResultCardProps {
  title: string;
  subtitle?: string;
  tag?: string;
  index?: number;
  linkPrefix?: string;
  variant?: "default" | "explanation";
  imageUrl?: string | null;
  imageType?: "song" | "artist";
  songMeta?: SongMeta;
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

  return (
    <div
      className={`${size} ${shape} shrink-0 bg-muted flex items-center justify-center text-muted-foreground`}
    >
      {isArtist ? <User className="w-5 h-5" /> : <Disc3 className="w-5 h-5" />}
    </div>
  );
};

const PlayButton = ({ title, subtitle, meta }: { title: string; subtitle?: string; meta?: SongMeta }) => {
  const { currentTrack, isPlaying, progress, toggle } = useAudio();
  const trackId = title;
  const isActive = currentTrack === trackId && isPlaying;
  const showProgress = currentTrack === trackId;

  const artist = subtitle ? subtitle.replace(/\s*\(\d{4}\)\s*$/, "").trim() : "";
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${artist}`.trim())}`;

  if (!meta?.preview_url) {
    if (meta?.spotify_url) {
      return (
        <a
          href={meta.spotify_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          <span>Open in Spotify</span>
        </a>
      );
    }
    return (
      <a
        href={youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        <span>Watch on YouTube</span>
      </a>
    );
  }

  return (
    <div className="shrink-0 flex flex-col items-center gap-0.5">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle(trackId, meta.preview_url!);
        }}
        className="relative w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors group"
        aria-label={isActive ? "Pause preview" : "Play preview"}
      >
        {isActive ? (
          <Pause className="w-3.5 h-3.5 text-primary" />
        ) : (
          <Play className="w-3.5 h-3.5 text-primary ml-0.5" />
        )}
        {/* Circular progress ring */}
        {showProgress && (
          <svg className="absolute inset-0 w-8 h-8 -rotate-90" viewBox="0 0 32 32">
            <circle
              cx="16"
              cy="16"
              r="14"
              fill="none"
              stroke="hsl(var(--primary) / 0.2)"
              strokeWidth="2"
            />
            <circle
              cx="16"
              cy="16"
              r="14"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              strokeDasharray={`${2 * Math.PI * 14}`}
              strokeDashoffset={`${2 * Math.PI * 14 * (1 - progress / 100)}`}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-100"
            />
          </svg>
        )}
      </button>
      {meta.spotify_url && (
        <a
          href={meta.spotify_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[9px] text-muted-foreground/60 hover:text-primary transition-colors"
        >
          Spotify
        </a>
      )}
    </div>
  );
};

const ResultCard = ({
  title,
  subtitle,
  tag,
  index = 0,
  linkPrefix,
  variant = "default",
  imageUrl,
  imageType,
  songMeta,
}: ResultCardProps) => {
  const { artist, year } = parseSubtitle(subtitle);
  const showImage = imageType === "song" || imageType === "artist";
  const showPlay = imageType === "song";

  if (variant === "explanation") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
      >
        <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
      </motion.div>
    );
  }

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
            <div className="flex items-center gap-2 shrink-0">
              {tag && (
                <span className="text-xs font-mono px-2 py-1 rounded-md bg-primary/10 text-primary">
                  {tag}
                </span>
              )}
              {showPlay && <PlayButton title={title} meta={songMeta} />}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

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
