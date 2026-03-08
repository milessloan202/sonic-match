
-- Create seo_pages table for programmatic SEO content
CREATE TABLE public.seo_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL,
  page_type TEXT NOT NULL CHECK (page_type IN ('song', 'artist', 'vibe')),
  title TEXT NOT NULL,
  meta_description TEXT,
  heading TEXT NOT NULL,
  summary TEXT,
  closest_matches JSONB DEFAULT '[]'::jsonb,
  same_energy JSONB DEFAULT '[]'::jsonb,
  related_artists JSONB DEFAULT '[]'::jsonb,
  why_these_work JSONB DEFAULT '[]'::jsonb,
  related_songs JSONB DEFAULT '[]'::jsonb,
  related_vibes JSONB DEFAULT '[]'::jsonb,
  related_artist_links JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (slug, page_type)
);

-- Enable RLS
ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;

-- Public read access (pages are public SEO content)
CREATE POLICY "Anyone can read seo_pages" ON public.seo_pages FOR SELECT USING (true);

-- Only edge functions (service role) can insert/update
CREATE POLICY "Service role can insert seo_pages" ON public.seo_pages FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update seo_pages" ON public.seo_pages FOR UPDATE USING (true);

-- Index for fast lookups
CREATE INDEX idx_seo_pages_slug_type ON public.seo_pages (slug, page_type);
CREATE INDEX idx_seo_pages_page_type ON public.seo_pages (page_type);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_seo_pages_updated_at
BEFORE UPDATE ON public.seo_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
