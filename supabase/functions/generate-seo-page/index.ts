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
    const { slug, page_type, deep_cut_mode } = await req.json();
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

    // Rate limits only apply to new AI generations
    if (isPerMinuteLimited()) {
      return new Response(
        JSON.stringify({ error: "Page generation is temporarily busy, please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (await isDailyLimited(supabase)) {
      return new Response(
        JSON.stringify({ error: "Daily page generation limit reached (500/day). Please try again tomorrow." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    recordGeneration();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const displayName = slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

    const songPrompt = `You are a world-class music curator — part crate-digger, part musicologist, part the best record store clerk alive. You think in terms of sonic DNA: production fingerprints, harmonic choices, rhythmic feel, and emotional architecture.

User is looking for songs similar to: "${displayName}"

Your mission: find songs that live in the SAME MUSICAL UNIVERSE. Not the same Spotify playlist — the same sonic bloodline.

Evaluate candidates through these lenses (in priority order):
1. **Production style & recording aesthetic**: mix approach (lo-fi/hi-fi, wet/dry, analog warmth/digital precision), spatial qualities, how the track "breathes"
2. **Instrumentation & textural palette**: specific synth choices, guitar tones, drum machine vs. live kit, bass character, layering approach
3. **Groove & rhythmic DNA**: tempo, swing factor, syncopation patterns, how the rhythm section locks together
4. **Harmonic & melodic language**: chord voicings, key choices, melodic contour, resolution tendencies
5. **Emotional arc & dynamics**: tension/release patterns, loudness contour, the emotional journey within the track
6. **Genre lineage & cultural context**: what movement or tradition birthed this sound, who influenced whom

CRITICAL RULES:
- Do NOT stack multiple tracks by the same artist. Maximum 1 per artist across all lists.
- Do NOT default to an artist's biggest hits unless they are genuinely the strongest sonic match.
- Include at least 2 picks per list that would surprise a casual listener but make a music nerd nod in recognition.
- Cross-genre connections are encouraged when the sonic thread is real (e.g., a post-punk track and an R&B track can share the same bass-driven tension).
- Every recommendation must pass the "record store clerk test": would a knowledgeable human actually suggest this pairing?

closestMatches: 5 songs that scratch the exact same sonic itch — a listener who loves the query track would hear these and think "yes, this is my frequency." Prioritize unexpected but undeniable connections over obvious genre neighbors.

sameEnergy: 5 songs that share the emotional and atmospheric DNA but arrive from different sonic territories — different decades, different genres, but the same underlying musical truth. These should feel like genuinely surprising discoveries.

relatedArtists: 3 artists whose broader catalog overlaps most with the sonic world of this specific track. Go one level deeper than the obvious choices.

whyTheseWork: 2-3 sentences explaining the SPECIFIC sonic thread connecting these recommendations. Reference concrete musical details: name the synth texture, the drum pattern, the harmonic movement, the production technique. Never use phrases like "similar vibe," "same feel," "fans of X will enjoy," or "same energy." Write like a music journalist who respects the reader's intelligence.

summary: A 2-3 sentence description of what makes this track sonically distinctive — its production fingerprint, its emotional architecture, and the specific type of listener it rewards.`;

    const artistPrompt = `You are a world-class music curator — part crate-digger, part musicologist, part the best record store clerk alive. You think in terms of artistic DNA: how an artist's sonic identity, production choices, and creative evolution connect them to the broader musical landscape.

User is looking for artists similar to: "${displayName}"

Your mission: map the musical universe surrounding this artist. Not "related artists" from a streaming algorithm — genuine sonic and artistic kinship.

Evaluate candidates through these lenses:
1. **Sonic signature**: characteristic production choices, timbral fingerprints, mixing approach
2. **Songwriting architecture**: structural tendencies, harmonic vocabulary, lyrical territory
3. **Vocal/performance identity**: delivery style, range usage, how voice functions in the mix
4. **Artistic evolution**: which era of the artist is most relevant, how their sound has migrated
5. **Scene & lineage**: shared musical movements, influence chains, collaborator networks

CRITICAL RULES:
- For closestMatches (tracks BY the queried artist): do NOT just list their 5 biggest hits. Choose tracks that reveal different dimensions of their artistry — deep cuts, pivotal album tracks, overlooked gems alongside signature moments.
- For sameEnergy (tracks by OTHER artists): maximum 1 track per artist. At least 2 should be genuinely surprising discoveries that reveal non-obvious connections.
- For relatedArtists: go one level deeper than the streaming algorithm's top suggestions. Find artists who share specific sonic qualities, not just genre labels.

closestMatches: 5 tracks BY ${displayName} that best map their sonic range. Include at least 2 non-singles or deeper cuts that reveal facets casual fans might miss.

sameEnergy: 5 tracks by OTHER artists that ${displayName} fans would love. Prioritize picks that illuminate unexpected connections — the shared bass tone, the parallel harmonic approach, the same spatial production quality.

relatedArtists: 3 artists with genuine sonic kinship. Avoid the most obvious first-result connections.

whyTheseWork: 2-3 sentences explaining what SPECIFIC musical qualities connect ${displayName} to these recommendations. Name the production techniques, harmonic tendencies, rhythmic approaches, or vocal qualities. Never use "similar vibe" or "same energy."

summary: A 2-3 sentence description of ${displayName}'s sonic identity — their production fingerprint, where they sit in the musical landscape, and what distinguishes them from their closest peers.`;

    const vibePrompt = `You are a world-class music curator who understands that a "vibe" is a precise sonic atmosphere — a complete sensory environment encoded in sound.

User is searching for music that matches: "${displayName}"

Your mission: curate the definitive sonic palette for this atmosphere. Not a generic mood playlist — a carefully selected set of tracks that ARE this feeling in its most potent form.

Decode this vibe through these dimensions:
1. **Sonic environment**: reverb character, spatial depth, frequency balance, analog warmth vs. digital clarity
2. **Temporal & physical quality**: time of day, season, temperature, movement, light quality
3. **Emotional granularity**: not just happy/sad — the specific emotional shade (wistful nostalgia vs. aching loss, nervous excitement vs. euphoric release, contemplative stillness vs. peaceful acceptance)
4. **Production aesthetic**: lo-fi tape hiss, bedroom intimacy, studio polish, vintage recording, modern minimalism
5. **Rhythmic feel**: pace, pulse, whether it breathes or drives

CRITICAL RULES:
- Maximum 1 track per artist across all lists.
- Do NOT pick the most overplayed tracks associated with this mood. Find the songs that truly embody the atmosphere, not the ones that show up on every mood playlist.
- Include tracks from at least 3 different decades across your recommendations.
- At least 2 picks per list should be genuine discoveries — tracks most listeners haven't heard but that perfectly crystallize this atmosphere.

closestMatches: 5 songs that ARE this vibe in its purest form — the definitive soundtrack. These should feel inevitable and essential, not generic or predictable.

sameEnergy: 5 songs that access the same emotional space from unexpected sonic angles — different genres, different eras, but the same atmospheric truth. These are the "oh, I never would have thought of that but it's perfect" picks.

relatedArtists: 3 artists whose catalogs consistently inhabit or orbit this sonic world.

whyTheseWork: 2-3 sentences describing the SPECIFIC sonic qualities that create this atmosphere — instrumentation, production techniques, tempo, harmonic mood, textural choices. Be concrete and musically literate.

summary: A 2-3 sentence evocation of this vibe as a musical atmosphere — what it sounds like, what it feels like physically, and the precise moment you'd reach for it.`;

    const promptByType: Record<string, string> = {
      song: songPrompt,
      artist: artistPrompt,
      vibe: vibePrompt,
    };

    let basePrompt = promptByType[page_type] || songPrompt;

    if (deep_cut_mode) {
      basePrompt += `

DEEP CUT MODE — CRITICAL INSTRUCTIONS:
You are now in crate-digger mode. Act like an obsessive vinyl collector who lives in record shops.

PRIORITIZE:
- Deep album cuts, B-sides, and overlooked tracks
- Underground, independent, or cult-favorite artists
- Influential but underplayed tracks that shaped genres
- Songs from lesser-known albums by well-known artists
- Cross-genre discoveries that share genuine sonic DNA
- Tracks with fewer than 50M streams that deserve more attention

AVOID:
- The artist's biggest mainstream hits (no "#1 singles" energy)
- Tracks that appear on every "similar songs" playlist
- The most obvious genre associations
- Extremely well-known songs unless they are historically important deep influences

Your recommendations should make a music nerd say "oh wow, great pull" — not "yeah, obviously."`;
    }

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
closestMatches = exactly 5 songs (real tracks, real years). MAX 1 TRACK PER ARTIST across closestMatches and sameEnergy combined.
sameEnergy = exactly 5 songs (real tracks, real years). Must include tracks from at least 3 different decades.
relatedArtists = exactly 3 artists (avoid the single most obvious choice — go one level deeper)
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
        system: "You are a world-class music discovery engine with encyclopedic knowledge of production techniques, genre lineages, and sonic connections across decades. You think like a legendary record store clerk, not a streaming algorithm. Return only valid JSON, no markdown, no code fences.\n\nCRITICAL ACCURACY RULES:\n- Every track you recommend MUST be a REAL song by a REAL artist that was commercially released and is likely to appear in major music catalogs (Spotify, Apple Music, etc.).\n- Only recommend songs and artists you are reasonably confident are real and commercially released. If uncertain, do NOT guess — choose a different recommendation that you ARE confident about.\n- Do NOT invent plausible-sounding song titles, alternate versions, unreleased recordings, or fictional deep cuts.\n- Prefer a correct, somewhat more familiar song over an obscure track you are unsure about. Deep cuts are welcome ONLY when your confidence is high.\n- Never duplicate artists across recommendation lists.\n- If you cannot think of enough high-confidence obscure picks, widen your pool and choose real, musically relevant tracks instead of forcing rarity at the expense of accuracy.\n- Prioritize musical DNA over popularity, but NEVER prioritize obscurity over accuracy.",
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

    const { error: insertError } = await supabase.from("seo_pages").upsert({
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
