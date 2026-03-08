import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SongItem {
  title: string;
  subtitle?: string;
}

interface ImageMap {
  [key: string]: string | null;
}

/**
 * Extracts artist name from subtitle like "Artist Name (2020)"
 */
function extractArtist(subtitle?: string): string {
  if (!subtitle) return "";
  return subtitle.replace(/\s*\(\d{4}\)\s*$/, "").trim();
}

export function useSpotifyImages(
  songs: SongItem[],
  artistItems: SongItem[]
) {
  const [songImages, setSongImages] = useState<ImageMap>({});
  const [artistImages, setArtistImages] = useState<ImageMap>({});
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    if (songs.length === 0 && artistItems.length === 0) return;

    fetchedRef.current = true;

    const songQueries = songs
      .map((s) => ({ title: s.title, artist: extractArtist(s.subtitle) }))
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
          const mapped: ImageMap = {};
          for (const [key, url] of Object.entries(data.songs as Record<string, string | null>)) {
            const [title] = key.split("|||");
            mapped[title] = url;
          }
          setSongImages(mapped);
        }

        if (data.artists) {
          setArtistImages(data.artists as ImageMap);
        }
      });
  }, [songs, artistItems]);

  return { songImages, artistImages };
}
