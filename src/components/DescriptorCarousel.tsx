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
  limit?: number;
}

/**
 * A horizontal scrollable row of album artwork for songs matching a descriptor.
 */
export default function DescriptorCarousel({ descriptorSlug, descriptorLabel, limit = 10 }: Props) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      // 1. Get songs with this descriptor
      const { data: profiles } = await supabase
        .from("song_sonic_profiles")
        .select("song_title, artist_name, spotify_track_id")
        .contains("descriptor_slugs", [descriptorSlug])
        .limit(limit);

      if (cancelled || !profiles?.length) {
        if (!cancelled) setLoading(false);
        return;
      }

      // 2. Batch-fetch images from song_image_cache
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

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground capitalize">{descriptorLabel} sounds</h3>
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground capitalize">{descriptorLabel} sounds</h3>
        <Link
          to={`/sounds/${descriptorSlug}`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 group"
        >
          View all <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

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
    </div>
  );
}
