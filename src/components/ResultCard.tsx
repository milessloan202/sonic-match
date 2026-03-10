import { useState } from "react";
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
import { MatchDNACompact } from "@/components/MatchDNA";

const SpotifyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
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
  metaLoaded?: boolean;
  sonicDescriptors?: string[];
}

const toSlug = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function parseSubtitle(subtitle?: string) {
  if (!subtitle) return { artist: "", year: "" };
  const match = subtitle.match(/^(.+?)\s*\((\d{4})\)\s*$/);
  if (match) return { artist: match[1], year: match[2] };
  return { artist: subtitle, year: "" };
}

const PlaceholderIcon = ({ isArtist, size, shape }: { isArtist: boolean; size: string; shape: string }) => (
  <div
    className={`${size} ${shape} shrink-0 bg-muted flex items-center justify-center text-muted-foreground`}
  >
    {isArtist ? <User className="w-5 h-5" /> : <Disc3 className="w-5 h-5" />}
  </div>
);

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

  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (!url || errored) {
    return <PlaceholderIcon isArtist={isArtist} size={size} shape={shape} />;
  }

  return (
    <div className={`${size} ${shape} shrink-0 relative overflow-hidden bg-muted`}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          {isArtist ? <User className="w-5 h-5" /> : <Disc3 className="w-5 h-5" />}
        </div>
      )}
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
};

const PlayButton = ({ title, subtitle, meta, metaLoaded }: { title: string; subtitle?: string; meta?: SongMeta; metaLoaded?: boolean }) => {
  const { currentTrack, isPlaying, progress, toggle } = useAudio();
  const pbArtist = subtitle ? subtitle.replace(/\s*\(\d{4}\)\s*$/, "").trim() : "";
  const trackId = pbArtist ? `${title}|||${pbArtist}` : title;
  const isActive = currentTrack === trackId && isPlaying;
  const showProgress = currentTrack === trackId;

  const hasSpotify = !!meta?.spotify_url;

  // Loading state
  if (!metaLoaded) {
    return (
      <div className="shrink-0 flex flex-col items-center gap-1">
        <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground/70 animate-spin" />
      </div>
    );
  }

  // Determine status-based messaging
  const status = meta?.status;

  if (status === "temporary_failure") {
    return (
      <div className="shrink-0 flex flex-col items-center gap-1">
        <span className="text-[10px] text-muted-foreground/50">Spotify temporarily unavailable</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="shrink-0 flex flex-col items-center gap-1">
        <span className="text-[10px] text-muted-foreground/50">Couldn't load track</span>
      </div>
    );
  }

  // No preview — show Spotify link or "Not available on Spotify"
  if (!meta?.preview_url) {
    if (hasSpotify) {
      return (
        <div className="shrink-0 flex flex-col items-center gap-1">
          <a
            href={meta.spotify_url!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-[#1DB954] transition-colors"
          >
            <SpotifyIcon className="w-3.5 h-3.5" />
            <span>Open on Spotify</span>
          </a>
        </div>
      );
    }

    return (
      <div className="shrink-0 flex flex-col items-center gap-1">
        <span className="text-[10px] text-muted-foreground/50">Not available on Spotify</span>
      </div>
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
        {showProgress && (
          <svg className="absolute inset-0 w-8 h-8 -rotate-90" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="none" stroke="hsl(var(--primary) / 0.2)" strokeWidth="2" />
            <circle
              cx="16" cy="16" r="14" fill="none"
              stroke="hsl(var(--primary))" strokeWidth="2"
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
          className="flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-[#1DB954] transition-colors"
        >
          <SpotifyIcon className="w-2.5 h-2.5" />
          <span>Spotify</span>
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
  metaLoaded = true,
  sonicDescriptors,
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
      className={`group surface-glass rounded-lg p-5 min-h-[60px] transition-all duration-300 ${
        linkPrefix
          ? "hover:border-primary/30 hover:glow-primary hover:scale-[1.02] cursor-pointer"
          : "hover:border-primary/30 hover:glow-primary cursor-default"
      }`}
    >
      <div className="flex items-center gap-3">
        {showImage && <Thumbnail url={imageUrl} type={imageType} alt={title} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-foreground truncate">{title}</h3>
              {subtitle && imageType === "song" && artist ? (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  <Link
                    to={`/artists-like/${toSlug(artist)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:text-foreground hover:underline underline-offset-2 transition-colors"
                  >
                    {artist}
                  </Link>
                  {year && <span> • {year}</span>}
                </p>
              ) : subtitle ? (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{subtitle}</p>
              ) : null}
              {sonicDescriptors && sonicDescriptors.length > 0 && (
                <div className="mt-2">
                  <MatchDNACompact topDescriptors={sonicDescriptors} />
                </div>
              )}
            </div>
            {showPlay && (
              <div className="shrink-0">
                <PlayButton title={title} subtitle={subtitle} meta={songMeta} metaLoaded={metaLoaded} />
              </div>
            )}
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
    const linkSlug =
      linkPrefix === "/songs-like" && artist
        ? `${toSlug(title)}-${toSlug(artist)}`
        : toSlug(title);
    return (
      <Link to={`${linkPrefix}/${linkSlug}`} className="block">
        {wrappedContent}
      </Link>
    );
  }

  return wrappedContent;
};

export default ResultCard;
