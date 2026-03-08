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
  variant?: "default" | "explanation" | "card";
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

/* ─── Shared play button ─── */

const PlayButton = ({
  title,
  subtitle,
  meta,
  size = "sm",
}: {
  title: string;
  subtitle?: string;
  meta?: SongMeta;
  size?: "sm" | "lg";
}) => {
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

  const dim = size === "lg" ? 40 : 32;
  const r = size === "lg" ? 17 : 14;
  const iconCls = size === "lg" ? "w-4.5 h-4.5" : "w-3.5 h-3.5";

  return (
    <div className="shrink-0 flex flex-col items-center gap-0.5">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle(trackId, meta.preview_url!);
        }}
        className={`relative flex items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 transition-colors`}
        style={{ width: dim, height: dim }}
        aria-label={isActive ? "Pause preview" : "Play preview"}
      >
        {isActive ? (
          <Pause className={`${iconCls} text-primary`} />
        ) : (
          <Play className={`${iconCls} text-primary ml-0.5`} />
        )}
        {showProgress && (
          <svg
            className="absolute inset-0 -rotate-90"
            style={{ width: dim, height: dim }}
            viewBox={`0 0 ${dim} ${dim}`}
          >
            <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke="hsl(var(--primary) / 0.2)" strokeWidth="2" />
            <circle
              cx={dim / 2}
              cy={dim / 2}
              r={r}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              strokeDasharray={`${2 * Math.PI * r}`}
              strokeDashoffset={`${2 * Math.PI * r * (1 - progress / 100)}`}
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

/* ─── Card variant (visual album-art cards) ─── */

const VisualCard = ({
  title,
  subtitle,
  tag,
  index = 0,
  linkPrefix,
  imageUrl,
  imageType,
  songMeta,
}: ResultCardProps) => {
  const { artist, year } = parseSubtitle(subtitle);
  const isArtist = imageType === "artist";
  const showPlay = imageType === "song";

  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      className="group relative rounded-xl border border-border bg-card overflow-hidden transition-shadow duration-300 hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
    >
      {/* Artwork */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              isArtist ? "" : ""
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            {isArtist ? <User className="w-10 h-10" /> : <Disc3 className="w-10 h-10" />}
          </div>
        )}

        {/* Play overlay — visible on hover */}
        {showPlay && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-background/40 backdrop-blur-[2px]">
            <PlayButton title={title} subtitle={subtitle} meta={songMeta} size="lg" />
          </div>
        )}

        {tag && (
          <span className="absolute top-2 right-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-background/70 text-primary backdrop-blur-sm">
            {tag}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-0.5">
        <h3 className="text-sm font-medium text-foreground truncate">{title}</h3>
        {artist && (
          <p className="text-xs text-muted-foreground truncate">{artist}</p>
        )}
        {year && (
          <p className="text-[10px] text-muted-foreground/60">{year}</p>
        )}
      </div>
    </motion.div>
  );

  if (linkPrefix) {
    return <Link to={`${linkPrefix}/${toSlug(title)}`}>{inner}</Link>;
  }
  return inner;
};

/* ─── Default list variant ─── */

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
    <div className={`${size} ${shape} shrink-0 bg-muted flex items-center justify-center text-muted-foreground`}>
      {isArtist ? <User className="w-5 h-5" /> : <Disc3 className="w-5 h-5" />}
    </div>
  );
};

/* ─── Main ResultCard ─── */

const ResultCard = (props: ResultCardProps) => {
  const {
    title,
    subtitle,
    tag,
    index = 0,
    linkPrefix,
    variant = "default",
    imageUrl,
    imageType,
    songMeta,
  } = props;

  const { artist, year } = parseSubtitle(subtitle);
  const showImage = imageType === "song" || imageType === "artist";
  const showPlay = imageType === "song";

  // Card variant → delegate
  if (variant === "card") {
    return <VisualCard {...props} />;
  }

  // Explanation variant
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

  // Default list variant
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
              {showPlay && <PlayButton title={title} subtitle={subtitle} meta={songMeta} />}
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
        <TooltipContent side="top" className="max-w-xs whitespace-pre-line text-xs">
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
