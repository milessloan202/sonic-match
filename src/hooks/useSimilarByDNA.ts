import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SonicProfile, CanonicalDescriptorPayload } from "./useSonicProfile";

// =============================================================================
// useSimilarByDNA
//
// Finds songs with similar sonic DNA using weighted category scoring.
//
// Scoring formula:
//   score = Σ(WEIGHT[category(slug)] for slug in matched_slugs)
//           / Σ(WEIGHT[category(slug)] for slug in center.all_slugs)
//
// Each matched slug contributes its category's weight rather than 1.
// Normalised to [0–1] against the maximum possible weighted score.
// Tune CATEGORY_WEIGHTS to adjust which dimensions drive similarity.
//
// Diversity filters (hard exclusions):
//   - center song itself
//   - same artist
//   - near-duplicate profile (match_ratio > 0.95 and nearly all slugs match)
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

// ── Category weights ──────────────────────────────────────────────────────────
// Controls how strongly each sonic dimension influences similarity scoring.
// Higher = a match in this category moves the score more.
// Internal categories (drum, bass, melodic) fall back to DEFAULT_CATEGORY_WEIGHT.

const CATEGORY_WEIGHTS: Record<string, number> = {
  emotional_tone:         3.0,
  energy_posture:         3.0,
  groove_character:       2.8,
  texture:                2.3,
  spatial_feel:           2.2,
  vocal_character:        2.0,
  harmonic_color:         1.8,
  arrangement_energy_arc: 1.8,
  era_movement:           1.5,
  era_period:             0.7,
  environment_imagery:    0.6,
  listener_use_case:      0.4,
};
const DEFAULT_CATEGORY_WEIGHT = 1.0; // drum_character, bass_character, melodic_character

// Build slug → weight map from the center profile's known category assignments
function buildSlugWeightMap(profile: SonicProfile): Map<string, number> {
  const map = new Map<string, number>();
  const fields: Array<keyof SonicProfile> = [
    "energy_posture", "groove_character", "drum_character", "bass_character",
    "harmonic_color", "melodic_character", "vocal_character", "texture",
    "arrangement_energy_arc", "spatial_feel", "emotional_tone",
    "era_period", "era_movement", "environment_imagery", "listener_use_case",
  ];
  for (const field of fields) {
    const val = profile[field];
    if (!Array.isArray(val)) continue;
    const weight = CATEGORY_WEIGHTS[field as string] ?? DEFAULT_CATEGORY_WEIGHT;
    for (const slug of val as string[]) map.set(slug, weight);
  }
  return map;
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

        // Build weight map and denominator once for the center song
        const slugWeights  = buildSlugWeightMap(profile!);
        const totalWeight  = canonical!.all_slugs.reduce(
          (sum, s) => sum + (slugWeights.get(s) ?? DEFAULT_CATEGORY_WEIGHT), 0,
        );
        const centerEra = [...(profile!.era_movement || []), ...(profile!.era_period || [])];

        const scored: SimilarSong[] = rawResults
          .filter(r => {
            if (r.spotify_track_id === centerTrackId) return false;
            if (r.artist_name.toLowerCase() === centerArtist.toLowerCase()) return false;
            if (r.match_ratio > 0.95 && r.matched_count >= canonical!.all_slugs.length - 1) return false;
            return true;
          })
          .map(r => {
            // Weighted overlap: each matched slug contributes its category weight
            const weightedMatched = r.matched_slugs.reduce(
              (sum, s) => sum + (slugWeights.get(s) ?? DEFAULT_CATEGORY_WEIGHT), 0,
            );
            const score = totalWeight > 0 ? weightedMatched / totalWeight : 0;

            const primarySlugs   = canonical!.display_descriptors.slice(0, 3).map(d => d.slug);
            const coreMatchCount = primarySlugs.filter(s => r.matched_slugs.includes(s)).length;
            const sharedEra      = centerEra.find(s => r.descriptor_slugs.includes(s)) ?? null;

            return {
              spotify_track_id:  r.spotify_track_id,
              song_title:        r.song_title,
              artist_name:       r.artist_name,
              sharedDescriptors: r.matched_slugs,
              coreMatchCount,
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
