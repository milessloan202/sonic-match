import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SonicProfile, CanonicalDescriptorPayload } from "./useSonicProfile";

// =============================================================================
// useSimilarByDNA
//
// Finds songs with similar sonic DNA using descriptor overlap scoring.
//
// Scoring model:
//   baseScore = descriptorScore * 0.65
//             + primaryDescriptorBonus * 0.20
//             + eraScore * 0.15
//
// Diversity penalties applied as hard filters:
//   - same artist excluded
//   - near-duplicate descriptor profile excluded (match_ratio > 0.95)
//   - center song itself excluded
// =============================================================================

export interface SimilarSong {
  spotify_track_id: string;
  song_title: string;
  artist_name: string;
  sharedDescriptors: string[];
  coreMatchCount: number;
  eraLabel: string | null;
  score: number;
  slug: string;
}

interface UseSimilarByDNAArgs {
  profile: SonicProfile | null;
  canonical: CanonicalDescriptorPayload | null;
  centerTrackId: string | undefined;
  centerArtist: string;
  enabled?: boolean;
}

function toSlug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function useSimilarByDNA({
  profile,
  canonical,
  centerTrackId,
  centerArtist,
  enabled = true,
}: UseSimilarByDNAArgs) {
  const [results, setResults] = useState<SimilarSong[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Stable key so effect only re-runs when descriptors actually change
  const slugKey = canonical?.all_slugs.join(",") ?? "";

  useEffect(() => {
    if (!enabled || !profile || !canonical || canonical.all_slugs.length === 0) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "search-by-descriptors",
          { body: { descriptors: canonical!.all_slugs, limit: 40 } },
        );
        if (fnError) throw new Error(fnError.message);
        if (data?.error)  throw new Error(data.error);
        if (cancelled) return;

        type RawResult = {
          spotify_track_id: string;
          song_title: string;
          artist_name: string;
          descriptor_slugs: string[];
          matched_count: number;
          matched_slugs: string[];
          match_ratio: number;
        };

        const rawResults = (data.results || []) as RawResult[];

        // Primary slugs: first 3 canonical display descriptors
        const primarySlugs = canonical!.display_descriptors.slice(0, 3).map(d => d.slug);
        const centerEra    = profile!.era_lineage || [];

        const scored: SimilarSong[] = rawResults
          .filter(r => {
            // Exclude center song
            if (r.spotify_track_id === centerTrackId) return false;
            // Same-artist diversity penalty (hard exclude)
            if (r.artist_name.toLowerCase() === centerArtist.toLowerCase()) return false;
            // Near-duplicate profile
            if (r.match_ratio > 0.95 && r.matched_count >= canonical!.all_slugs.length - 1) return false;
            return true;
          })
          .map(r => {
            const descriptorScore = r.match_ratio;

            const primaryMatched = primarySlugs.filter(s => r.matched_slugs.includes(s)).length;
            const primaryDescriptorBonus =
              primarySlugs.length > 0 ? primaryMatched / primarySlugs.length : 0;

            const eraMatched = centerEra.filter(s => r.descriptor_slugs.includes(s)).length;
            const eraScore   = centerEra.length > 0 ? eraMatched / centerEra.length : 0;

            const score =
              descriptorScore * 0.65 +
              primaryDescriptorBonus * 0.20 +
              eraScore * 0.15;

            const sharedEra = centerEra.find(s => r.descriptor_slugs.includes(s)) ?? null;

            return {
              spotify_track_id:  r.spotify_track_id,
              song_title:        r.song_title,
              artist_name:       r.artist_name,
              sharedDescriptors: r.matched_slugs,
              coreMatchCount:    primaryMatched,
              eraLabel:          sharedEra,
              score,
              slug: `${toSlug(r.song_title)}-${toSlug(r.artist_name)}`,
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 8);

        setResults(scored);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slugKey, centerTrackId, centerArtist, enabled]);

  return { results, loading, error };
}
