import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SampleData {
  sampled_song_title: string;
  sampled_artist_name: string;
  sampled_recording_id: string | null;
}

export function useSampleData(songTitle: string | undefined, artistName: string | undefined) {
  const [sample, setSample] = useState<SampleData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!songTitle || !artistName) return;

    const fetchSample = async () => {
      setLoading(true);
      try {
        // Check cache first via direct DB read
        const { data: cached } = await supabase
          .from("sample_cache")
          .select("*")
          .eq("song_title", songTitle)
          .eq("artist_name", artistName)
          .maybeSingle();

        if (cached?.looked_up) {
          if (cached.sample_verified) {
            setSample({
              sampled_song_title: cached.sampled_song_title!,
              sampled_artist_name: cached.sampled_artist_name!,
              sampled_recording_id: cached.sampled_recording_id,
            });
          }
          setLoading(false);
          return;
        }

        // Call edge function to lookup
        const { data, error } = await supabase.functions.invoke("fetch-samples", {
          body: { song_title: songTitle, artist_name: artistName },
        });

        if (!error && data?.sample?.sample_verified) {
          setSample({
            sampled_song_title: data.sample.sampled_song_title,
            sampled_artist_name: data.sample.sampled_artist_name,
            sampled_recording_id: data.sample.sampled_recording_id,
          });
        }
      } catch (e) {
        console.error("Sample lookup failed:", e);
      }
      setLoading(false);
    };

    fetchSample();
  }, [songTitle, artistName]);

  return { sample, loading };
}
