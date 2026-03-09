import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SongItem {
  title: string;
  subtitle?: string;
  spotify_id?: string | null;
}

export type ResolverStatus = "resolved" | "not_found" | "temporary_failure" | "error";

export interface SongMeta {
  image_url: string | null;
  preview_url: string | null;
  spotify_url: string | null;
  youtube_thumbnail_url: string | null;
  status?: ResolverStatus;
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
  const [metaLoaded, setMetaLoaded] = useState(false);
  const fetchedRef = useRef(false);

  // Derived image-only map keyed by title|||artist (Spotify only)
  const songImages: ImageMap = {};
  for (const [k, v] of Object.entries(songMeta)) {
    songImages[k] = v.image_url || null;
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

    if (songQueries.length === 0 && artistQueries.length === 0) {
      setMetaLoaded(true);
      return;
    }

    supabase.functions
      .invoke("fetch-spotify-images", {
        body: { songs: songQueries, artists: artistQueries },
      })
      .then(({ data, error }) => {
        if (error || !data) {
          // Edge function failed entirely — mark all songs as error
          const errorMeta: SongMetaMap = {};
          for (const s of songQueries) {
            const key = `${s.title}|||${s.artist}`;
            errorMeta[key] = {
              image_url: null,
              preview_url: null,
              spotify_url: null,
              youtube_thumbnail_url: null,
              status: "error",
            };
          }
          setSongMeta(errorMeta);
          setMetaLoaded(true);
          return;
        }

        if (data.songs) {
          const mapped: SongMetaMap = {};
          for (const [key, meta] of Object.entries(data.songs as Record<string, any>)) {
            mapped[key] = {
              image_url: meta.image_url ?? null,
              preview_url: meta.preview_url ?? null,
              spotify_url: meta.spotify_url ?? null,
              youtube_thumbnail_url: meta.youtube_thumbnail_url ?? null,
              status: meta.status ?? (meta.spotify_url ? "resolved" : "not_found"),
            };
          }
          setSongMeta(mapped);
        }

        if (data.artists) {
          setArtistImages(data.artists as ImageMap);
        }
        setMetaLoaded(true);
      });
  }, [songs, artistItems]);

  return { songImages, songMeta, artistImages, metaLoaded };
}
