import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Cache Spotify token in memory (edge function instance)
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID")!;
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET")!;
  const basic = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);

  const data = await res.json();
  cachedToken = data.access_token;
  // Expire 60s early to be safe
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken!;
}

interface SongQuery {
  title: string;
  artist: string;
}

interface ArtistQuery {
  name: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { songs, artists }: { songs?: SongQuery[]; artists?: ArtistQuery[] } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const songResults: Record<string, { image_url: string | null; preview_url: string | null; spotify_url: string | null }> = {};
    const artistResults: Record<string, string | null> = {};

    // --- Process songs ---
    if (songs?.length) {
      // Check cache first
      const songKeys = songs.map((s) => `${s.title}|||${s.artist}`);
      const { data: cached } = await supabase
        .from("song_image_cache")
        .select("name, artist, image_url, preview_url, spotify_url");

      const cachedMap = new Map<string, { image_url: string | null; preview_url: string | null; spotify_url: string | null }>();
      (cached || []).forEach((r: any) => cachedMap.set(`${r.name}|||${r.artist}`, { image_url: r.image_url, preview_url: r.preview_url, spotify_url: r.spotify_url }));

      const uncached: SongQuery[] = [];
      for (const s of songs) {
        const key = `${s.title}|||${s.artist}`;
        if (cachedMap.has(key)) {
          const c = cachedMap.get(key)!;
          songResults[key] = { image_url: c.image_url, preview_url: c.preview_url, spotify_url: c.spotify_url };
        } else {
          uncached.push(s);
        }
      }

      if (uncached.length > 0) {
        const token = await getSpotifyToken();

        // Batch fetch uncached songs (max ~10 at a time to stay within limits)
        const fetches = uncached.slice(0, 15).map(async (s) => {
          const q = encodeURIComponent(`track:"${s.title}" artist:"${s.artist}"`);
          try {
            const res = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return { song: s, imageUrl: null };
            const data = await res.json();
            const track = data?.tracks?.items?.[0];
            const imageUrl = track?.album?.images?.[1]?.url || track?.album?.images?.[0]?.url || null;
            return { song: s, imageUrl };
          } catch {
            return { song: s, imageUrl: null };
          }
        });

        const results = await Promise.all(fetches);

        // Store in cache
        const toInsert = results.map((r) => ({
          name: r.song.title,
          artist: r.song.artist,
          image_url: r.imageUrl,
        }));

        if (toInsert.length > 0) {
          await supabase.from("song_image_cache").upsert(toInsert, { onConflict: "name,artist" });
        }

        for (const r of results) {
          songResults[`${r.song.title}|||${r.song.artist}`] = r.imageUrl;
        }
      }
    }

    // --- Process artists ---
    if (artists?.length) {
      const { data: cached } = await supabase
        .from("artist_image_cache")
        .select("name, image_url");

      const cachedMap = new Map<string, string | null>();
      (cached || []).forEach((r: any) => cachedMap.set(r.name, r.image_url));

      const uncached: ArtistQuery[] = [];
      for (const a of artists) {
        if (cachedMap.has(a.name)) {
          artistResults[a.name] = cachedMap.get(a.name)!;
        } else {
          uncached.push(a);
        }
      }

      if (uncached.length > 0) {
        const token = await getSpotifyToken();

        const fetches = uncached.slice(0, 10).map(async (a) => {
          const q = encodeURIComponent(a.name);
          try {
            const res = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=artist&limit=1`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return { artist: a, imageUrl: null };
            const data = await res.json();
            const artist = data?.artists?.items?.[0];
            const imageUrl = artist?.images?.[1]?.url || artist?.images?.[0]?.url || null;
            return { artist: a, imageUrl };
          } catch {
            return { artist: a, imageUrl: null };
          }
        });

        const results = await Promise.all(fetches);

        const toInsert = results.map((r) => ({
          name: r.artist.name,
          image_url: r.imageUrl,
        }));

        if (toInsert.length > 0) {
          await supabase.from("artist_image_cache").upsert(toInsert, { onConflict: "name" });
        }

        for (const r of results) {
          artistResults[r.artist.name] = r.imageUrl;
        }
      }
    }

    return new Response(JSON.stringify({ songs: songResults, artists: artistResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-spotify-images error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
