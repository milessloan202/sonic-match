import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// =============================================================================
// useSonicProfile
//
// Cache-first: checks song_sonic_profiles table first,
// then calls generate-sonic-profile edge function if missing.
//
// Usage:
//   const { profile, canonical, loading, error } = useSonicProfile({
//     spotifyTrackId: "4uLU6hMCjMI75M1A2tKUQC",
//     songTitle: "Blinding Lights",
//     artistName: "The Weeknd",
//   });
// =============================================================================

export interface SonicProfile {
  energy_posture: string[];
  groove_character: string[];
  drum_character: string[];
  bass_character: string[];
  harmonic_color: string[];
  melodic_character: string[];
  vocal_character: string[];
  texture: string[];
  arrangement_energy_arc: string[];
  spatial_feel: string[];
  emotional_tone: string[];
  era_period: string[];
  era_movement: string[];
  environment_imagery: string[];
  listener_use_case: string[];
  intensity_level: string;
  danceability_feel: string;
  confidence_score?: number;
  canonical_descriptors?: CanonicalDescriptorPayload;
  // Genre classification — for filtering/browsing/SEO only, not used in similarity scoring
  genre?: string;
  subgenre?: string[];
}

export interface CanonicalDescriptor {
  slug: string;
  label: string;
  category: string;
  is_clickable: boolean;
  search_url: string;
  dna_url: string;
}

export interface CanonicalDescriptorPayload {
  display_descriptors: CanonicalDescriptor[];
  descriptor_search_url: string;
  all_slugs: string[];
}

interface UseSonicProfileArgs {
  spotifyTrackId: string | null | undefined;
  songTitle: string;
  artistName: string;
  // Set to false to disable auto-generation (e.g. on ResultCards where it's optional)
  autoGenerate?: boolean;
}

interface UseSonicProfileResult {
  profile: SonicProfile | null;
  canonical: CanonicalDescriptorPayload | null;
  loading: boolean;
  error: string | null;
  source: "cache" | "generated" | null;
}

export function useSonicProfile({
  spotifyTrackId,
  songTitle,
  artistName,
  autoGenerate = true,
}: UseSonicProfileArgs): UseSonicProfileResult {
  const [profile, setProfile]     = useState<SonicProfile | null>(null);
  const [canonical, setCanonical] = useState<CanonicalDescriptorPayload | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [source, setSource]       = useState<"cache" | "generated" | null>(null);

  useEffect(() => {
    if (!spotifyTrackId || !songTitle || !artistName) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        // Fast cache check directly from DB first (avoids edge function cold start)
        const { data: cached } = await (supabase
          .from("song_sonic_profiles" as any)
          .select("profile_json")
          .eq("spotify_track_id", spotifyTrackId)
          .single() as any);

        if (cancelled) return;

        if (cached?.profile_json) {
          const profileJson = cached.profile_json as SonicProfile;
          setProfile(profileJson);
          setSource("cache");

          // If the cached profile has canonical_descriptors, use them immediately
          if (profileJson.canonical_descriptors) {
            setCanonical(profileJson.canonical_descriptors);
            setLoading(false);
            return;
          }

          // v1 cache — fall through to edge function to upgrade it
          if (!autoGenerate) {
            setLoading(false);
            return;
          }
        }

        if (!autoGenerate && !cached?.profile_json) {
          setLoading(false);
          return;
        }

        // Generate (or upgrade) via edge function
        const { data, error: fnError } = await supabase.functions.invoke(
          "generate-sonic-profile",
          {
            body: {
              spotify_track_id: spotifyTrackId,
              song_title:       songTitle,
              artist_name:      artistName,
            },
          }
        );

        if (cancelled) return;

        if (fnError) throw new Error(fnError.message);
        if (data?.error) throw new Error(data.error);

        setProfile(data.profile as SonicProfile);
        setSource(data.source || "generated");
        if (data.canonical_descriptors) {
          setCanonical(data.canonical_descriptors as CanonicalDescriptorPayload);
        }

      } catch (e) {
        if (!cancelled) {
          console.error("[useSonicProfile] Error:", e);
          setError(e instanceof Error ? e.message : "Failed to load sonic profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [spotifyTrackId, songTitle, artistName, autoGenerate]);

  return { profile, canonical, loading, error, source };
}

// ── Utility: get top N descriptors from a profile for compact display ─────────
// Prioritizes emotional_tone, texture, and era for compact card display

export function getTopDescriptors(profile: SonicProfile, count = 3): string[] {
  const priority = [
    ...profile.emotional_tone,
    ...profile.texture,
    ...(profile.era_movement || []),
    ...(profile.era_period || []),
    ...profile.environment_imagery,
    ...(profile.energy_posture || []),
  ];
  return [...new Set(priority)].slice(0, count);
}
