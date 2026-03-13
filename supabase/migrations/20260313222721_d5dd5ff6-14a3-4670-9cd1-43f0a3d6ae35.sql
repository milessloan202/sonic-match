DELETE FROM song_sonic_profiles WHERE spotify_track_id = '7KNmfcgQZS2W2YW0XRVEQn';
DELETE FROM seo_pages WHERE slug LIKE '%30-for-30%' AND page_type = 'song';
DELETE FROM song_comparisons WHERE song_a_id = '7KNmfcgQZS2W2YW0XRVEQn' OR song_b_id = '7KNmfcgQZS2W2YW0XRVEQn';