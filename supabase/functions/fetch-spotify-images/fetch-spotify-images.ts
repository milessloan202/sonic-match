import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// fetch-spotify-images — Phase 2: cache-first + queue-backed
//
// Flow for each requested song:
//   1. Normalize title + artist
//   2. Check song_image_cache by normalized key
//      a. FRESH resolved hit  → return immediately (no Spotify call)
//      b. STALE resolved hit  → return cached data + enqueue background refresh
//      c. not_found (fresh)   → return not_found immediately
//      d. not_found (expired) → enqueue retry, return temporary_failure
//      e. MISS                → attempt live resolution (up to LIVE_RESOLVE_LIMIT)
//                               if over limit → enqueue + return temporary_failure
//   3. Live resolution uses the same 3-strategy Spotify search as before
//   4. Writes only resolved / not_found to cache (never temporary_failure/error)
//   5. Enqueues work into resolution_jobs with dedup_key to avoid double-queueing
//
// Frontend contract is unchanged: every song always gets one of:
//   resolved | not_found | temporary_failure | error
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEBUG = true;
const CACHE_VERSION = 3;
const LIVE_RESOLVE_LIMIT = 5;
const RESOLVED_FRESH_MS = 30 * 24 * 60 * 60 * 1000;
const NOT_FOUND_TTL_MS = 24 * 60 * 60 * 1000;

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let rateLimitedUntil = 0;

type ResolverStatus = "resolved" | "not_found" | "temporary_failure" | "error";

interface SongQuery { title: string; artist: string; spotify_id?: string }
interface ArtistQuery { name: string }

interface SongResolverResult {
  status: ResolverStatus;
  image_url: string | null;
  preview_url: string | null;
  spotify_url: string | null;
  spotify_track_id: string | null;
}

interface ProcessResult {
  song: SongQuery;
  status: ResolverStatus;
  imageUrl: string | null;
  previewUrl: string | null;
  spotifyUrl: string | null;
  spotifyTrackId: string | null;
  albumId: string | null;
  artistIds: string[];
  reason: string | null;
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

function normalizeArtist(artist: string): string {
  return artist
    .toLowerCase()
    .replace(/\s*&\s*/g, " ")
    .replace(/\s+vs\.?\s+/gi, " ")
    .replace(/\s+feat\.?\s+/gi, " ")
    .replace(/\s+ft\.?\s+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cacheKey(title: string, artist: string): string {
  return `${normalizeTitle(title)}|||${normalizeArtist(artist)}`;
}

function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

function artistsMatch(queryArtist: string, trackArtists: string[]): boolean {
  const normalized = normalizeArtist(queryArtist);
  const queryParts = normalized.split(/\s+the\s+/i).map(p => p.trim()).filter(Boolean);
  return trackArtists.some((a) => {
    const na = a.toLowerCase().trim();
    if (na === normalized || na.includes(normalized) || normalized.includes(na)) return true;
    if (queryParts.some(part => na.includes(part) || part.includes(na))) return true;
    return false;
  });
}

function spotifyUrlFromId(trackId: string | null): string | null {
  if (!trackId) return null;
  return `https://open.spotify.com/track/${trackId}`;
}

async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID")!;
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET")!;
  const basic = btoa(`${clientId}:${clientSecret}`);
  if (DEBUG) console.log("[Auth] Requesting Spotify access token");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  if (DEBUG) console.log(`[Auth] Token acquired, expires in ${data.expires_in}s`);
  return cachedToken!;
}

async function spotifyFetch(url: string, token: string): Promise<{
  response: Response | null; rateLimited: boolean; httpStatus: number | null; retryAfter: number | null;
}> {
  if (Date.now() < rateLimitedUntil) {
    if (DEBUG) console.log(`  [Circuit] Skipping — rate limited for ${Math.round((rateLimitedUntil - Date.now()) / 1000)}s more`);
    return { response: null, rateLimited: true, httpStatus: 429, retryAfter: null };
  }
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "60", 10);
      try { await res.text(); } catch { /* drain */ }
      rateLimitedUntil = Date.now() + retryAfter * 1000;
      console.warn(`⛔ [Spotify] 429 — circuit open for ${retryAfter}s`);
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

async function resolveOneSong(s: SongQuery, token: string): Promise<ProcessResult> {
  const fail = (status: ResolverStatus, reason: string): ProcessResult => ({
    song: s, status, reason,
    imageUrl: null, previewUrl: null, spotifyUrl: null,
    spotifyTrackId: null, albumId: null, artistIds: [],
  });

  const sanitizedArtist = normalizeArtist(s.artist);
  if (DEBUG) console.log(`🔍 [Lookup] "${s.title}" by ${s.artist}`);

  try {
    let track: any = null;

    if (s.spotify_id) {
      const { response, rateLimited, httpStatus } = await spotifyFetch(
        `https://api.spotify.com/v1/tracks/${s.spotify_id}`, token
      );
      if (rateLimited) return fail("temporary_failure", "rate_limited");
      if (response?.ok) { track = await response.json(); }
      else if (httpStatus && httpStatus >= 500) return fail("temporary_failure", `spotify_${httpStatus}`);
      else if (response) { try { await response.text(); } catch { /* drain */ } }
      else return fail("error", "network_failure");
    }

    if (!track) {
      const strategies = [
        { label: "strict",     q: `track:"${s.title}" artist:"${sanitizedArtist}"`, limit: 5  },
        { label: "broad",      q: `${s.title} ${sanitizedArtist}`,                  limit: 10 },
        { label: "title-only", q: `track:"${s.title}"`,                             limit: 10 },
      ];

      let tracks: any[] = [];
      let hitRateLimit = false;
      let hitServerError = false;
      let gotSuccessful200 = false;

      for (const strat of strategies) {
        if (tracks.length > 0) break;
        const encoded = encodeURIComponent(strat.q);
        const { response, rateLimited, httpStatus } = await spotifyFetch(
          `https://api.spotify.com/v1/search?q=${encoded}&type=track&limit=${strat.limit}`, token
        );
        if (rateLimited) { hitRateLimit = true; break; }
        if (!response && httpStatus && httpStatus >= 500) { hitServerError = true; continue; }
        if (!response) continue;
        if (response.ok) {
          gotSuccessful200 = true;
          const data = await response.json();
          tracks = data?.tracks?.items || [];
          if (DEBUG) console.log(`  [Search:${strat.label}] → ${tracks.length} results`);
        } else { try { await response.text(); } catch { /* drain */ } }
      }

      if (tracks.length === 0) {
        if (hitRateLimit)    return fail("temporary_failure", "rate_limited");
        if (hitServerError)  return fail("temporary_failure", "spotify_server_error");
        if (!gotSuccessful200) return fail("error", "no_successful_api_response");
        return fail("not_found", "no_match");
      }

      track = tracks.find((t: any) => {
        const names = t.artists?.map((a: any) => a.name) || [];
        return artistsMatch(s.artist, names) && titlesMatch(s.title, t.name);
      });

      if (!track) {
        track = tracks.find((t: any) => {
          const names = t.artists?.map((a: any) => a.name) || [];
          return artistsMatch(s.artist, names);
        });
        if (track && DEBUG) console.log(`  ⚠️ Artist-only match: "${track.name}"`);
      }

      if (!track) {
        const titleMatches = tracks.filter((t: any) => titlesMatch(s.title, t.name));
        if (titleMatches.length === 1) {
          track = titleMatches[0];
          if (DEBUG) console.log(`  ⚠️ Title-only match (single): "${track.name}"`);
        }
      }

      if (!track) {
        if (DEBUG) console.log(`  ❌ No match for "${s.title}"`);
        return fail("not_found", "no_match");
      }
    }

    const imageUrl       = track?.album?.images?.[1]?.url || track?.album?.images?.[0]?.url || null;
    const previewUrl     = track?.preview_url || null;
    const spotifyTrackId = track?.id || s.spotify_id || null;
    const spotifyUrl     = track?.external_urls?.spotify || spotifyUrlFromId(spotifyTrackId);
    const albumId        = track?.album?.id || null;
    const artistIds      = (track?.artists || []).map((a: any) => a.id).filter(Boolean) as string[];

    if (DEBUG) console.log(`  ✅ "${s.title}" resolved (id=${spotifyTrackId}, art=${!!imageUrl})`);
    return { song: s, status: "resolved", reason: null, imageUrl, previewUrl, spotifyUrl, spotifyTrackId, albumId, artistIds };

  } catch (err) {
    console.error(`  [Error] "${s.title}": ${err instanceof Error ? err.message : "unknown"}`);
    return fail("error", "exception");
  }
}

async function enqueueSong(supabase: any, s: SongQuery, reason: string, delayMs = 0): Promise<void> {
  const dedupKey = cacheKey(s.title, s.artist);
  const { error } = await supabase
    .from("resolution_jobs")
    .upsert(
      {
        job_type:     "resolve_song",
        payload:      { title: s.title, artist: s.artist, spotify_id: s.spotify_id || null },
        status:       "pending",
        dedup_key:    dedupKey,
        available_at: new Date(Date.now() + delayMs).toISOString(),
        last_error:   reason,
      },
      { onConflict: "dedup_key", ignoreDuplicates: true }
    );
  if (error) console.warn(`[Queue] Failed to enqueue "${s.title}": ${error.message}`);
  else if (DEBUG) console.log(`📥 [Queue] "${s.title}" enqueued (reason=${reason})`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { songs, artists }: { songs?: SongQuery[]; artists?: ArtistQuery[] } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase    = createClient(supabaseUrl, supabaseKey);

    const songResults:   Record<string, SongResolverResult> = {};
    const artistResults: Record<string, string | null>      = {};

    // ── Songs ────────────────────────────────────────────────────────────────
    if (songs?.length) {
      const { data: cached } = await supabase
        .from("song_image_cache")
        .select("name, artist, normalized_title, normalized_artist, image_url, preview_url, spotify_url, spotify_track_id, resolver_status, expires_at, updated_at, cache_version, album_id, artist_ids");

      const cachedMap = new Map<string, any>();
      (cached || []).forEach((r: any) => {
        const nKey   = `${r.normalized_title || normalizeTitle(r.name)}|||${r.normalized_artist || normalizeArtist(r.artist)}`;
        const origKey = `${r.name}|||${r.artist}`;
        cachedMap.set(nKey, r);
        cachedMap.set(origKey, r);
      });

      const toResolve: SongQuery[] = [];

      for (const s of songs) {
        const nKey    = cacheKey(s.title, s.artist);
        const origKey = `${s.title}|||${s.artist}`;
        const c       = cachedMap.get(nKey) || cachedMap.get(origKey);

        if (c) {
          const isResolved = !!(c.spotify_url || c.spotify_track_id);
          const spotifyUrl = c.spotify_url || spotifyUrlFromId(c.spotify_track_id);
          const now        = Date.now();

          if (isResolved) {
            const age     = now - new Date(c.updated_at || 0).getTime();
            const isStale = age > RESOLVED_FRESH_MS;
            songResults[origKey] = {
              status: "resolved",
              image_url: c.image_url, preview_url: c.preview_url,
              spotify_url: spotifyUrl, spotify_track_id: c.spotify_track_id,
            };
            if (isStale) {
              if (DEBUG) console.log(`♻️ [Stale] "${s.title}" — serving cache, enqueuing refresh`);
              enqueueSong(supabase, s, "stale_refresh");
            } else {
              if (DEBUG) console.log(`📦 [HIT] "${s.title}"`);
            }
            continue;
          }

          const isExpired = c.expires_at
            ? new Date(c.expires_at).getTime() < now
            : (now - new Date(c.created_at || 0).getTime()) > NOT_FOUND_TTL_MS;

          if (!isExpired) {
            if (DEBUG) console.log(`📦 [NOT_FOUND fresh] "${s.title}"`);
            songResults[origKey] = { status: "not_found", image_url: null, preview_url: null, spotify_url: null, spotify_track_id: null };
            continue;
          }

          if (DEBUG) console.log(`♻️ [NOT_FOUND expired] "${s.title}" — enqueuing retry`);
          await enqueueSong(supabase, s, "not_found_retry");
          songResults[origKey] = { status: "temporary_failure", image_url: null, preview_url: null, spotify_url: null, spotify_track_id: null };
          continue;
        }

        toResolve.push(s);
      }

      if (toResolve.length > 0) {
        const live     = toResolve.slice(0, LIVE_RESOLVE_LIMIT);
        const overflow = toResolve.slice(LIVE_RESOLVE_LIMIT);

        for (const s of overflow) {
          await enqueueSong(supabase, s, "overflow");
          songResults[`${s.title}|||${s.artist}`] = { status: "temporary_failure", image_url: null, preview_url: null, spotify_url: null, spotify_track_id: null };
        }

        if (live.length > 0) {
          let token: string | null = null;
          try { token = await getSpotifyToken(); }
          catch (authErr) {
            console.error(`[Auth] Token failure: ${authErr}`);
            for (const s of live) {
              await enqueueSong(supabase, s, "auth_failure");
              songResults[`${s.title}|||${s.artist}`] = { status: "error", image_url: null, preview_url: null, spotify_url: null, spotify_track_id: null };
            }
          }

          if (token) {
            const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
            const liveResults: ProcessResult[] = [];
            for (let i = 0; i < live.length; i++) {
              liveResults.push(await resolveOneSong(live[i], token));
              if (i < live.length - 1) await delay(150);
            }

            const toInsert = liveResults
              .filter(r => r.status === "resolved" || r.status === "not_found")
              .map(r => ({
                name: r.song.title, artist: r.song.artist,
                normalized_title:  normalizeTitle(r.song.title),
                normalized_artist: normalizeArtist(r.song.artist),
                image_url: r.imageUrl, preview_url: r.previewUrl,
                spotify_url: r.spotifyUrl, spotify_track_id: r.spotifyTrackId,
                album_id: r.albumId, artist_ids: r.artistIds.length > 0 ? r.artistIds : null,
                youtube_thumbnail_url: null,
                resolver_status: r.status, reason: r.reason,
                cache_version: CACHE_VERSION,
                expires_at: r.status === "not_found"
                  ? new Date(Date.now() + NOT_FOUND_TTL_MS).toISOString() : null,
              }));

            if (toInsert.length > 0) {
              console.log(`💾 [Cache Write] ${toInsert.length} entries v${CACHE_VERSION}`);
              await supabase.from("song_image_cache").upsert(toInsert, { onConflict: "name,artist" });
            }

            for (const r of liveResults.filter(r => r.status === "temporary_failure" || r.status === "error")) {
              await enqueueSong(supabase, r.song, r.reason || r.status, r.reason === "rate_limited" ? 60_000 : 0);
            }

            for (const r of liveResults) {
              songResults[`${r.song.title}|||${r.song.artist}`] = {
                status: r.status, image_url: r.imageUrl, preview_url: r.previewUrl,
                spotify_url: r.spotifyUrl, spotify_track_id: r.spotifyTrackId,
              };
            }
          }
        }
      }

      for (const s of songs) {
        const origKey = `${s.title}|||${s.artist}`;
        if (!songResults[origKey]) {
          console.warn(`⚠️ [Safety] No result for "${s.title}"`);
          songResults[origKey] = { status: "error", image_url: null, preview_url: null, spotify_url: null, spotify_track_id: null };
        }
      }
    }

    // ── Artists ───────────────────────────────────────────────────────────────
    if (artists?.length) {
      const { data: cached } = await supabase.from("artist_image_cache").select("name, image_url");
      const cachedMap = new Map<string, string | null>();
      (cached || []).forEach((r: any) => cachedMap.set(r.name, r.image_url));

      const uncached: ArtistQuery[] = [];
      for (const a of artists) {
        if (cachedMap.has(a.name)) artistResults[a.name] = cachedMap.get(a.name)!;
        else uncached.push(a);
      }

      if (uncached.length > 0) {
        let artistToken: string | null = null;
        try { artistToken = await getSpotifyToken(); }
        catch (authErr) { console.error(`[Auth] Artist token failure: ${authErr}`); }

        if (artistToken) {
          const fetches = uncached.slice(0, 10).map(async (a) => {
            const { response, rateLimited } = await spotifyFetch(
              `https://api.spotify.com/v1/search?q=${encodeURIComponent(a.name)}&type=artist&limit=1`, artistToken!
            );
            if (rateLimited || !response || !response.ok) return { artist: a, imageUrl: null, shouldCache: !rateLimited };
            const data   = await response.json();
            const artist = data?.artists?.items?.[0];
            return { artist: a, imageUrl: artist?.images?.[1]?.url || artist?.images?.[0]?.url || null, shouldCache: true };
          });

          const results = await Promise.all(fetches);
          const toInsert = results.filter(r => r.shouldCache).map(r => ({ name: r.artist.name, image_url: r.imageUrl }));
          if (toInsert.length > 0) await supabase.from("artist_image_cache").upsert(toInsert, { onConflict: "name" });
          for (const r of results) artistResults[r.artist.name] = r.imageUrl;
        } else {
          for (const a of uncached) artistResults[a.name] = null;
        }
      }
    }

    return new Response(
      JSON.stringify({ songs: songResults, artists: artistResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("fetch-spotify-images error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
