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

  const pipedInstances = [
    "https://api.piped.private.coffee",
  ];

  for (const instance of pipedInstances) {
    try {
      const url = `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = await res.json();
      const items = data?.items;
      if (!items?.length) continue;
      const videoUrl = items[0]?.url;
      if (!videoUrl) continue;
      const match = videoUrl.match(/[?&]v=([^&]+)/);
      const videoId = match?.[1];
      if (!videoId) continue;
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      console.log(`✅ [YouTube] Found: ${thumbnailUrl}`);
      return thumbnailUrl;
    } catch (e) {
      console.log(`[YouTube] Piped ${instance} failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  const invidiousInstances = [
    "https://invidious.nikkosphere.com",
    "https://inv.perditum.com",
    "https://invidious.materialio.us",
  ];

  for (const instance of invidiousInstances) {
    try {
      const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) continue;
      const videoId = data[0]?.videoId;
      if (!videoId) continue;
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      console.log(`✅ [YouTube] Found via Invidious: ${thumbnailUrl}`);
      return thumbnailUrl;
    } catch (e) {
      console.log(`[YouTube] Invidious ${instance} failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  console.log(`[YouTube] All instances failed for: "${query}"`);
  return null;
}

/** Normalize a title for fuzzy comparison */
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

/** Sanitize artist name for better Spotify search */
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
  // Split query artist into parts (e.g. "Lil Jon The East Side Boyz" -> ["lil jon", "east side boyz"])
  const queryParts = normalized.split(/\s+the\s+/i).map(p => p.trim()).filter(Boolean);
  
  return trackArtists.some((a) => {
    const na = a.toLowerCase().trim();
    // Direct match
    if (na === normalized || na.includes(normalized) || normalized.includes(na)) return true;
    // Check if any query part matches
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
  youtube_thumbnail_url: string | null;
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
        .select("name, artist, image_url, preview_url, spotify_url, youtube_thumbnail_url, spotify_track_id");

      const cachedMap = new Map<string, { image_url: string | null; preview_url: string | null; spotify_url: string | null; youtube_thumbnail_url: string | null; spotify_track_id: string | null }>();
      (cached || []).forEach((r: any) => {
        cachedMap.set(`${r.name}|||${r.artist}`, {
          image_url: r.image_url,
          preview_url: r.preview_url,
          spotify_url: r.spotify_url,
          youtube_thumbnail_url: r.youtube_thumbnail_url,
          spotify_track_id: r.spotify_track_id,
        });
      });

      const uncached: SongQuery[] = [];
      const needsYoutube: { key: string; song: SongQuery }[] = [];

      for (const s of songs) {
        const key = `${s.title}|||${s.artist}`;
        if (cachedMap.has(key)) {
          const c = cachedMap.get(key)!;
          const isVerified = !!(c.spotify_url || c.spotify_track_id);
          
          // Always return cached data (verified or not)
          songResults[key] = {
            image_url: c.image_url,
            preview_url: c.preview_url,
            spotify_url: c.spotify_url,
            youtube_thumbnail_url: c.youtube_thumbnail_url,
          };
          
          console.log(`📦 [Cache] "${s.title}" by ${s.artist} — verified=${isVerified}, artwork=${c.image_url ? "spotify" : c.youtube_thumbnail_url ? "youtube" : "none"}`);
          
          // If no artwork at all, queue for YouTube thumbnail
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

        // Process songs SEQUENTIALLY with delays to avoid Spotify 429 rate limiting
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
                await res.text(); // consume body
                console.log(`⚠️ [Spotify] Track ID ${s.spotify_id} failed with status ${res.status}`);
              }
            }

            // Fallback to search
            if (!track) {
              // Strategy 1: Strict field search with sanitized artist
              const strictQ = encodeURIComponent(`track:"${s.title}" artist:"${sanitizedArtist}"`);
              const res1 = await fetch(`https://api.spotify.com/v1/search?q=${strictQ}&type=track&limit=5`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              
              let tracks: any[] = [];
              if (res1.ok) {
                const data = await res1.json();
                tracks = data?.tracks?.items || [];
                console.log(`  [Spotify] Strict search returned ${tracks.length} results`);
              } else {
                await res1.text();
                console.log(`  [Spotify] Strict search returned status ${res1.status}`);
              }

              // Strategy 2: Broad keyword search
              if (tracks.length === 0) {
                console.log(`🔄 [Spotify] Trying broad search for "${s.title}" by ${sanitizedArtist}`);
                const broadQ = encodeURIComponent(`${s.title} ${sanitizedArtist}`);
                const res2 = await fetch(`https://api.spotify.com/v1/search?q=${broadQ}&type=track&limit=10`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (res2.ok) {
                  const data2 = await res2.json();
                  tracks = data2?.tracks?.items || [];
                  console.log(`  [Spotify] Broad search returned ${tracks.length} results`);
                } else {
                  await res2.text();
                }
              }

              // Strategy 3: Title-only search as last resort
              if (tracks.length === 0) {
                console.log(`🔄 [Spotify] Trying title-only search for "${s.title}"`);
                const titleQ = encodeURIComponent(`track:"${s.title}"`);
                const res3 = await fetch(`https://api.spotify.com/v1/search?q=${titleQ}&type=track&limit=10`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (res3.ok) {
                  const data3 = await res3.json();
                  tracks = data3?.tracks?.items || [];
                  console.log(`  [Spotify] Title-only search returned ${tracks.length} results`);
                } else {
                  await res3.text();
                }
              }
                
              if (tracks.length === 0) {
                console.log(`❌ [Spotify] No results for "${s.title}" by ${s.artist} (all strategies)`);
                return { song: s, imageUrl: null, previewUrl: null, spotifyUrl: null, spotifyTrackId: null, verified: false };
              }

              // Match with fuzzy title + artist matching
              track = tracks.find((t: any) => {
                const trackArtistNames = t.artists?.map((a: any) => a.name) || [];
                return artistsMatch(s.artist, trackArtistNames) && titlesMatch(s.title, t.name);
              });

              // If no fuzzy match, try artist-only match
              if (!track) {
                track = tracks.find((t: any) => {
                  const trackArtistNames = t.artists?.map((a: any) => a.name) || [];
                  return artistsMatch(s.artist, trackArtistNames);
                });
                if (track) {
                  console.log(`⚠️ [Spotify] Artist-only match for "${s.title}": found "${track.name}" by ${track.artists.map((a: any) => a.name).join(", ")}`);
                }
              }

              // Last resort: accept first result if title matches closely
              if (!track) {
                track = tracks.find((t: any) => titlesMatch(s.title, t.name));
                if (track) {
                  console.log(`⚠️ [Spotify] Title-only match for "${s.title}": accepted "${track.name}" by ${track.artists.map((a: any) => a.name).join(", ")}`);
                }
              }

              if (!track) {
                console.log(`❌ [Spotify] No match for "${s.title}" by ${s.artist} — ${tracks.length} candidates: ${tracks.slice(0, 3).map((t: any) => `"${t.name}" by ${t.artists.map((a: any) => a.name).join(", ")}`).join(" | ")}`);
                return { song: s, imageUrl: null, previewUrl: null, spotifyUrl: null, spotifyTrackId: null, verified: false };
              }

              console.log(`✅ [Spotify] MATCHED "${s.title}" by ${s.artist} → "${track.name}" by ${track.artists.map((a: any) => a.name).join(", ")}`);
            }

            const imageUrl = track?.album?.images?.[1]?.url || track?.album?.images?.[0]?.url || null;
            const previewUrl = track?.preview_url || null;
            const spotifyUrl = track?.external_urls?.spotify || null;
            const spotifyTrackId = track?.id || s.spotify_id || null;
            
            console.log(`✅ [Spotify] VERIFIED "${s.title}" by ${s.artist}: artwork=${imageUrl ? "yes" : "no"}, preview=${previewUrl ? "yes" : "no"}, id=${spotifyTrackId}`);
            return { song: s, imageUrl, previewUrl, spotifyUrl, spotifyTrackId, verified: true };
          } catch (err) {
            console.log(`❌ [Spotify] Error for "${s.title}" by ${s.artist}: ${err instanceof Error ? err.message : "unknown"}`);
            return { song: s, imageUrl: null, previewUrl: null, spotifyUrl: null, spotifyTrackId: null, verified: false };
          }
        });

        const results = await Promise.all(fetches);

        // Fetch YouTube thumbnails for ALL songs that lack artwork (verified or not)
        const needingArtwork = results.filter((r) => !r.imageUrl);
        console.log(`[YouTube] ${needingArtwork.length} songs need YouTube thumbnail fallback`);

        const youtubePromises = needingArtwork.map(async (r) => {
          const ytThumb = await fetchYouTubeThumbnail(r.song.title, r.song.artist);
          return { key: `${r.song.title}|||${r.song.artist}`, ytThumb };
        });

        const ytResults = await Promise.all(youtubePromises);
        const ytMap = new Map(ytResults.map((r) => [r.key, r.ytThumb]));

        // Cache ALL songs (verified and unverified) so we don't re-query
        const toInsert = results.map((r) => {
          const key = `${r.song.title}|||${r.song.artist}`;
          return {
            name: r.song.title,
            artist: r.song.artist,
            image_url: r.imageUrl || null,
            preview_url: r.previewUrl || null,
            spotify_url: r.spotifyUrl || null,
            youtube_thumbnail_url: ytMap.get(key) || null,
            spotify_track_id: r.spotifyTrackId || null,
          };
        });

        if (toInsert.length > 0) {
          console.log(`💾 [Cache] Saving ${toInsert.length} songs (${results.filter(r => r.verified).length} verified, ${results.filter(r => !r.verified).length} unverified)`);
          await supabase.from("song_image_cache").upsert(toInsert, { onConflict: "name,artist" });
        }

        // Return ALL songs (verified get Spotify data, unverified get YouTube data)
        for (const r of results) {
          const key = `${r.song.title}|||${r.song.artist}`;
          const ytThumb = ytMap.get(key) || null;
          
          songResults[key] = {
            image_url: r.imageUrl,
            preview_url: r.previewUrl,
            spotify_url: r.spotifyUrl,
            youtube_thumbnail_url: ytThumb,
          };
          
          const artworkSource = r.imageUrl ? "spotify" : ytThumb ? "youtube" : "none";
          const action = r.spotifyUrl ? "spotify" : "youtube-fallback";
          console.log(`📋 [Result] "${r.song.title}" by ${r.song.artist} — artwork=${artworkSource}, action=${action}`);
        }
      }

      // Handle cached songs that need YouTube thumbnails
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
