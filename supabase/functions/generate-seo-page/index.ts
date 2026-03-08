import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { slug, page_type } = await req.json();
    if (!slug || !page_type) {
      return new Response(JSON.stringify({ error: "slug and page_type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if page already exists
    const { data: existing } = await supabase
      .from("seo_pages")
      .select("id")
      .eq("slug", slug)
      .eq("page_type", page_type)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ status: "exists" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const displayName = slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

    const typeLabels: Record<string, string> = {
      song: "song",
      artist: "artist",
      vibe: "vibe/mood",
    };

    const prompt = `You are a music discovery engine.

User query: ${displayName}
Search type: ${typeLabels[page_type] || page_type}

Return ONLY JSON:
{
  "title": "",
  "description": "",
  "heading": "",
  "summary": "",
  "closestMatches": [
    {"title": "", "artist": "", "year": 2000}
  ],
  "sameEnergy": [
    {"title": "", "artist": "", "year": 2000}
  ],
  "relatedArtists": ["", "", ""],
  "whyTheseWork": "",
  "relatedSongs": [{"name": "", "slug": ""}],
  "relatedVibes": [{"name": "", "slug": ""}],
  "relatedArtistLinks": [{"name": "", "slug": ""}]
}

Rules:
closestMatches = exactly 5 songs
sameEnergy = exactly 5 songs
relatedArtists = exactly 3 artists
relatedSongs = 4 related songs with slugs (lowercase-hyphenated)
relatedVibes = 3 related vibes with slugs
relatedArtistLinks = 3 related artists with slugs
title = SEO page title (under 60 chars)
description = SEO meta description (under 160 chars)
Use REAL music data - real artist names, real song names, real genres.
Return JSON only. No markdown, no code fences.`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 2048,
        system: "You are a music discovery engine. Return only valid JSON, no markdown, no code fences.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await aiResponse.text();
      throw new Error(`Claude API error [${status}]: ${body}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.content?.[0]?.text;
    if (!rawContent) throw new Error("No AI response content");

    let content;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      content = JSON.parse(cleaned);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    // Map camelCase AI response to snake_case DB columns
    const closestMatches = (content.closestMatches || []).map((m: any) => ({
      title: m.title,
      subtitle: `${m.artist} (${m.year})`,
    }));

    const sameEnergy = (content.sameEnergy || []).map((m: any) => ({
      title: m.title,
      subtitle: `${m.artist} (${m.year})`,
    }));

    const relatedArtists = (content.relatedArtists || []).map((a: string) => ({
      title: a,
      subtitle: "Artist",
    }));

    const whyTheseWork = content.whyTheseWork
      ? [{ title: "Why These Work", subtitle: content.whyTheseWork }]
      : [];

    const { error: insertError } = await supabase.from("seo_pages").insert({
      slug,
      page_type,
      title: content.title,
      meta_description: content.description,
      heading: content.heading,
      summary: content.summary,
      closest_matches: closestMatches,
      same_energy: sameEnergy,
      related_artists: relatedArtists,
      why_these_work: whyTheseWork,
      related_songs: content.relatedSongs || [],
      related_vibes: content.relatedVibes || [],
      related_artist_links: content.relatedArtistLinks || [],
    });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ status: "created" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-seo-page error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
