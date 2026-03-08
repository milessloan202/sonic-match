import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory rate limiter: max 6 AI generations per minute
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 6;
const generationTimestamps: number[] = [];

function isPerMinuteLimited(): boolean {
  const now = Date.now();
  while (generationTimestamps.length > 0 && generationTimestamps[0] <= now - RATE_LIMIT_WINDOW_MS) {
    generationTimestamps.shift();
  }
  return generationTimestamps.length >= RATE_LIMIT_MAX;
}

function recordGeneration(): void {
  generationTimestamps.push(Date.now());
}

// Daily limit: 500 new pages per day (DB-backed, survives cold starts)
const DAILY_LIMIT = 500;

async function isDailyLimited(supabase: any): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("seo_pages")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString());
  return (count ?? 0) >= DAILY_LIMIT;
}

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

    // Rate limit only applies to new AI generations
    if (isRateLimited()) {
      return new Response(
        JSON.stringify({ error: "Page generation is temporarily busy, please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    recordGeneration();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const displayName = slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

    const songPrompt = `You are an expert music curator with deep knowledge of production techniques, sonic textures, harmonic language, and emotional resonance.

User is looking for songs similar to: "${displayName}"

Your task: recommend songs that share GENUINE MUSICAL DNA with the query — not just the same genre or era. Consider:
- **Production style**: recording techniques, mix aesthetics (lo-fi, polished, layered, sparse)
- **Instrumentation & arrangement**: specific instrument choices, how they interact, textural palette
- **Harmonic & melodic language**: chord progressions, key choices, melodic contour, vocal style
- **Rhythmic feel & groove**: tempo, swing, syncopation, drum patterns
- **Emotional arc**: tension/release, dynamics, mood progression through the song
- **Sonic lineage**: what musical tradition or movement this song belongs to

closestMatches: 5 songs that a fan would immediately recognize as sonically kindred — they scratch the same itch. Prioritize deep cuts and unexpected connections over obvious same-artist picks.

sameEnergy: 5 songs that share the emotional frequency and atmosphere but may come from different genres or eras. These should feel like surprising-but-perfect pairings.

relatedArtists: 3 artists whose overall catalog overlaps most with the sonic world of this song.

whyTheseWork: 2-3 sentences explaining the specific sonic thread connecting these recommendations (reference production, instrumentation, or harmonic qualities — not just "similar vibes").

summary: A 2-3 sentence description of the song's musical character — what makes it sonically distinctive and what kind of listener it appeals to.`;

    const artistPrompt = `You are an expert music curator with deep knowledge of artist discographies, production evolution, and musical lineages.

User is looking for artists similar to: "${displayName}"

Your task: recommend artists who share genuine musical DNA — not just genre labels. Consider:
- **Sonic palette**: characteristic production choices, timbral signatures
- **Songwriting approach**: lyrical themes, structural tendencies, harmonic vocabulary
- **Vocal/performance style**: delivery, range usage, emotive qualities
- **Artistic trajectory**: how their sound has evolved, which era is most relevant
- **Cultural/scene connections**: shared movements, influences, collaborators

closestMatches: 5 representative tracks BY the queried artist that best showcase their range and appeal. Pick tracks that reveal different facets — not just the biggest hits.

sameEnergy: 5 tracks by OTHER artists that fans of ${displayName} would love. Prioritize artists who share specific sonic qualities over generic genre matches. Include at least 2 picks that would be genuinely surprising discoveries.

relatedArtists: 3 artists whose catalogs most overlap sonically. Avoid the most obvious/mainstream connections — go one level deeper.

whyTheseWork: 2-3 sentences explaining what specific musical qualities connect ${displayName} to these recommendations (production approach, harmonic language, thematic territory).

summary: A 2-3 sentence description of ${displayName}'s sonic identity — what makes them distinctive and where they sit in the musical landscape.`;

    const vibePrompt = `You are an expert music curator who understands that "vibes" are specific sonic atmospheres, not genre labels.

User is searching for music that matches: "${displayName}"

Interpret this as a complete sensory/emotional atmosphere. Consider:
- **Sonic environment**: What does this space sound like? (reverb-drenched, intimate/dry, cavernous, warm analog, digital shimmer)
- **Temporal quality**: Time of day, season, pace of life this evokes
- **Emotional texture**: Not just "happy/sad" — the specific shade (wistful nostalgia vs. aching loss, nervous excitement vs. euphoric abandon)
- **Physical sensation**: Temperature, movement, light quality this music suggests
- **Production aesthetic**: Lo-fi warmth, crisp modern production, vintage recording, bedroom intimacy

closestMatches: 5 songs that ARE this vibe — the definitive soundtrack. These should feel inevitable, not generic. Avoid the most overplayed choices; find the songs that truly embody the atmosphere.

sameEnergy: 5 songs that approach this same emotional space from unexpected angles — different genres or eras but the same atmospheric truth.

relatedArtists: 3 artists whose catalogs consistently live in or near this sonic world.

whyTheseWork: 2-3 sentences describing the specific sonic qualities that create this vibe (instrumentation, production techniques, tempo, harmonic mood — be concrete).

summary: A 2-3 sentence evocation of this vibe as a musical atmosphere — what it sounds like, feels like, and when you'd reach for it.`;

    const promptByType: Record<string, string> = {
      song: songPrompt,
      artist: artistPrompt,
      vibe: vibePrompt,
    };

    const basePrompt = promptByType[page_type] || songPrompt;

    const prompt = `${basePrompt}

Return ONLY this JSON structure:
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
closestMatches = exactly 5 songs (real tracks, real years)
sameEnergy = exactly 5 songs (real tracks, real years)
relatedArtists = exactly 3 artists
relatedSongs = 4 related songs with slugs (lowercase-hyphenated)
relatedVibes = 3 related vibes with slugs (lowercase-hyphenated, descriptive phrases)
relatedArtistLinks = 3 related artists with slugs
title = SEO page title (under 60 chars)
description = SEO meta description (under 160 chars)
heading = page heading that feels natural, not keyword-stuffed
ALL music data must be REAL — real artist names, real song titles, real release years. Never fabricate tracks.
Return JSON only. No markdown, no code fences.`;

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
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
