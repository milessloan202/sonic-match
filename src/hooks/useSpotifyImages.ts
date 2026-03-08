import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SongItem {
  title: string;
  subtitle?: string;
  spotify_id?: string | null;
}

export interface SongMeta {
  image_url: string | null;
  preview_url: string | null;
  spotify_url: string | null;
  youtube_thumbnail_url: string | null;
}

export interface ImageMap {
  [key: string]: string | null;
}

export interface SongMetaMap {
  [key: string]: SongMeta;
}

function extractArtist(subtitle?: string): string {
  if (!subtitle) return "";
  return subtitle.replace(/\s*\(\d{4}\)\s*$/, "").trim();
}

/** Build a composite key: "title|||artist" for unique song identity */
export function songKey(title: string, subtitle?: string): string {
  const artist = extractArtist(subtitle);
  return artist ? `${title}|||${artist}` : title;
}

export function useSpotifyImages(songs: SongItem[], artistItems: SongItem[]) {
  const [songMeta, setSongMeta] = useState<SongMetaMap>({});
  const [artistImages, setArtistImages] = useState<ImageMap>({});
  const fetchedRef = useRef(false);

  // Derived image-only map keyed by title|||artist
  const songImages: ImageMap = {};
  for (const [k, v] of Object.entries(songMeta)) {
    songImages[k] = v.image_url || v.youtube_thumbnail_url || null;
  }

  useEffect(() => {
    if (fetchedRef.current) return;
    if (songs.length === 0 && artistItems.length === 0) return;
    fetchedRef.current = true;

    const songQueries = songs
      .map((s) => ({ title: s.title, artist: extractArtist(s.subtitle), spotify_id: s.spotify_id || undefined }))
      .filter((s) => s.title && s.artist);

    const artistQueries = artistItems
      .map((a) => ({ name: a.title }))
      .filter((a) => a.name);

    if (songQueries.length === 0 && artistQueries.length === 0) return;

    supabase.functions
      .invoke("fetch-spotify-images", {
        body: { songs: songQueries, artists: artistQueries },
      })
      .then(({ data, error }) => {
        if (error || !data) return;

        if (data.songs) {
          // Backend returns keys as "title|||artist" — keep as-is
          const mapped: SongMetaMap = {};
          for (const [key, meta] of Object.entries(data.songs as Record<string, SongMeta>)) {
            mapped[key] = meta;
          }
          setSongMeta(mapped);
        }

        if (data.artists) {
          setArtistImages(data.artists as ImageMap);
        }
      });
  }, [songs, artistItems]);

  return { songImages, songMeta, artistImages };
}
