CREATE TABLE public.sample_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_title text NOT NULL,
  artist_name text NOT NULL,
  sampled_song_title text,
  sampled_artist_name text,
  musicbrainz_recording_id text,
  sampled_recording_id text,
  sample_verified boolean NOT NULL DEFAULT false,
  looked_up boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (song_title, artist_name)
);

ALTER TABLE public.sample_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sample_cache" ON public.sample_cache FOR SELECT USING (true);
CREATE POLICY "Service role can insert sample_cache" ON public.sample_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update sample_cache" ON public.sample_cache FOR UPDATE USING (true) WITH CHECK (true);