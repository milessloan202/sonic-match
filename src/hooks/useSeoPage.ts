import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RelatedLink {
  name: string;
  slug: string;
}

interface SeoPageData {
  title: string;
  meta_description: string | null;
  heading: string;
  summary: string | null;
  spotify_track_id: string | null;
  closest_matches: { title: string; subtitle?: string; tag?: string; spotify_id?: string | null }[];
  same_energy: { title: string; subtitle?: string; spotify_id?: string | null }[];
  related_artists: { title: string; subtitle?: string }[];
  why_these_work: { title: string; subtitle?: string }[];
  related_songs: RelatedLink[];
  related_vibes: RelatedLink[];
  related_artist_links: RelatedLink[];
}

export function useSeoPage(slug: string | undefined, pageType: string) {
  const [data, setData] = useState<SeoPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    const fetchPage = async () => {
      setLoading(true);
      setError(null);

      // Try to fetch from DB
      const { data: page, error: fetchError } = await supabase
        .from("seo_pages")
        .select("*")
        .eq("slug", slug)
        .eq("page_type", pageType)
        .maybeSingle();

      if (page) {
        setData({
          title: page.title,
          meta_description: page.meta_description,
          heading: page.heading,
          summary: page.summary,
          spotify_track_id: page.spotify_track_id ?? null,
          closest_matches: (page.closest_matches as any[]) || [],
          same_energy: (page.same_energy as any[]) || [],
          related_artists: (page.related_artists as any[]) || [],
          why_these_work: (page.why_these_work as any[]) || [],
          related_songs: (page.related_songs as any[]) || [],
          related_vibes: (page.related_vibes as any[]) || [],
          related_artist_links: (page.related_artist_links as any[]) || [],
        });
        setLoading(false);
        return;
      }

      // Page doesn't exist - generate it
      setGenerating(true);
      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          "generate-seo-page",
          { body: { slug, page_type: pageType } }
        );

        if (fnError) throw fnError;

        if (fnData?.status === "retry") {
          console.log("[useSeoPage] Generation retry requested:", fnData?.reason || "unknown");
          setError("This page is still generating. Please refresh in a moment.");
          setLoading(false);
          setGenerating(false);
          return;
        }

        if (fnData?.error) {
          setError(fnData.error);
          setLoading(false);
          setGenerating(false);
          return;
        }

        // Re-fetch the newly created page
        const { data: newPage } = await supabase
          .from("seo_pages")
          .select("*")
          .eq("slug", slug)
          .eq("page_type", pageType)
          .maybeSingle();

        if (newPage) {
          setData({
            title: newPage.title,
            meta_description: newPage.meta_description,
            heading: newPage.heading,
            summary: newPage.summary,
            spotify_track_id: newPage.spotify_track_id ?? null,
            closest_matches: (newPage.closest_matches as any[]) || [],
            same_energy: (newPage.same_energy as any[]) || [],
            related_artists: (newPage.related_artists as any[]) || [],
            why_these_work: (newPage.why_these_work as any[]) || [],
            related_songs: (newPage.related_songs as any[]) || [],
            related_vibes: (newPage.related_vibes as any[]) || [],
            related_artist_links: (newPage.related_artist_links as any[]) || [],
          });
        } else {
          setError("This page is still generating. Please refresh in a moment.");
        }
      } catch (e) {
        console.error("Error generating page:", e);
        setError("Failed to generate page content. Please try again.");
      }

      setLoading(false);
      setGenerating(false);
    };

    fetchPage();
  }, [slug, pageType]);

  return { data, loading, generating, error };
}
