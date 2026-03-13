import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SonicProfile, CanonicalDescriptorPayload } from "./useSonicProfile";

// =============================================================================
// useSimilarByDNA
//
// Finds songs with similar sonic DNA using weighted category scoring
// plus an emotional-anchor bonus layer.
//
// Pipeline:
//   1. Backend (search-by-descriptors): fetches up to 200 candidates from DB
//      that overlap at least one descriptor slug with the center song.
//   2. Frontend (here): applies weighted category scoring over all 200,
//      adds emotional-anchor bonuses, applies a secondary-score soft cap,
//      then returns the top 8.
//
// Scoring formula:
//   coreScore = Σ(WEIGHT[category(slug)] for slug in matched_slugs)
//               / Σ(WEIGHT[category(slug)] for slug in center.all_slugs)
//
// Emotional anchor layer (additive, post-normalisation):
//   - Exact dominant_emotional_tone match: +3.5
//   - Partial match (one's dominant appears in other's emotional_tone): +1.0
//
// Secondary soft cap:
//   Categories ranked Low (era_period, environment_imagery, listener_use_case)
//   are summed separately and capped at 6.0 before adding to core score.
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
// Tune these values to adjust which dimensions drive recommendations.
//
// Tiers:
//   High   (2.2–3.0): core sonic identity — these should dominate matching
//   Medium (1.2–2.0): important texture/character dimensions
//   Low    (0.4–0.9): contextual or decorative — useful but not load-bearing
//
// Any slug whose category is not listed here falls back to DEFAULT_CATEGORY_WEIGHT.

const CATEGORY_WEIGHTS: Record<string, number> = {
  // High — core sonic identity
  emotional_tone:         3.0,
  energy_posture:         3.0,
  groove_character:       2.8,
  texture:                2.3,
  spatial_feel:           2.2,

  // Medium — important character dimensions
  vocal_character:        2.0,
  harmonic_color:         1.8,
  arrangement_energy_arc: 1.8,
  melodic_character:      1.5,
  era_movement:           1.5,
  drum_character:         1.3,
  bass_character:         1.2,

  // Low — contextual / decorative
  era_period:             0.7,
  environment_imagery:    0.6,
  listener_use_case:      0.4,
};
const DEFAULT_CATEGORY_WEIGHT = 1.0; // fallback for any future/unknown categories

// Categories treated as "secondary" for soft-cap purposes
const SECONDARY_CATEGORIES = new Set(["era_period", "environment_imagery", "listener_use_case"]);

// Emotional anchor bonuses
const DOMINANT_TONE_EXACT_BONUS  = 3.5;
const DOMINANT_TONE_PARTIAL_BONUS = 1.0;

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
          // Request the full backend pool (200) so weighted scoring sees all candidates,
          // not just the top-40 by flat overlap count.
          { body: { descriptors: canonical!.all_slugs, limit: 200 } },
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
          profile_json: Record<string, unknown>;
          dominant_emotional_tone: string | null;
        };

        const rawResults = (data.results || []) as RawResult[];

        // Build weight map and denominator once for the center song
        const slugWeights  = buildSlugWeightMap(profile!);
        const totalWeight  = canonical!.all_slugs.reduce(
          (sum, s) => sum + (slugWeights.get(s) ?? DEFAULT_CATEGORY_WEIGHT), 0,
        );
        const centerEra = [...(profile!.era_movement || []), ...(profile!.era_period || [])];
        const centerDominant = profile!.dominant_emotional_tone ?? null;

        // Build slug → category map for secondary soft-cap
        const slugToCategory = new Map<string, string>();
        const categoryFields: Array<keyof SonicProfile> = [
          "energy_posture", "groove_character", "drum_character", "bass_character",
          "harmonic_color", "melodic_character", "vocal_character", "texture",
          "arrangement_energy_arc", "spatial_feel", "emotional_tone",
          "era_period", "era_movement", "environment_imagery", "listener_use_case",
        ];
        for (const field of categoryFields) {
          const val = profile![field];
          if (!Array.isArray(val)) continue;
          for (const slug of val as string[]) slugToCategory.set(slug, field as string);
        }

        const scored: SimilarSong[] = rawResults
          .filter(r => {
            if (r.spotify_track_id === centerTrackId) return false;
            if (r.artist_name.toLowerCase() === centerArtist.toLowerCase()) return false;
            if (r.match_ratio > 0.95 && r.matched_count >= canonical!.all_slugs.length - 1) return false;
            return true;
          })
          .map(r => {
            // Split matched slugs into core vs secondary contributions
            let coreWeighted = 0;
            let secondaryWeighted = 0;
            for (const s of r.matched_slugs) {
              const w = slugWeights.get(s) ?? DEFAULT_CATEGORY_WEIGHT;
              const cat = slugToCategory.get(s) ?? "";
              if (SECONDARY_CATEGORIES.has(cat)) {
                secondaryWeighted += w;
              } else {
                coreWeighted += w;
              }
            }
            // Soft cap on secondary category contribution
            const cappedSecondary = Math.min(secondaryWeighted, 6);
            const baseScore = totalWeight > 0
              ? (coreWeighted + cappedSecondary) / totalWeight
              : 0;

            // ── Emotional anchor bonus ──────────────────────────────────
            let emotionBonus = 0;
            const candidateDominant = r.dominant_emotional_tone ?? null;
            if (centerDominant && candidateDominant) {
              if (centerDominant === candidateDominant) {
                // Exact dominant match — strong bonus
                emotionBonus = DOMINANT_TONE_EXACT_BONUS;
              } else {
                // Partial: center's dominant appears in candidate's emotional_tone array
                const candidateEmotions = Array.isArray(r.profile_json?.emotional_tone)
                  ? (r.profile_json.emotional_tone as string[])
                  : [];
                if (candidateEmotions.includes(centerDominant)) {
                  emotionBonus = DOMINANT_TONE_PARTIAL_BONUS;
                }
              }
            }

            const score = baseScore + emotionBonus;

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
