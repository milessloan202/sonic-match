
ALTER TABLE public.seo_pages ADD COLUMN spotify_track_id TEXT;

-- Add spotify_track_id to song_image_cache for reliable lookups
ALTER TABLE public.song_image_cache ADD COLUMN spotify_track_id TEXT;
