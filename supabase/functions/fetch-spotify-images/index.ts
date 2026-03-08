import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken!;
}

async function fetchYouTubeThumbnail(title: string, artist: string): Promise<string | null> {
  const query = `${title} ${artist}`;
  console.log(`[YouTube] Searching for: "${query}"`);

  // Try multiple Piped instances for reliability
  const pipedInstances = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.adminforge.de",
    "https://pipedapi.in.projectsegfau.lt",
  ];

  for (const instance of pipedInstances) {
    try {
      const url = `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`;
      console.log(`[YouTube] Trying instance: ${instance}`);
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.log(`[YouTube] Instance ${instance} returned ${res.status}`);
        continue;
      }
      const data = await res.json();
      const items = data?.items;
      if (!items?.length) {
        console.log(`[YouTube] No results from ${instance}`);
        continue;
      }
      const videoUrl = items[0]?.url;
      if (!videoUrl) continue;
      const match = videoUrl.match(/[?&]v=([^&]+)/);
      const videoId = match?.[1];
      if (!videoId) {
        console.log(`[YouTube] Could not extract video ID from: ${videoUrl}`);
        continue;
      }
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      console.log(`[YouTube] Found thumbnail for "${query}": ${thumbnailUrl}`);
      return thumbnailUrl;
    } catch (e) {
      console.log(`[YouTube] Instance ${instance} failed: ${e instanceof Error ? e.message : "unknown error"}`);
      continue;
    }
  }

  console.log(`[YouTube] All instances failed for: "${query}"`);
  return null;
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

    const songResults: Record<string, { image_url: string | null; preview_url: string | null; spotify_url: string | null; youtube_thumbnail_url: string | null }> = {};
    const artistResults: Record<string, string | null> = {};

    // --- Process songs ---
    if (songs?.length) {
      const { data: cached } = await supabase
        .from("song_image_cache")
        .select("name, artist, image_url, preview_url, spotify_url, youtube_thumbnail_url");

      const cachedMap = new Map<string, { image_url: string | null; preview_url: string | null; spotify_url: string | null; youtube_thumbnail_url: string | null }>();
      (cached || []).forEach((r: any) => cachedMap.set(`${r.name}|||${r.artist}`, {
        image_url: r.image_url,
        preview_url: r.preview_url,
        spotify_url: r.spotify_url,
        youtube_thumbnail_url: r.youtube_thumbnail_url,
      }));

      const uncached: SongQuery[] = [];
      const needsYoutube: { key: string; song: SongQuery }[] = [];

      for (const s of songs) {
        const key = `${s.title}|||${s.artist}`;
        if (cachedMap.has(key)) {
          const c = cachedMap.get(key)!;
          songResults[key] = c;
          console.log(`[Cache] Hit for "${s.title}" by ${s.artist} — Spotify: ${c.image_url ? "yes" : "no"}, YouTube: ${c.youtube_thumbnail_url ? "yes" : "no"}`);
          // If no Spotify image AND no YouTube thumbnail yet, queue for YouTube lookup
          if (!c.image_url && !c.youtube_thumbnail_url) {
            needsYoutube.push({ key, song: s });
          }
        } else {
          uncached.push(s);
        }
      }

      if (uncached.length > 0) {
        console.log(`[Spotify] Fetching ${uncached.length} uncached songs`);
        const token = await getSpotifyToken();

        const fetches = uncached.slice(0, 15).map(async (s) => {
          const q = encodeURIComponent(`track:"${s.title}" artist:"${s.artist}"`);
          try {
            const res = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return { song: s, imageUrl: null, previewUrl: null, spotifyUrl: null };
            const data = await res.json();
            const track = data?.tracks?.items?.[0];
            const imageUrl = track?.album?.images?.[1]?.url || track?.album?.images?.[0]?.url || null;
            const previewUrl = track?.preview_url || null;
            const spotifyUrl = track?.external_urls?.spotify || null;
            console.log(`[Spotify] "${s.title}" by ${s.artist}: artwork=${imageUrl ? "found" : "missing"}`);
            return { song: s, imageUrl, previewUrl, spotifyUrl };
          } catch {
            return { song: s, imageUrl: null, previewUrl: null, spotifyUrl: null };
          }
        });

        const results = await Promise.all(fetches);

        // For songs without Spotify artwork, try YouTube
        const songsNeedingYt = results.filter((r) => !r.imageUrl);
        console.log(`[YouTube] ${songsNeedingYt.length} songs need YouTube thumbnail fallback`);

        const youtubePromises = songsNeedingYt.map(async (r) => {
          const ytThumb = await fetchYouTubeThumbnail(r.song.title, r.song.artist);
          return { key: `${r.song.title}|||${r.song.artist}`, ytThumb };
        });

        const ytResults = await Promise.all(youtubePromises);
        const ytMap = new Map(ytResults.map((r) => [r.key, r.ytThumb]));

        const toInsert = results.map((r) => {
          const key = `${r.song.title}|||${r.song.artist}`;
          return {
            name: r.song.title,
            artist: r.song.artist,
            image_url: r.imageUrl,
            preview_url: r.previewUrl,
            spotify_url: r.spotifyUrl,
            youtube_thumbnail_url: ytMap.get(key) || null,
          };
        });

        if (toInsert.length > 0) {
          await supabase.from("song_image_cache").upsert(toInsert, { onConflict: "name,artist" });
        }

        for (const r of results) {
          const key = `${r.song.title}|||${r.song.artist}`;
          songResults[key] = {
            image_url: r.imageUrl,
            preview_url: r.previewUrl,
            spotify_url: r.spotifyUrl,
            youtube_thumbnail_url: ytMap.get(key) || null,
          };
        }
      }

      // Handle previously cached songs that need YouTube thumbnails
      if (needsYoutube.length > 0) {
        console.log(`[YouTube] ${needsYoutube.length} cached songs need YouTube thumbnail retry`);
        const ytFetches = needsYoutube.slice(0, 10).map(async ({ key, song }) => {
          const ytThumb = await fetchYouTubeThumbnail(song.title, song.artist);
          return { key, ytThumb };
        });
        const ytResults = await Promise.all(ytFetches);

        for (const { key, ytThumb } of ytResults) {
          if (ytThumb) {
            songResults[key].youtube_thumbnail_url = ytThumb;
            const [name, artist] = key.split("|||");
            await supabase
              .from("song_image_cache")
              .update({ youtube_thumbnail_url: ytThumb })
              .eq("name", name)
              .eq("artist", artist);
          }
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
