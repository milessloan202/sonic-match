import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// compare-songs
//
// Generates a MatchDNA comparison between two songs.
// Requires both songs to have sonic profiles already generated.
// Cache-first: returns existing comparison if found.
//
// POST body:
//   { song_a_id, song_b_id }
//   (song_a_id and song_b_id are spotify_track_ids)
//
// Returns:
//   { comparison, source: "cache" | "generated" }
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Ensure consistent ordering so (a,b) and (b,a) map to same cache entry
function orderIds(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}

function buildCompareSystemPrompt(): string {
  return `You are a music critic and producer analyzing the sonic relationship between two songs.

Your job is to explain WHY two songs feel similar and how they differ, using precise musical language.

STRICT RULES:
1. Never mention song titles in the JSON values — only in the labels.
2. Describe concrete sonic elements: rhythm, texture, harmony, vocals, production.
3. Avoid vague phrases: "same vibe", "similar energy", "feels alike" — always explain WHY.
4. shared_traits: 3 specific phrases describing what the songs share musically.
5. differences: 1–2 phrases describing key sonic differences.
6. short_reason: exactly 1 sentence (max 20 words) for use in compact UI cards.
7. long_reason: 2–3 sentences for the full MatchDNA module. Write like a music critic.
8. match_strength: 0.0–1.0. Be honest — not every recommendation is a perfect match.
9. Return ONLY valid JSON. No preamble, no markdown backticks.

OUTPUT FORMAT:
{
  "shared_traits": ["phrase 1", "phrase 2", "phrase 3"],
  "differences": ["phrase 1"],
  "match_strength": 0.82,
  "short_reason": "One sentence explaining the match.",
  "long_reason": "Two to three sentences of music critic prose explaining the sonic relationship in detail."
}`;
}

function buildCompareUserPrompt(
  titleA: string, artistA: string, profileA: any,
  titleB: string, artistB: string, profileB: any,
): string {
  return `Compare the sonic DNA of these two songs and explain why they are musically similar.

SONG A: "${titleA}" by ${artistA}
Sonic Profile: ${JSON.stringify(profileA, null, 2)}

SONG B: "${titleB}" by ${artistB}
Sonic Profile: ${JSON.stringify(profileB, null, 2)}

Focus on:
- What rhythmic, textural, and harmonic qualities they share
- How their vocal and melodic approaches relate
- What production era and emotional register they occupy together
- One meaningful way they differ

Write as a producer who understands both tracks deeply. Be specific.
Return only the JSON comparison object.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { song_a_id, song_b_id } = await req.json();

    if (!song_a_id || !song_b_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: song_a_id, song_b_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (song_a_id === song_b_id) {
      return new Response(
        JSON.stringify({ error: "Cannot compare a song with itself" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [orderedA, orderedB] = orderIds(song_a_id, song_b_id);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase    = createClient(supabaseUrl, supabaseKey);

    // ── Cache check ───────────────────────────────────────────────────────────
    const { data: existing } = await supabase
      .from("song_comparisons")
      .select("*")
      .eq("song_a_id", orderedA)
      .eq("song_b_id", orderedB)
      .single();

    if (existing) {
      console.log(`[compare-songs] Cache HIT: ${orderedA} ↔ ${orderedB}`);
      return new Response(
        JSON.stringify({ comparison: existing, source: "cache" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Load both sonic profiles ───────────────────────────────────────────────
    const { data: profiles } = await supabase
      .from("song_sonic_profiles")
      .select("spotify_track_id, song_title, artist_name, profile_json")
      .in("spotify_track_id", [song_a_id, song_b_id]);

    const profileMap = new Map((profiles || []).map((p: any) => [p.spotify_track_id, p]));
    const profA = profileMap.get(song_a_id);
    const profB = profileMap.get(song_b_id);

    if (!profA || !profB) {
      const missing = [!profA && song_a_id, !profB && song_b_id].filter(Boolean);
      return new Response(
        JSON.stringify({
          error: "Sonic profiles not found for one or both songs. Generate profiles first.",
          missing_profiles: missing,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Generate comparison via Claude ────────────────────────────────────────
    console.log(`[compare-songs] Generating: "${profA.song_title}" ↔ "${profB.song_title}"`);

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
        max_tokens: 800,
        system:     buildCompareSystemPrompt(),
        messages: [{
          role:    "user",
          content: buildCompareUserPrompt(
            profA.song_title, profA.artist_name, profA.profile_json,
            profB.song_title, profB.artist_name, profB.profile_json,
          ),
        }],
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      throw new Error(`Claude API error: ${aiRes.status} — ${err.slice(0, 200)}`);
    }

    const aiData = await aiRes.json();
    const rawText = aiData.content?.[0]?.text || "";
    const jsonText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

    let comparison: Record<string, any>;
    try {
      comparison = JSON.parse(jsonText);
    } catch {
      throw new Error(`Failed to parse Claude JSON: ${jsonText.slice(0, 300)}`);
    }

    // Validate structure
    const matchStrength = typeof comparison.match_strength === "number"
      ? Math.min(Math.max(comparison.match_strength, 0), 1)
      : 0.5;

    const row = {
      song_a_id:     orderedA,
      song_b_id:     orderedB,
      shared_traits: Array.isArray(comparison.shared_traits) ? comparison.shared_traits.slice(0, 5) : [],
      differences:   Array.isArray(comparison.differences)   ? comparison.differences.slice(0, 3)   : [],
      match_strength: matchStrength,
      short_reason:  typeof comparison.short_reason === "string" ? comparison.short_reason : "",
      long_reason:   typeof comparison.long_reason  === "string" ? comparison.long_reason  : "",
    };

    // ── Write to cache ────────────────────────────────────────────────────────
    const { data: inserted, error: insertError } = await supabase
      .from("song_comparisons")
      .upsert(row, { onConflict: "song_a_id,song_b_id" })
      .select()
      .single();

    if (insertError) {
      console.error("[compare-songs] Cache write error:", insertError.message);
    }

    console.log(`[compare-songs] Generated (strength=${matchStrength.toFixed(2)}): "${profA.song_title}" ↔ "${profB.song_title}"`);

    return new Response(
      JSON.stringify({ comparison: inserted || row, source: "generated" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("[compare-songs] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
