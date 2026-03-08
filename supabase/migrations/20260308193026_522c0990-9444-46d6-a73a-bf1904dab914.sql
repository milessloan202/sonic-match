
CREATE TABLE public.song_image_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  artist text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, artist)
);

CREATE TABLE public.artist_image_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.song_image_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_image_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read song_image_cache" ON public.song_image_cache FOR SELECT USING (true);
CREATE POLICY "Anyone can read artist_image_cache" ON public.artist_image_cache FOR SELECT USING (true);
CREATE POLICY "Service role can insert song_image_cache" ON public.song_image_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can insert artist_image_cache" ON public.artist_image_cache FOR INSERT WITH CHECK (true);
