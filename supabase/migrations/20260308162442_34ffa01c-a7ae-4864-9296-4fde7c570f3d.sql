
-- Drop overly permissive policies
DROP POLICY "Service role can insert seo_pages" ON public.seo_pages;
DROP POLICY "Service role can update seo_pages" ON public.seo_pages;

-- Restrict insert/update to service role only (no authenticated user can write)
CREATE POLICY "Only service role can insert seo_pages" ON public.seo_pages 
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Only service role can update seo_pages" ON public.seo_pages 
  FOR UPDATE TO service_role USING (true);
