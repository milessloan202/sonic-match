// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// search-by-descriptors
//
// Searches song_sonic_profiles by descriptor slug(s).
// POST { descriptors: string[], limit?: number }
// GET  ?descriptors=slug1,slug2&limit=24
//
// Single descriptor  → .contains("descriptor_slugs", [slug])
// Multiple           → .overlaps("descriptor_slugs", slugs)
//
// Scores by matched_count desc, total descriptors asc (tiebreak).
// Returns { results, requested_descriptors, total }
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let descriptors: string[] = [];
    let limit = 24;

    if (req.method === "GET") {
      const url = new URL(req.url);
      const raw = url.searchParams.get("descriptors") || "";
      descriptors = raw.split(",").map((s) => s.trim()).filter(Boolean);
      limit = parseInt(url.searchParams.get("limit") || "24", 10) || 24;
    } else {
      const body = await req.json();
      descriptors = Array.isArray(body.descriptors) ? body.descriptors : [];
      limit = typeof body.limit === "number" ? body.limit : 24;
    }

    if (descriptors.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one descriptor slug is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch a generous pool so we can score+sort before trimming to limit
    let query = supabase
      .from("song_sonic_profiles")
      .select("spotify_track_id, song_title, artist_name, descriptor_slugs, profile_json")
      .limit(200);

    if (descriptors.length === 1) {
      query = query.contains("descriptor_slugs", [descriptors[0]]);
    } else {
      query = query.overlaps("descriptor_slugs", descriptors);
    }

    const { data, error } = await query;
    if (error) throw error;

    interface ProfileRow {
      spotify_track_id: string;
      song_title: string;
      artist_name: string;
      descriptor_slugs: string[];
      profile_json: Record<string, unknown>;
    }

    const rows = (data || []) as ProfileRow[];

    // Score: count how many requested descriptors each song has
    const scored = rows.map((row) => {
      const matched_slugs = descriptors.filter((d) =>
        (row.descriptor_slugs || []).includes(d)
      );
      const matched_count = matched_slugs.length;
      const match_ratio = Number((matched_count / descriptors.length).toFixed(2));
      return { ...row, matched_count, matched_slugs, match_ratio };
    });

    // Sort: matched_count desc, then fewest total descriptors as tiebreak
    scored.sort((a, b) => {
      if (b.matched_count !== a.matched_count) return b.matched_count - a.matched_count;
      return (a.descriptor_slugs?.length || 0) - (b.descriptor_slugs?.length || 0);
    });

    const results = scored.slice(0, limit);

    console.log(
      `[search-by-descriptors] [${descriptors.join(",")}] → ${results.length}/${scored.length} results`,
    );

    return new Response(
      JSON.stringify({ results, requested_descriptors: descriptors, total: scored.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[search-by-descriptors] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
