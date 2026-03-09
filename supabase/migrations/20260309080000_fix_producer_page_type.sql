-- =============================================================================
-- Fix producer page_type constraint
-- The original constraint was added in 20260308220343 but only covers
-- song/artist/vibe. Producer pages can't be saved without this fix.
-- =============================================================================

-- The constraint name from the earlier migration
ALTER TABLE public.seo_pages DROP CONSTRAINT IF EXISTS seo_pages_page_type_check;

ALTER TABLE public.seo_pages
  ADD CONSTRAINT seo_pages_page_type_check
  CHECK (page_type = ANY (ARRAY['song'::text, 'artist'::text, 'producer'::text, 'vibe'::text]));
