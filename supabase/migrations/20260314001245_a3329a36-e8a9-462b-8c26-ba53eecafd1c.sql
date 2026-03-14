CREATE OR REPLACE FUNCTION public.clear_song_cache(song_slug TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM seo_pages
  WHERE slug ILIKE '%' || song_slug || '%';

  DELETE FROM song_comparisons
  WHERE song_a_id ILIKE '%' || replace(song_slug, '-', '%') || '%'
     OR song_b_id ILIKE '%' || replace(song_slug, '-', '%') || '%';
END;
$$;