import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory rate limiter: max 6 AI generations per minute
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 6;
const generationTimestamps: number[] = [];

function isPerMinuteLimited(): boolean {
  const now = Date.now();
  while (generationTimestamps.length > 0 && generationTimestamps[0] <= now - RATE_LIMIT_WINDOW_MS) {
    generationTimestamps.shift();
  }
  return generationTimestamps.length >= RATE_LIMIT_MAX;
}

function recordGeneration(): void {
  generationTimestamps.push(Date.now());
}

// Daily limit: 500 new pages per day (DB-backed, survives cold starts)
const DAILY_LIMIT = 500;

async function isDailyLimited(supabase: any): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("seo_pages")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayStart.toISOString());
  return (count ?? 0) >= DAILY_LIMIT;
}

// ============= VERIFIED METADATA LAYER =============

interface VerifiedMetadata {
  song_title: string | null;
  artist_name: string | null;
  spotify_track_id: string | null;
  year: string | null;
  genres: string[];
  album_name: string | null;
  producer_name: string | null; // only if verified
  sampled_song_title: string | null; // only if verified
  sampled_artist_name: string | null; // only if verified
  sample_verified: boolean;
  metadata_confidence: "high" | "medium" | "low";
}

async function fetchVerifiedMetadata(
  displayName: string,
  pageType: string,
  supabase: any,
  spotifyToken: string | null
): Promise<VerifiedMetadata> {
  const metadata: VerifiedMetadata = {
    song_title: null,
    artist_name: null,
    spotify_track_id: null,
    year: null,
    genres: [],
    album_name: null,
    producer_name: null,
    sampled_song_title: null,
    sampled_artist_name: null,
    sample_verified: false,
    metadata_confidence: "low",
  };

  if (pageType !== "song") {
    return metadata;
  }

  // Parse song title and artist from displayName (format: "Song Title – Artist Name" or just "Song Title")
  const dashMatch = displayName.match(/^(.+?)\s*[–—-]\s*(.+)$/);
  let songTitle = dashMatch ? dashMatch[1].trim() : displayName;
  let artistName = dashMatch ? dashMatch[2].trim() : null;

  metadata.song_title = songTitle;
  metadata.artist_name = artistName;

  let confidencePoints = 0;

  // 1. Fetch from Spotify for enriched metadata
  if (spotifyToken) {
    try {
      // When artistName is known, use strict field-qualified search.
      // When not (slug format has no dash separator), use a plain unquoted
      // query so Spotify fuzzy-matches across title + artist — same approach
      // used by resolve-song, which correctly maps "stronger kanye west" to
      // "Stronger" by Kanye West. Strict track:"..." on an unsplit slug would
      // match arbitrary titles (e.g. "Stronger - 1950s Kanye West").
      const query = artistName
        ? `track:"${songTitle}" artist:"${artistName}"`
        : displayName;
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
        { headers: { Authorization: `Bearer ${spotifyToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        const track = data?.tracks?.items?.[0];
        if (track) {
          metadata.spotify_track_id = track.id;
          metadata.song_title = track.name;
          metadata.artist_name = track.artists?.[0]?.name || artistName;
          metadata.year = track.album?.release_date?.slice(0, 4) || null;
          metadata.album_name = track.album?.name || null;
          confidencePoints += 2;

          // Fetch artist genres if available
          const artistId = track.artists?.[0]?.id;
          if (artistId) {
            try {
              const artistRes = await fetch(
                `https://api.spotify.com/v1/artists/${artistId}`,
                { headers: { Authorization: `Bearer ${spotifyToken}` } }
              );
              if (artistRes.ok) {
                const artistData = await artistRes.json();
                metadata.genres = artistData.genres?.slice(0, 5) || [];
                if (metadata.genres.length > 0) confidencePoints += 1;
              }
            } catch (e) {
              console.log("[Metadata] Failed to fetch artist genres:", e);
            }
          }

        }
      }
    } catch (e) {
      console.log("[Metadata] Spotify lookup failed:", e);
    }
  }

  // 2. Check sample_cache for verified sample information
  if (metadata.song_title && metadata.artist_name) {
    try {
      const { data: sampleData } = await supabase
        .from("sample_cache")
        .select("*")
        .eq("song_title", metadata.song_title)
        .eq("artist_name", metadata.artist_name)
        .maybeSingle();

      if (sampleData?.looked_up && sampleData?.sample_verified) {
        metadata.sampled_song_title = sampleData.sampled_song_title;
        metadata.sampled_artist_name = sampleData.sampled_artist_name;
        metadata.sample_verified = true;
        confidencePoints += 2;
      }
    } catch (e) {
      console.log("[Metadata] Sample cache lookup failed:", e);
    }
  }

  // Determine confidence level
  if (confidencePoints >= 4) {
    metadata.metadata_confidence = "high";
  } else if (confidencePoints >= 2) {
    metadata.metadata_confidence = "medium";
  } else {
    metadata.metadata_confidence = "low";
  }

  console.log(`[Metadata] Confidence: ${metadata.metadata_confidence} (${confidencePoints} points)`);
  return metadata;
}

function buildMetadataBlock(metadata: VerifiedMetadata): string {
  if (!metadata.song_title) return "";

  const lines: string[] = [];
  lines.push("\n\n=== VERIFIED METADATA (MUST USE THESE FACTS) ===");
  
  if (metadata.song_title) lines.push(`Song Title: "${metadata.song_title}"`);
  if (metadata.artist_name) lines.push(`Artist: ${metadata.artist_name}`);
  if (metadata.year) lines.push(`Year: ${metadata.year}`);
  if (metadata.album_name) lines.push(`Album: ${metadata.album_name}`);
  if (metadata.genres.length > 0) lines.push(`Genres: ${metadata.genres.join(", ")}`);
  
  if (metadata.sample_verified && metadata.sampled_song_title) {
    lines.push(`VERIFIED SAMPLE: This track samples "${metadata.sampled_song_title}" by ${metadata.sampled_artist_name}`);
  }

  lines.push(`\nMetadata Confidence: ${metadata.metadata_confidence.toUpperCase()}`);
  lines.push("=== END VERIFIED METADATA ===\n");

  return lines.join("\n");
}

function getFactualInstructions(confidence: "high" | "medium" | "low"): string {
  const baseInstructions = `
FACTUAL ACCURACY RULES (CRITICAL — STRICTLY ENFORCED):

1. YOU MAY DESCRIBE:
   - Mood, atmosphere, and emotional character (e.g., "melancholic tone," "euphoric build")
   - Sonic textures and production qualities (e.g., "glossy synths," "lo-fi warmth," "crisp drums")
   - Rhythmic feel and groove (e.g., "driving rhythm," "laid-back swing")
   - Genre positioning and stylistic elements
   - General era or decade character

2. YOU MAY NOT INVENT:
   - Producer credits (unless provided in verified metadata)
   - Sample sources or interpolations (unless provided in verified metadata)
   - Specific instrumentation claims (e.g., "built around a Fender Rhodes")
   - Studio or recording details, collaboration or writing credits
   - Historical claims about the recording process

3. SAMPLE RULE:
   - ONLY mention sampling if VERIFIED SAMPLE appears in the metadata above
   - If sample info is verified, you MAY reference it naturally in the summary
   - If no verified sample info exists, do NOT speculate about samples

4. SONIC DNA PROFILE — GROUND TRUTH (ALWAYS ENFORCED):
   - The SONIC DNA PROFILE block is the objective ground truth for how this song sounds
   - Every energy, mood, and texture claim in the prose MUST be consistent with it
   - Lead the summary with the dominant energy and mood reflected by those descriptors
   - NEVER use adjectives that contradict the profile: if it says "driving" or "stalking," do not write "sparse" or "meditative"; if it says "cold" or "nocturnal," do not write "warm" or "euphoric"
   - If no Sonic DNA Profile is present, describe the track broadly without specific energy/mood claims`;

  if (confidence === "low") {
    return baseInstructions + `

5. LOW CONFIDENCE MODE:
   - Write broader, more impressionistic descriptions anchored to the Sonic DNA Profile
   - Use phrases like "evokes," "channels," "recalls" rather than definitive statements
   - Avoid specific factual claims about the track's creation beyond what metadata confirms
   - If the Sonic DNA Profile is marked LOW confidence, the descriptors are approximate guides — write with slightly broader, less definitive language rather than stating sonic characteristics as absolute fact`;
  } else if (confidence === "medium") {
    return baseInstructions + `

5. MEDIUM CONFIDENCE MODE:
   - You may use verified metadata fields (year, artist, genres) confidently
   - For other details, lean toward description over assertion
   - Stay anchored to the Sonic DNA Profile for all energy and mood claims`;
  } else {
    return baseInstructions + `

5. HIGH CONFIDENCE MODE:
   - Use all verified metadata fields confidently
   - Write with specificity about the track's sonic character, fully grounded in the Sonic DNA Profile
   - Still do NOT invent production credits, samples, or historical claims beyond metadata`;
  }
}

// ============= IDENTITY VALIDATION LAYER =============
// Guards against caching or generating content for the wrong song.
// Two entry points:
//   validateResolvedIdentity — used after a fresh Spotify lookup
//   validateCachedHeading    — used when a cached seo_pages row is found

const IDENTITY_STOP = new Set([
  "the","a","an","and","of","in","to","is","it","by","at","on","for",
  "songs","similar","like","song",
]);

function identityWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1 && !IDENTITY_STOP.has(w));
}

/**
 * Checks whether the Spotify-resolved title + artist are consistent with
 * the slug. Two rules must both pass:
 *
 * 1. At least 50 % of meaningful slug words appear in (title ∪ artist).
 * 2. If the artist has meaningful words, at least one must appear in the
 *    slug. This catches "Stronger - 1950s Kanye West / The Speakeasy
 *    Rappers" — the title coincidentally matches all slug words but the
 *    artist name has zero slug overlap, betraying the wrong identity.
 */
function validateResolvedIdentity(
  slug: string,
  resolvedTitle: string,
  resolvedArtist: string,
): { valid: boolean; ratio: number; reason: string } {
  const slugWords = identityWords(slug.replace(/-/g, " "));
  if (slugWords.length === 0) return { valid: true, ratio: 1, reason: "empty slug" };

  const titleWords = identityWords(resolvedTitle);
  const artistWords = identityWords(resolvedArtist);
  const identitySet = new Set([...titleWords, ...artistWords]);
  const slugSet = new Set(slugWords);

  const matches = slugWords.filter(w => identitySet.has(w)).length;
  const ratio = matches / slugWords.length;

  // Rule 2: artist words must have at least one slug word hit
  if (artistWords.length > 0) {
    const artistInSlug = artistWords.filter(w => slugSet.has(w)).length;
    if (artistInSlug === 0) {
      return {
        valid: false,
        ratio,
        reason: `artist "${resolvedArtist}" has no words in slug`,
      };
    }
  }

  // Rule 1: overall word coverage
  if (ratio < 0.5) {
    return { valid: false, ratio, reason: `low word overlap (${ratio.toFixed(2)})` };
  }

  return { valid: true, ratio, reason: "ok" };
}

/**
 * Checks whether a cached seo_pages row's heading is consistent with
 * the slug. Used to detect and evict stale/wrong cached rows.
 */
function validateCachedHeading(slug: string, heading: string | null): boolean {
  if (!heading) return false;
  const slugWords = identityWords(slug.replace(/-/g, " "));
  if (slugWords.length === 0) return true;
  const headingWords = new Set(identityWords(heading));
  const matches = slugWords.filter(w => headingWords.has(w)).length;
  return matches / slugWords.length >= 0.5;
}

// ============= SONIC DNA PROFILE LAYER =============
// Fetches (or generates) the sonic descriptor profile for the center song,
// then injects it into the prose prompt so the summary is anchored to
// verified descriptors rather than Claude's general music knowledge alone.

interface CanonicalDescriptor {
  slug: string;
  label: string;
  category: string;
}

const SONIC_CATEGORY_LABELS: Record<string, string> = {
  emotional_tone:      "Mood",
  energy_posture:      "Energy",
  texture:             "Texture",
  spatial_feel:        "Space",
  era_movement:        "Era",
  era_period:          "Period",
  groove_character:    "Groove",
  harmonic_color:      "Harmony",
  vocal_character:     "Vocals",
  environment_imagery: "Environment",
  listener_use_case:   "Best For",
};

const SONIC_CATEGORY_ORDER = [
  "emotional_tone", "energy_posture", "texture", "spatial_feel",
  "era_movement", "era_period", "groove_character", "harmonic_color",
  "vocal_character", "environment_imagery", "listener_use_case",
];

interface SonicDescriptorResult {
  descriptors: CanonicalDescriptor[];
  confidenceScore: number | null;
}

async function fetchSonicDescriptors(
  spotifyTrackId: string,
  songTitle: string,
  artistName: string,
  supabase: any,
): Promise<SonicDescriptorResult | null> {
  try {
    // Cache-first: check DB before calling the edge function
    const { data: cached } = await (supabase
      .from("song_sonic_profiles")
      .select("profile_json, confidence_score")
      .eq("spotify_track_id", spotifyTrackId)
      .single() as any);

    if (cached?.profile_json?.canonical_descriptors?.display_descriptors?.length) {
      console.log("[SonicDNA] Cache hit (v2) for prose anchoring");
      return {
        descriptors: cached.profile_json.canonical_descriptors.display_descriptors as CanonicalDescriptor[],
        confidenceScore: typeof cached.confidence_score === "number" ? cached.confidence_score : null,
      };
    }

    // v1 fallback: manually seeded profiles store raw slug arrays per category
    // (e.g. profile_json.emotional_tone: ["cold","detached"]) with no canonical_descriptors.
    // Extract them directly so we avoid the round-trip to generate-sonic-profile.
    if (cached?.profile_json) {
      const v1Descriptors: CanonicalDescriptor[] = [];
      for (const cat of SONIC_CATEGORY_ORDER) {
        const slugs = (cached.profile_json as Record<string, unknown>)[cat];
        if (Array.isArray(slugs)) {
          for (const slug of slugs) {
            if (typeof slug === "string") {
              const label = slug.replace(/-/g, " ");
              v1Descriptors.push({ slug, label, category: cat });
            }
          }
        }
      }
      if (v1Descriptors.length > 0) {
        console.log(`[SonicDNA] Cache hit (v1 raw format) — ${v1Descriptors.length} descriptors extracted, no round-trip needed`);
        return {
          descriptors: v1Descriptors,
          confidenceScore: typeof cached.confidence_score === "number" ? cached.confidence_score : null,
        };
      }
    }

    // Generate via the sonic-profile edge function
    console.log("[SonicDNA] Profile missing — calling generate-sonic-profile before prose");
    const { data } = await supabase.functions.invoke("generate-sonic-profile", {
      body: {
        spotify_track_id: spotifyTrackId,
        song_title: songTitle,
        artist_name: artistName,
      },
    });

    const descriptors = data?.canonical_descriptors?.display_descriptors;
    if (Array.isArray(descriptors) && descriptors.length > 0) {
      console.log(`[SonicDNA] Generated ${descriptors.length} descriptors`);

      // Belt-and-suspenders: write to song_sonic_profiles here in case
      // generate-sonic-profile's own DB write failed (e.g. RLS or insert error).
      // Uses upsert so it's a no-op if generate-sonic-profile already persisted it.
      const rawConfidence = data?.profile?.confidence_score;
      const confidenceScore = typeof rawConfidence === "number"
        ? Math.min(Math.max(rawConfidence, 0), 1)
        : null;
      try {
        const { error: upsertError } = await supabase
          .from("song_sonic_profiles")
          .upsert({
            spotify_track_id: spotifyTrackId,
            song_title: songTitle,
            artist_name: artistName,
            profile_json: data.profile,
            confidence_score: confidenceScore,
          }, { onConflict: "spotify_track_id" });
        if (upsertError) {
          console.warn("[SonicDNA] Belt-and-suspenders upsert failed:", upsertError.message);
        } else {
          console.log("[SonicDNA] Belt-and-suspenders upsert succeeded");
        }
      } catch (upsertEx) {
        console.warn("[SonicDNA] Belt-and-suspenders upsert threw:", upsertEx);
      }

      return {
        descriptors: descriptors as CanonicalDescriptor[],
        confidenceScore,
      };
    }

    console.log("[SonicDNA] generate-sonic-profile returned no descriptors");
    return null;
  } catch (e) {
    console.log("[SonicDNA] Profile fetch failed:", e);
    return null;
  }
}

function buildSonicDnaBlock(descriptors: CanonicalDescriptor[], confidenceScore: number | null = null): string {
  if (descriptors.length === 0) return "";

  // Group by category
  const grouped: Record<string, string[]> = {};
  for (const d of descriptors) {
    if (!grouped[d.category]) grouped[d.category] = [];
    grouped[d.category].push(d.label);
  }

  const lines: string[] = [
    "",
    "=== SONIC DNA PROFILE (VERIFIED — ANCHOR YOUR SUMMARY TO THESE) ===",
    "These descriptors reflect the actual sonic character of this track.",
    "Your summary MUST stay within this lane. Do not describe qualities that contradict these.",
    "",
  ];

  for (const cat of SONIC_CATEGORY_ORDER) {
    const labels = grouped[cat];
    if (!labels || labels.length === 0) continue;
    const catLabel = (SONIC_CATEGORY_LABELS[cat] || cat).padEnd(12);
    lines.push(`${catLabel}: ${labels.join(", ")}`);
  }

  if (confidenceScore !== null && confidenceScore < 0.65) {
    lines.push("");
    lines.push("Profile Confidence: LOW — treat these descriptors as approximate, not definitive");
  }

  lines.push("=== END SONIC DNA PROFILE ===");
  lines.push("");

  return lines.join("\n");
}

// ============= POSTURE ANCHOR LAYER =============
//
// WHY THIS EXISTS:
// LLMs have a well-documented heuristic failure in music prose: they read
// "dark + minor-key + sparse" as sadness or emotional vulnerability because
// confessional/introspective framing is heavily over-represented in music
// criticism training data.
//
// In hip-hop, industrial, post-punk, and many electronic contexts, those same
// cues actually signal dominance, menace, or controlled aggression — not emotional
// exposure. A cold, metallic track is a hard track; restrained vocals signal
// authority, not fragility; sparse production can mean pressure, not loneliness.
//
// CORE RULE: PROSE MUST NOT CONTRADICT SONIC DNA.
//
// To prevent re-inference drift, we compute the dominant emotional posture
// deterministically from the actual descriptor slugs and inject a concrete
// POSTURE ANCHOR block into the prompt. The LLM receives a named posture,
// a forbidden-word list, and an emphasize list — not an invitation to infer.

type Posture =
  | "dominant"
  | "detached"
  | "menacing"
  | "melancholic"
  | "dreamlike"
  | "euphoric"
  | "nostalgic"
  | "playful"
  | "vulnerable"
  | "defiant"
  | "triumphant"
  | "restless"
  | "seductive"
  | "tender";

// Each entry maps one or more descriptor slugs to a posture signal.
// Weight reflects how strongly that slug indicates the posture.
// Scored by summing weights across all matched slugs; highest total wins.
const POSTURE_SIGNALS: Array<{ slugs: string[]; posture: Posture; weight: number }> = [
  // ── Dominant / hard / confrontational ───────────────────────────────────────
  { slugs: ["swaggering", "menacing"],                          posture: "dominant",    weight: 3 },
  { slugs: ["stalking", "coiled"],                              posture: "menacing",    weight: 3 },
  { slugs: ["commanding"],                                      posture: "dominant",    weight: 2 },
  { slugs: ["defiant"],                                         posture: "defiant",     weight: 2 },
  { slugs: ["glamorous"],                                       posture: "dominant",    weight: 1 },
  { slugs: ["explosive", "charging", "propulsive", "driving"], posture: "dominant",    weight: 1 },
  // ── Detached / cool / controlled ────────────────────────────────────────────
  // Weight 3: cold/cool-toned/restrained-vocal are strong, explicit detachment signals.
  // Raising from 2→3 ensures detached beats a melancholic tie (wistful+lonely=4)
  // for tracks like Future's Mask Off where the flute can mislead toward sadness.
  { slugs: ["cold", "cool-toned", "restrained-vocal"],         posture: "detached",    weight: 3 },
  // ── Triumphant / euphoric ────────────────────────────────────────────────────
  { slugs: ["triumphant", "euphoric"],                         posture: "triumphant",  weight: 2 },
  { slugs: ["explosive-chorus", "euphoric-lift"],              posture: "euphoric",    weight: 1 },
  // ── Inward / vulnerable / tender ────────────────────────────────────────────
  { slugs: ["tender", "devotional"],                           posture: "tender",      weight: 2 },
  { slugs: ["wistful", "lonely"],                              posture: "melancholic", weight: 2 },
  { slugs: ["melancholic"],                                    posture: "melancholic", weight: 2 },
  { slugs: ["yearning", "emotionally-direct"],                 posture: "vulnerable",  weight: 2 },
  // ── Atmospheric / dreamlike ──────────────────────────────────────────────────
  { slugs: ["nocturnal"],                                      posture: "dreamlike",   weight: 1 },
  { slugs: ["floating", "gliding", "hazy"],                   posture: "dreamlike",   weight: 1 },
  // ── Other named postures ─────────────────────────────────────────────────────
  { slugs: ["nostalgic"],                                      posture: "nostalgic",   weight: 2 },
  { slugs: ["playful"],                                        posture: "playful",     weight: 2 },
  { slugs: ["seductive"],                                      posture: "seductive",   weight: 2 },
  { slugs: ["restless"],                                       posture: "restless",    weight: 2 },
];

function inferPosture(descriptors: CanonicalDescriptor[]): Posture {
  const slugSet = new Set(descriptors.map((d) => d.slug));
  const scores = new Map<Posture, number>();

  for (const { slugs, posture, weight } of POSTURE_SIGNALS) {
    for (const slug of slugs) {
      if (slugSet.has(slug)) {
        scores.set(posture, (scores.get(posture) ?? 0) + weight);
      }
    }
  }

  if (scores.size === 0) return "detached"; // safe fallback

  let best: Posture = "detached";
  let bestScore = 0;
  for (const [posture, score] of scores) {
    if (score > bestScore) { best = posture; bestScore = score; }
  }
  return best;
}

// Per-posture word lists: what to forbid and what to emphasize in the prose.
// These are injected verbatim into the prompt so the LLM receives concrete lists,
// not abstract instructions to "stay consistent."
const POSTURE_GUARDRAILS: Record<Posture, { forbidden: string[]; emphasize: string[] }> = {
  dominant:    {
    forbidden: ["lonely","vulnerable","introspective","confessional","emotionally fragile","tender","raw emotional honesty","exposed","intimate"],
    emphasize: ["authority","swagger","dominance","confrontation","pressure","icy control","hard edge","weight"],
  },
  detached:    {
    forbidden: ["lonely","vulnerable","introspective","confessional","emotionally fragile","tender","raw","intimate","warm"],
    emphasize: ["detachment","cool precision","controlled distance","restrained authority","airless control"],
  },
  menacing:    {
    forbidden: ["lonely","vulnerable","tender","warm","inviting","playful","confessional","intimate"],
    emphasize: ["menace","predatory pressure","threat","controlled aggression","industrial force","dark authority"],
  },
  defiant:     {
    forbidden: ["vulnerable","tender","confessional","introspective","submissive"],
    emphasize: ["defiance","resistance","hard refusal","assertive force","proud refusal"],
  },
  triumphant:  {
    forbidden: ["lonely","sad","dark","melancholic","introspective","vulnerable"],
    emphasize: ["triumph","ascent","release","victory","euphoric lift","peak energy"],
  },
  melancholic: {
    forbidden: ["dominant","commanding","hard-edged","confrontational","aggressive","swaggering"],
    emphasize: ["longing","bittersweet distance","muted ache","wistful atmosphere","soft decay"],
  },
  dreamlike:   {
    // Nightcall / synthwave protection: nocturnal and cinematic tracks are cold and sleek,
    // not confessional. Add intimate/vulnerable/confessional to the forbidden list so that
    // even if a track lands on dreamlike rather than detached, the prose stays correct.
    forbidden: ["aggressive","confrontational","dominant","hard-edged","industrial","intimate vulnerability","confessional","vulnerable","raw emotional honesty","emotionally exposed"],
    emphasize: ["drifting atmosphere","hazy texture","nocturnal immersion","weightless ambience","sleek distance","cinematic cool"],
  },
  euphoric:    {
    forbidden: ["lonely","melancholic","introspective","dark","somber"],
    emphasize: ["euphoria","lift","radiant energy","peak release","bright momentum"],
  },
  nostalgic:   {
    forbidden: ["confrontational","industrial","aggressive","dominant","hard-edged"],
    emphasize: ["warmth","memory","bittersweet familiarity","soft decay","temporal distance"],
  },
  playful:     {
    forbidden: ["menacing","confrontational","dark","aggressive","industrial"],
    emphasize: ["lightness","wit","bounce","irreverence","playful momentum","levity"],
  },
  vulnerable:  {
    forbidden: ["commanding","confrontational","dominant","hard-edged","menacing","industrial"],
    emphasize: ["emotional exposure","intimacy","fragility","raw candor","unguarded delivery"],
  },
  restless:    {
    forbidden: ["relaxed","laid-back","peaceful","resolved","comfortable"],
    emphasize: ["unresolved tension","anxious momentum","restless urgency","unsettled energy"],
  },
  seductive:   {
    forbidden: ["confrontational","aggressive","menacing","hard-edged","industrial"],
    emphasize: ["seductive pull","low-key invitation","sensual restraint","controlled desire"],
  },
  tender:      {
    forbidden: ["commanding","confrontational","dominant","industrial","hard-edged","menacing"],
    emphasize: ["tenderness","care","soft delivery","emotional warmth","gentle intimacy"],
  },
};

function buildPostureAnchorBlock(posture: Posture, confidenceScore: number | null): string {
  const g = POSTURE_GUARDRAILS[posture];
  const isLow = confidenceScore !== null && confidenceScore < 0.65;
  const certaintyCue = isLow
    ? `Profile confidence is LOW. Soften certainty with "leans toward," "suggests," "feels closer to," or "projects." The posture guardrail still applies — do not contradict it even at low confidence.`
    : `Profile confidence is HIGH. Write with specificity.`;

  return [
    "",
    "=== POSTURE ANCHOR (pre-computed from Sonic DNA — do not override) ===",
    `Dominant emotional posture: ${posture.toUpperCase()}`,
    "",
    "The prose MUST remain consistent with this posture.",
    "Do NOT reinterpret the Sonic DNA descriptors into a different emotional archetype.",
    "",
    `FORBIDDEN words/phrases: ${g.forbidden.join(", ")}`,
    `EMPHASIZE qualities such as: ${g.emphasize.join(", ")}`,
    "",
    certaintyCue,
    "=== END POSTURE ANCHOR ===",
    "",
  ].join("\n");
}

// ============= ANTI-REPETITION LAYER =============

async function getFrequentlyRecommendedSongs(supabase: any, pageType: string): Promise<string[]> {
  try {
    // Fetch the 100 most recent pages of this type
    const { data: recentPages } = await supabase
      .from("seo_pages")
      .select("closest_matches, same_energy")
      .eq("page_type", pageType)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!recentPages || recentPages.length === 0) return [];

    // Count song occurrences across all recommendations
    const songCounts = new Map<string, number>();
    for (const page of recentPages) {
      const allSongs = [
        ...((page.closest_matches as any[]) || []),
        ...((page.same_energy as any[]) || []),
      ];
      for (const song of allSongs) {
        const key = song.title?.toLowerCase()?.trim();
        if (key) {
          songCounts.set(key, (songCounts.get(key) || 0) + 1);
        }
      }
    }

    // Songs appearing in 10%+ of recent pages are "overused"
    const threshold = Math.max(5, Math.floor(recentPages.length * 0.1));
    const overused: string[] = [];
    for (const [title, count] of songCounts.entries()) {
      if (count >= threshold) {
        overused.push(`"${title}" (appeared ${count} times)`);
      }
    }

    return overused.slice(0, 15); // Cap at 15 to keep prompt manageable
  } catch (e) {
    console.log("[AntiRepetition] Failed to fetch frequency data:", e);
    return [];
  }
}

function buildAntiRepetitionBlock(overusedSongs: string[]): string {
  if (overusedSongs.length === 0) return "";

  return `

=== ANTI-REPETITION GUIDANCE ===
The following songs have been recommended very frequently across recent searches. They are NOT banned, but you should ONLY include them if they are genuinely one of the strongest possible matches for this specific query. If equally strong alternatives exist, prefer the alternative.

Overused songs to deprioritize:
${overusedSongs.map(s => `- ${s}`).join("\n")}

Instead of defaulting to these, dig deeper: find tracks that are equally valid sonic matches but less obvious. Think like a record store clerk who notices they've been recommending the same album all week and consciously reaches for something different but equally fitting.
=== END ANTI-REPETITION GUIDANCE ===
`;
}

// ============= END ANTI-REPETITION LAYER =============

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { slug, page_type, deep_cut_mode } = await req.json();
    if (!slug || !page_type) {
      return new Response(JSON.stringify({ error: "slug and page_type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if page already exists — for song pages also validate identity
    const { data: existing } = await supabase
      .from("seo_pages")
      .select("id, spotify_track_id, heading, resolved_song_title, resolved_artist_name")
      .eq("slug", slug)
      .eq("page_type", page_type)
      .maybeSingle();

    if (existing) {
      if (page_type === "song") {
        // Prefer exact resolved identity fields when available; fall back to
        // heading-based word matching for rows written before the schema change.
        let cacheOk: boolean;
        let validationMethod: string;

        if (existing.resolved_song_title && existing.resolved_artist_name) {
          const check = validateResolvedIdentity(
            slug,
            existing.resolved_song_title,
            existing.resolved_artist_name,
          );
          cacheOk = check.valid;
          validationMethod = `exact fields ratio=${check.ratio.toFixed(2)}`;
        } else {
          cacheOk = validateCachedHeading(slug, existing.heading);
          validationMethod = "heading fallback";
        }

        if (!cacheOk) {
          console.log(
            `[Identity] Cache MISMATCH slug="${slug}"` +
            ` resolved_title="${existing.resolved_song_title ?? "—"}"` +
            ` resolved_artist="${existing.resolved_artist_name ?? "—"}"` +
            ` heading="${existing.heading}" method="${validationMethod}" — evicting and regenerating`,
          );
          await supabase.from("seo_pages").delete().eq("id", existing.id);
          // Fall through to regeneration
        } else {
          console.log(
            `[Identity] Cache HIT slug="${slug}"` +
            ` resolved_title="${existing.resolved_song_title ?? "—"}"` +
            ` resolved_artist="${existing.resolved_artist_name ?? "—"}"` +
            ` track_id="${existing.spotify_track_id ?? "none"}" method="${validationMethod}"`,
          );
          return new Response(JSON.stringify({ status: "exists" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ status: "exists" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Rate limits only apply to new AI generations
    if (isPerMinuteLimited()) {
      return new Response(
        JSON.stringify({ error: "Page generation is temporarily busy, please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (await isDailyLimited(supabase)) {
      return new Response(
        JSON.stringify({ error: "Daily page generation limit reached (500/day). Please try again tomorrow." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    recordGeneration();

    // --- Get Spotify token early for metadata lookup ---
    let spotifyToken: string | null = null;
    try {
      const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
      const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
      if (clientId && clientSecret) {
        const basic = btoa(`${clientId}:${clientSecret}`);
        const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: "grant_type=client_credentials",
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          spotifyToken = tokenData.access_token;
        }
      }
    } catch (e) {
      console.log("[Spotify] Token fetch failed:", e);
    }

    const displayName = slug.replace(/-deep$/, "").replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

    // --- Fetch verified metadata for song pages ---
    const verifiedMetadata = await fetchVerifiedMetadata(displayName, page_type, supabase, spotifyToken);

    // --- Identity logging and validation (song pages only) ---
    if (page_type === "song") {
      console.log(
        `[Identity] slug="${slug}"` +
        ` resolved_title="${verifiedMetadata.song_title ?? "none"}"` +
        ` resolved_artist="${verifiedMetadata.artist_name ?? "none"}"` +
        ` spotify_track_id="${verifiedMetadata.spotify_track_id ?? "none"}"` +
        ` confidence="${verifiedMetadata.metadata_confidence}"`,
      );

      // If Spotify resolved a track ID, validate the identity before generating.
      // A mismatch means Spotify returned the wrong song for this slug — abort
      // rather than cache bad content.
      if (verifiedMetadata.spotify_track_id && verifiedMetadata.song_title && verifiedMetadata.artist_name) {
        const check = validateResolvedIdentity(slug, verifiedMetadata.song_title, verifiedMetadata.artist_name);
        if (!check.valid) {
          console.error(
            `[Identity] ABORT slug="${slug}" reason="${check.reason}"` +
            ` resolved_title="${verifiedMetadata.song_title}"` +
            ` resolved_artist="${verifiedMetadata.artist_name}"`,
          );
          return new Response(
            JSON.stringify({ error: `Could not confidently resolve song identity for slug "${slug}". Reason: ${check.reason}` }),
            { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        console.log(`[Identity] Resolved identity OK slug="${slug}" ratio=${check.ratio.toFixed(2)}`);
      }
    }

    const metadataBlock = buildMetadataBlock(verifiedMetadata);
    const factualInstructions = getFactualInstructions(verifiedMetadata.metadata_confidence);

    // --- Fetch/generate Sonic DNA profile — hard prerequisite for song prose ---
    // If we have a resolved track ID but can't get a profile, return 202 so the
    // client retries rather than generating prose with no sonic grounding.
    let sonicDnaBlock = "";
    let postureAnchorBlock = "";
    if (page_type === "song" && !verifiedMetadata.spotify_track_id) {
      console.warn("[PostureAnchor] ABORT — no spotify_track_id for song page, cannot anchor prose — returning 202 for retry");
      return new Response(
        JSON.stringify({ status: "retry", reason: "spotify_lookup_failed" }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (
      page_type === "song" &&
      verifiedMetadata.spotify_track_id &&
      verifiedMetadata.song_title &&
      verifiedMetadata.artist_name
    ) {
      const sonicResult = await fetchSonicDescriptors(
        verifiedMetadata.spotify_track_id,
        verifiedMetadata.song_title,
        verifiedMetadata.artist_name,
        supabase,
      );
      if (!sonicResult || sonicResult.descriptors.length === 0) {
        console.log("[SonicDNA] Profile unavailable after generation attempt — returning retry");
        return new Response(
          JSON.stringify({ status: "retry", reason: "sonic_profile_unavailable" }),
          { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      sonicDnaBlock = buildSonicDnaBlock(sonicResult.descriptors, sonicResult.confidenceScore);
      const posture = inferPosture(sonicResult.descriptors);
      postureAnchorBlock = buildPostureAnchorBlock(posture, sonicResult.confidenceScore);
      console.log(`[SonicDNA] Profile ready (confidence=${sonicResult.confidenceScore ?? "unknown"}, posture=${posture}) — proceeding with grounded generation`);
      console.log(`[PostureAnchor] Block built (posture=${posture}, chars=${postureAnchorBlock.length}) — will be sent to Claude`);
    }

    // --- Fetch overused songs for anti-repetition ---
    const overusedSongs = await getFrequentlyRecommendedSongs(supabase, page_type);
    const antiRepetitionBlock = buildAntiRepetitionBlock(overusedSongs);
    console.log(`[AntiRepetition] Found ${overusedSongs.length} overused songs for page_type="${page_type}"`);

    let seedTracks: { title: string; artist: string; year: string }[] = [];
    if (page_type === "producer" && spotifyToken) {
      try {
        const producerName = slug.replace(/-deep$/, "").replace(/-/g, " ");
        const queries = [
          `producer:"${producerName}"`,
          `"${producerName}"`,
        ];

        const seen = new Set<string>();
        for (const q of queries) {
          if (seedTracks.length >= 8) break;
          try {
            const searchRes = await fetch(
              `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=10`,
              { headers: { Authorization: `Bearer ${spotifyToken}` } }
            );
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              const tracks = searchData?.tracks?.items || [];
              for (const t of tracks) {
                if (seedTracks.length >= 8) break;
                const key = `${t.name}|||${t.artists?.[0]?.name}`;
                if (seen.has(key)) continue;
                seen.add(key);
                seedTracks.push({
                  title: t.name,
                  artist: t.artists?.[0]?.name || "Unknown",
                  year: t.album?.release_date?.slice(0, 4) || "Unknown",
                });
              }
            }
          } catch (e) {
            console.log(`[Seed] Spotify search failed for query "${q}":`, e);
          }
        }
        console.log(`[Seed] Found ${seedTracks.length} seed tracks for producer "${producerName}"`);
      } catch (e) {
        console.log("[Seed] Spotify producer lookup failed:", e);
      }
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const songPrompt = `You are a world-class music curator — part crate-digger, part musicologist, part the best record store clerk alive. You think in terms of sonic DNA: production fingerprints, harmonic choices, rhythmic feel, and emotional architecture.

User is looking for songs similar to: "${displayName}"
${metadataBlock}
${sonicDnaBlock}
${factualInstructions}
${antiRepetitionBlock}

Your mission: find songs that live in the SAME MUSICAL UNIVERSE. Not the same Spotify playlist — the same sonic bloodline.

Evaluate candidates through these lenses (in priority order):
1. **Production style & recording aesthetic**: mix approach (lo-fi/hi-fi, wet/dry, analog warmth/digital precision), spatial qualities, how the track "breathes"
2. **Instrumentation & textural palette**: specific synth choices, guitar tones, drum machine vs. live kit, bass character, layering approach
3. **Groove & rhythmic DNA**: tempo, swing factor, syncopation patterns, how the rhythm section locks together
4. **Harmonic & melodic language**: chord voicings, key choices, melodic contour, resolution tendencies
5. **Emotional arc & dynamics**: tension/release patterns, loudness contour, the emotional journey within the track
6. **Genre lineage & cultural context**: what movement or tradition birthed this sound, who influenced whom

CRITICAL RULES:
- Do NOT stack multiple tracks by the same artist. Maximum 1 per artist across all lists.
- Do NOT default to an artist's biggest hits unless they are genuinely the strongest sonic match.
- Include at least 2 picks per list that would surprise a casual listener but make a music nerd nod in recognition.
- Cross-genre connections are encouraged when the sonic thread is real (e.g., a post-punk track and an R&B track can share the same bass-driven tension).
- Every recommendation must pass the "record store clerk test": would a knowledgeable human actually suggest this pairing?

closestMatches: 5 songs that scratch the exact same sonic itch — a listener who loves the query track would hear these and think "yes, this is my frequency." Prioritize unexpected but undeniable connections over obvious genre neighbors.

sameEnergy: 5 songs that share the emotional and atmospheric DNA but arrive from different sonic territories — different decades, different genres, but the same underlying musical truth. These should feel like genuinely surprising discoveries.

relatedArtists: 3 artists whose broader catalog overlaps most with the sonic world of this specific track. Go one level deeper than the obvious choices.

whyTheseWork: 2-3 sentences explaining the SPECIFIC sonic thread connecting these recommendations. Each recommended track should share at least 2 descriptor traits with the center song — name which traits (e.g., "Both share the stalking energy and cold emotional tone"). Reference concrete musical details: drum pattern, harmonic movement, production technique. Never use "similar vibe," "same feel," "fans of X will enjoy," or "same energy."

${postureAnchorBlock}
summary: EXACTLY 3 sentences. Dense and specific beats long and vague.
- Sentence 1: MUST begin with "{Artist Name}'s \"{Song Title}\"" and lead with the dominant energy and mood from the Sonic DNA Profile. Example: "Kanye West's \"Cold\" is a stalking, icy GOOD Music posse cut built on thick bass pressure and menacing minor-key synths."
- Sentences 2-3: Describe the production texture, emotional architecture, and what kind of listener it rewards — all grounded in the Sonic DNA Profile.
- CRITICAL: The Sonic DNA Profile is ground truth. Every adjective you use must be consistent with it. If the profile says "driving," do not write "sparse." If it says "cold," do not write "warm." If it says "swaggering," do not write "meditative."
- Write like a music critic describing the track to someone who hasn't heard it — specific, grounded, energetic where the track is energetic.
- AVOID generic filler phrases like "hard-hitting bars," "infectious hooks," or "undeniable bangers" unless the Sonic DNA Profile explicitly supports high energy and danceability.
- If the Sonic DNA Profile is marked "Profile Confidence: LOW," do not make highly specific sonic claims. Write with appropriate uncertainty — prefer "suggests," "leans toward," "has the feel of" over definitive statements.
- EMOTIONAL POSTURE RULE: Describe what the song projects outward, not what a listener might feel inward. Prioritize texture → groove → energy → atmosphere → emotional posture, in that order. Do NOT infer loneliness, vulnerability, introspection, or tenderness unless the Sonic DNA Profile explicitly contains descriptors like "lonely," "tender," "wistful," or "yearning." Sparse production alone does not imply loneliness. Restrained vocals alone do not imply vulnerability. Cold, metallic, or industrial textures signal hardness, menace, or authority — not emotional exposure.`;

    const artistPrompt = `You are a world-class music curator — part crate-digger, part musicologist, part the best record store clerk alive. You think in terms of artistic DNA: how an artist's sonic identity, production choices, and creative evolution connect them to the broader musical landscape.

User is looking for artists similar to: "${displayName}"
${antiRepetitionBlock}

Your mission: map the musical universe surrounding this artist. Not "related artists" from a streaming algorithm — genuine sonic and artistic kinship.

Evaluate candidates through these lenses:
1. **Sonic signature**: characteristic production choices, timbral fingerprints, mixing approach
2. **Songwriting architecture**: structural tendencies, harmonic vocabulary, lyrical territory
3. **Vocal/performance identity**: delivery style, range usage, how voice functions in the mix
4. **Artistic evolution**: which era of the artist is most relevant, how their sound has migrated
5. **Scene & lineage**: shared musical movements, influence chains, collaborator networks

CRITICAL RULES:
- NEVER include songs performed by ${displayName} in closestMatches or sameEnergy. Every recommended track MUST be by a DIFFERENT artist. The user already knows ${displayName}'s music — they want to discover similar music by OTHER artists.
- Maximum 1 track per artist across all lists.
- At least 2 picks per list should be genuinely surprising discoveries that reveal non-obvious connections.
- For relatedArtists: go one level deeper than the streaming algorithm's top suggestions. Find artists who share specific sonic qualities, not just genre labels.

${factualInstructions}

closestMatches: 5 tracks by OTHER artists (NOT ${displayName}) that most closely match ${displayName}'s sonic signature — production style, vocal approach, lyrical territory, and musical DNA. These should scratch the same itch as ${displayName}'s best work.

sameEnergy: 5 tracks by OTHER artists (NOT ${displayName}) that share the emotional and atmospheric DNA but arrive from different sonic territories — different decades, different genres, but the same underlying musical truth.

relatedArtists: 3 artists with genuine sonic kinship to ${displayName}. Avoid the most obvious first-result connections.

whyTheseWork: 2-3 sentences explaining what SPECIFIC musical qualities connect ${displayName} to these recommendations. Name the production techniques, harmonic tendencies, rhythmic approaches, or vocal qualities. Never use "similar vibe" or "same energy."

summary: A 2-3 sentence description of ${displayName}'s sonic identity — their production fingerprint, where they sit in the musical landscape, and what distinguishes them from their closest peers.`;

    const vibePrompt = `You are a world-class music curator who understands that a "vibe" is a precise sonic atmosphere — a complete sensory environment encoded in sound.

User is searching for music that matches: "${displayName}"
${antiRepetitionBlock}

Your mission: curate the definitive sonic palette for this atmosphere. Not a generic mood playlist — a carefully selected set of tracks that ARE this feeling in its most potent form.

Decode this vibe through these dimensions:
1. **Sonic environment**: reverb character, spatial depth, frequency balance, analog warmth vs. digital clarity
2. **Temporal & physical quality**: time of day, season, temperature, movement, light quality
3. **Emotional granularity**: not just happy/sad — the specific emotional shade (wistful nostalgia vs. aching loss, nervous excitement vs. euphoric release, contemplative stillness vs. peaceful acceptance)
4. **Production aesthetic**: lo-fi tape hiss, bedroom intimacy, studio polish, vintage recording, modern minimalism
5. **Rhythmic feel**: pace, pulse, whether it breathes or drives

CRITICAL RULES:
- Maximum 1 track per artist across all lists.
- Do NOT pick the most overplayed tracks associated with this mood. Find the songs that truly embody the atmosphere, not the ones that show up on every mood playlist.
- Include tracks from at least 3 different decades across your recommendations.
- At least 2 picks per list should be genuine discoveries — tracks most listeners haven't heard but that perfectly crystallize this atmosphere.

${factualInstructions}

closestMatches: 5 songs that ARE this vibe in its purest form — the definitive soundtrack. These should feel inevitable and essential, not generic or predictable.

sameEnergy: 5 songs that access the same emotional space from unexpected sonic angles — different genres, different eras, but the same atmospheric truth. These are the "oh, I never would have thought of that but it's perfect" picks.

relatedArtists: 3 artists whose catalogs consistently inhabit or orbit this sonic world.

whyTheseWork: 2-3 sentences describing the SPECIFIC sonic qualities that create this atmosphere — instrumentation, production techniques, tempo, harmonic mood, textural choices. Be concrete and musically literate.

summary: A 2-3 sentence evocation of this vibe as a musical atmosphere — what it sounds like, what it feels like physically, and the precise moment you'd reach for it.`;

    const seedTrackBlock = seedTracks.length > 0
      ? `\n\nVERIFIED SEED TRACKS (confirmed to exist on Spotify — use these as your foundation):\n${seedTracks.map((t, i) => `${i + 1}. "${t.title}" by ${t.artist} (${t.year})`).join("\n")}\n\nUse these seed tracks to understand ${displayName}'s production fingerprint. Your closestMatches SHOULD prioritize tracks from this list or other tracks you are highly confident ${displayName} produced. Do NOT invent producer credits — if you are unsure whether ${displayName} produced a track, do not include it in closestMatches. You may include tracks not in this list ONLY if you have high confidence they are real productions by ${displayName}.`
      : `\n\nIMPORTANT: No verified seed tracks were found via Spotify. Be EXTRA conservative with closestMatches — only include tracks you are highly confident were produced by ${displayName}. If unsure, choose well-known productions over obscure guesses. Do NOT invent producer credits.`;

    const producerPrompt = `You are a world-class music curator — part crate-digger, part studio engineer, part the best A&R executive alive. You think in terms of production DNA: how a producer's sonic fingerprint — their drum programming, synth choices, mixing approach, sampling philosophy, and arrangement instincts — connects tracks across genres and decades.

User is looking for producers similar to: "${displayName}"
${seedTrackBlock}
${antiRepetitionBlock}

Your mission: map the production universe surrounding this producer. Not "related producers" from a streaming algorithm — genuine sonic and technical kinship based on production approach.

Evaluate candidates through these lenses:
1. **Production signature**: characteristic drum sounds, synth textures, mixing approach, use of space and dynamics
2. **Arrangement philosophy**: how they build a track, layering approach, use of silence, structural tendencies
3. **Sonic palette**: preferred instruments, samples, timbral choices, frequency emphasis
4. **Recording aesthetic**: analog vs. digital, lo-fi vs. polished, live vs. programmed, spatial characteristics
5. **Genre fluency**: ability to work across styles, how their signature translates between genres

CRITICAL RULES:
- For closestMatches (tracks produced by the queried producer): ONLY include tracks you are confident ${displayName} actually produced. Prioritize tracks from the verified seed list above. Do NOT guess producer credits.
- For sameEnergy (tracks by OTHER producers): maximum 1 track per producer. Find tracks where the production approach shares genuine DNA with the queried producer.
- For relatedArtists (actually related PRODUCERS): recommend producers, not performing artists. Go one level deeper than the obvious choices.
- Only recommend songs and artists you are reasonably confident are real and commercially released.

${factualInstructions}

closestMatches: 5 tracks produced by or heavily associated with ${displayName} that best showcase their production range. Prioritize verified seed tracks and other productions you are highly confident about.

sameEnergy: 5 tracks by OTHER producers that share production DNA with ${displayName}'s style — similar drum programming, mixing approach, sonic textures, or arrangement philosophy.

relatedArtists: 3 producers (NOT performing artists) with genuine production kinship. Avoid the most obvious first-result connections.

whyTheseWork: 2-3 sentences explaining the SPECIFIC production techniques, sonic choices, and studio approaches that connect ${displayName} to these recommendations. Name the drum sounds, synth textures, mixing techniques, or sampling approaches.

summary: A 2-3 sentence description of ${displayName}'s production identity — their sonic fingerprint, signature techniques, and what makes their productions immediately recognizable.`;

    const promptByType: Record<string, string> = {
      song: songPrompt,
      artist: artistPrompt,
      producer: producerPrompt,
      vibe: vibePrompt,
    };

    let basePrompt = promptByType[page_type] || songPrompt;

    if (deep_cut_mode) {
      basePrompt += `

DEEP CUT MODE — CRITICAL INSTRUCTIONS:
You are now in crate-digger mode. Act like an obsessive vinyl collector who lives in record shops.

PRIORITIZE:
- Deep album cuts, B-sides, and overlooked tracks
- Underground, independent, or cult-favorite artists
- Influential but underplayed tracks that shaped genres
- Songs from lesser-known albums by well-known artists
- Cross-genre discoveries that share genuine sonic DNA
- Tracks with fewer than 50M streams that deserve more attention

AVOID:
- The artist's biggest mainstream hits (no "#1 singles" energy)
- Tracks that appear on every "similar songs" playlist
- The most obvious genre associations
- Extremely well-known songs unless they are historically important deep influences

Your recommendations should make a music nerd say "oh wow, great pull" — not "yeah, obviously."`;
    }

    const prompt = `${basePrompt}

Return ONLY this JSON structure:
{
  "title": "",
  "description": "",
  "heading": "",
  "summary": "",
  "closestMatches": [
    {"title": "", "artist": "", "year": 2000}
  ],
  "sameEnergy": [
    {"title": "", "artist": "", "year": 2000}
  ],
  "relatedArtists": ["", "", ""],
  "whyTheseWork": "",
  "relatedSongs": [{"name": "", "slug": ""}],
  "relatedVibes": [{"name": "", "slug": ""}],
  "relatedArtistLinks": [{"name": "", "slug": ""}]
}

Rules:
closestMatches = exactly 5 songs (real tracks, real years). MAX 1 TRACK PER ARTIST across closestMatches and sameEnergy combined.
sameEnergy = exactly 5 songs (real tracks, real years). Must include tracks from at least 3 different decades.
relatedArtists = exactly 3 artists (avoid the single most obvious choice — go one level deeper)
relatedSongs = 4 related songs with slugs. IMPORTANT: slugs MUST include both song title AND artist in the format "song-title-artist-name" (lowercase-hyphenated). Example: "pump-it-up-joe-budden", "ivy-frank-ocean". The "name" field should be "Song Title – Artist Name".
relatedVibes = 3 related vibes with slugs (lowercase-hyphenated, descriptive phrases)
relatedArtistLinks = 3 related artists with slugs
title = SEO page title (under 60 chars)
description = SEO meta description (under 160 chars)
heading = page heading that feels natural, not keyword-stuffed. For artist pages, use the format "Songs Similar to {Artist Name}" (e.g. "Songs Similar to Joe Budden").

ACCURACY RULES (CRITICAL — follow strictly):
- Only recommend songs and artists you are reasonably confident are real and commercially released. If you are uncertain whether a song exists, do NOT include it — choose a different recommendation that is more likely to exist in major music catalogs.
- Do NOT invent plausible-sounding song titles, alternate versions, or unreleased recordings. Do NOT guess.
- Prefer a correct, recognizable track over an obscure one you are unsure about. Deep cuts are allowed ONLY when confidence is high.
- For artist recommendations, prefer artists with a recognizable catalog presence. Avoid obscure names unless you are highly confident they are real.
- If you cannot find enough high-confidence deep cuts, widen your pool — a real, musically relevant track is always better than an imaginary perfect fit.

ALL music data must be REAL — real artist names, real song titles, real release years. Never fabricate tracks.
Return JSON only. No markdown, no code fences.`;

    const systemPrompt = `You are a world-class music discovery engine with encyclopedic knowledge of production techniques, genre lineages, and sonic connections across decades. You think like a legendary record store clerk, not a streaming algorithm. Return only valid JSON, no markdown, no code fences.

CRITICAL ACCURACY RULES:
- Every track you recommend MUST be a REAL song by a REAL artist that was commercially released and is likely to appear in major music catalogs (Spotify, Apple Music, etc.).
- Only recommend songs and artists you are reasonably confident are real and commercially released. If uncertain, do NOT guess — choose a different recommendation that you ARE confident about.
- Do NOT invent plausible-sounding song titles, alternate versions, unreleased recordings, or fictional deep cuts.
- Prefer a correct, somewhat more familiar song over an obscure track you are unsure about. Deep cuts are welcome ONLY when your confidence is high.
- Never duplicate artists across recommendation lists.
- If you cannot think of enough high-confidence obscure picks, widen your pool and choose real, musically relevant tracks instead of forcing rarity at the expense of accuracy.
- Prioritize musical DNA over popularity, but NEVER prioritize obscurity over accuracy.

FACTUAL WRITING RULES (CRITICAL):
- You MAY describe mood, atmosphere, sonic textures, rhythmic feel, and emotional character using interpretive language.
- You MAY NOT invent or state as fact: producer credits, sample sources, specific instrument models, studio details, or historical claims about the recording process — UNLESS this information is explicitly provided in the VERIFIED METADATA section of the prompt.
- If verified sample information is provided, you may naturally reference it. If not, do NOT mention sampling at all.
- When metadata confidence is LOW, write broader, impressionistic descriptions. When confidence is HIGH, you may be more specific about verified facts.

SAMPLE INFORMATION RULE (CRITICAL):
- NEVER mention sampling, interpolation, borrowed melodies, or sample sources UNLESS the VERIFIED METADATA explicitly includes sample information.
- Sample data is handled by a separate verified system (MusicBrainz). Any sample references you generate without verified metadata are unverified and potentially fabricated.
- Do NOT reference sampling even for well-known cases unless metadata confirms it.

SONIC DNA PROFILE RULE (CRITICAL):
- If a SONIC DNA PROFILE block is present in the user prompt, it is the objective ground truth for how this song sounds.
- Every energy, mood, and texture claim in the summary MUST be consistent with those descriptors. Never use adjectives that contradict the profile.
- Lead the summary with the dominant energy and mood reflected by the profile — do not lead with biographical or contextual information.
- If the profile indicates low energy, calm, melancholic, or tender descriptors, do NOT describe the track as energetic, hard-hitting, or aggressive.
- If no Sonic DNA Profile is present, describe the track broadly without making specific energy or mood claims.

EMOTIONAL POSTURE VS. EMOTIONAL VULNERABILITY (CRITICAL DISTINCTION):
- There are two distinct types of darkness. Do NOT conflate them.
  - OUTWARD COLDNESS: icy, detached, commanding, arrogant, confrontational, controlled, menacing, hard-edged. These are projected postures — the song presents a hard or cold face to the world.
  - INWARD DARKNESS: lonely, vulnerable, introspective, emotionally exposed, tender, wistful. These are internal emotional states — the song reveals something soft or private beneath the surface.
- Cold, metallic, sparse, or industrial descriptors belong to OUTWARD COLDNESS. Do NOT slide them into loneliness or vulnerability.
- Sparse production does NOT imply loneliness.
- Restrained or cool-toned vocal delivery does NOT imply vulnerability or introspection.
- Metallic, glossy, or industrial textures signal hardness, menace, or authority — not emotional exposure.
- ONLY use words like "lonely," "vulnerable," "introspective," "tender," or "emotionally raw" if the Sonic DNA Profile explicitly contains descriptors such as "lonely," "tender," "wistful," or "yearning." If those descriptors are absent, do not infer them from production choices.`;

    console.log("[PromptDebug] System prompt:\n" + systemPrompt);
    console.log("[PromptDebug] Full prompt sent to Claude:\n" + prompt);

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await aiResponse.text();
      throw new Error(`Claude API error [${status}]: ${body}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.content?.[0]?.text;
    if (!rawContent) throw new Error("No AI response content");

    let content;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      content = JSON.parse(cleaned);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    // --- Resolve Spotify track IDs for song pages ---
    let seedSpotifyTrackId: string | null = verifiedMetadata.spotify_track_id;

    async function resolveSpotifyId(title: string, artist: string, token: string): Promise<{ id: string | null; url: string | null }> {
      try {
        const q = encodeURIComponent(`track:"${title}" artist:"${artist}"`);
        const res = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { id: null, url: null };
        const data = await res.json();
        const track = data?.tracks?.items?.[0];
        if (!track) return { id: null, url: null };
        return { id: track.id, url: track.external_urls?.spotify || null };
      } catch {
        return { id: null, url: null };
      }
    }

    // Map camelCase AI response to snake_case DB columns, enriching with Spotify IDs
    const allRecommendedSongs = [
      ...(content.closestMatches || []),
      ...(content.sameEnergy || []),
    ];

    // Resolve Spotify IDs for all recommended songs in parallel
    const spotifyIdMap = new Map<string, { id: string | null; url: string | null }>();

    if (spotifyToken) {
      const lookups = allRecommendedSongs.map(async (m: any) => {
        const result = await resolveSpotifyId(m.title, m.artist, spotifyToken);
        const key = `${m.title}|||${m.artist}`;
        spotifyIdMap.set(key, result);
        if (result.id) {
          console.log(`[Spotify ID] "${m.title}" by ${m.artist}: ${result.id}`);
        }
      });
      await Promise.all(lookups);
    }

    const closestMatches = (content.closestMatches || []).map((m: any) => {
      const key = `${m.title}|||${m.artist}`;
      const spotifyInfo = spotifyIdMap.get(key);
      return {
        title: m.title,
        subtitle: `${m.artist} (${m.year})`,
        spotify_id: spotifyInfo?.id || null,
      };
    });

    const sameEnergy = (content.sameEnergy || []).map((m: any) => {
      const key = `${m.title}|||${m.artist}`;
      const spotifyInfo = spotifyIdMap.get(key);
      return {
        title: m.title,
        subtitle: `${m.artist} (${m.year})`,
        spotify_id: spotifyInfo?.id || null,
      };
    });

    const relatedArtists = (content.relatedArtists || []).map((a: string) => ({
      title: a,
      subtitle: "Artist",
    }));

    const whyTheseWork = content.whyTheseWork
      ? [{ title: "Why These Work", subtitle: content.whyTheseWork }]
      : [];

    const upsertData: any = {
      slug,
      page_type,
      title: content.title,
      meta_description: content.description,
      heading: content.heading,
      summary: content.summary,
      closest_matches: closestMatches,
      same_energy: sameEnergy,
      related_artists: relatedArtists,
      why_these_work: whyTheseWork,
      related_songs: content.relatedSongs || [],
      related_vibes: content.relatedVibes || [],
      related_artist_links: content.relatedArtistLinks || [],
    };

    if (seedSpotifyTrackId) {
      upsertData.spotify_track_id = seedSpotifyTrackId;
    }

    // Store verified identity fields so future cache reads can validate
    // without re-querying Spotify. Requires the columns to exist in seo_pages
    // (see schema recommendation below). Harmless if columns are absent —
    // PostgREST will reject the upsert in that case; we catch and continue.
    if (page_type === "song" && verifiedMetadata.song_title) {
      upsertData.resolved_song_title = verifiedMetadata.song_title;
      upsertData.resolved_artist_name = verifiedMetadata.artist_name;
    }

    let insertError: any = null;
    try {
      ({ error: insertError } = await supabase.from("seo_pages").upsert(upsertData));
    } catch (e) {
      insertError = e;
    }

    // If the upsert failed because resolved_song_title/resolved_artist_name
    // columns don't exist yet, retry without those fields.
    if (insertError) {
      const msg = String(insertError?.message || insertError);
      if (msg.includes("resolved_song_title") || msg.includes("resolved_artist_name")) {
        console.log("[Identity] Schema missing resolved identity columns — writing without them");
        delete upsertData.resolved_song_title;
        delete upsertData.resolved_artist_name;
        const { error: retryError } = await supabase.from("seo_pages").upsert(upsertData);
        if (retryError) throw retryError;
      } else {
        throw insertError;
      }
    }

    return new Response(JSON.stringify({ status: "created" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-seo-page error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
