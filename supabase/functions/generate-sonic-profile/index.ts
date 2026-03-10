import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// generate-sonic-profile
//
// Creates a structured Sonic DNA profile for a song using Claude.
// Cache-first: returns existing profile if found, generates only if missing.
//
// POST body:
//   { spotify_track_id, song_title, artist_name }
//
// Returns:
//   { profile, source: "cache" | "generated" }
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// The full descriptor vocabulary Claude must choose from.
// This is embedded in the prompt to prevent hallucination.
const DESCRIPTOR_VOCABULARY = {
  tempo_feel: ["slow-burn","laid-back","midtempo","driving","urgent","propulsive","floating","steady"],
  groove: ["straight","swung","syncopated","shuffling","pulsing","hypnotic","bouncy","stuttering","gliding","marching","rolling","locked-in"],
  drum_character: ["crisp","dusty","punchy","clipped","roomy","electronic","live-kit","808-heavy","breakbeat-driven","clap-forward","gated","skeletal"],
  bass_character: ["sub-heavy","melodic-bass","rubbery","droning","warm-bass","distorted","restrained","funky","syrupy","synth-bass"],
  harmonic_color: ["minor-key","major-key","jazzy","lush","suspended","gospel-rich","melancholic","bright","cinematic","static-vamp","nostalgic"],
  melodic_character: ["chant-like","airy","conversational","hook-forward","leap-heavy","repetitive","silky","angular","anthemic","intimate"],
  vocal_character: ["breathy","commanding","restrained-vocal","falsetto-led","layered","talk-sung","rhythmic","emotionally-direct","cool-toned","raw","yearning"],
  texture: ["glossy","grainy","neon","analog","lo-fi","polished","hazy","saturated","sparse","lush-texture","metallic","warm"],
  arrangement_energy_arc: ["immediate-impact","slow-build","sustained-drive","explosive-chorus","hypnotic-loop","late-night-cruise","euphoric-lift","tension-release","simmering","full-bloom"],
  emotional_tone: ["wistful","triumphant","lonely","seductive","swaggering","devotional","restless","playful","cold","glamorous","tender","nocturnal","euphoric"],
  era_lineage: ["blog-era-rap","80s-revival","90s-r-and-b","y2k-club","neo-soul","indie-sleaze","trap-soul","synth-pop","quiet-storm","electro-pop"],
  environment_imagery: ["night-drive","club-floor","headphones-alone","rooftop-city","summer-daylight","rainy-street","after-hours","house-party"],
  listener_use_case: ["pregame","late-night-walk","dancefloor","windows-down","flirtation","reflective-commute"],
};

const INTENSITY_LEVELS = ["very-low","low","medium-low","medium","medium-high","high","very-high"];
const DANCEABILITY_FEELS = ["not-danceable","minimal","moderate","danceable","highly-danceable","made-for-dancefloor"];

function buildSystemPrompt(): string {
  return `You are a music analyst with the precision of a record producer and the language of a music critic.

Your job is to analyze songs and return a structured Sonic DNA profile.

STRICT RULES:
1. Only use descriptor slugs from the vocabulary provided. Never invent new slugs.
2. Each category must use 1–4 slugs from that category's list.
3. You may NOT invent factual information: no samples, no production credits, no release dates.
4. You ARE allowed to interpret sonic characteristics based on the song's known sound.
5. Return ONLY valid JSON. No preamble, no explanation, no markdown backticks.
6. intensity_level must be one of: ${INTENSITY_LEVELS.join(", ")}
7. danceability_feel must be one of: ${DANCEABILITY_FEELS.join(", ")}

VOCABULARY:
${JSON.stringify(DESCRIPTOR_VOCABULARY, null, 2)}

OUTPUT FORMAT (return exactly this structure, no extra fields):
{
  "tempo_feel": ["slug1"],
  "groove": ["slug1", "slug2"],
  "drum_character": ["slug1", "slug2"],
  "bass_character": ["slug1"],
  "harmonic_color": ["slug1", "slug2"],
  "melodic_character": ["slug1"],
  "vocal_character": ["slug1", "slug2"],
  "texture": ["slug1", "slug2"],
  "arrangement_energy_arc": ["slug1", "slug2"],
  "emotional_tone": ["slug1", "slug2"],
  "era_lineage": ["slug1"],
  "environment_imagery": ["slug1", "slug2"],
  "listener_use_case": ["slug1"],
  "intensity_level": "medium",
  "danceability_feel": "danceable",
  "confidence_score": 0.85
}

confidence_score reflects how confident you are that this analysis is accurate (0.0–1.0).
Use lower confidence for obscure, genre-defying, or instrumental works where you have less certainty.`;
}

function buildUserPrompt(title: string, artist: string): string {
  return `Analyze the sonic DNA of "${title}" by ${artist}.

Focus on:
- The actual rhythmic feel and groove
- Drum sound character (live or programmed, what era/style)
- Bass presence and movement
- Harmonic language and chord quality
- Melodic approach and vocal delivery
- Production texture (how it sounds, not just genre)
- Emotional register and atmosphere
- What environment or activity this music fits

Write your analysis as a producer or critic would think about the track's sonic fingerprint.
Return only the JSON profile.`;
}

function extractDescriptorSlugs(profile: Record<string, any>): string[] {
  const slugs: string[] = [];
  const arrayFields = [
    "tempo_feel","groove","drum_character","bass_character","harmonic_color",
    "melodic_character","vocal_character","texture","arrangement_energy_arc",
    "emotional_tone","era_lineage","environment_imagery","listener_use_case",
  ];
  for (const field of arrayFields) {
    if (Array.isArray(profile[field])) {
      slugs.push(...profile[field]);
    }
  }
  return [...new Set(slugs)]; // dedupe
}

function validateProfile(profile: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const arrayFields = Object.keys(DESCRIPTOR_VOCABULARY) as Array<keyof typeof DESCRIPTOR_VOCABULARY>;
  for (const field of arrayFields) {
    if (!Array.isArray(profile[field])) {
      errors.push(`Missing or non-array field: ${field}`);
      continue;
    }
    const allowed = DESCRIPTOR_VOCABULARY[field];
    for (const slug of profile[field]) {
      if (!allowed.includes(slug)) {
        errors.push(`Invalid slug "${slug}" in ${field}`);
      }
    }
  }

  if (!INTENSITY_LEVELS.includes(profile.intensity_level)) {
    errors.push(`Invalid intensity_level: ${profile.intensity_level}`);
  }
  if (!DANCEABILITY_FEELS.includes(profile.danceability_feel)) {
    errors.push(`Invalid danceability_feel: ${profile.danceability_feel}`);
  }
  if (typeof profile.confidence_score !== "number" ||
      profile.confidence_score < 0 || profile.confidence_score > 1) {
    errors.push(`Invalid confidence_score: ${profile.confidence_score}`);
  }

  return { valid: errors.length === 0, errors };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { spotify_track_id, song_title, artist_name } = await req.json();

    if (!spotify_track_id || !song_title || !artist_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: spotify_track_id, song_title, artist_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase    = createClient(supabaseUrl, supabaseKey);

    // ── Cache check ───────────────────────────────────────────────────────────
    const { data: existing } = await supabase
      .from("song_sonic_profiles")
      .select("*")
      .eq("spotify_track_id", spotify_track_id)
      .single();

    if (existing) {
      console.log(`[sonic-profile] Cache HIT: ${song_title} by ${artist_name}`);
      return new Response(
        JSON.stringify({ profile: existing.profile_json, source: "cache", id: existing.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Generate via Claude ───────────────────────────────────────────────────
    console.log(`[sonic-profile] Generating for: "${song_title}" by ${artist_name}`);

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system:     buildSystemPrompt(),
        messages:   [{ role: "user", content: buildUserPrompt(song_title, artist_name) }],
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      throw new Error(`Claude API error: ${aiRes.status} — ${err.slice(0, 200)}`);
    }

    const aiData = await aiRes.json();
    const rawText = aiData.content?.[0]?.text || "";

    // Strip markdown fences if present
    const jsonText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

    let profile: Record<string, any>;
    try {
      profile = JSON.parse(jsonText);
    } catch {
      throw new Error(`Failed to parse Claude JSON response: ${jsonText.slice(0, 300)}`);
    }

    // Validate against vocabulary
    const { valid, errors } = validateProfile(profile);
    if (!valid) {
      console.warn(`[sonic-profile] Validation warnings for "${song_title}":`, errors);
      // Don't throw — still cache what we got, just log the issues
    }

    const confidenceScore = typeof profile.confidence_score === "number"
      ? Math.min(Math.max(profile.confidence_score, 0), 1)
      : 0.75;

    const descriptorSlugs = extractDescriptorSlugs(profile);

    // ── Write to cache ────────────────────────────────────────────────────────
    const { data: inserted, error: insertError } = await supabase
      .from("song_sonic_profiles")
      .upsert({
        spotify_track_id,
        song_title,
        artist_name,
        profile_json:     profile,
        confidence_score: confidenceScore,
        descriptor_slugs: descriptorSlugs,
      }, { onConflict: "spotify_track_id" })
      .select()
      .single();

    if (insertError) {
      console.error("[sonic-profile] Cache write error:", insertError.message);
      // Still return the profile even if we couldn't cache it
    }

    console.log(`[sonic-profile] Generated and cached "${song_title}" (confidence=${confidenceScore}, descriptors=${descriptorSlugs.length})`);

    return new Response(
      JSON.stringify({ profile, source: "generated", id: inserted?.id || null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("[sonic-profile] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
