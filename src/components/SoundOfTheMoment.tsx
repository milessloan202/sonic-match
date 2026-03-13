import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Disc3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { RegistryDescriptor } from "@/hooks/useExploreData";

/** Curated set of strong, visual descriptors likely to have good song coverage */
const FEATURED_POOL = [
  "nocturnal", "dreamy", "cold", "metallic", "nostalgic",
  "hazy", "lush", "stomping", "driving", "glossy",
];

interface Song {
  song_title: string;
  artist_name: string;
  spotify_track_id: string;
  image_url?: string | null;
}

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

interface Props {
  descriptors: RegistryDescriptor[];
}

export default function SoundOfTheMoment({ descriptors }: Props) {
  const featured = useMemo(() => {
    const pool = FEATURED_POOL.filter((s) => descriptors.some((d) => d.slug === s));
    return pool[Math.floor(Math.random() * pool.length)] ?? "nocturnal";
  }, [descriptors]);

  const reg = descriptors.find((d) => d.slug === featured);

  const [songs, setSongs] = useState<Song[]>([]);
  const [coOccurring, setCoOccurring] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: profiles } = await supabase
        .from("song_sonic_profiles")
        .select("song_title, artist_name, spotify_track_id, descriptor_slugs")
        .contains("descriptor_slugs", [featured])
        .limit(8);

      if (cancelled || !profiles?.length) {
        if (!cancelled) setLoading(false);
        return;
      }

      // Lightweight co-occurrence: count other descriptors appearing alongside featured
      const counts: Record<string, number> = {};
      for (const p of profiles) {
        const slugs = (p.descriptor_slugs as string[]) ?? [];
        for (const s of slugs) {
          if (s !== featured) counts[s] = (counts[s] || 0) + 1;
        }
      }
      const top = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([s]) => s);

      // Batch-fetch images
      const trackIds = profiles.map((p) => p.spotify_track_id);
      const { data: images } = await supabase
        .from("song_image_cache")
        .select("spotify_track_id, image_url")
        .in("spotify_track_id", trackIds);

      const imageMap = new Map<string, string>();
      images?.forEach((img) => {
        if (img.spotify_track_id && img.image_url)
          imageMap.set(img.spotify_track_id, img.image_url);
      });

      if (!cancelled) {
        setSongs(
          profiles.map((p) => ({
            song_title: p.song_title,
            artist_name: p.artist_name,
            spotify_track_id: p.spotify_track_id,
            image_url: imageMap.get(p.spotify_track_id) ?? null,
          }))
        );
        setCoOccurring(top);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [featured]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-40 bg-secondary rounded animate-pulse" />
        <div className="flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[120px] h-[120px] rounded-lg bg-secondary animate-pulse shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (songs.length === 0) return null;

  const label = reg?.label ?? featured.replace(/-/g, " ");

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Sound of the moment
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground capitalize">{label}</h2>
        {coOccurring.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Often appears with:{" "}
            {coOccurring.map((s) => s.replace(/-/g, " ")).join(", ")}
          </p>
        )}
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
              <div className="w-[120px] h-[120px] sm:w-[140px] sm:h-[140px] rounded-lg overflow-hidden border border-border/50 hover:border-primary/30 transition-all duration-300 hover:scale-105 bg-secondary">
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
              <p className="text-xs text-foreground mt-1.5 truncate w-[120px] sm:w-[140px]">{song.song_title}</p>
              <p className="text-[10px] text-muted-foreground truncate w-[120px] sm:w-[140px]">{song.artist_name}</p>
            </Link>
          );
        })}
      </div>

      <Link
        to={`/sounds/${featured}`}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
      >
        Explore {label} <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}
