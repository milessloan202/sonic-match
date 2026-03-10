-- =============================================================================
-- Sonic DNA System — Migration 2 of 3
-- Creates song_sonic_profiles table
-- =============================================================================

CREATE TABLE public.song_sonic_profiles (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_track_id text        NOT NULL UNIQUE,
  song_title       text        NOT NULL,
  artist_name      text        NOT NULL,

  -- Full structured sonic profile as JSON
  -- Shape matches the descriptor vocabulary:
  -- { tempo_feel, groove, drum_character, bass_character, harmonic_color,
  --   melodic_character, vocal_character, texture, arrangement_energy_arc,
  --   emotional_tone, era_lineage, environment_imagery, listener_use_case,
  --   intensity_level, danceability_feel }
  profile_json     jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- 0.0–1.0 confidence that Claude's analysis is accurate
  -- Lower confidence = vaguer genres (jazz fusion, noise rock etc.)
  confidence_score numeric(3,2) NOT NULL DEFAULT 0.80
                               CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),

  -- Track which descriptor slugs are present for fast filtering
  -- Populated on write from profile_json values
  descriptor_slugs text[]      NOT NULL DEFAULT '{}',

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.song_sonic_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read song_sonic_profiles"
  ON public.song_sonic_profiles FOR SELECT USING (true);

CREATE POLICY "Service role can insert song_sonic_profiles"
  ON public.song_sonic_profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update song_sonic_profiles"
  ON public.song_sonic_profiles FOR UPDATE USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE TRIGGER update_song_sonic_profiles_updated_at
  BEFORE UPDATE ON public.song_sonic_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fast lookup by Spotify ID (primary discovery path)
CREATE INDEX idx_song_sonic_profiles_track_id
  ON public.song_sonic_profiles (spotify_track_id);

-- GIN index on descriptor_slugs array for multi-descriptor filtering
-- Powers /dna/nocturnal, /dna/nocturnal/glossy etc.
CREATE INDEX idx_song_sonic_profiles_descriptors
  ON public.song_sonic_profiles USING GIN (descriptor_slugs);

-- GIN index on profile_json for flexible querying
CREATE INDEX idx_song_sonic_profiles_profile
  ON public.song_sonic_profiles USING GIN (profile_json);
