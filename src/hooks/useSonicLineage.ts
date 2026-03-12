import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SonicProfile, CanonicalDescriptorPayload } from "./useSonicProfile";

// =============================================================================
// useSonicLineage
//
// For a given song, identifies:
//   ROOTS       — earlier songs that influenced the sound
//   DESCENDANTS — later songs continuing or evolving the sound
//
// Lineage score formula:
//   score = (baseSimilarity   * 0.70)   weighted descriptor overlap [0–1]
//         + (eraMovementBonus * 0.20)   shared production wave [0–1]
//         + (coreDescRatio    * 0.10)   top-3 descriptor match ratio [0–1]
//
// Temporal direction determined by era_period rank. Songs without a
// determinable era rank (via era_period or ERA_MOVEMENT_RANK fallback)
// are excluded — temporal placement cannot be asserted.
// =============================================================================

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface LineageResult {
  spotify_track_id: string;
  song_title: string;
  artist_name: string;
  score: number;
  sharedDescriptors: string[];
  sharedEraMovements: string[];
  eraLabel: string | null;
  slug: string;
}

interface UseSonicLineageArgs {
  profile: SonicProfile | null;
  canonical: CanonicalDescriptorPayload | null;
  centerTrackId: string | undefined;
  centerArtist: string;
  enabled?: boolean;
}

// ── Era period ordering ───────────────────────────────────────────────────────
// Chronological ordinal for era_period slugs. Lower = earlier.

const ERA_PERIOD_ORDER: Record<string, number> = {
  "1980s":       1,
  "early-90s":   2,
  "mid-90s":     3,
  "late-90s":    4,
  "early-2000s": 5,
  "mid-2000s":   6,
  "late-2000s":  7,
  "early-2010s": 8,
  "mid-2010s":   9,
  "late-2010s":  10,
  "early-2020s": 11,
};

// Implied era rank for era_movement slugs — used as fallback when no
// era_period slug is present in a song's descriptor_slugs.
const ERA_MOVEMENT_RANK: Record<string, number> = {
  // Classic hip-hop
  "quiet-storm":           3,
  "golden-age-hiphop":     3,
  "boom-bap-era":          3,
  "jazz-rap-era":          3,
  "native-tongues-era":    3,
  "dream-pop":             3,
  "jiggy-era-rap":         4,
  "neo-soul":              4,
  "neptunes-era":          5,
  "chipmunk-soul-era":     5,
  "early-atl-trap":        5,
  "glossy-commercial-rap": 5,
  "french-house":          5,
  "post-punk-revival":     5,
  "garage-rock-revival":   5,
  "southern-crunk":        6,
  "blog-era-rap":          7,
  "bloghouse-era":         7,
  "electro-pop":           7,
  "lo-fi-trap":            7,
  "synth-rap-era":         8,
  "indie-rap-era":         8,
  "cloud-rap-era":         8,
  "industrial-rap":        8,
  "yeezus-era":            8,
  "chicago-drill":         8,
  "witch-house-rap":       8,
  "80s-revival":           8,
  "synthwave":             8,
  "indie-folk-revival":    8,
  "melodic-trap":          9,
  "trap-soul":             9,
  "alternative-rnb":       9,
  "bedroom-pop":           9,
  "shoegaze-revival":      9,
  "dance-pop":             9,
  "alt-pop":               9,
  "ambient-techno":        9,
  "lo-fi-house":           9,
  "emo-rap-era":           10,
  "soundcloud-rap-era":    10,
  "soundcloud-punk-rap":   10,
  "brooklyn-drill":        10,
  "rage-rap":              10,
  "synthpop-revival":      10,
  "hypertrap":             11,
  "glitch-rap":            11,
  "hyperpop":              11,
};

// ── Category weights (identical to useSimilarByDNA) ──────────────────────────
// Keeps lineage and similarity scoring consistent. Tune here or in
// useSimilarByDNA — they should stay in sync.

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// Returns the earliest era rank determinable from a set of descriptor slugs.
// Checks era_period slugs first; falls back to ERA_MOVEMENT_RANK.
// Returns null if no temporal anchor can be resolved.
function resolveEraRank(slugs: string[]): number | null {
  const periodRanks = slugs
    .map((s) => ERA_PERIOD_ORDER[s])
    .filter((r): r is number => r !== undefined);
  if (periodRanks.length > 0) return Math.min(...periodRanks);

  const movementRanks = slugs
    .map((s) => ERA_MOVEMENT_RANK[s])
    .filter((r): r is number => r !== undefined);
  if (movementRanks.length > 0) return Math.min(...movementRanks);

  return null;
}

function toSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSonicLineage({
  profile,
  canonical,
  centerTrackId,
  centerArtist,
  enabled = true,
}: UseSonicLineageArgs) {
  const [roots, setRoots]               = useState<LineageResult[]>([]);
  const [descendants, setDescendants]   = useState<LineageResult[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const slugKey = canonical?.all_slugs.join(",") ?? "";

  useEffect(() => {
    if (!enabled || !profile || !canonical || canonical.all_slugs.length === 0) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const centerEraRank = resolveEraRank(canonical!.all_slugs);

        // Without a temporal anchor on the center song, lineage is indeterminate.
        if (centerEraRank === null) {
          setRoots([]);
          setDescendants([]);
          return;
        }

        const { data, error: fnError } = await supabase.functions.invoke(
          "search-by-descriptors",
          { body: { descriptors: canonical!.all_slugs, limit: 60 } },
        );
        if (fnError) throw new Error(fnError.message);
        if (data?.error) throw new Error(data.error);
        if (cancelled) return;

        type RawResult = {
          spotify_track_id: string;
          song_title: string;
          artist_name: string;
          descriptor_slugs: string[];
          matched_slugs: string[];
          match_ratio: number;
        };

        const rawResults = (data.results || []) as RawResult[];

        const slugWeights    = buildSlugWeightMap(profile!);
        const totalWeight    = canonical!.all_slugs.reduce(
          (sum, s) => sum + (slugWeights.get(s) ?? DEFAULT_CATEGORY_WEIGHT), 0,
        );
        const centerEraMovementSet = new Set(profile!.era_movement || []);
        const primarySlugs         = canonical!.display_descriptors.slice(0, 3).map((d) => d.slug);

        const rootResults:       LineageResult[] = [];
        const descendantResults: LineageResult[] = [];

        for (const r of rawResults) {
          // Diversity filters
          if (r.spotify_track_id === centerTrackId) continue;
          if (r.artist_name.toLowerCase() === centerArtist.toLowerCase()) continue;

          // Require a determinable era rank on the candidate
          const candidateEraRank = resolveEraRank(r.descriptor_slugs);
          if (candidateEraRank === null) continue;

          // Contemporaries (same era rank) are not lineage
          if (candidateEraRank === centerEraRank) continue;

          // ── Score ─────────────────────────────────────────────────────────

          // 1. Base weighted descriptor similarity
          const weightedMatched = r.matched_slugs.reduce(
            (sum, s) => sum + (slugWeights.get(s) ?? DEFAULT_CATEGORY_WEIGHT), 0,
          );
          const baseSimilarity = totalWeight > 0 ? weightedMatched / totalWeight : 0;

          // 2. era_movement overlap bonus — shared production wave = direct lineage signal
          const sharedEraMovements = r.descriptor_slugs.filter((s) => centerEraMovementSet.has(s));
          const eraMovementBonus   = sharedEraMovements.length > 0
            ? Math.min(sharedEraMovements.length / Math.max(centerEraMovementSet.size, 1), 1.0)
            : 0;

          // 3. Shared core descriptor ratio (top-3 display descriptors)
          const coreMatchCount = primarySlugs.filter((s) => r.matched_slugs.includes(s)).length;
          const coreRatio      = primarySlugs.length > 0 ? coreMatchCount / primarySlugs.length : 0;

          const score = (baseSimilarity * 0.70) + (eraMovementBonus * 0.20) + (coreRatio * 0.10);

          // Minimum threshold — must have meaningful sonic overlap
          if (score < 0.08) continue;

          const eraLabel =
            sharedEraMovements[0] ??
            r.descriptor_slugs.find((s) => ERA_PERIOD_ORDER[s] !== undefined) ??
            null;

          const result: LineageResult = {
            spotify_track_id:  r.spotify_track_id,
            song_title:        r.song_title,
            artist_name:       r.artist_name,
            score,
            sharedDescriptors: r.matched_slugs,
            sharedEraMovements,
            eraLabel,
            slug: `${toSlug(r.song_title)}-${toSlug(r.artist_name)}`,
          };

          if (candidateEraRank < centerEraRank) {
            rootResults.push(result);
          } else {
            descendantResults.push(result);
          }
        }

        setRoots(rootResults.sort((a, b) => b.score - a.score).slice(0, 6));
        setDescendants(descendantResults.sort((a, b) => b.score - a.score).slice(0, 6));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load lineage");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slugKey, centerTrackId, centerArtist, enabled]);

  return { roots, descendants, loading, error };
}
