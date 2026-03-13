ALTER TABLE song_sonic_profiles ADD COLUMN dominant_emotional_tone TEXT;

-- Backfill from profile_json.emotional_tone[0]
UPDATE song_sonic_profiles
SET dominant_emotional_tone = profile_json->'emotional_tone'->>0
WHERE profile_json->'emotional_tone' IS NOT NULL
  AND jsonb_array_length(profile_json->'emotional_tone') > 0;