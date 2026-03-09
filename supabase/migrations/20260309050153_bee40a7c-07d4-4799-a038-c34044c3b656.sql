-- Add cache metadata columns to song_image_cache for safer cache management
ALTER TABLE song_image_cache 
  ADD COLUMN IF NOT EXISTS resolver_status text DEFAULT 'resolved',
  ADD COLUMN IF NOT EXISTS last_http_status integer,
  ADD COLUMN IF NOT EXISTS cache_version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

-- Backfill: mark existing entries with null spotify_url as not_found
UPDATE song_image_cache 
SET resolver_status = 'not_found' 
WHERE spotify_url IS NULL AND spotify_track_id IS NULL;

-- Index for cache cleanup queries
CREATE INDEX IF NOT EXISTS idx_song_image_cache_resolver_status ON song_image_cache(resolver_status);
CREATE INDEX IF NOT EXISTS idx_song_image_cache_expires_at ON song_image_cache(expires_at) WHERE expires_at IS NOT NULL;