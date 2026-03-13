import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Disc3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Song {
  song_title: string;
  artist_name: string;
  spotify_track_id: string;
  image_url?: string | null;
}

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

interface Props {
  descriptorSlug: string;
  descriptorLabel: string;
  descriptorDescription?: string;
  category?: string;
  limit?: number;
}

/**
 * A horizontal scrollable row of album artwork for songs matching a descriptor.
 * Header hierarchy: chip → title → subtitle → carousel → CTA
 */
export default function DescriptorCarousel({
  descriptorSlug,
  descriptorLabel,
  descriptorDescription,
  category,
  limit = 10,
}: Props) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      const { data: profiles } = await supabase
        .from("song_sonic_profiles")
        .select("song_title, artist_name, spotify_track_id")
        .contains("descriptor_slugs", [descriptorSlug])
        .limit(limit);

      if (cancelled || !profiles?.length) {
        if (!cancelled) setLoading(false);
        return;
      }

      const trackIds = profiles.map((p) => p.spotify_track_id);
      const { data: images } = await supabase
        .from("song_image_cache")
        .select("spotify_track_id, image_url")
        .in("spotify_track_id", trackIds);

      const imageMap = new Map<string, string>();
      images?.forEach((img) => {
        if (img.spotify_track_id && img.image_url) {
          imageMap.set(img.spotify_track_id, img.image_url);
        }
      });

      if (!cancelled) {
        setSongs(
          profiles.map((p) => ({
            ...p,
            image_url: imageMap.get(p.spotify_track_id) ?? null,
          }))
        );
        setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [descriptorSlug, limit]);

  /** Build a natural-sounding row title */
  const rowTitle = `${descriptorLabel}-sounding songs`;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="h-4 w-16 bg-secondary rounded animate-pulse" />
          <div className="h-5 w-48 bg-secondary rounded animate-pulse" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[140px] h-[140px] rounded-md bg-secondary animate-pulse shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (songs.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Row header: chip + title + description */}
      <div className="space-y-1.5">
        <Link
          to={`/sounds/${descriptorSlug}`}
          className="inline-block text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border border-border/60 bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
        >
          {descriptorLabel}
        </Link>
        <h3 className="text-sm font-semibold text-foreground">{rowTitle}</h3>
        {descriptorDescription && (
          <p className="text-xs text-muted-foreground/70 max-w-md">{descriptorDescription}</p>
        )}
      </div>

      {/* Album carousel */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {songs.map((song) => {
          const songSlug = `${slugify(song.song_title)}-${slugify(song.artist_name)}`;
          return (
            <Link
              key={song.spotify_track_id}
              to={`/songs-like/${songSlug}`}
              className="shrink-0 group"
            >
              <div className="w-[140px] h-[140px] rounded-md overflow-hidden border border-border/50 hover:border-primary/30 transition-all duration-300 hover:scale-105 bg-secondary">
                {song.image_url ? (
                  <img
                    src={song.image_url}
                    alt={`${song.song_title} by ${song.artist_name}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Disc3 className="w-8 h-8" />
                  </div>
                )}
              </div>
              <p className="text-xs text-foreground mt-1.5 truncate w-[140px]">{song.song_title}</p>
              <p className="text-[10px] text-muted-foreground truncate w-[140px]">{song.artist_name}</p>
            </Link>
          );
        })}
      </div>

      {/* CTA */}
      <Link
        to={`/sounds/${descriptorSlug}`}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
      >
        Explore {descriptorLabel.toLowerCase()} <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}
