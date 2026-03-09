-- =============================================================================
-- Phase 1: Spotify-safe scaling architecture
-- - Extend song_image_cache with normalization + dedup fields
-- - Add resolution_jobs queue table for deferred Spotify work
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extend song_image_cache
--    Add only columns that don't already exist.
--    Existing columns (as of last migration):
--      id, name, artist, image_url, created_at,
--      preview_url, spotify_url, youtube_thumbnail_url,
--      spotify_track_id, resolver_status, last_http_status,
--      cache_version, expires_at
-- -----------------------------------------------------------------------------

-- Normalized fields for deduplication (lowercase, stripped punctuation)
ALTER TABLE public.song_image_cache
  ADD COLUMN IF NOT EXISTS normalized_title  text,
  ADD COLUMN IF NOT EXISTS normalized_artist text;

-- Human-readable reason for resolver_status (e.g. "rate_limited", "no_match", "api_error")
ALTER TABLE public.song_image_cache
  ADD COLUMN IF NOT EXISTS reason text;

-- Spotify relational IDs for batch hydration (Phase 4)
ALTER TABLE public.song_image_cache
  ADD COLUMN IF NOT EXISTS album_id   text,
  ADD COLUMN IF NOT EXISTS artist_ids text[]; -- array of Spotify artist IDs

-- updated_at for stale-while-revalidate logic
ALTER TABLE public.song_image_cache
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill normalized fields from existing name/artist values.
-- Normalization mirrors the Edge Function logic:
--   lowercase, strip parens/brackets, collapse whitespace,
--   remove common suffixes (remaster, deluxe, etc.)
UPDATE public.song_image_cache
SET
  normalized_title = lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(name, '\(.*?\)|\[.*?\]', '', 'g'),
        '\b(remastered?|deluxe|edition|version|edit|mix|mono|stereo|single|album)\b',
        '', 'gi'
      ),
      '\s+', ' ', 'g'
    )
  ),
  normalized_artist = lower(regexp_replace(artist, '\s+', ' ', 'g'))
WHERE normalized_title IS NULL;

-- updated_at trigger (reuse existing function from seo_pages migration)
CREATE TRIGGER update_song_image_cache_updated_at
  BEFORE UPDATE ON public.song_image_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for cache-first lookups and dedup
CREATE INDEX IF NOT EXISTS idx_song_image_cache_normalized
  ON public.song_image_cache (normalized_title, normalized_artist);

CREATE INDEX IF NOT EXISTS idx_song_image_cache_updated_at
  ON public.song_image_cache (updated_at);

CREATE INDEX IF NOT EXISTS idx_song_image_cache_spotify_track_id
  ON public.song_image_cache (spotify_track_id)
  WHERE spotify_track_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. resolution_jobs — queue table for deferred Spotify work
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.resolution_jobs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What kind of work this job represents
  job_type       text        NOT NULL
                             CHECK (job_type IN ('resolve_song', 'resolve_artist', 'batch_hydrate')),

  -- Arbitrary JSON payload. For resolve_song: { title, artist, cache_key }
  -- For batch_hydrate: { track_ids: [...] }
  payload        jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Lifecycle status
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'processing', 'done', 'failed', 'cancelled')),

  -- Retry tracking
  attempt_count  integer     NOT NULL DEFAULT 0,
  max_attempts   integer     NOT NULL DEFAULT 3,
  last_error     text,

  -- When this job is eligible to be picked up (supports delayed retry)
  available_at   timestamptz NOT NULL DEFAULT now(),

  -- Deduplication key — normalized_title|||normalized_artist for songs,
  -- artist_name for artists, comma-joined track IDs for batch
  dedup_key      text        UNIQUE,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.resolution_jobs ENABLE ROW LEVEL SECURITY;

-- Only service role (Edge Functions) can read/write jobs
CREATE POLICY "Service role can select resolution_jobs"
  ON public.resolution_jobs FOR SELECT USING (true);

CREATE POLICY "Service role can insert resolution_jobs"
  ON public.resolution_jobs FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update resolution_jobs"
  ON public.resolution_jobs FOR UPDATE USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE TRIGGER update_resolution_jobs_updated_at
  BEFORE UPDATE ON public.resolution_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for the worker query pattern:
--   SELECT ... WHERE status = 'pending' AND available_at <= now()
--   ORDER BY available_at ASC LIMIT N
CREATE INDEX idx_resolution_jobs_worker
  ON public.resolution_jobs (status, available_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX idx_resolution_jobs_dedup
  ON public.resolution_jobs (dedup_key)
  WHERE dedup_key IS NOT NULL;

CREATE INDEX idx_resolution_jobs_created_at
  ON public.resolution_jobs (created_at);
