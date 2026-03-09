import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEBUG = true;
const MAX_SONGS_PER_BATCH = 20;
const CACHE_VERSION = 2;

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

async function spotifyFetch(
  url: string,
  token: string
): Promise<{ response: Response | null; rateLimited: boolean; httpStatus: number | null; retryAfter: number | null }> {
  if (Date.now() < rateLimitedUntil) {
    if (DEBUG) console.log(`  [Circuit] Skipping — rate limited for ${Math.round((rateLimitedUntil - Date.now()) / 1000)}s more`);
    return { response: null, rateLimited: true, httpStatus: 429, retryAfter: null };
  }

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "60", 10);
      try { await res.text(); } catch {}
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

/** Synthesize a Spotify URL from a track ID */
function spotifyUrlFromId(trackId: string | null): string | null {
  if (!trackId) return null;
  return `https://open.spotify.com/track/${trackId}`;
}

interface SongQuery { title: string; artist: string; spotify_id?: string }
interface ArtistQuery { name: string }

interface ProcessResult {
  song: SongQuery;
  status: ResolverStatus;
  imageUrl: string | null;
  previewUrl: string | null;
  spotifyUrl: string | null;
  spotifyTrackId: string | null;
}

const NOT_FOUND_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
        .select("name, artist, image_url, preview_url, spotify_url, spotify_track_id, created_at, resolver_status, expires_at, cache_version");

      const cachedMap = new Map<string, {
        image_url: string | null;
        preview_url: string | null;
        spotify_url: string | null;
        spotify_track_id: string | null;
        created_at: string;
        resolver_status: string | null;
        expires_at: string | null;
        cache_version: number | null;
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

          // If this is a "not found" entry, check if it's expired or stale
          if (!isResolved) {
            const isExpired = c.expires_at && new Date(c.expires_at).getTime() < Date.now();
            const age = Date.now() - new Date(c.created_at).getTime();
            const isStale = !c.expires_at && age > NOT_FOUND_CACHE_MAX_AGE_MS;

            if (isExpired || isStale) {
              if (DEBUG) console.log(`♻️ [Cache] Expired not-found for "${s.title}" by ${s.artist} (expires_at=${c.expires_at}, age=${Math.round(age / 3600000)}h) — will retry`);
              uncached.push(s);
              continue;
            }
          }

          // FIX #1: Synthesize spotify_url from spotify_track_id if missing
          const spotifyUrl = c.spotify_url || spotifyUrlFromId(c.spotify_track_id);

          songResults[key] = {
            status: isResolved ? "resolved" : "not_found",
            image_url: c.image_url,
            preview_url: c.preview_url,
            spotify_url: spotifyUrl,
            spotify_track_id: c.spotify_track_id,
          };
          if (DEBUG) console.log(`📦 [Cache] ${isResolved ? "HIT" : "NOT_FOUND"} "${s.title}" by ${s.artist} (url=${!!spotifyUrl}, id=${!!c.spotify_track_id})`);
        } else {
          uncached.push(s);
        }
      }

      if (uncached.length > 0) {
        if (DEBUG) console.log(`[Spotify] Need to look up ${uncached.length} uncached songs`);

        // FIX #5: Safe token acquisition with explicit null typing
        let token: string | null = null;
        try {
          token = await getSpotifyToken();
        } catch (authErr) {
          console.error(`[Auth] Cannot get token: ${authErr}`);
          // Auth failure → all uncached songs are "error"
          for (const s of uncached) {
            const key = `${s.title}|||${s.artist}`;
            songResults[key] = { status: "error", image_url: null, preview_url: null, spotify_url: null, spotify_track_id: null };
          }
        }

        if (token) {
          const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

          const processOneSong = async (s: SongQuery): Promise<ProcessResult> => {
            const sanitizedArtist = sanitizeArtist(s.artist);
            if (DEBUG) console.log(`🔍 [Lookup] "${s.title}" by ${s.artist} (normalized: "${normalizeTitle(s.title)}", artist: "${sanitizedArtist}")`);

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
                  if (DEBUG) console.log(`  ⚠️ Track ID ${s.spotify_id} returned ${httpStatus}, falling back to search`);
                } else {
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
                // FIX #2: Track whether we got at least one successful 200 response
                let gotSuccessful200 = false;

                for (const strat of strategies) {
                  if (tracks.length > 0) break;

                  const encoded = encodeURIComponent(strat.q);
                  const { response, rateLimited, httpStatus } = await spotifyFetch(
                    `https://api.spotify.com/v1/search?q=${encoded}&type=track&limit=${strat.limit}`, token!
                  );

                  if (rateLimited) {
                    hitRateLimit = true;
                    if (DEBUG) console.log(`  [Search:${strat.label}] → 429 rate limited`);
                    break;
                  }

                  if (!response) {
                    if (httpStatus && httpStatus >= 500) {
                      hitServerError = true;
                      if (DEBUG) console.log(`  [Search:${strat.label}] → ${httpStatus} server error`);
                    } else {
                      if (DEBUG) console.log(`  [Search:${strat.label}] → network error (httpStatus=${httpStatus})`);
                    }
                    continue;
                  }

                  if (response.ok) {
                    gotSuccessful200 = true;
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
                  // FIX #2: Only classify as not_found if we got at least one 200
                  if (!gotSuccessful200) {
                    console.log(`  [Result] "${s.title}" → error (no successful API response)`);
                    return fail("error");
                  }
                  console.log(`  [Result] "${s.title}" → not_found (genuine miss, verified via 200)`);
                  return fail("not_found");
                }

                // 3. Match evaluation — log all candidates
                if (DEBUG && tracks.length > 0) {
                  console.log(`  [Candidates] ${tracks.length} tracks for "${s.title}" by ${s.artist}:`);
                  for (const t of tracks.slice(0, 5)) {
                    const candidateArtists = t.artists?.map((a: any) => a.name).join(", ") || "?";
                    const hasArt = !!(t.album?.images?.length);
                    console.log(`    → "${t.name}" by ${candidateArtists} | id=${t.id} | art=${hasArt} | preview=${!!t.preview_url}`);
                  }
                }

                // Try: artist+title match
                track = tracks.find((t: any) => {
                  const names = t.artists?.map((a: any) => a.name) || [];
                  const tm = titlesMatch(s.title, t.name);
                  const am = artistsMatch(s.artist, names);
                  if (DEBUG) console.log(`    [Eval] "${t.name}" by ${names.join(",")} — title=${tm}, artist=${am}`);
                  return am && tm;
                });

                // Fallback: artist-only match
                if (!track) {
                  track = tracks.find((t: any) => {
                    const names = t.artists?.map((a: any) => a.name) || [];
                    return artistsMatch(s.artist, names);
                  });
                  if (track && DEBUG) console.log(`  ⚠️ Artist-only match: "${track.name}" by ${track.artists.map((a: any) => a.name).join(", ")}`);
                }

                // FIX #4: Title-only fallback — only if exactly 1 candidate matches title
                if (!track) {
                  const titleMatches = tracks.filter((t: any) => titlesMatch(s.title, t.name));
                  if (titleMatches.length === 1) {
                    track = titleMatches[0];
                    if (DEBUG) console.log(`  ⚠️ Title-only match (single candidate): "${track.name}" by ${track.artists.map((a: any) => a.name).join(", ")}`);
                  } else if (titleMatches.length > 1) {
                    if (DEBUG) console.log(`  ❌ Title-only match rejected: ${titleMatches.length} ambiguous candidates for "${s.title}"`);
                  }
                }

                if (!track) {
                  console.log(`  [Result] "${s.title}" → not_found (${tracks.length} candidates, none matched safely)`);
                  return fail("not_found");
                }
              }

              // 4. Extract metadata from matched track
              const imageUrl = track?.album?.images?.[1]?.url || track?.album?.images?.[0]?.url || null;
              const previewUrl = track?.preview_url || null;
              const spotifyTrackId = track?.id || s.spotify_id || null;
              // Always ensure spotify_url is populated for resolved tracks
              const spotifyUrl = track?.external_urls?.spotify || spotifyUrlFromId(spotifyTrackId);

              console.log(`  [Result] "${s.title}" → resolved (artwork=${imageUrl ? "yes" : "no"}, preview=${previewUrl ? "yes" : "no"}, id=${spotifyTrackId}, url=${!!spotifyUrl})`);
              return { song: s, status: "resolved" as ResolverStatus, imageUrl, previewUrl, spotifyUrl, spotifyTrackId };
            } catch (err) {
              console.error(`  [Result] "${s.title}" → error: ${err instanceof Error ? err.message : "unknown"}`);
              return fail("error");
            }
          };

          // FIX #3: Process up to MAX_SONGS_PER_BATCH, but give overflow songs a terminal status
          const toProcess = uncached.slice(0, MAX_SONGS_PER_BATCH);
          const overflow = uncached.slice(MAX_SONGS_PER_BATCH);

          const results: ProcessResult[] = [];
          for (const s of toProcess) {
            const result = await processOneSong(s);
            results.push(result);
            await delay(150);
          }

          // FIX #3: Overflow songs get "temporary_failure" so tiles don't stay stuck
          if (overflow.length > 0) {
            console.log(`⚠️ [Overflow] ${overflow.length} songs exceeded batch limit — returning temporary_failure`);
            for (const s of overflow) {
              results.push({
                song: s,
                status: "temporary_failure",
                imageUrl: null,
                previewUrl: null,
                spotifyUrl: null,
                spotifyTrackId: null,
              });
            }
          }

          // Cache writes — ONLY resolved and not_found (genuine misses)
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
              resolver_status: r.status,
              cache_version: CACHE_VERSION,
              expires_at: r.status === "not_found"
                ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                : null,
            }));

          if (toInsert.length > 0) {
            const resolved = toInsert.filter(r => r.spotify_url).length;
            const notFound = toInsert.length - resolved;
            console.log(`💾 [Cache Write] ${toInsert.length} entries (${resolved} resolved, ${notFound} genuine not_found) v${CACHE_VERSION}`);
            await supabase.from("song_image_cache").upsert(toInsert, { onConflict: "name,artist" });
          }

          const skipped = results.filter(r => r.status === "temporary_failure" || r.status === "error");
          if (skipped.length > 0) {
            console.log(`⏭️ [Cache Skip] ${skipped.length} songs NOT cached (${skipped.map(r => r.status).join(", ")})`);
          }

          // Build response for all processed results
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
        } // end if (token)
      }

      // FIX #7: Safety net — ensure every requested song has a result
      for (const s of songs) {
        const key = `${s.title}|||${s.artist}`;
        if (!songResults[key]) {
          console.warn(`⚠️ [Safety] Song "${s.title}" by ${s.artist} had no result — assigning error`);
          songResults[key] = { status: "error", image_url: null, preview_url: null, spotify_url: null, spotify_track_id: null };
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
        // FIX #6: Wrap artist token acquisition safely
        let artistToken: string | null = null;
        try {
          artistToken = await getSpotifyToken();
        } catch (authErr) {
          console.error(`[Auth] Artist image lookup skipped — token failure: ${authErr}`);
        }

        if (artistToken) {
          const fetches = uncached.slice(0, 10).map(async (a) => {
            const { response, rateLimited } = await spotifyFetch(
              `https://api.spotify.com/v1/search?q=${encodeURIComponent(a.name)}&type=artist&limit=1`, artistToken!
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
        } else {
          // Return null images gracefully for all uncached artists
          for (const a of uncached) {
            artistResults[a.name] = null;
          }
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
