-- Add genre classification fields to song_sonic_profiles.
--
-- These are used for filtering, browsing, and SEO page categorization only.
-- They are NOT included in descriptor_slugs and do NOT influence
-- Sonic DNA similarity scoring.

ALTER TABLE song_sonic_profiles
  ADD COLUMN IF NOT EXISTS genre    text,
  ADD COLUMN IF NOT EXISTS subgenre text[];

-- Efficient equality filter for genre browsing pages
CREATE INDEX IF NOT EXISTS idx_song_sonic_profiles_genre
  ON song_sonic_profiles (genre)
  WHERE genre IS NOT NULL;

-- GIN index for subgenre array containment queries
CREATE INDEX IF NOT EXISTS idx_song_sonic_profiles_subgenre
  ON song_sonic_profiles USING GIN (subgenre)
  WHERE subgenre IS NOT NULL;
