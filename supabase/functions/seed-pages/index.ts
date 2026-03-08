import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SEEDS: { slug: string; page_type: string }[] = [
  // ── Songs (80) ──
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
  { slug: "hey-ya", page_type: "song" },
  { slug: "stan", page_type: "song" },
  { slug: "jolene", page_type: "song" },
  { slug: "hallelujah", page_type: "song" },
  { slug: "heroes", page_type: "song" },
  { slug: "purple-rain", page_type: "song" },
  { slug: "africa", page_type: "song" },
  { slug: "dont-stop-me-now", page_type: "song" },
  { slug: "superstition", page_type: "song" },
  { slug: "imagine", page_type: "song" },
  { slug: "hotel-california", page_type: "song" },
  { slug: "sweet-child-o-mine", page_type: "song" },
  { slug: "like-a-rolling-stone", page_type: "song" },
  { slug: "dancing-queen", page_type: "song" },
  { slug: "karma-police", page_type: "song" },
  { slug: "november-rain", page_type: "song" },
  { slug: "fly-me-to-the-moon", page_type: "song" },
  { slug: "a-day-in-the-life", page_type: "song" },
  { slug: "roxanne", page_type: "song" },
  { slug: "landslide", page_type: "song" },
  { slug: "life-on-mars", page_type: "song" },
  { slug: "fade-into-you", page_type: "song" },
  { slug: "lovefool", page_type: "song" },
  { slug: "torn", page_type: "song" },
  { slug: "everywhere", page_type: "song" },
  { slug: "losing-my-religion", page_type: "song" },
  { slug: "champagne-supernova", page_type: "song" },
  { slug: "nuthin-but-a-g-thang", page_type: "song" },
  { slug: "motion-sickness", page_type: "song" },
  { slug: "waves", page_type: "song" },
  { slug: "heat-waves", page_type: "song" },
  { slug: "young-folks", page_type: "song" },
  { slug: "ribs", page_type: "song" },
  { slug: "myth", page_type: "song" },
  { slug: "never-gonna-give-you-up", page_type: "song" },
  { slug: "summertime-sadness", page_type: "song" },
  { slug: "alright", page_type: "song" },
  { slug: "nights", page_type: "song" },
  { slug: "black-dog", page_type: "song" },
  { slug: "comfortably-numb", page_type: "song" },
  { slug: "bitter-sweet-symphony", page_type: "song" },
  { slug: "zombie", page_type: "song" },
  { slug: "where-is-my-mind", page_type: "song" },
  { slug: "lucky", page_type: "song" },
  { slug: "agnes", page_type: "song" },

  // ── Artists (70) ──
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
  { slug: "adele", page_type: "artist" },
  { slug: "led-zeppelin", page_type: "artist" },
  { slug: "prince", page_type: "artist" },
  { slug: "the-beatles", page_type: "artist" },
  { slug: "stevie-wonder", page_type: "artist" },
  { slug: "outkast", page_type: "artist" },
  { slug: "the-cure", page_type: "artist" },
  { slug: "depeche-mode", page_type: "artist" },
  { slug: "the-smiths", page_type: "artist" },
  { slug: "joy-division", page_type: "artist" },
  { slug: "talking-heads", page_type: "artist" },
  { slug: "r-e-m", page_type: "artist" },
  { slug: "oasis", page_type: "artist" },
  { slug: "blur", page_type: "artist" },
  { slug: "the-national", page_type: "artist" },
  { slug: "sufjan-stevens", page_type: "artist" },
  { slug: "elliot-smith", page_type: "artist" },
  { slug: "fiona-apple", page_type: "artist" },
  { slug: "bjork", page_type: "artist" },
  { slug: "portishead", page_type: "artist" },
  { slug: "massive-attack", page_type: "artist" },
  { slug: "cocteau-twins", page_type: "artist" },
  { slug: "kate-bush", page_type: "artist" },
  { slug: "lorde", page_type: "artist" },
  { slug: "clairo", page_type: "artist" },
  { slug: "weyes-blood", page_type: "artist" },
  { slug: "khruangbin", page_type: "artist" },
  { slug: "japanese-breakfast", page_type: "artist" },
  { slug: "the-war-on-drugs", page_type: "artist" },
  { slug: "alvvays", page_type: "artist" },
  { slug: "men-i-trust", page_type: "artist" },
  { slug: "cigarettes-after-sex", page_type: "artist" },
  { slug: "j-cole", page_type: "artist" },
  { slug: "travis-scott", page_type: "artist" },
  { slug: "childish-gambino", page_type: "artist" },

  // ── Vibes (50) ──
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
  { slug: "foggy-morning-walk", page_type: "vibe" },
  { slug: "existential-crisis-playlist", page_type: "vibe" },
  { slug: "sapphic-indie", page_type: "vibe" },
  { slug: "cottagecore-folk", page_type: "vibe" },
  { slug: "songs-that-make-you-feel-powerful", page_type: "vibe" },
  { slug: "liminal-space-music", page_type: "vibe" },
  { slug: "sunset-on-the-rooftop", page_type: "vibe" },
  { slug: "old-soul-playlist", page_type: "vibe" },
  { slug: "2000s-pop-throwback", page_type: "vibe" },
  { slug: "songs-for-stargazing", page_type: "vibe" },
  { slug: "rainy-day-acoustic", page_type: "vibe" },
  { slug: "after-party-comedown", page_type: "vibe" },
  { slug: "shower-singing-bangers", page_type: "vibe" },
  { slug: "songs-that-feel-like-autumn", page_type: "vibe" },
  { slug: "driving-through-the-city-at-night", page_type: "vibe" },
  { slug: "hauntingly-beautiful", page_type: "vibe" },
  { slug: "songs-that-feel-like-a-warm-hug", page_type: "vibe" },
  { slug: "90s-alternative-deep-cuts", page_type: "vibe" },
  { slug: "bittersweet-graduation", page_type: "vibe" },
  { slug: "psychedelic-journey", page_type: "vibe" },
];

// Deduplicate
const seen = new Set<string>();
const UNIQUE_SEEDS = SEEDS.filter((s) => {
  const key = `${s.page_type}:${s.slug}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const DELAY_MS = 2500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(body.limit || 10, 1), 50);
    const offset = Math.max(body.offset || 0, 0);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get existing pages
    const { data: existing } = await supabase
      .from("seo_pages")
      .select("slug, page_type");

    const existingSet = new Set(
      (existing || []).map((p: any) => `${p.page_type}:${p.slug}`)
    );

    // Slice the seed list from offset
    const window = UNIQUE_SEEDS.slice(offset, offset + limit);
    const toGenerate = window.filter((s) => !existingSet.has(`${s.page_type}:${s.slug}`));
    const alreadyExist = window.filter((s) => existingSet.has(`${s.page_type}:${s.slug}`));

    console.log(`Batch: offset=${offset}, limit=${limit}, window=${window.length}, toGenerate=${toGenerate.length}, skipped=${alreadyExist.length}`);

    let created = 0;
    let failed = 0;
    const errors: { slug: string; page_type: string; error: string }[] = [];

    // Process one at a time to stay within timeout
    for (let i = 0; i < toGenerate.length; i++) {
      const seed = toGenerate[i];
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
          errors.push({ ...seed, error: "rate_limited" });
          failed++;
          continue;
        }

        const data = await res.json();
        if (data.error) {
          errors.push({ ...seed, error: data.error });
          failed++;
        } else {
          created++;
          console.log(`Created: ${seed.page_type}/${seed.slug} (${i + 1}/${toGenerate.length})`);
        }
      } catch (e) {
        errors.push({ ...seed, error: e.message });
        failed++;
      }

      if (i < toGenerate.length - 1) {
        await sleep(DELAY_MS);
      }
    }

    const nextOffset = offset + limit;
    const remaining = Math.max(UNIQUE_SEEDS.length - nextOffset, 0);
    const done = nextOffset >= UNIQUE_SEEDS.length;

    const summary = {
      total_seeds: UNIQUE_SEEDS.length,
      offset,
      limit,
      attempted: toGenerate.length,
      created,
      skipped: alreadyExist.length,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      next_offset: done ? null : nextOffset,
      remaining,
      done,
    };

    console.log(`Result: ${JSON.stringify({ ...summary, errors: undefined })}`);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seed-pages error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
