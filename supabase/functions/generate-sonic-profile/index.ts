// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// generate-sonic-profile
//
// Creates a structured Sonic DNA profile for a song using Claude.
// Cache-first: returns existing profile if found, generates only if missing.
// v2: adds conflict resolution + canonical_descriptors payload.
//
// POST body:
//   { spotify_track_id, song_title, artist_name }
//
// Returns:
//   { profile, canonical_descriptors, source: "cache" | "generated" }
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

// Categories included in canonical display_descriptors
const CANONICAL_CATEGORIES = new Set([
  "tempo_feel", "texture", "emotional_tone", "era_lineage",
  "environment_imagery", "listener_use_case", "groove", "harmonic_color", "vocal_character",
]);

// ── Types ─────────────────────────────────────────────────────────────────────

interface RegistryRow {
  slug: string;
  label: string;
  category: string;
  is_clickable: boolean;
  conflicts_with: string[];
}

interface CanonicalDescriptor {
  slug: string;
  label: string;
  category: string;
  is_clickable: boolean;
  search_url: string;
  dna_url: string;
}

interface CanonicalDescriptorPayload {
  display_descriptors: CanonicalDescriptor[];
  descriptor_search_url: string;
  all_slugs: string[];
}

// ── Conflict resolution ───────────────────────────────────────────────────────

function resolveConflicts(
  profile: Record<string, unknown>,
  registry: Map<string, RegistryRow>,
): string[] {
  const arrayFields = [
    "tempo_feel","groove","drum_character","bass_character","harmonic_color",
    "melodic_character","vocal_character","texture","arrangement_energy_arc",
    "emotional_tone","era_lineage","environment_imagery","listener_use_case",
  ];

  const allSlugs: string[] = [];
  for (const field of arrayFields) {
    const val = profile[field];
    if (Array.isArray(val)) allSlugs.push(...val);
  }

  const accepted: string[] = [];
  const blocked = new Set<string>();

  for (const slug of allSlugs) {
    if (blocked.has(slug)) continue;
    accepted.push(slug);
    const meta = registry.get(slug);
    for (const conflict of (meta?.conflicts_with ?? [])) {
      blocked.add(conflict);
    }
  }

  return accepted;
}

// ── Canonical descriptor builder ──────────────────────────────────────────────

function buildCanonicalDescriptors(
  resolvedSlugs: string[],
  registry: Map<string, RegistryRow>,
): CanonicalDescriptorPayload {
  const display_descriptors: CanonicalDescriptor[] = resolvedSlugs
    .filter((slug) => {
      const meta = registry.get(slug);
      return meta && CANONICAL_CATEGORIES.has(meta.category);
    })
    .map((slug) => {
      const meta = registry.get(slug)!;
      return {
        slug,
        label: meta.label,
        category: meta.category,
        is_clickable: meta.is_clickable,
        search_url: `/search?descriptors=${slug}`,
        dna_url: `/dna/${slug}`,
      };
    });

  const slugList = display_descriptors.map((d) => d.slug).join(",");

  return {
    display_descriptors,
    descriptor_search_url: slugList ? `/search?descriptors=${slugList}` : "/search",
    all_slugs: resolvedSlugs,
  };
}

// ── Load registry ─────────────────────────────────────────────────────────────

async function loadRegistry(supabase: ReturnType<typeof createClient>): Promise<Map<string, RegistryRow>> {
  const { data } = await supabase
    .from("descriptor_registry")
    .select("slug, label, category, is_clickable, conflicts_with");
  return new Map((data || []).map((r: RegistryRow) => [r.slug, r]));
}

// ── Claude prompts ────────────────────────────────────────────────────────────

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

function extractDescriptorSlugs(profile: Record<string, unknown>): string[] {
  const slugs: string[] = [];
  const arrayFields = [
    "tempo_feel","groove","drum_character","bass_character","harmonic_color",
    "melodic_character","vocal_character","texture","arrangement_energy_arc",
    "emotional_tone","era_lineage","environment_imagery","listener_use_case",
  ];
  for (const field of arrayFields) {
    const val = profile[field];
    if (Array.isArray(val)) slugs.push(...val);
  }
  return [...new Set(slugs)];
}

function validateProfile(profile: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const arrayFields = Object.keys(DESCRIPTOR_VOCABULARY) as Array<keyof typeof DESCRIPTOR_VOCABULARY>;
  for (const field of arrayFields) {
    const val = profile[field];
    if (!Array.isArray(val)) {
      errors.push(`Missing or non-array field: ${field}`);
      continue;
    }
    const allowed = DESCRIPTOR_VOCABULARY[field];
    for (const slug of val as string[]) {
      if (!allowed.includes(slug)) errors.push(`Invalid slug "${slug}" in ${field}`);
    }
  }
  if (!INTENSITY_LEVELS.includes(profile.intensity_level as string)) {
    errors.push(`Invalid intensity_level: ${profile.intensity_level}`);
  }
  if (!DANCEABILITY_FEELS.includes(profile.danceability_feel as string)) {
    errors.push(`Invalid danceability_feel: ${profile.danceability_feel}`);
  }
  if (
    typeof profile.confidence_score !== "number" ||
    (profile.confidence_score as number) < 0 ||
    (profile.confidence_score as number) > 1
  ) {
    errors.push(`Invalid confidence_score: ${profile.confidence_score}`);
  }
  return { valid: errors.length === 0, errors };
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { spotify_track_id, song_title, artist_name } = await req.json();

    if (!spotify_track_id || !song_title || !artist_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: spotify_track_id, song_title, artist_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Cache check ───────────────────────────────────────────────────────────
    const { data: existing } = await supabase
      .from("song_sonic_profiles")
      .select("*")
      .eq("spotify_track_id", spotify_track_id)
      .single();

    if (existing) {
      // v2 cache: canonical_descriptors already present — return immediately
      if (existing.profile_json?.canonical_descriptors) {
        console.log(`[sonic-profile] Cache HIT (v2): ${song_title} by ${artist_name}`);
        return new Response(
          JSON.stringify({
            profile: existing.profile_json,
            canonical_descriptors: existing.profile_json.canonical_descriptors,
            source: "cache",
            id: existing.id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // v1 cache: upgrade in place by adding canonical_descriptors
      console.log(`[sonic-profile] Upgrading v1 cache: ${song_title} by ${artist_name}`);
      const registry = await loadRegistry(supabase);
      const resolvedSlugs = resolveConflicts(existing.profile_json, registry);
      const canonical = buildCanonicalDescriptors(resolvedSlugs, registry);
      const upgradedProfile = { ...existing.profile_json, canonical_descriptors: canonical };

      await supabase
        .from("song_sonic_profiles")
        .update({ profile_json: upgradedProfile })
        .eq("id", existing.id);

      return new Response(
        JSON.stringify({
          profile: upgradedProfile,
          canonical_descriptors: canonical,
          source: "cache",
          id: existing.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Generate via Claude ───────────────────────────────────────────────────
    console.log(`[sonic-profile] Generating: "${song_title}" by ${artist_name}`);

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
    const rawText = (aiData.content?.[0]?.text as string) || "";
    const jsonText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

    let profile: Record<string, unknown>;
    try {
      profile = JSON.parse(jsonText);
    } catch {
      throw new Error(`Failed to parse Claude JSON response: ${jsonText.slice(0, 300)}`);
    }

    const { valid, errors } = validateProfile(profile);
    if (!valid) {
      console.warn(`[sonic-profile] Validation warnings for "${song_title}":`, errors);
    }

    const confidenceScore = typeof profile.confidence_score === "number"
      ? Math.min(Math.max(profile.confidence_score as number, 0), 1)
      : 0.75;

    const descriptorSlugs = extractDescriptorSlugs(profile);

    // ── Conflict resolution + canonical ──────────────────────────────────────
    const registry = await loadRegistry(supabase);
    const resolvedSlugs = resolveConflicts(profile, registry);
    const canonical = buildCanonicalDescriptors(resolvedSlugs, registry);
    const enrichedProfile = { ...profile, canonical_descriptors: canonical };

    // ── Write to cache ────────────────────────────────────────────────────────
    const { data: inserted, error: insertError } = await supabase
      .from("song_sonic_profiles")
      .upsert({
        spotify_track_id,
        song_title,
        artist_name,
        profile_json:     enrichedProfile,
        confidence_score: confidenceScore,
        descriptor_slugs: descriptorSlugs,
      }, { onConflict: "spotify_track_id" })
      .select()
      .single();

    if (insertError) {
      console.error("[sonic-profile] Cache write error:", insertError.message);
    }

    console.log(
      `[sonic-profile] Generated "${song_title}" (confidence=${confidenceScore}, descriptors=${descriptorSlugs.length}, canonical=${canonical.display_descriptors.length})`,
    );

    return new Response(
      JSON.stringify({
        profile: enrichedProfile,
        canonical_descriptors: canonical,
        source: "generated",
        id: inserted?.id || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[sonic-profile] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
