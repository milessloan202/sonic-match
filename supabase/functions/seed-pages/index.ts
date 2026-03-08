import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SEEDS: { slug: string; page_type: string }[] = [
  // Songs (35)
  { slug: "bohemian-rhapsody", page_type: "song" },
  { slug: "blinding-lights", page_type: "song" },
  { slug: "smells-like-teen-spirit", page_type: "song" },
  { slug: "redbone", page_type: "song" },
  { slug: "somebody-that-i-used-to-know", page_type: "song" },
  { slug: "midnight-city", page_type: "song" },
  { slug: "video-games", page_type: "song" },
  { slug: "ivy", page_type: "song" },
  { slug: "let-it-happen", page_type: "song" },
  { slug: "electric-feel", page_type: "song" },
  { slug: "do-i-wanna-know", page_type: "song" },
  { slug: "skinny-love", page_type: "song" },
  { slug: "get-lucky", page_type: "song" },
  { slug: "somebody-else", page_type: "song" },
  { slug: "take-me-out", page_type: "song" },
  { slug: "pumped-up-kicks", page_type: "song" },
  { slug: "take-on-me", page_type: "song" },
  { slug: "hotline-bling", page_type: "song" },
  { slug: "space-oddity", page_type: "song" },
  { slug: "come-as-you-are", page_type: "song" },
  { slug: "fast-car", page_type: "song" },
  { slug: "feel-good-inc", page_type: "song" },
  { slug: "no-surprises", page_type: "song" },
  { slug: "budapest", page_type: "song" },
  { slug: "creep", page_type: "song" },
  { slug: "wish-you-were-here", page_type: "song" },
  { slug: "dreams", page_type: "song" },
  { slug: "mr-brightside", page_type: "song" },
  { slug: "heart-of-gold", page_type: "song" },
  { slug: "under-pressure", page_type: "song" },
  { slug: "lose-yourself", page_type: "song" },
  { slug: "stairway-to-heaven", page_type: "song" },
  { slug: "a-case-of-you", page_type: "song" },
  { slug: "pink-white", page_type: "song" },
  { slug: "the-less-i-know-the-better", page_type: "song" },

  // Artists (35)
  { slug: "taylor-swift", page_type: "artist" },
  { slug: "tame-impala", page_type: "artist" },
  { slug: "frank-ocean", page_type: "artist" },
  { slug: "radiohead", page_type: "artist" },
  { slug: "lana-del-rey", page_type: "artist" },
  { slug: "kendrick-lamar", page_type: "artist" },
  { slug: "arctic-monkeys", page_type: "artist" },
  { slug: "sza", page_type: "artist" },
  { slug: "bon-iver", page_type: "artist" },
  { slug: "daft-punk", page_type: "artist" },
  { slug: "the-weeknd", page_type: "artist" },
  { slug: "billie-eilish", page_type: "artist" },
  { slug: "fleetwood-mac", page_type: "artist" },
  { slug: "tyler-the-creator", page_type: "artist" },
  { slug: "pink-floyd", page_type: "artist" },
  { slug: "hozier", page_type: "artist" },
  { slug: "childish-gambino", page_type: "artist" },
  { slug: "david-bowie", page_type: "artist" },
  { slug: "gorillaz", page_type: "artist" },
  { slug: "mac-demarco", page_type: "artist" },
  { slug: "phoebe-bridgers", page_type: "artist" },
  { slug: "nirvana", page_type: "artist" },
  { slug: "the-1975", page_type: "artist" },
  { slug: "beach-house", page_type: "artist" },
  { slug: "steve-lacy", page_type: "artist" },
  { slug: "mgmt", page_type: "artist" },
  { slug: "amy-winehouse", page_type: "artist" },
  { slug: "glass-animals", page_type: "artist" },
  { slug: "drake", page_type: "artist" },
  { slug: "kanye-west", page_type: "artist" },
  { slug: "joni-mitchell", page_type: "artist" },
  { slug: "queen", page_type: "artist" },
  { slug: "the-strokes", page_type: "artist" },
  { slug: "mac-miller", page_type: "artist" },
  { slug: "mitski", page_type: "artist" },

  // Vibes (30)
  { slug: "music-for-night-driving", page_type: "vibe" },
  { slug: "golden-hour-chill", page_type: "vibe" },
  { slug: "rainy-lo-fi", page_type: "vibe" },
  { slug: "dark-academia-playlist", page_type: "vibe" },
  { slug: "main-character-energy", page_type: "vibe" },
  { slug: "chill-lo-fi-study-beats", page_type: "vibe" },
  { slug: "late-night-sad-songs", page_type: "vibe" },
  { slug: "getting-over-a-breakup", page_type: "vibe" },
  { slug: "sunday-morning-coffee", page_type: "vibe" },
  { slug: "summer-road-trip", page_type: "vibe" },
  { slug: "90s-nostalgia", page_type: "vibe" },
  { slug: "indie-coffee-shop", page_type: "vibe" },
  { slug: "workout-hype", page_type: "vibe" },
  { slug: "ethereal-dreamy", page_type: "vibe" },
  { slug: "cozy-winter-evening", page_type: "vibe" },
  { slug: "beach-sunset-vibes", page_type: "vibe" },
  { slug: "melancholy-but-beautiful", page_type: "vibe" },
  { slug: "feel-good-upbeat", page_type: "vibe" },
  { slug: "midnight-jazz", page_type: "vibe" },
  { slug: "cyberpunk-synthwave", page_type: "vibe" },
  { slug: "acoustic-campfire", page_type: "vibe" },
  { slug: "falling-in-love", page_type: "vibe" },
  { slug: "songs-that-feel-like-floating", page_type: "vibe" },
  { slug: "villain-era-playlist", page_type: "vibe" },
  { slug: "childhood-nostalgia", page_type: "vibe" },
  { slug: "4am-thoughts", page_type: "vibe" },
  { slug: "city-pop-aesthetic", page_type: "vibe" },
  { slug: "songs-for-a-movie-soundtrack", page_type: "vibe" },
  { slug: "slow-burn-romance", page_type: "vibe" },
  { slug: "desert-highway-rock", page_type: "vibe" },
];

const BATCH_SIZE = 3;
const DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check which pages already exist
  const { data: existing } = await supabase
    .from("seo_pages")
    .select("slug, page_type");

  const existingSet = new Set(
    (existing || []).map((p) => `${p.page_type}:${p.slug}`)
  );

  const toGenerate = SEEDS.filter(
    (s) => !existingSet.has(`${s.page_type}:${s.slug}`)
  );

  const results: { slug: string; page_type: string; status: string }[] = [];
  let errorCount = 0;

  for (let i = 0; i < toGenerate.length; i += BATCH_SIZE) {
    const batch = toGenerate.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (seed) => {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/generate-seo-page`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify(seed),
          });

          if (res.status === 429) {
            return { ...seed, status: "rate_limited" };
          }

          const data = await res.json();
          if (data.error) {
            return { ...seed, status: `error: ${data.error}` };
          }
          return { ...seed, status: data.status || "created" };
        } catch (e) {
          return { ...seed, status: `error: ${e.message}` };
        }
      })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled") {
        results.push(r.value);
        if (r.value.status.startsWith("error")) errorCount++;
      }
    }

    // Delay between batches to avoid rate limits
    if (i + BATCH_SIZE < toGenerate.length) {
      await sleep(DELAY_MS);
    }
  }

  return new Response(
    JSON.stringify({
      total_seeds: SEEDS.length,
      already_existed: SEEDS.length - toGenerate.length,
      processed: results.length,
      errors: errorCount,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
