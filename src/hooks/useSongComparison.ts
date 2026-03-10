import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// =============================================================================
// useSongComparison
//
// Fetches the MatchDNA comparison between two songs.
// Both songs must have sonic profiles generated first.
// Cache-first via song_comparisons table.
//
// Usage:
//   const { comparison, loading } = useSongComparison({
//     songAId: "centerTrackSpotifyId",
//     songBId: "recommendedTrackSpotifyId",
//     autoGenerate: true,
//   });
// =============================================================================

export interface SongComparison {
  id?: string;
  song_a_id: string;
  song_b_id: string;
  shared_traits: string[];
  differences: string[];
  match_strength: number;
  short_reason: string;
  long_reason: string;
}

interface UseSongComparisonArgs {
  songAId: string | null | undefined;
  songBId: string | null | undefined;
  // Set false to skip generation (only use cached data)
  autoGenerate?: boolean;
}

interface UseSongComparisonResult {
  comparison: SongComparison | null;
  loading: boolean;
  error: string | null;
  source: "cache" | "generated" | null;
}

// Consistent pair ordering (mirrors DB constraint)
function orderIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function useSongComparison({
  songAId,
  songBId,
  autoGenerate = true,
}: UseSongComparisonArgs): UseSongComparisonResult {
  const [comparison, setComparison] = useState<SongComparison | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [source, setSource]         = useState<"cache" | "generated" | null>(null);

  useEffect(() => {
    if (!songAId || !songBId || songAId === songBId) return;

    const [ordA, ordB] = orderIds(songAId, songBId);
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        // Fast DB cache check
        const { data: cached } = await (supabase
          .from("song_comparisons" as any)
          .select("*")
          .eq("song_a_id", ordA)
          .eq("song_b_id", ordB)
          .single() as any);

        if (cancelled) return;

        if (cached) {
          setComparison(cached as unknown as SongComparison);
          setSource("cache");
          setLoading(false);
          return;
        }

        if (!autoGenerate) {
          setLoading(false);
          return;
        }

        // Generate via edge function
        const { data, error: fnError } = await supabase.functions.invoke(
          "compare-songs",
          { body: { song_a_id: songAId, song_b_id: songBId } }
        );

        if (cancelled) return;

        if (fnError) throw new Error(fnError.message);
        if (data?.error) throw new Error(data.error);

        setComparison(data.comparison as SongComparison);
        setSource(data.source || "generated");

      } catch (e) {
        if (!cancelled) {
          console.error("[useSongComparison] Error:", e);
          setError(e instanceof Error ? e.message : "Failed to load comparison");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [songAId, songBId, autoGenerate]);

  return { comparison, loading, error, source };
}
