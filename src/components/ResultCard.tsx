import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Disc3, User, Play, Pause } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAudio } from "@/contexts/AudioContext";
import type { SongMeta } from "@/hooks/useSpotifyImages";

const SpotifyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

const YouTubeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

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
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(meta.spotify_url!, "_blank");
          }}
          className="shrink-0 flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-[#1DB954] transition-colors"
        >
          <SpotifyIcon className="w-3.5 h-3.5" />
          <span>Open in Spotify</span>
        </button>
      );
    }
    return (
      <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(youtubeUrl, "_blank");
          }}
          className="shrink-0 flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-[#FF0000] transition-colors"
        >
          <YouTubeIcon className="w-3.5 h-3.5" />
          <span>Watch on YouTube</span>
        </button>
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
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(meta.spotify_url!, "_blank");
          }}
          className="flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-[#1DB954] transition-colors"
        >
          <SpotifyIcon className="w-2.5 h-2.5" />
          <span>Spotify</span>
        </button>
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
