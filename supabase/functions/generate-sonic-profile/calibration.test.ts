// =============================================================================
// Sonic DNA Calibration Test
//
// Integration test: calls the live generate-sonic-profile edge function for
// each entry in the calibration dataset and validates descriptor accuracy.
//
// ⚠️  This test calls the Claude API. Do NOT run in CI.
//     Run manually when evaluating descriptor generation changes.
//
// Usage:
//   deno test --allow-env --allow-net calibration.test.ts
//
// Filter to one song (by partial title match):
//   SONG_FILTER="Heartless" deno test --allow-env --allow-net calibration.test.ts
//
// Load env from .env file:
//   deno test --allow-env --allow-net --allow-read calibration.test.ts
//
// Required env vars:
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_PUBLISHABLE_KEY
// =============================================================================

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { CALIBRATION_SONGS, type CalibrationEntry } from "./calibration-dataset.ts";

const SUPABASE_URL       = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY  = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SONG_FILTER        = Deno.env.get("SONG_FILTER")?.toLowerCase() ?? "";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SongProfile {
  energy_posture?: string[];
  groove_character?: string[];
  drum_character?: string[];
  bass_character?: string[];
  harmonic_color?: string[];
  melodic_character?: string[];
  vocal_character?: string[];
  texture?: string[];
  arrangement_energy_arc?: string[];
  emotional_tone?: string[];
  era_period?: string[];
  era_movement?: string[];
  environment_imagery?: string[];
  listener_use_case?: string[];
  spatial_feel?: string[];
  intensity_level?: string;
  danceability_feel?: string;
  confidence_score?: number;
}

interface CalibrationResult {
  entry: CalibrationEntry;
  profile: SongProfile | null;
  allSlugs: string[];
  missing: string[];      // must_have slugs not found
  forbidden: string[];    // must_not_have slugs that were found
  passed: boolean;
  error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractAllSlugs(profile: SongProfile): string[] {
  const fields = [
    "energy_posture","groove_character","drum_character","bass_character","harmonic_color",
    "melodic_character","vocal_character","texture","arrangement_energy_arc",
    "emotional_tone","era_period","era_movement","environment_imagery","listener_use_case","spatial_feel",
  ] as const;
  const slugs: string[] = [];
  for (const f of fields) {
    const v = profile[f];
    if (Array.isArray(v)) slugs.push(...v);
  }
  return [...new Set(slugs)];
}

async function generateProfile(title: string, artist: string): Promise<{
  profile: SongProfile | null;
  error?: string;
}> {
  // Force cache bypass by appending a timestamp to avoid stale cached profiles
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-sonic-profile`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey":        SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      spotify_track_id: `calibration-${title}-${artist}-${Date.now()}`,
      song_title:       title,
      artist_name:      artist,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { profile: null, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  }

  const data = await res.json();
  if (data.error) return { profile: null, error: data.error };
  return { profile: data.profile as SongProfile };
}

function evaluateEntry(entry: CalibrationEntry, profile: SongProfile): CalibrationResult {
  const allSlugs = extractAllSlugs(profile);
  const slugSet  = new Set(allSlugs);

  const missing   = entry.must_have.filter((s) => !slugSet.has(s));
  const forbidden = entry.must_not_have.filter((s) => slugSet.has(s));
  const passed    = missing.length === 0 && forbidden.length === 0;

  return { entry, profile, allSlugs, missing, forbidden, passed };
}

function printResult(r: CalibrationResult, index: number, total: number): void {
  const status = r.error ? "ERROR" : r.passed ? "PASS" : "FAIL";
  const icon   = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️";
  const pct    = `[${index}/${total}]`;

  console.log(`\n${icon} ${pct} "${r.entry.title}" — ${r.entry.artist}`);
  console.log(`   Archetype : ${r.entry.archetype}`);

  if (r.error) {
    console.log(`   Error     : ${r.error}`);
    return;
  }

  console.log(`   Slugs     : ${r.allSlugs.join(", ")}`);
  console.log(`   Intensity : ${r.profile?.intensity_level ?? "?"} | Dance: ${r.profile?.danceability_feel ?? "?"} | Confidence: ${r.profile?.confidence_score?.toFixed(2) ?? "?"}`);

  if (r.missing.length > 0) {
    console.log(`   ❌ MISSING (must_have) : ${r.missing.join(", ")}`);
  }
  if (r.forbidden.length > 0) {
    console.log(`   ❌ PRESENT (must_not_have) : ${r.forbidden.join(", ")}`);
  }
  if (r.passed) {
    console.log(`   ✅ All checks passed`);
  }
  console.log(`   Reason    : ${r.entry.reasoning}`);
}

function printSummary(results: CalibrationResult[]): void {
  const total   = results.length;
  const passed  = results.filter((r) => r.passed).length;
  const failed  = results.filter((r) => !r.passed && !r.error).length;
  const errored = results.filter((r) => !!r.error).length;

  console.log("\n" + "═".repeat(60));
  console.log("CALIBRATION SUMMARY");
  console.log("═".repeat(60));
  console.log(`Total   : ${total}`);
  console.log(`Passed  : ${passed} (${Math.round((passed / total) * 100)}%)`);
  console.log(`Failed  : ${failed}`);
  console.log(`Errors  : ${errored}`);
  console.log("═".repeat(60));

  if (failed > 0 || errored > 0) {
    console.log("\nFAILED / ERRORED:");
    for (const r of results.filter((r) => !r.passed)) {
      const label = r.error ? `[ERROR] ${r.error}` :
        [
          r.missing.length  ? `missing: ${r.missing.join(", ")}`   : "",
          r.forbidden.length ? `forbidden: ${r.forbidden.join(", ")}` : "",
        ].filter(Boolean).join(" | ");
      console.log(`  • "${r.entry.title}" (${r.entry.artist}) — ${label}`);
    }
  }
}

// ── Test ───────────────────────────────────────────────────────────────────────

Deno.test("sonic-profile: calibration dataset validation", async () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
    throw new Error("Missing required env vars");
  }

  const songs = SONG_FILTER
    ? CALIBRATION_SONGS.filter((s) =>
        s.title.toLowerCase().includes(SONG_FILTER) ||
        s.artist.toLowerCase().includes(SONG_FILTER)
      )
    : CALIBRATION_SONGS;

  if (songs.length === 0) {
    throw new Error(`No songs matched SONG_FILTER="${SONG_FILTER}"`);
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`SONIC DNA CALIBRATION — ${songs.length} song(s)`);
  if (SONG_FILTER) console.log(`Filter: "${SONG_FILTER}"`);
  console.log("═".repeat(60));

  const results: CalibrationResult[] = [];

  for (let i = 0; i < songs.length; i++) {
    const entry = songs[i];
    const { profile, error } = await generateProfile(entry.title, entry.artist);

    let result: CalibrationResult;
    if (error || !profile) {
      result = {
        entry,
        profile: null,
        allSlugs: [],
        missing: entry.must_have,
        forbidden: [],
        passed: false,
        error: error ?? "No profile returned",
      };
    } else {
      result = evaluateEntry(entry, profile);
    }

    results.push(result);
    printResult(result, i + 1, songs.length);

    // Stagger requests slightly to avoid rate limiting
    if (i < songs.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  printSummary(results);

  // Fail the test if any entries failed
  const failCount = results.filter((r) => !r.passed).length;
  if (failCount > 0) {
    throw new Error(`${failCount} calibration check(s) failed — see output above`);
  }
});
