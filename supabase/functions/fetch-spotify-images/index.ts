import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEBUG = true; // flip to false to quiet logs

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

// Circuit breaker: if we hit a 429, skip all remaining Spotify calls
let rateLimitedUntil = 0;

type ResolverStatus = "resolved" | "not_found" | "temporary_failure" | "error";

interface SongResolverResult {
  status: ResolverStatus;
  image_url: string | null;
  preview_url: string | null;
  spotify_url: string | null;
  spotify_track_id: string | null;
}

async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID")!;
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET")!;
  const basic = btoa(`${clientId}:${clientSecret}`);

  if (DEBUG) console.log(`[Auth] Requesting Spotify access token`);

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[Auth] Spotify auth failed: HTTP ${res.status} — ${body}`);
    throw new Error(`Spotify auth failed: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  if (DEBUG) console.log(`[Auth] Token acquired, expires in ${data.expires_in}s`);
  return cachedToken!;
}

/**
 * Fetch with rate-limit awareness.
 * Returns { response, rateLimited } where response is null if rate-limited.
 */
async function spotifyFetch(
  url: string,
  token: string
): Promise<{ response: Response | null; rateLimited: boolean; httpStatus: number | null; retryAfter: number | null }> {
  // Circuit breaker check
  if (Date.now() < rateLimitedUntil) {
    if (DEBUG) console.log(`  [Circuit] Skipping — rate limited for ${Math.round((rateLimitedUntil - Date.now()) / 1000)}s more`);
    return { response: null, rateLimited: true, httpStatus: 429, retryAfter: null };
  }

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "60", 10);
      try { await res.text(); } catch {} // drain body
      rateLimitedUntil = Date.now() + retryAfter * 1000;
      console.warn(`⛔ [Spotify] 429 Rate Limited — Retry-After=${retryAfter}s, circuit open until ${new Date(rateLimitedUntil).toISOString()}`);
      return { response: null, rateLimited: true, httpStatus: 429, retryAfter };
    }

    if (res.status >= 500) {
      const body = await res.text();
      console.warn(`⛔ [Spotify] Server error ${res.status}: ${body.slice(0, 200)}`);
      return { response: null, rateLimited: false, httpStatus: res.status, retryAfter: null };
    }

    return { response: res, rateLimited: false, httpStatus: res.status, retryAfter: null };
  } catch (err) {
    console.error(`⛔ [Spotify] Network error: ${err instanceof Error ? err.message : "unknown"}`);
    return { response: null, rateLimited: false, httpStatus: null, retryAfter: null };
  }
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

interface SongQuery { title: string; artist: string; spotify_id?: string }
interface ArtistQuery { name: string }

// Maximum age for a "not found" cache entry before we retry
const NOT_FOUND_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { songs, artists }: { songs?: SongQuery[]; artists?: ArtistQuery[] } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const songResults: Record<string, SongResolverResult> = {};
    const artistResults: Record<string, string | null> = {};

    // --- Process songs ---
    if (songs?.length) {
      const { data: cached } = await supabase
        .from("song_image_cache")
        .select("name, artist, image_url, preview_url, spotify_url, spotify_track_id, created_at");

      const cachedMap = new Map<string, {
        image_url: string | null;
        preview_url: string | null;
        spotify_url: string | null;
        spotify_track_id: string | null;
        created_at: string;
      }>();
      (cached || []).forEach((r: any) => {
        cachedMap.set(`${r.name}|||${r.artist}`, r);
      });

      const uncached: SongQuery[] = [];

      for (const s of songs) {
        const key = `${s.title}|||${s.artist}`;
        const c = cachedMap.get(key);
        
        if (c) {
          const isResolved = !!(c.spotify_url || c.spotify_track_id);

          // If this is a "not found" entry, check if it's stale
          if (!isResolved) {
            const age = Date.now() - new Date(c.created_at).getTime();
            if (age > NOT_FOUND_CACHE_MAX_AGE_MS) {
              if (DEBUG) console.log(`♻️ [Cache] Stale not-found for "${s.title}" by ${s.artist} (${Math.round(age / 3600000)}h old) — will retry`);
              uncached.push(s);
              continue;
            }
          }

          songResults[key] = {
            status: isResolved ? "resolved" : "not_found",
            image_url: c.image_url,
            preview_url: c.preview_url,
            spotify_url: c.spotify_url,
            spotify_track_id: null,
          };
          if (DEBUG) console.log(`📦 [Cache] ${isResolved ? "HIT" : "NOT_FOUND"} "${s.title}" by ${s.artist}`);
        } else {
          uncached.push(s);
        }
      }

      if (uncached.length > 0) {
        if (DEBUG) console.log(`[Spotify] Need to look up ${uncached.length} uncached songs`);
        
        let token: string;
        try {
          token = await getSpotifyToken();
        } catch (authErr) {
          // Auth failure → all uncached songs are "error"
          console.error(`[Auth] Cannot get token: ${authErr}`);
          for (const s of uncached) {
            const key = `${s.title}|||${s.artist}`;
            songResults[key] = { status: "error", image_url: null, preview_url: null, spotify_url: null, spotify_track_id: null };
          }
          // Skip to artist processing
          uncached.length = 0;
        }

        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        interface ProcessResult {
          song: SongQuery;
          status: ResolverStatus;
          imageUrl: string | null;
          previewUrl: string | null;
          spotifyUrl: string | null;
          spotifyTrackId: string | null;
        }

        const processOneSong = async (s: SongQuery): Promise<ProcessResult> => {
          const sanitizedArtist = sanitizeArtist(s.artist);
          if (DEBUG) console.log(`🔍 [Lookup] "${s.title}" by ${s.artist}`);

          const fail = (status: ResolverStatus): ProcessResult => ({
            song: s, status, imageUrl: null, previewUrl: null, spotifyUrl: null, spotifyTrackId: null,
          });

          try {
            let track: any = null;

            // 1. Direct track lookup by Spotify ID
            if (s.spotify_id) {
              const { response, rateLimited, httpStatus } = await spotifyFetch(
                `https://api.spotify.com/v1/tracks/${s.spotify_id}`, token!
              );
              if (rateLimited) {
                console.log(`  [Result] "${s.title}" → temporary_failure (429 on direct lookup)`);
                return fail("temporary_failure");
              }
              if (response && response.ok) {
                track = await response.json();
                if (DEBUG) console.log(`  ✅ Resolved via track ID ${s.spotify_id}`);
              } else if (response) {
                try { await response.text(); } catch {}
                if (httpStatus && httpStatus >= 500) {
                  console.log(`  [Result] "${s.title}" → temporary_failure (${httpStatus} on direct lookup)`);
                  return fail("temporary_failure");
                }
                // 4xx on direct ID lookup — fall through to search
                if (DEBUG) console.log(`  ⚠️ Track ID ${s.spotify_id} returned ${httpStatus}, falling back to search`);
              } else {
                // Network error
                console.log(`  [Result] "${s.title}" → error (network failure on direct lookup)`);
                return fail("error");
              }
            }

            // 2. Search strategies (strict → broad → title-only)
            if (!track) {
              const strategies = [
                { label: "strict", q: `track:"${s.title}" artist:"${sanitizedArtist}"`, limit: 5 },
                { label: "broad", q: `${s.title} ${sanitizedArtist}`, limit: 10 },
                { label: "title-only", q: `track:"${s.title}"`, limit: 10 },
              ];

              let tracks: any[] = [];
              let hitRateLimit = false;
              let hitServerError = false;

              for (const strat of strategies) {
                if (tracks.length > 0) break; // already have candidates

                const encoded = encodeURIComponent(strat.q);
                const { response, rateLimited, httpStatus } = await spotifyFetch(
                  `https://api.spotify.com/v1/search?q=${encoded}&type=track&limit=${strat.limit}`, token!
                );

                if (rateLimited) {
                  hitRateLimit = true;
                  if (DEBUG) console.log(`  [Search:${strat.label}] → 429 rate limited`);
                  break; // circuit breaker will skip all further
                }

                if (!response) {
                  if (httpStatus && httpStatus >= 500) {
                    hitServerError = true;
                    if (DEBUG) console.log(`  [Search:${strat.label}] → ${httpStatus} server error`);
                  } else {
                    if (DEBUG) console.log(`  [Search:${strat.label}] → network error`);
                  }
                  continue;
                }

                if (response.ok) {
                  const data = await response.json();
                  tracks = data?.tracks?.items || [];
                  if (DEBUG) console.log(`  [Search:${strat.label}] → ${tracks.length} results`);
                } else {
                  try { await response.text(); } catch {}
                  if (DEBUG) console.log(`  [Search:${strat.label}] → HTTP ${httpStatus}`);
                }
              }

              // Classify failure when no tracks found
              if (tracks.length === 0) {
                if (hitRateLimit) {
                  console.log(`  [Result] "${s.title}" → temporary_failure (rate limited)`);
                  return fail("temporary_failure");
                }
                if (hitServerError) {
                  console.log(`  [Result] "${s.title}" → temporary_failure (server error)`);
                  return fail("temporary_failure");
                }
                // If we got actual 200 responses with 0 results, that's a genuine not_found
                console.log(`  [Result] "${s.title}" → not_found (genuine miss)`);
                return fail("not_found");
              }

              // 3. Match evaluation
              // Try: artist+title → artist-only → title-only
              track = tracks.find((t: any) => {
                const names = t.artists?.map((a: any) => a.name) || [];
                return artistsMatch(s.artist, names) && titlesMatch(s.title, t.name);
              });

              if (!track) {
                track = tracks.find((t: any) => {
                  const names = t.artists?.map((a: any) => a.name) || [];
                  return artistsMatch(s.artist, names);
                });
                if (track && DEBUG) console.log(`  ⚠️ Artist-only match: "${track.name}" by ${track.artists.map((a: any) => a.name).join(", ")}`);
              }

              if (!track) {
                track = tracks.find((t: any) => titlesMatch(s.title, t.name));
                if (track && DEBUG) console.log(`  ⚠️ Title-only match: "${track.name}" by ${track.artists.map((a: any) => a.name).join(", ")}`);
              }

              if (!track) {
                console.log(`  [Result] "${s.title}" → not_found (${tracks.length} candidates, none matched)`);
                return fail("not_found");
              }
            }

            // 4. Extract metadata from matched track
            const imageUrl = track?.album?.images?.[1]?.url || track?.album?.images?.[0]?.url || null;
            const previewUrl = track?.preview_url || null;
            const spotifyUrl = track?.external_urls?.spotify || null;
            const spotifyTrackId = track?.id || s.spotify_id || null;

            console.log(`  [Result] "${s.title}" → resolved (artwork=${imageUrl ? "yes" : "no"}, preview=${previewUrl ? "yes" : "no"}, id=${spotifyTrackId})`);
            return { song: s, status: "resolved" as ResolverStatus, imageUrl, previewUrl, spotifyUrl, spotifyTrackId };
          } catch (err) {
            console.error(`  [Result] "${s.title}" → error: ${err instanceof Error ? err.message : "unknown"}`);
            return fail("error");
          }
        };

        const results: ProcessResult[] = [];
        for (const s of uncached.slice(0, 15)) {
          const result = await processOneSong(s);
          results.push(result);
          await delay(150);
        }

        // 5. Cache writes — ONLY resolved and not_found (genuine misses)
        const toInsert = results
          .filter((r) => r.status === "resolved" || r.status === "not_found")
          .map((r) => ({
            name: r.song.title,
            artist: r.song.artist,
            image_url: r.imageUrl,
            preview_url: r.previewUrl,
            spotify_url: r.spotifyUrl,
            youtube_thumbnail_url: null,
            spotify_track_id: r.spotifyTrackId,
          }));

        if (toInsert.length > 0) {
          const resolved = toInsert.filter(r => r.spotify_url).length;
          const notFound = toInsert.length - resolved;
          console.log(`💾 [Cache Write] ${toInsert.length} entries (${resolved} resolved, ${notFound} genuine not_found)`);
          await supabase.from("song_image_cache").upsert(toInsert, { onConflict: "name,artist" });
        }

        const skipped = results.filter(r => r.status === "temporary_failure" || r.status === "error");
        if (skipped.length > 0) {
          console.log(`⏭️ [Cache Skip] ${skipped.length} songs NOT cached (${skipped.map(r => r.status).join(", ")})`);
        }

        // Build response for all results
        for (const r of results) {
          const key = `${r.song.title}|||${r.song.artist}`;
          songResults[key] = {
            status: r.status,
            image_url: r.imageUrl,
            preview_url: r.previewUrl,
            spotify_url: r.spotifyUrl,
            spotify_track_id: r.spotifyTrackId,
          };
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
          const { response, rateLimited } = await spotifyFetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(a.name)}&type=artist&limit=1`, token
          );
          if (rateLimited || !response || !response.ok) {
            return { artist: a, imageUrl: null, shouldCache: !rateLimited };
          }
          const data = await response.json();
          const artist = data?.artists?.items?.[0];
          const imageUrl = artist?.images?.[1]?.url || artist?.images?.[0]?.url || null;
          return { artist: a, imageUrl, shouldCache: true };
        });

        const results = await Promise.all(fetches);

        const toInsert = results
          .filter(r => r.shouldCache)
          .map((r) => ({ name: r.artist.name, image_url: r.imageUrl }));

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
