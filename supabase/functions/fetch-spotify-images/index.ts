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

/** Fetch with retry on 429 rate limit — returns null if rate-limited too long */
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 1): Promise<Response | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);
    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
      // Drain body to free connection
      try { await res.text(); } catch {}
      if (retryAfter > 5) {
        console.log(`⛔ [Spotify] Rate limited (429), Retry-After=${retryAfter}s is too long — skipping`);
        return null;
      }
      const waitMs = Math.min(retryAfter * 1000, 3000);
      console.log(`⏳ [Spotify] Rate limited (429), waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      continue;
    }
    if (res.status === 429) {
      // Last attempt still 429 — drain and return null
      try { await res.text(); } catch {}
      console.log(`⛔ [Spotify] Still rate limited after ${maxRetries} retries — giving up`);
      return null;
    }
    return res;
  }
  return fetch(url, options);
}

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(remaster(ed)?|deluxe|edition|version|edit|mix|mono|stereo|single|album)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeArtist(artist: string): string {
  return artist
    .replace(/\s*&\s*/g, " ")
    .replace(/\s+vs\.?\s+/gi, " ")
    .replace(/\s+feat\.?\s+/gi, " ")
    .replace(/\s+ft\.?\s+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

function artistsMatch(queryArtist: string, trackArtists: string[]): boolean {
  const normalized = sanitizeArtist(queryArtist).toLowerCase();
  const queryParts = normalized.split(/\s+the\s+/i).map(p => p.trim()).filter(Boolean);
  
  return trackArtists.some((a) => {
    const na = a.toLowerCase().trim();
    if (na === normalized || na.includes(normalized) || normalized.includes(na)) return true;
    if (queryParts.some(part => na.includes(part) || part.includes(na))) return true;
    return false;
  });
}

interface SongQuery {
  title: string;
  artist: string;
  spotify_id?: string;
}

interface ArtistQuery {
  name: string;
}

interface SongResult {
  image_url: string | null;
  preview_url: string | null;
  spotify_url: string | null;
  youtube_thumbnail_url: null; // kept for interface compat, always null
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { songs, artists }: { songs?: SongQuery[]; artists?: ArtistQuery[] } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const songResults: Record<string, SongResult> = {};
    const artistResults: Record<string, string | null> = {};

    // --- Process songs ---
    if (songs?.length) {
      const { data: cached } = await supabase
        .from("song_image_cache")
        .select("name, artist, image_url, preview_url, spotify_url, spotify_track_id");

      const cachedMap = new Map<string, { image_url: string | null; preview_url: string | null; spotify_url: string | null; spotify_track_id: string | null }>();
      (cached || []).forEach((r: any) => {
        cachedMap.set(`${r.name}|||${r.artist}`, {
          image_url: r.image_url,
          preview_url: r.preview_url,
          spotify_url: r.spotify_url,
          spotify_track_id: r.spotify_track_id,
        });
      });

      const uncached: SongQuery[] = [];

      for (const s of songs) {
        const key = `${s.title}|||${s.artist}`;
        if (cachedMap.has(key)) {
          const c = cachedMap.get(key)!;
          const isVerified = !!(c.spotify_url || c.spotify_track_id);
          
          songResults[key] = {
            image_url: c.image_url,
            preview_url: c.preview_url,
            spotify_url: c.spotify_url,
            youtube_thumbnail_url: null,
          };
          
          console.log(`📦 [Cache] "${s.title}" by ${s.artist} — verified=${isVerified}, artwork=${c.image_url ? "spotify" : "none"}`);
        } else {
          uncached.push(s);
        }
      }

      if (uncached.length > 0) {
        console.log(`[Spotify] Fetching ${uncached.length} uncached songs`);
        const token = await getSpotifyToken();

        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        
        const processOneSong = async (s: SongQuery) => {
          const sanitizedArtist = sanitizeArtist(s.artist);
          console.log(`🔍 [Spotify] Querying "${s.title}" by ${s.artist} (sanitized: "${sanitizedArtist}")`);
          
          try {
            let track: any = null;

            // Prefer direct track lookup by Spotify ID
            if (s.spotify_id) {
              const res = await fetch(`https://api.spotify.com/v1/tracks/${s.spotify_id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                track = await res.json();
                console.log(`✅ [Spotify] "${s.title}" verified via track ID ${s.spotify_id}`);
              } else {
                await res.text();
                console.log(`⚠️ [Spotify] Track ID ${s.spotify_id} failed with status ${res.status}`);
              }
            }

            // Fallback to search
            if (!track) {
              const strictQ = encodeURIComponent(`track:"${s.title}" artist:"${sanitizedArtist}"`);
              const res1 = await fetchWithRetry(`https://api.spotify.com/v1/search?q=${strictQ}&type=track&limit=5`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              
              let tracks: any[] = [];
              if (res1 && res1.ok) {
                const data = await res1.json();
                tracks = data?.tracks?.items || [];
                console.log(`  [Spotify] Strict search returned ${tracks.length} results`);
              } else if (res1) {
                try { await res1.text(); } catch {}
                console.log(`  [Spotify] Strict search returned status ${res1.status}`);
              } else {
                console.log(`  [Spotify] Strict search skipped (rate limited)`);
              }

              if (tracks.length === 0) {
                console.log(`🔄 [Spotify] Trying broad search for "${s.title}" by ${sanitizedArtist}`);
                const broadQ = encodeURIComponent(`${s.title} ${sanitizedArtist}`);
                const res2 = await fetchWithRetry(`https://api.spotify.com/v1/search?q=${broadQ}&type=track&limit=10`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (res2 && res2.ok) {
                  const data2 = await res2.json();
                  tracks = data2?.tracks?.items || [];
                  console.log(`  [Spotify] Broad search returned ${tracks.length} results`);
                } else if (res2) {
                  try { await res2.text(); } catch {}
                }
              }

              if (tracks.length === 0) {
                console.log(`🔄 [Spotify] Trying title-only search for "${s.title}"`);
                const titleQ = encodeURIComponent(`track:"${s.title}"`);
                const res3 = await fetchWithRetry(`https://api.spotify.com/v1/search?q=${titleQ}&type=track&limit=10`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (res3 && res3.ok) {
                  const data3 = await res3.json();
                  tracks = data3?.tracks?.items || [];
                  console.log(`  [Spotify] Title-only search returned ${tracks.length} results`);
                } else if (res3) {
                  try { await res3.text(); } catch {}
                }
              }
                
              if (tracks.length === 0) {
                // Check if we were rate limited (all searches returned null from fetchWithRetry)
                const wasRateLimited = !res1;
                console.log(`❌ [Spotify] No results for "${s.title}" by ${s.artist} (all strategies)${wasRateLimited ? " — RATE LIMITED, will NOT cache" : ""}`);
                return { song: s, imageUrl: null, previewUrl: null, spotifyUrl: null, spotifyTrackId: null, verified: false, rateLimited: wasRateLimited };
              }

              track = tracks.find((t: any) => {
                const trackArtistNames = t.artists?.map((a: any) => a.name) || [];
                return artistsMatch(s.artist, trackArtistNames) && titlesMatch(s.title, t.name);
              });

              if (!track) {
                track = tracks.find((t: any) => {
                  const trackArtistNames = t.artists?.map((a: any) => a.name) || [];
                  return artistsMatch(s.artist, trackArtistNames);
                });
                if (track) {
                  console.log(`⚠️ [Spotify] Artist-only match for "${s.title}": found "${track.name}" by ${track.artists.map((a: any) => a.name).join(", ")}`);
                }
              }

              if (!track) {
                track = tracks.find((t: any) => titlesMatch(s.title, t.name));
                if (track) {
                  console.log(`⚠️ [Spotify] Title-only match for "${s.title}": accepted "${track.name}" by ${track.artists.map((a: any) => a.name).join(", ")}`);
                }
              }

              if (!track) {
                console.log(`❌ [Spotify] No match for "${s.title}" by ${s.artist} — ${tracks.length} candidates`);
                return { song: s, imageUrl: null, previewUrl: null, spotifyUrl: null, spotifyTrackId: null, verified: false };
              }

              console.log(`✅ [Spotify] MATCHED "${s.title}" by ${s.artist} → "${track.name}" by ${track.artists.map((a: any) => a.name).join(", ")}`);
            }

            const imageUrl = track?.album?.images?.[1]?.url || track?.album?.images?.[0]?.url || null;
            const previewUrl = track?.preview_url || null;
            const spotifyUrl = track?.external_urls?.spotify || null;
            const spotifyTrackId = track?.id || s.spotify_id || null;
            
            console.log(`✅ [Spotify] VERIFIED "${s.title}" by ${s.artist}: artwork=${imageUrl ? "yes" : "no"}, preview=${previewUrl ? "yes" : "no"}, id=${spotifyTrackId}`);
            return { song: s, imageUrl, previewUrl, spotifyUrl, spotifyTrackId, verified: true, rateLimited: false };
          } catch (err) {
            console.log(`❌ [Spotify] Error for "${s.title}" by ${s.artist}: ${err instanceof Error ? err.message : "unknown"}`);
            return { song: s, imageUrl: null, previewUrl: null, spotifyUrl: null, spotifyTrackId: null, verified: false, rateLimited: false };
          }
        };

        const results = [];
        for (const s of uncached.slice(0, 15)) {
          const result = await processOneSong(s);
          results.push(result);
          if (uncached.indexOf(s) < uncached.length - 1) {
            await delay(150);
          }
        }

        // Cache only non-rate-limited songs (don't poison cache with 429 failures)
        const toInsert = results.filter((r) => !r.rateLimited).map((r) => ({
          name: r.song.title,
          artist: r.song.artist,
          image_url: r.imageUrl || null,
          preview_url: r.previewUrl || null,
          spotify_url: r.spotifyUrl || null,
          youtube_thumbnail_url: null,
          spotify_track_id: r.spotifyTrackId || null,
        }));

        if (toInsert.length > 0) {
          console.log(`💾 [Cache] Saving ${toInsert.length} songs (${results.filter(r => r.verified).length} verified, ${results.filter(r => !r.verified).length} unverified)`);
          await supabase.from("song_image_cache").upsert(toInsert, { onConflict: "name,artist" });
        }

        for (const r of results) {
          const key = `${r.song.title}|||${r.song.artist}`;
          
          songResults[key] = {
            image_url: r.imageUrl,
            preview_url: r.previewUrl,
            spotify_url: r.spotifyUrl,
            youtube_thumbnail_url: null,
          };
          
          const artworkSource = r.imageUrl ? "spotify" : "placeholder";
          const action = r.spotifyUrl ? "spotify" : "not-on-spotify";
          console.log(`📋 [Result] "${r.song.title}" by ${r.song.artist} — artwork=${artworkSource}, action=${action}`);
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
            if (!res.ok) {
              await res.text();
              return { artist: a, imageUrl: null };
            }
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
