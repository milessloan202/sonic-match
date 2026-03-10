CREATE TABLE public.song_sonic_profiles (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_track_id text        NOT NULL UNIQUE,
  song_title       text        NOT NULL,
  artist_name      text        NOT NULL,
  profile_json     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  confidence_score numeric(3,2) NOT NULL DEFAULT 0.80
                               CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
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

CREATE TRIGGER update_song_sonic_profiles_updated_at
  BEFORE UPDATE ON public.song_sonic_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_song_sonic_profiles_track_id
  ON public.song_sonic_profiles (spotify_track_id);

CREATE INDEX idx_song_sonic_profiles_descriptors
  ON public.song_sonic_profiles USING GIN (descriptor_slugs);

CREATE INDEX idx_song_sonic_profiles_profile
  ON public.song_sonic_profiles USING GIN (profile_json);