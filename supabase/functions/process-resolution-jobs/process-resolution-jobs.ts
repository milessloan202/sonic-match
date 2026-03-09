import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// process-resolution-jobs — Phase 3: background job worker
//
// Called by:
//   - A Supabase cron (pg_cron) every 2 minutes, OR
//   - Manually via POST to the function URL (e.g. from a Vercel cron)
//   - POST body (all optional): { batch_size?: number, dry_run?: boolean }
//
// For each pending job it:
//   1. Claims a batch (sets status = "processing") atomically
//   2. Resolves each song against Spotify
//   3. Writes resolved / not_found back to song_image_cache
//   4. Marks job done / failed / retries with exponential backoff
//   5. Never caches temporary_failure or error permanently
//
// Rate limit safety:
//   - Processes at most BATCH_SIZE jobs per invocation
//   - 200ms delay between Spotify calls
//   - Trips circuit breaker on 429, aborts remaining jobs for this run
//   - On 429: sets available_at = now() + retryAfter, resets status to pending
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEBUG            = true;
const DEFAULT_BATCH    = 10;
const MAX_BATCH        = 25;
const CALL_DELAY_MS    = 200;
const NOT_FOUND_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_VERSION    = 3;

// Exponential backoff delays per attempt (ms)
const RETRY_DELAYS = [0, 60_000, 300_000, 900_000]; // 0s, 1m, 5m, 15m

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let rateLimitedUntil = 0;

// ─── Types ────────────────────────────────────────────────────────────────────

type ResolverStatus = "resolved" | "not_found" | "temporary_failure" | "error";

interface JobRow {
  id: string;
  job_type: string;
  payload: Record<string, any>;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
}

interface ResolveResult {
  status: ResolverStatus;
  reason: string | null;
  imageUrl: string | null;
  previewUrl: string | null;
  spotifyUrl: string | null;
  spotifyTrackId: string | null;
  albumId: string | null;
  artistIds: string[];
}

// ─── Normalization ────────────────────────────────────────────────────────────

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

// ─── Matching helpers ─────────────────────────────────────────────────────────

function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function artistsMatch(queryArtist: string, trackArtists: string[]): boolean {
  const normalized = normalizeArtist(queryArtist);
  const queryParts = normalized.split(/\s+the\s+/i).map(p => p.trim()).filter(Boolean);
  return trackArtists.some((a) => {
    const na = a.toLowerCase().trim();
    if (na === normalized || na.includes(normalized) || normalized.includes(na)) return true;
    return queryParts.some(part => na.includes(part) || part.includes(na));
  });
}

function spotifyUrlFromId(id: string | null): string | null {
  return id ? `https://open.spotify.com/track/${id}` : null;
}

// ─── Spotify auth ─────────────────────────────────────────────────────────────

async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  const clientId     = Deno.env.get("SPOTIFY_CLIENT_ID")!;
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET")!;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);
  const data     = await res.json();
  cachedToken    = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken!;
}

// ─── Spotify fetch with circuit breaker ───────────────────────────────────────

async function spotifyFetch(url: string, token: string): Promise<{
  response: Response | null;
  rateLimited: boolean;
  httpStatus: number | null;
  retryAfter: number | null;
}> {
  if (Date.now() < rateLimitedUntil) {
    return { response: null, rateLimited: true, httpStatus: 429, retryAfter: null };
  }
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "60", 10);
      try { await res.text(); } catch { /* drain */ }
      rateLimitedUntil = Date.now() + retryAfter * 1000;
      console.warn(`⛔ [Worker] 429 — circuit open for ${retryAfter}s`);
      return { response: null, rateLimited: true, httpStatus: 429, retryAfter };
    }
    if (res.status >= 500) {
      try { await res.text(); } catch { /* drain */ }
      return { response: null, rateLimited: false, httpStatus: res.status, retryAfter: null };
    }
    return { response: res, rateLimited: false, httpStatus: res.status, retryAfter: null };
  } catch (err) {
    console.error(`[Worker] Network error: ${err instanceof Error ? err.message : "unknown"}`);
    return { response: null, rateLimited: false, httpStatus: null, retryAfter: null };
  }
}

// ─── Resolve one song against Spotify ────────────────────────────────────────

async function resolveSong(
  title: string,
  artist: string,
  spotifyId: string | null,
  token: string,
): Promise<ResolveResult> {
  const fail = (status: ResolverStatus, reason: string): ResolveResult => ({
    status, reason, imageUrl: null, previewUrl: null,
    spotifyUrl: null, spotifyTrackId: null, albumId: null, artistIds: [],
  });

  try {
    let track: any = null;

    // Direct track ID lookup first
    if (spotifyId) {
      const { response, rateLimited, httpStatus } = await spotifyFetch(
        `https://api.spotify.com/v1/tracks/${spotifyId}`, token
      );
      if (rateLimited) return fail("temporary_failure", "rate_limited");
      if (response?.ok) track = await response.json();
      else if (httpStatus && httpStatus >= 500) return fail("temporary_failure", `spotify_${httpStatus}`);
      else if (response) { try { await response.text(); } catch { /* drain */ } }
    }

    // Search fallback
    if (!track) {
      const sanitized = normalizeArtist(artist);
      const strategies = [
        { label: "strict",     q: `track:"${title}" artist:"${sanitized}"`, limit: 5  },
        { label: "broad",      q: `${title} ${sanitized}`,                  limit: 10 },
        { label: "title-only", q: `track:"${title}"`,                       limit: 10 },
      ];

      let tracks: any[]      = [];
      let hitRateLimit        = false;
      let hitServerError      = false;
      let gotSuccessful200    = false;

      for (const strat of strategies) {
        if (tracks.length > 0) break;
        const { response, rateLimited, httpStatus } = await spotifyFetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(strat.q)}&type=track&limit=${strat.limit}`,
          token
        );
        if (rateLimited) { hitRateLimit = true; break; }
        if (!response && httpStatus && httpStatus >= 500) { hitServerError = true; continue; }
        if (!response) continue;
        if (response.ok) {
          gotSuccessful200 = true;
          const data = await response.json();
          tracks = data?.tracks?.items || [];
          if (DEBUG) console.log(`  [Search:${strat.label}] "${title}" → ${tracks.length} results`);
        } else { try { await response.text(); } catch { /* drain */ } }
      }

      if (tracks.length === 0) {
        if (hitRateLimit)      return fail("temporary_failure", "rate_limited");
        if (hitServerError)    return fail("temporary_failure", "spotify_server_error");
        if (!gotSuccessful200) return fail("error", "no_successful_api_response");
        return fail("not_found", "no_match");
      }

      // Match evaluation
      track = tracks.find((t: any) => {
        const names = t.artists?.map((a: any) => a.name) || [];
        return artistsMatch(artist, names) && titlesMatch(title, t.name);
      });

      if (!track) {
        track = tracks.find((t: any) => artistsMatch(artist, t.artists?.map((a: any) => a.name) || []));
        if (track && DEBUG) console.log(`  ⚠️ Artist-only match: "${track.name}"`);
      }

      if (!track) {
        const titleMatches = tracks.filter((t: any) => titlesMatch(title, t.name));
        if (titleMatches.length === 1) {
          track = titleMatches[0];
          if (DEBUG) console.log(`  ⚠️ Title-only match: "${track.name}"`);
        }
      }

      if (!track) return fail("not_found", "no_match");
    }

    return {
      status:          "resolved",
      reason:          null,
      imageUrl:        track?.album?.images?.[1]?.url || track?.album?.images?.[0]?.url || null,
      previewUrl:      track?.preview_url || null,
      spotifyUrl:      track?.external_urls?.spotify || spotifyUrlFromId(track?.id || spotifyId),
      spotifyTrackId:  track?.id || spotifyId || null,
      albumId:         track?.album?.id || null,
      artistIds:       (track?.artists || []).map((a: any) => a.id).filter(Boolean),
    };

  } catch (err) {
    console.error(`[Worker] Exception resolving "${title}": ${err instanceof Error ? err.message : "unknown"}`);
    return fail("error", "exception");
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Simple auth: require the Supabase anon key or service key in Authorization header
  // (The function is invoked by cron with service role — this prevents public abuse)
  const authHeader = req.headers.get("Authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey    = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const providedKey = authHeader.replace("Bearer ", "");
  if (providedKey !== serviceKey && providedKey !== anonKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body is fine */ }

    const batchSize = Math.min(body.batch_size ?? DEFAULT_BATCH, MAX_BATCH);
    const dryRun    = body.dry_run === true;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase    = createClient(supabaseUrl, serviceKey);

    // ── Claim a batch of pending jobs atomically ──────────────────────────────
    // We update status → "processing" in one query to avoid double-processing
    // across concurrent worker invocations.

    const now = new Date().toISOString();

    const { data: jobs, error: claimError } = await supabase
      .from("resolution_jobs")
      .update({ status: "processing", updated_at: now })
      .eq("status", "pending")
      .lte("available_at", now)
      .lt("attempt_count", supabase.rpc ? undefined : 999) // handled by max_attempts check below
      .order("available_at", { ascending: true })
      .limit(batchSize)
      .select("id, job_type, payload, attempt_count, max_attempts, last_error");

    if (claimError) {
      console.error("[Worker] Failed to claim jobs:", claimError.message);
      return new Response(
        JSON.stringify({ error: "Failed to claim jobs", detail: claimError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claimed = (jobs || []) as JobRow[];
    if (claimed.length === 0) {
      if (DEBUG) console.log("[Worker] No pending jobs");
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending jobs" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Worker] Claimed ${claimed.length} jobs (dry_run=${dryRun})`);

    if (dryRun) {
      // Release claimed jobs back to pending
      await supabase
        .from("resolution_jobs")
        .update({ status: "pending" })
        .in("id", claimed.map(j => j.id));
      return new Response(
        JSON.stringify({ dry_run: true, would_process: claimed.map(j => j.payload) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Get Spotify token once for the whole batch ────────────────────────────
    let token: string | null = null;
    try {
      token = await getSpotifyToken();
    } catch (authErr) {
      console.error("[Worker] Auth failure — releasing jobs:", authErr);
      // Release all claimed jobs back to pending
      await supabase
        .from("resolution_jobs")
        .update({ status: "pending", last_error: "auth_failure" })
        .in("id", claimed.map(j => j.id));
      return new Response(
        JSON.stringify({ error: "Spotify auth failure", processed: 0 }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Process each job ──────────────────────────────────────────────────────

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    const summary = { resolved: 0, not_found: 0, failed: 0, retrying: 0, rate_limited: 0 };

    for (let i = 0; i < claimed.length; i++) {
      const job = claimed[i];

      // Check max_attempts — if exceeded, mark cancelled
      if (job.attempt_count >= job.max_attempts) {
        console.warn(`[Worker] Job ${job.id} exceeded max_attempts (${job.max_attempts}) — cancelling`);
        await supabase
          .from("resolution_jobs")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", job.id);
        summary.failed++;
        continue;
      }

      if (job.job_type === "resolve_song") {
        const { title, artist, spotify_id } = job.payload as {
          title: string; artist: string; spotify_id?: string;
        };

        if (DEBUG) console.log(`[Worker] [${i + 1}/${claimed.length}] Processing "${title}" by ${artist}`);

        const result = await resolveSong(title, artist, spotify_id || null, token);

        if (result.status === "temporary_failure" && result.reason === "rate_limited") {
          // Circuit tripped — release remaining jobs and stop
          const retryAfter = Math.round((rateLimitedUntil - Date.now()) / 1000);
          const retryAt    = new Date(rateLimitedUntil).toISOString();

          console.warn(`[Worker] Rate limited — releasing remaining jobs, retry after ${retryAfter}s`);

          // Update this job and all remaining uncompleted ones to retry later
          const remainingIds = claimed.slice(i).map(j => j.id);
          await supabase
            .from("resolution_jobs")
            .update({
              status:       "pending",
              available_at: retryAt,
              last_error:   "rate_limited",
              updated_at:   new Date().toISOString(),
            })
            .in("id", remainingIds);

          summary.rate_limited += remainingIds.length;
          break; // stop processing for this invocation
        }

        const newAttemptCount = job.attempt_count + 1;

        if (result.status === "resolved" || result.status === "not_found") {
          // Write to cache
          const cacheRow = {
            name:              title,
            artist:            artist,
            normalized_title:  normalizeTitle(title),
            normalized_artist: normalizeArtist(artist),
            image_url:         result.imageUrl,
            preview_url:       result.previewUrl,
            spotify_url:       result.spotifyUrl,
            spotify_track_id:  result.spotifyTrackId,
            album_id:          result.albumId,
            artist_ids:        result.artistIds.length > 0 ? result.artistIds : null,
            youtube_thumbnail_url: null,
            resolver_status:   result.status,
            reason:            result.reason,
            cache_version:     CACHE_VERSION,
            expires_at:        result.status === "not_found"
              ? new Date(Date.now() + NOT_FOUND_TTL_MS).toISOString()
              : null,
          };

          await supabase
            .from("song_image_cache")
            .upsert(cacheRow, { onConflict: "name,artist" });

          // Mark job done
          await supabase
            .from("resolution_jobs")
            .update({
              status:        "done",
              attempt_count: newAttemptCount,
              last_error:    null,
              updated_at:    new Date().toISOString(),
            })
            .eq("id", job.id);

          if (result.status === "resolved") {
            console.log(`  ✅ Resolved "${title}"`);
            summary.resolved++;
          } else {
            console.log(`  ❌ Not found "${title}"`);
            summary.not_found++;
          }

        } else {
          // temporary_failure or error — retry with backoff if attempts remain
          const attemptsLeft = job.max_attempts - newAttemptCount;
          if (attemptsLeft > 0) {
            const backoffMs  = RETRY_DELAYS[Math.min(newAttemptCount, RETRY_DELAYS.length - 1)];
            const retryAt    = new Date(Date.now() + backoffMs).toISOString();
            await supabase
              .from("resolution_jobs")
              .update({
                status:        "pending",
                attempt_count: newAttemptCount,
                available_at:  retryAt,
                last_error:    result.reason || result.status,
                updated_at:    new Date().toISOString(),
              })
              .eq("id", job.id);
            console.log(`  ⚠️ "${title}" → ${result.status}, retry ${newAttemptCount}/${job.max_attempts} in ${backoffMs / 1000}s`);
            summary.retrying++;
          } else {
            // Out of attempts
            await supabase
              .from("resolution_jobs")
              .update({
                status:        "failed",
                attempt_count: newAttemptCount,
                last_error:    result.reason || result.status,
                updated_at:    new Date().toISOString(),
              })
              .eq("id", job.id);
            console.log(`  💀 "${title}" → permanently failed after ${newAttemptCount} attempts`);
            summary.failed++;
          }
        }
      } else {
        // Unknown job type — cancel immediately
        console.warn(`[Worker] Unknown job_type "${job.job_type}" — cancelling`);
        await supabase
          .from("resolution_jobs")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", job.id);
        summary.failed++;
      }

      // Pace between Spotify calls
      if (i < claimed.length - 1) await delay(CALL_DELAY_MS);
    }

    console.log(`[Worker] Done — ${JSON.stringify(summary)}`);

    return new Response(
      JSON.stringify({ processed: claimed.length, summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("[Worker] Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
