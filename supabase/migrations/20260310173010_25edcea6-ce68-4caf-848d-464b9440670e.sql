CREATE TABLE public.song_comparisons (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  song_a_id      text        NOT NULL,
  song_b_id      text        NOT NULL,
  CONSTRAINT song_comparisons_ordered CHECK (song_a_id < song_b_id),
  UNIQUE (song_a_id, song_b_id),
  shared_traits  text[]      NOT NULL DEFAULT '{}',
  differences    text[]      NOT NULL DEFAULT '{}',
  match_strength numeric(3,2) NOT NULL DEFAULT 0.50
                              CHECK (match_strength >= 0.0 AND match_strength <= 1.0),
  short_reason   text        NOT NULL DEFAULT '',
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

CREATE TRIGGER update_song_comparisons_updated_at
  BEFORE UPDATE ON public.song_comparisons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_song_comparisons_pair
  ON public.song_comparisons (song_a_id, song_b_id);

CREATE INDEX idx_song_comparisons_song_a ON public.song_comparisons (song_a_id);
CREATE INDEX idx_song_comparisons_song_b ON public.song_comparisons (song_b_id);

CREATE INDEX idx_song_comparisons_strength
  ON public.song_comparisons (match_strength DESC);