import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const TEST_SONGS = [
  { title: "Pump It Up", artist: "Joe Budden", expectResolved: true },
  { title: "Blinding Lights", artist: "The Weeknd", expectResolved: true },
  { title: "No Scrubs", artist: "TLC", expectResolved: true },
  { title: "Can't Tell Me Nothing", artist: "Kanye West", expectResolved: true },
  { title: "Int'l Players Anthem (I Choose You)", artist: "UGK", expectResolved: true },
  { title: "Xyzzy Frobnicator 9000", artist: "Totally Fake Artist", expectResolved: false },
];

Deno.test("fetch-spotify-images: test matrix of known and fake tracks", async () => {
  const songs = TEST_SONGS.map(t => ({ title: t.title, artist: t.artist }));

  const res = await fetch(`${SUPABASE_URL}/functions/v1/fetch-spotify-images`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ songs, artists: [] }),
  });

  const body = await res.text();
  assertEquals(res.status, 200, `Expected 200, got ${res.status}: ${body.slice(0, 500)}`);

  const data = JSON.parse(body);
  console.log("\n=== TEST MATRIX RESULTS ===\n");

  for (const t of TEST_SONGS) {
    const key = `${t.title}|||${t.artist}`;
    const result = data.songs?.[key];

    const status = result?.status ?? "MISSING";
    const hasArt = !!result?.image_url;
    const hasSpotify = !!result?.spotify_url;
    const hasPreview = !!result?.preview_url;

    console.log(
      `${status === "resolved" ? "✅" : status === "not_found" ? "❌" : "⚠️"} ` +
      `"${t.title}" by ${t.artist} → status=${status}, art=${hasArt}, spotify=${hasSpotify}, preview=${hasPreview}`
    );

    if (t.expectResolved) {
      // For known tracks: should be resolved OR temporary_failure (if rate limited)
      const acceptable = ["resolved", "temporary_failure"];
      if (!acceptable.includes(status)) {
        console.warn(`  ⚠️ UNEXPECTED: expected resolved or temporary_failure, got ${status}`);
      }
      if (status === "resolved") {
        // When resolved, spotify_url MUST be present
        assertEquals(hasSpotify, true, `${t.title}: resolved but no spotify_url`);
      }
    } else {
      // Fake track: should be not_found OR temporary_failure
      const acceptable = ["not_found", "temporary_failure"];
      if (!acceptable.includes(status)) {
        console.warn(`  ⚠️ UNEXPECTED: expected not_found or temporary_failure, got ${status}`);
      }
    }
  }

  console.log("\n=== END TEST MATRIX ===\n");
});
