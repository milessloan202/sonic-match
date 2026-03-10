-- =============================================================================
-- Sonic DNA System — Migration 3 of 3
-- Creates song_comparisons table
-- =============================================================================

CREATE TABLE public.song_comparisons (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References song_sonic_profiles.spotify_track_id (not FK to keep it loose)
  song_a_id      text        NOT NULL,
  song_b_id      text        NOT NULL,

  -- Ordered so (a,b) and (b,a) map to the same row
  -- Enforced by CHECK: song_a_id < song_b_id alphabetically
  -- Application layer must sort before querying
  CONSTRAINT song_comparisons_ordered CHECK (song_a_id < song_b_id),
  UNIQUE (song_a_id, song_b_id),

  -- Array of shared trait strings (human-readable phrases, not slugs)
  -- e.g. ["glossy neon synth texture", "driving night-cruise pulse"]
  shared_traits  text[]      NOT NULL DEFAULT '{}',

  -- Array of difference strings
  differences    text[]      NOT NULL DEFAULT '{}',

  -- 0.0–1.0 overall sonic similarity
  match_strength numeric(3,2) NOT NULL DEFAULT 0.50
                              CHECK (match_strength >= 0.0 AND match_strength <= 1.0),

  -- Short reason (1 sentence, shown in ResultCard)
  short_reason   text        NOT NULL DEFAULT '',

  -- Long reason (1–2 paragraphs, shown in SongPage MatchDNA module)
  long_reason    text        NOT NULL DEFAULT '',

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.song_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read song_comparisons"
  ON public.song_comparisons FOR SELECT USING (true);

CREATE POLICY "Service role can insert song_comparisons"
  ON public.song_comparisons FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update song_comparisons"
  ON public.song_comparisons FOR UPDATE USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE TRIGGER update_song_comparisons_updated_at
  BEFORE UPDATE ON public.song_comparisons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Primary lookup: given two song IDs, get the comparison
CREATE INDEX idx_song_comparisons_pair
  ON public.song_comparisons (song_a_id, song_b_id);

-- Lookup all comparisons involving a specific song
CREATE INDEX idx_song_comparisons_song_a ON public.song_comparisons (song_a_id);
CREATE INDEX idx_song_comparisons_song_b ON public.song_comparisons (song_b_id);

-- Filter by match strength (e.g. only show strong matches)
CREATE INDEX idx_song_comparisons_strength
  ON public.song_comparisons (match_strength DESC);
