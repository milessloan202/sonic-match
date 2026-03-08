import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "SongsLikeApp/1.0 (lovable.dev)";

async function mbFetch(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`MusicBrainz API error: ${res.status}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { song_title, artist_name } = await req.json();

    if (!song_title || !artist_name) {
      return new Response(
        JSON.stringify({ error: "song_title and artist_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check cache first
    const { data: cached } = await supabase
      .from("sample_cache")
      .select("*")
      .eq("song_title", song_title)
      .eq("artist_name", artist_name)
      .maybeSingle();

    if (cached?.looked_up) {
      return new Response(JSON.stringify({ sample: cached.sample_verified ? cached : null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search MusicBrainz for the recording
    const query = encodeURIComponent(`recording:"${song_title}" AND artist:"${artist_name}"`);
    const searchUrl = `${MB_BASE}/recording/?query=${query}&fmt=json&limit=5`;
    const searchData = await mbFetch(searchUrl);

    const recordings = searchData.recordings || [];
    if (recordings.length === 0) {
      // No match found — cache the miss
      await supabase.from("sample_cache").upsert(
        {
          song_title,
          artist_name,
          looked_up: true,
          sample_verified: false,
        },
        { onConflict: "song_title,artist_name" }
      );
      return new Response(JSON.stringify({ sample: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pick the best match
    const bestMatch = recordings[0];
    const mbid = bestMatch.id;

    // MusicBrainz rate limit: 1 req/sec
    await new Promise((r) => setTimeout(r, 1100));

    // Fetch recording relationships
    const relUrl = `${MB_BASE}/recording/${mbid}?inc=artist-credits+recording-rels&fmt=json`;
    const relData = await mbFetch(relUrl);

    // Look for "samples material" relationships
    const relations = relData.relations || [];
    const sampleRel = relations.find(
      (r: any) => r.type === "samples material" && r.direction === "forward"
    );

    if (!sampleRel) {
      await supabase.from("sample_cache").upsert(
        {
          song_title,
          artist_name,
          musicbrainz_recording_id: mbid,
          looked_up: true,
          sample_verified: false,
        },
        { onConflict: "song_title,artist_name" }
      );
      return new Response(JSON.stringify({ sample: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sampledRecording = sampleRel.recording || {};
    const sampledTitle = sampledRecording.title || "Unknown";
    const sampledArtist =
      sampledRecording["artist-credit"]?.[0]?.name ||
      sampledRecording["artist-credit"]?.[0]?.artist?.name ||
      "Unknown";
    const sampledMbid = sampledRecording.id;

    const cacheRow = {
      song_title,
      artist_name,
      musicbrainz_recording_id: mbid,
      sampled_song_title: sampledTitle,
      sampled_artist_name: sampledArtist,
      sampled_recording_id: sampledMbid,
      sample_verified: true,
      looked_up: true,
    };

    await supabase
      .from("sample_cache")
      .upsert(cacheRow, { onConflict: "song_title,artist_name" });

    return new Response(JSON.stringify({ sample: cacheRow }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("fetch-samples error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
