// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// generate-sonic-profile
//
// Creates a structured Sonic DNA profile for a song using Claude.
// Cache-first: returns existing profile if found, generates only if missing.
// v2: adds conflict resolution + canonical_descriptors payload.
//
// POST body:
//   { spotify_track_id, song_title, artist_name }
//
// Returns:
//   { profile, canonical_descriptors, source: "cache" | "generated" }
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DESCRIPTOR_VOCABULARY = {
  tempo_feel: ["slow-burn","laid-back","midtempo","driving","urgent","propulsive","floating","steady"],
  groove: ["straight","swung","syncopated","shuffling","pulsing","hypnotic","bouncy","stuttering","gliding","marching","rolling","locked-in"],
  drum_character: ["crisp","dusty","punchy","clipped","roomy","electronic","live-kit","808-heavy","breakbeat-driven","clap-forward","gated","skeletal"],
  bass_character: ["sub-heavy","melodic-bass","rubbery","droning","warm-bass","distorted","restrained","funky","syrupy","synth-bass"],
  harmonic_color: ["minor-key","major-key","jazzy","lush","suspended","gospel-rich","melancholic","bright","cinematic","static-vamp","nostalgic"],
  melodic_character: ["chant-like","airy","conversational","hook-forward","leap-heavy","repetitive","silky","angular","anthemic","intimate"],
  vocal_character: ["breathy","commanding","restrained-vocal","falsetto-led","layered","talk-sung","rhythmic","emotionally-direct","cool-toned","raw","yearning"],
  texture: ["glossy","grainy","neon","analog","lo-fi","polished","hazy","saturated","sparse","lush-texture","metallic","warm"],
  arrangement_energy_arc: ["immediate-impact","slow-build","sustained-drive","explosive-chorus","hypnotic-loop","late-night-cruise","euphoric-lift","tension-release","simmering","full-bloom"],
  emotional_tone: ["wistful","triumphant","lonely","seductive","swaggering","devotional","restless","playful","cold","glamorous","tender","nocturnal","euphoric"],
  era_lineage: [
    // Classic hip-hop lineage
    "golden-age-hiphop","boom-bap-era","jazz-rap-era","native-tongues-era",
    "jiggy-era-rap","glossy-commercial-rap","southern-crunk","neptunes-era",
    "chipmunk-soul-era","early-atl-trap","blog-era-rap",
    // 2010s crossover & cloud era
    "synth-rap-era","bloghouse-era","indie-rap-era","cloud-rap-era","witch-house-rap",
    // Trap evolution
    "ambient-trap","maximalist-trap","cinematic-trap","orchestral-trap",
    "industrial-rap","avant-rap","electro-punk-rap","yeezus-era",
    // Melodic / emo / sing-rap
    "melodic-trap","emo-rap-era","sing-rap-era",
    // SoundCloud generation
    "soundcloud-rap-era","soundcloud-punk-rap","lo-fi-trap",
    // Drill variants
    "chicago-drill","brooklyn-drill","uk-drill","jersey-drill",
    // Hyper-modern
    "rage-rap","hypertrap","glitch-rap",
    // Non-rap sonic eras (retained for cross-genre coverage)
    "80s-revival","trap-soul","neo-soul","quiet-storm",
  ],
  environment_imagery: ["night-drive","club-floor","headphones-alone","rooftop-city","summer-daylight","rainy-street","after-hours","house-party"],
  listener_use_case: ["pregame","late-night-walk","dancefloor","windows-down","flirtation","reflective-commute"],
};

const INTENSITY_LEVELS = ["very-low","low","medium-low","medium","medium-high","high","very-high"];
const DANCEABILITY_FEELS = ["not-danceable","minimal","moderate","danceable","highly-danceable","made-for-dancefloor"];

// Categories included in canonical display_descriptors
const CANONICAL_CATEGORIES = new Set([
  "tempo_feel", "texture", "emotional_tone", "era_lineage",
  "environment_imagery", "listener_use_case", "groove", "harmonic_color", "vocal_character",
]);

// ── Types ─────────────────────────────────────────────────────────────────────

interface RegistryRow {
  slug: string;
  label: string;
  category: string;
  is_clickable: boolean;
  conflicts_with: string[];
}

interface CanonicalDescriptor {
  slug: string;
  label: string;
  category: string;
  is_clickable: boolean;
  search_url: string;
  dna_url: string;
}

interface CanonicalDescriptorPayload {
  display_descriptors: CanonicalDescriptor[];
  descriptor_search_url: string;
  all_slugs: string[];
}

// ── Descriptor glossary ───────────────────────────────────────────────────────
// Authoritative definitions for all core descriptors.
// Drives both the system prompt and the contradiction ruleset.
// To add/correct a descriptor: edit here — changes propagate to the prompt automatically.

const DESCRIPTOR_GLOSSARY: Array<{
  slug: string;
  category: string;
  means: string;
  notMeans: string[];
}> = [
  // tempo_feel
  { slug: "laid-back",        category: "tempo_feel",             means: "Genuinely easy, loose, unforced comfort. The song feels unhurried and the listener can settle into it.", notMeans: ["sparse production", "midtempo BPM alone", "cool or detached delivery", "slow-paced trap", "cold or arrogant energy"] },
  { slug: "slow-burn",        category: "tempo_feel",             means: "Restrained energy with suppressed force. Tension building — not relaxation.", notMeans: ["laid-back", "easygoing", "calm"] },
  { slug: "driving",          category: "tempo_feel",             means: "Relentless forward momentum. Can be dark, cold, or hypnotic at any tempo.", notMeans: ["fast only", "aggressive only"] },
  // emotional_tone
  { slug: "cold",             category: "emotional_tone",         means: "Icy detachment, sterile confidence, arrogance, or predatory distance. Assertive and distancing.", notMeans: ["calm", "mellow", "relaxed", "laid-back", "introspective"] },
  { slug: "swaggering",       category: "emotional_tone",         means: "Dominant, self-assured outward projection of power and confidence.", notMeans: ["laid-back ease", "gentle confidence", "mellow"] },
  { slug: "nocturnal",        category: "emotional_tone",         means: "Atmospheric, late-night, withdrawn. Dark introspection — not peaceful or calm.", notMeans: ["calm", "peaceful", "euphoric", "triumphant"] },
  { slug: "restless",         category: "emotional_tone",         means: "Anxious, unresolved tension. Urgency and discomfort in the emotional character.", notMeans: ["laid-back", "easygoing", "relaxed"] },
  { slug: "wistful",          category: "emotional_tone",         means: "Gentle longing and bittersweet reflection. Soft, inward, and emotionally tender.", notMeans: ["cold", "aggressive", "swaggering", "confrontational"] },
  { slug: "playful",          category: "emotional_tone",         means: "Light, spirited, and fun. Levity without heaviness or darkness.", notMeans: ["cold", "dark", "aggressive", "tense", "menacing"] },
  // vocal_character
  { slug: "cool-toned",       category: "vocal_character",        means: "Controlled, precise, emotionally restrained vocal delivery. Detached — not relaxed.", notMeans: ["laid-back", "easygoing", "mellow — cool-toned can be predatory or forceful"] },
  { slug: "commanding",       category: "vocal_character",        means: "Assertive, dominant, authoritative vocal presence that controls the room.", notMeans: ["laid-back", "gentle", "easygoing"] },
  // texture
  { slug: "sparse",           category: "texture",                means: "Minimalist production with deliberate space between elements.", notMeans: ["relaxed", "laid-back", "easygoing — sparse can be cold, tense, or threatening"] },
  { slug: "warm",             category: "texture",                means: "Organic, rounded, inviting sonic surface. Comfort and analog richness.", notMeans: ["cold emotional character", "metallic", "harsh", "icy", "sterile"] },
  { slug: "glossy",           category: "texture",                means: "Polished, high-sheen, modern production surface. Clean, refined, and controlled.", notMeans: ["warm", "analog", "raw", "gritty"] },
  { slug: "metallic",         category: "texture",                means: "Hard, machine-like, sharp-edged sonic surface. Cold precision.", notMeans: ["warm", "organic", "cozy", "laid-back"] },
  // arrangement_energy_arc
  { slug: "simmering",        category: "arrangement_energy_arc", means: "Sustained suppressed tension. Force held back without release — contained and coiled.", notMeans: ["relaxed", "laid-back", "calm"] },
  { slug: "sustained-drive",  category: "arrangement_energy_arc", means: "Unrelenting forward motion maintained throughout the track.", notMeans: ["laid-back", "floaty", "unhurried"] },
  { slug: "immediate-impact", category: "arrangement_energy_arc", means: "Full energy present from bar one. Hits hard immediately — no buildup.", notMeans: ["gradual", "laid-back", "easygoing"] },
  // drum_character
  { slug: "808-heavy",        category: "drum_character",         means: "Deep, dominant 808 sub-bass that defines the rhythmic weight and pressure.", notMeans: ["warm", "organic", "laid-back — 808s add aggression and physical weight"] },
  { slug: "punchy",           category: "drum_character",         means: "Sharp-transient percussion with immediate physical impact.", notMeans: ["soft", "laid-back", "roomy", "organic"] },
  // era_lineage — classic hip-hop
  { slug: "golden-age-hiphop",     category: "era_lineage", means: "East Coast 90s hip-hop peak: complex lyricism, jazz/soul sampling, boom bap production, MC-first culture.", notMeans: ["trap", "melodic rap", "any post-2000 aesthetic"] },
  { slug: "boom-bap-era",          category: "era_lineage", means: "Hard kick-snare patterns with chopped samples. Lyrical focus, minimal synths. The rhythmic backbone of classic hip-hop.", notMeans: ["trap 808s", "melodic hooks", "electronic textures"] },
  { slug: "jazz-rap-era",          category: "era_lineage", means: "Sophisticated jazz samples, conversational flow, intellectual lyricism. Think ATCQ, Gang Starr, Pete Rock.", notMeans: ["hard club rap", "trap production", "aggressive energy"] },
  { slug: "native-tongues-era",    category: "era_lineage", means: "Afrocentric positivity, eclectic sampling, playful lyricism. De La Soul / ATCQ / Jungle Brothers aesthetic.", notMeans: ["aggressive rap", "dark trap", "gangsta rap"] },
  { slug: "jiggy-era-rap",         category: "era_lineage", means: "Late 90s glossy commercial hip-hop: luxury themes, danceable production, Puff Daddy / Bad Boy aesthetic.", notMeans: ["underground hip-hop", "lo-fi", "lyric-first rap"] },
  { slug: "glossy-commercial-rap", category: "era_lineage", means: "Early 2000s polished radio rap with full arrangements, melodic hooks, and mainstream crossover appeal.", notMeans: ["indie rap", "lo-fi", "underground or boom bap"] },
  { slug: "southern-crunk",        category: "era_lineage", means: "High-energy Southern club rap: big synth stabs, call-and-response hooks, Lil Jon / Three 6 Mafia influence.", notMeans: ["mellow Southern rap", "trap soul", "lo-fi"] },
  { slug: "neptunes-era",          category: "era_lineage", means: "Pharrell / Chad Hugo production signature: skeletal percussion, idiosyncratic funk, sparse but infectious minimalism.", notMeans: ["dense layered production", "boom bap", "generic pop"] },
  { slug: "chipmunk-soul-era",     category: "era_lineage", means: "Early Kanye West aesthetic: soul samples pitched up, warm nostalgia, emotional vulnerability over hip-hop beats.", notMeans: ["dark trap", "hard rap", "lo-fi or experimental"] },
  { slug: "early-atl-trap",        category: "era_lineage", means: "T.I. / Gucci Mane era Atlanta: slow hi-hat rolls, hard 808s, street narratives. The original trap blueprint.", notMeans: ["melodic trap", "cloud rap", "emo trap"] },
  { slug: "blog-era-rap",          category: "era_lineage", means: "2007–2012 internet rap economy: free mixtapes, eclectic production, Drake / Wale / Kid Cudi / early Odd Future.", notMeans: ["pre-internet classic hip-hop", "SoundCloud era", "streaming-era rap"] },
  // era_lineage — 2010s crossovers
  { slug: "synth-rap-era",         category: "era_lineage", means: "Rap over electronic and synth-driven production in the 2011–2015 crossover window. Electronic influences meeting hip-hop structures.", notMeans: ["organic boom bap", "trap 808s", "lo-fi"] },
  { slug: "bloghouse-era",         category: "era_lineage", means: "Ed Banger / blog-era electronic crossover: filtered house, French touch influence bleeding into hip-hop and indie dance.", notMeans: ["classic hip-hop", "trap", "acoustic"] },
  { slug: "indie-rap-era",         category: "era_lineage", means: "Alternative rap aesthetics meeting indie rock / lo-fi production. Early Childish Gambino, Lupe Fiasco, Atmosphere.", notMeans: ["mainstream commercial rap", "trap", "club rap"] },
  { slug: "cloud-rap-era",         category: "era_lineage", means: "Ethereal, hazy, weightless beats (Clams Casino era): atmospheric reverb, minimal percussion, mood over bars.", notMeans: ["hard trap", "boom bap", "aggressive hip-hop"] },
  { slug: "witch-house-rap",       category: "era_lineage", means: "Dark, occult-influenced aesthetic meeting trap: Three 6 Mafia legacy, $uicideboy$ territory, haunted and menacing.", notMeans: ["uplifting rap", "commercial pop-rap", "boom bap"] },
  // era_lineage — trap evolution
  { slug: "ambient-trap",          category: "era_lineage", means: "Spacious, atmospheric trap: long reverb tails, minimal percussion, mood and texture over lyrical density.", notMeans: ["hard trap", "club trap", "lyric-focused rap"] },
  { slug: "maximalist-trap",       category: "era_lineage", means: "Dense, layered trap with multiple melodic lines, aggressive 808s, and high production density. Nothing sparse.", notMeans: ["minimal trap", "cloud rap", "lo-fi or bedroom production"] },
  { slug: "cinematic-trap",        category: "era_lineage", means: "Orchestral or cinematic scope applied to trap rhythms: strings, brass, and epic scale. Travis Scott / Drake stadium era.", notMeans: ["minimal trap", "underground rap", "lo-fi"] },
  { slug: "orchestral-trap",       category: "era_lineage", means: "Full orchestral arrangement married to trap rhythm section. More maximalist than cinematic-trap — literal string/brass arrangements.", notMeans: ["sparse trap", "boom bap", "electronic minimalism"] },
  { slug: "industrial-rap",        category: "era_lineage", means: "Harsh, machine-textured production: metal percussion, distortion, confrontational noise. Yeezus / Death Grips territory.", notMeans: ["warm hip-hop", "melodic rap", "boom bap"] },
  { slug: "avant-rap",             category: "era_lineage", means: "Experimental, structurally unpredictable rap. Resists genre conventions. Young Thug early work, clipping., JPEGMAFIA.", notMeans: ["mainstream rap", "conventional trap", "radio rap"] },
  { slug: "electro-punk-rap",      category: "era_lineage", means: "High-BPM, aggressive electronic-rap crossover with punk energy: abrasive, fast, confrontational. Death Grips adjacent.", notMeans: ["mellow rap", "melodic trap", "smooth R&B adjacent rap"] },
  { slug: "yeezus-era",            category: "era_lineage", means: "Kanye's 2013 industrial/electronic minimalist period: harsh textures, deconstructed beats, confrontational aggression.", notMeans: ["warm Kanye", "808s and Heartbreak aesthetic", "conventional rap production"] },
  // era_lineage — melodic / emo / sing-rap
  { slug: "melodic-trap",          category: "era_lineage", means: "Sung melodies over trap beats: emotional register, The Weeknd / Future / Young Thug melodic delivery.", notMeans: ["lyric-first boom bap", "aggressive hard trap", "club rap"] },
  { slug: "emo-rap-era",           category: "era_lineage", means: "Emotional vulnerability meets trap production: Juice WRLD, Lil Peep, XXXTentacion. Pain and longing over 808s.", notMeans: ["hard club rap", "confident swaggering rap", "boom bap"] },
  { slug: "sing-rap-era",          category: "era_lineage", means: "Fluid movement between singing and rapping as equal modes. Drake-influenced melodic delivery normalization.", notMeans: ["MC-only boom bap", "pure singing R&B", "aggressive rap"] },
  // era_lineage — SoundCloud generation
  { slug: "soundcloud-rap-era",    category: "era_lineage", means: "Raw, abrasive, lo-fi bedroom trap born from SoundCloud distribution. DIY production ethic, unpolished affect.", notMeans: ["polished commercial rap", "boom bap", "label-produced R&B"] },
  { slug: "soundcloud-punk-rap",   category: "era_lineage", means: "Aggressive, distorted, fast SoundCloud rap with punk energy. 6ix9ine / early Lil Pump: abrasive and chaotic.", notMeans: ["mellow rap", "melodic trap", "emotional emo-rap"] },
  { slug: "lo-fi-trap",            category: "era_lineage", means: "Bedroom-produced trap with lo-fi texture: muffled 808s, vinyl warmth, intimate scale. Cassette-degraded aesthetic.", notMeans: ["polished studio trap", "maximalist-trap", "hi-fi production"] },
  // era_lineage — drill variants
  { slug: "chicago-drill",         category: "era_lineage", means: "Chief Keef era Chicago: sliding melodic 808 lines, dark minor-key atmosphere, sparse arrangements, street realism.", notMeans: ["boom bap", "melodic trap soul", "East Coast rap"] },
  { slug: "brooklyn-drill",        category: "era_lineage", means: "NY drill: faster hi-hat patterns, ominous piano melodies, Pop Smoke's bass-heavy presence. NYC grit meets UK drill.", notMeans: ["Chicago drill", "melodic trap", "boom bap"] },
  { slug: "uk-drill",              category: "era_lineage", means: "UK-specific drill: darker harmonic palette, slower gravel flows, slide-heavy 808s, distinct British street sensibility.", notMeans: ["Chicago drill", "Brooklyn drill", "grime or UK garage"] },
  { slug: "jersey-drill",          category: "era_lineage", means: "Jersey Club rhythmic patterns merged with drill aesthetics: fast-paced percussion, club energy meeting street menace.", notMeans: ["slow trap", "boom bap", "melodic R&B"] },
  // era_lineage — hyper-modern
  { slug: "rage-rap",              category: "era_lineage", means: "Playboi Carti / Ken Carson influence: high-pitched melodic rapping, rapid-fire snares, hedonistic and maximally detached.", notMeans: ["lyric-focused rap", "boom bap", "emotional emo-rap"] },
  { slug: "hypertrap",             category: "era_lineage", means: "Everything pushed to the extreme: saturated 808s, hyper-fast or hyper-slow BPMs, maximally intense affect.", notMeans: ["understated trap", "cloud rap", "mellow hip-hop"] },
  { slug: "glitch-rap",            category: "era_lineage", means: "Digital artifact aesthetics embedded in production: stuttering, chopped, corrupted or glitchy textures as deliberate style.", notMeans: ["clean polished production", "conventional trap", "boom bap"] },
  // era_lineage — non-rap sonic eras (cross-genre coverage)
  { slug: "80s-revival",           category: "era_lineage", means: "Modern production channeling 80s synth aesthetics: gated reverb, analog warmth, neon palette. The Weeknd, M83, Daft Punk.", notMeans: ["actual 80s recordings", "lo-fi", "trap or hip-hop lineage"] },
  { slug: "trap-soul",             category: "era_lineage", means: "Trap production married to R&B/soul vocal melody and emotional register. The Weeknd, Drake, 6LACK, PartyNextDoor.", notMeans: ["hard trap", "boom bap", "gospel or traditional soul"] },
  { slug: "neo-soul",              category: "era_lineage", means: "Early 2000s soul renaissance: live instrumentation, introspective lyricism, emotional depth. D'Angelo, Erykah Badu, Lauryn Hill.", notMeans: ["trap soul", "contemporary pop R&B", "gospel"] },
  { slug: "quiet-storm",           category: "era_lineage", means: "Smooth late-night R&B: lush orchestral arrangements, romantic themes, soft-focus production. Luther Vandross lineage.", notMeans: ["trap soul", "hard R&B", "neo-soul rawness"] },
];

// ── Contradiction rules ───────────────────────────────────────────────────────
// When `target` appears alongside any blocker slug, the target is removed.
// To add a rule: append a new entry. To loosen a rule: remove a blocker slug.

const CONTRADICTION_RULES: Array<{
  target: string;
  blockers: string[];
  reason: string;
}> = [
  {
    target: "laid-back",
    blockers: [
      "cold", "swaggering", "restless", "triumphant",      // emotional tone — not easygoing
      "commanding", "emotionally-direct",                   // vocal — forceful delivery
      "immediate-impact", "tension-release",                // arrangement — tension or hard impact
      "sustained-drive", "simmering",                       // arrangement — suppressed or persistent force
      "808-heavy", "punchy",                                // drums — hard, physical impact
      "metallic",                                           // texture — cold, machine-like
    ],
    reason: "laid-back requires genuine ease; these signal force, tension, or emotional distance",
  },
  {
    target: "floating",
    blockers: ["immediate-impact", "808-heavy", "punchy", "tension-release", "sustained-drive"],
    reason: "floating implies weightlessness; hard-hitting or high-tension elements contradict it",
  },
  {
    target: "warm",
    blockers: ["cold", "metallic"],
    reason: "warm texture (organic, inviting) contradicts cold emotional distance or metallic production",
  },
  {
    target: "tender",
    blockers: ["cold", "swaggering", "restless"],
    reason: "tender emotion is incompatible with cold detachment, dominant swagger, or anxious urgency",
  },
  {
    target: "nocturnal",
    blockers: ["triumphant", "euphoric"],
    reason: "nocturnal is withdrawn and introspective; triumphant/euphoric are outward and uplifting",
  },
  {
    target: "wistful",
    blockers: ["swaggering", "cold", "restless"],
    reason: "wistful is soft and reflective; these signal assertion, distance, or agitation",
  },
  {
    target: "playful",
    blockers: ["cold", "swaggering", "simmering", "tension-release"],
    reason: "playful requires lightness; cold, dominant, or high-tension energy contradicts levity",
  },
];

// Intensity levels that are definitionally incompatible with laid-back.
// Checked independently of slug co-occurrence.
const HIGH_INTENSITY = new Set(["medium-high", "high", "very-high"]);

// ── Glossary → prompt formatter ───────────────────────────────────────────────

function formatGlossaryForPrompt(): string {
  const categoryOrder = [
    "tempo_feel", "emotional_tone", "vocal_character",
    "texture", "arrangement_energy_arc", "drum_character", "era_lineage",
  ];
  const categoryLabels: Record<string, string> = {
    tempo_feel:             "TEMPO FEEL",
    emotional_tone:         "EMOTIONAL TONE",
    vocal_character:        "VOCAL CHARACTER",
    texture:                "TEXTURE",
    arrangement_energy_arc: "ARRANGEMENT ARC",
    drum_character:         "DRUM CHARACTER",
    era_lineage:            "ERA / PRODUCTION LINEAGE",
  };
  const grouped: Record<string, typeof DESCRIPTOR_GLOSSARY> = {};
  for (const entry of DESCRIPTOR_GLOSSARY) {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category].push(entry);
  }
  const lines: string[] = [];
  for (const cat of categoryOrder) {
    if (!grouped[cat]?.length) continue;
    lines.push(`${categoryLabels[cat]}:`);
    for (const e of grouped[cat]) {
      lines.push(`• "${e.slug}": ${e.means}`);
      lines.push(`  ✗ NOT: ${e.notMeans.join("; ")}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

// ── Post-generation validation ────────────────────────────────────────────────

function flagDescriptorConflicts(
  profile: Record<string, unknown>,
): { profile: Record<string, unknown>; removals: string[] } {
  const arrayFields = [
    "tempo_feel","groove","drum_character","bass_character","harmonic_color",
    "melodic_character","vocal_character","texture","arrangement_energy_arc",
    "emotional_tone","era_lineage","environment_imagery","listener_use_case",
  ];

  const allSlugs = new Set<string>();
  for (const field of arrayFields) {
    const val = profile[field];
    if (Array.isArray(val)) (val as string[]).forEach((s) => allSlugs.add(s));
  }

  const toRemove = new Set<string>();

  // Apply contradiction rules
  for (const { target, blockers, reason } of CONTRADICTION_RULES) {
    if (!allSlugs.has(target)) continue;
    for (const blocker of blockers) {
      if (allSlugs.has(blocker)) {
        console.warn(`[sonic-profile] Contradiction: "${blocker}" → removing "${target}" (${reason})`);
        toRemove.add(target);
        break;
      }
    }
  }

  // Intensity gate: high-intensity songs are definitionally not laid-back
  if (allSlugs.has("laid-back") && !toRemove.has("laid-back")) {
    if (HIGH_INTENSITY.has(profile.intensity_level as string)) {
      console.warn(`[sonic-profile] Intensity gate: removing "laid-back" (intensity_level=${profile.intensity_level})`);
      toRemove.add("laid-back");
    }
  }

  if (toRemove.size === 0) return { profile, removals: [] };

  const cleaned: Record<string, unknown> = { ...profile };
  for (const field of arrayFields) {
    const val = profile[field];
    if (Array.isArray(val)) {
      cleaned[field] = (val as string[]).filter((s) => !toRemove.has(s));
    }
  }

  return { profile: cleaned, removals: [...toRemove] };
}

// ── Conflict resolution ───────────────────────────────────────────────────────

function resolveConflicts(
  profile: Record<string, unknown>,
  registry: Map<string, RegistryRow>,
): string[] {
  const arrayFields = [
    "tempo_feel","groove","drum_character","bass_character","harmonic_color",
    "melodic_character","vocal_character","texture","arrangement_energy_arc",
    "emotional_tone","era_lineage","environment_imagery","listener_use_case",
  ];

  const allSlugs: string[] = [];
  for (const field of arrayFields) {
    const val = profile[field];
    if (Array.isArray(val)) allSlugs.push(...val);
  }

  const accepted: string[] = [];
  const blocked = new Set<string>();

  for (const slug of allSlugs) {
    if (blocked.has(slug)) continue;
    accepted.push(slug);
    const meta = registry.get(slug);
    for (const conflict of (meta?.conflicts_with ?? [])) {
      blocked.add(conflict);
    }
  }

  return accepted;
}

// ── Canonical descriptor builder ──────────────────────────────────────────────

function buildCanonicalDescriptors(
  resolvedSlugs: string[],
  registry: Map<string, RegistryRow>,
): CanonicalDescriptorPayload {
  const display_descriptors: CanonicalDescriptor[] = resolvedSlugs
    .filter((slug) => {
      const meta = registry.get(slug);
      return meta && CANONICAL_CATEGORIES.has(meta.category);
    })
    .map((slug) => {
      const meta = registry.get(slug)!;
      return {
        slug,
        label: meta.label,
        category: meta.category,
        is_clickable: meta.is_clickable,
        search_url: `/search?descriptors=${slug}`,
        dna_url: `/dna/${slug}`,
      };
    });

  const slugList = display_descriptors.map((d) => d.slug).join(",");

  return {
    display_descriptors,
    descriptor_search_url: slugList ? `/search?descriptors=${slugList}` : "/search",
    all_slugs: resolvedSlugs,
  };
}

// ── Load registry ─────────────────────────────────────────────────────────────

async function loadRegistry(supabase: any): Promise<Map<string, RegistryRow>> {
  const { data } = await supabase
    .from("descriptor_registry")
    .select("slug, label, category, is_clickable, conflicts_with");
  return new Map((data || []).map((r: RegistryRow) => [r.slug, r]));
}

// ── Claude prompts ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a music analyst with the precision of a record producer and the language of a music critic.

Your job is to analyze songs and return a structured Sonic DNA profile.

STRICT RULES:
1. Only use descriptor slugs from the vocabulary provided. Never invent new slugs.
2. Each category must use 1–4 slugs from that category's list.
3. You may NOT invent factual information: no samples, no production credits, no release dates.
4. You ARE allowed to interpret sonic characteristics based on the song's known sound.
5. Return ONLY valid JSON. No preamble, no explanation, no markdown backticks.
6. intensity_level must be one of: ${INTENSITY_LEVELS.join(", ")}
7. danceability_feel must be one of: ${DANCEABILITY_FEELS.join(", ")}

VOCABULARY:
${JSON.stringify(DESCRIPTOR_VOCABULARY, null, 2)}

EVALUATION ORDER — always assess these before choosing descriptors:
1. EMOTIONAL POSTURE: Is the song dominant, vulnerable, cold, warm, playful, or tense?
2. FORCE AND TENSION: Is there suppressed or overt force — even at slow tempos?
3. GROOVE CHARACTER: Does the rhythm feel easy and loose, or locked and deliberate?
4. VOCAL DELIVERY: Is it assertive, detached, expressive, or easygoing?
Surface cues (tempo, sparseness) come LAST. Never let sparse or midtempo override a cold or forceful emotional posture.

DO NOT CONFUSE:
• sparse → relaxed (sparse can be cold, tense, or predatory)
• detached → mellow (detached delivery can be dominant or predatory)
• nocturnal → calm (nocturnal can be anxious, tense, or menacing)
• cool-toned → easygoing (cool-toned is control, not ease)
• midtempo → laid-back (midtempo cold or hard-edged songs are NOT laid-back)
• slow → comfortable (slow-burn and simmering imply suppressed force, not relaxation)

DESCRIPTOR GLOSSARY:
${formatGlossaryForPrompt()}

BEFORE ASSIGNING "laid-back" — mandatory check:
Ask: would a critic describe this as chill, easygoing, or comfortable?
If the song has ANY of the following → do NOT use "laid-back":
  ✗ Cold, arrogant, predatory, or menacing emotional character
  ✗ Hard 808s, punchy drums, or aggressive percussion
  ✗ Confrontational, dominant, or forceful energy
  ✗ Controlled or commanding delivery (control ≠ ease)
  ✗ Intensity level medium-high or higher
If unsure between "laid-back" and "midtempo" → always choose "midtempo".

HARD INCOMPATIBILITIES — the system will enforce these; do not generate them together:
${CONTRADICTION_RULES.map((r) => `• "${r.target}" cannot coexist with: ${r.blockers.map((b) => `"${b}"`).join(", ")}`).join("\n")}
• "laid-back" cannot coexist with intensity levels: medium-high, high, very-high

OUTPUT FORMAT (return exactly this structure, no extra fields):
{
  "tempo_feel": ["slug1"],
  "groove": ["slug1", "slug2"],
  "drum_character": ["slug1", "slug2"],
  "bass_character": ["slug1"],
  "harmonic_color": ["slug1", "slug2"],
  "melodic_character": ["slug1"],
  "vocal_character": ["slug1", "slug2"],
  "texture": ["slug1", "slug2"],
  "arrangement_energy_arc": ["slug1", "slug2"],
  "emotional_tone": ["slug1", "slug2"],
  "era_lineage": ["slug1"],
  "environment_imagery": ["slug1", "slug2"],
  "listener_use_case": ["slug1"],
  "intensity_level": "medium",
  "danceability_feel": "danceable",
  "confidence_score": 0.85
}

confidence_score reflects how confident you are that this analysis is accurate (0.0–1.0).
Use lower confidence for obscure, genre-defying, or instrumental works where you have less certainty.`;
}

function buildUserPrompt(title: string, artist: string): string {
  return `Analyze the sonic DNA of "${title}" by ${artist}.

Focus on:
- The actual rhythmic feel and groove
- Drum sound character (live or programmed, what era/style)
- Bass presence and movement
- Harmonic language and chord quality
- Melodic approach and vocal delivery
- Production texture (how it sounds, not just genre)
- Emotional register and atmosphere
- What environment or activity this music fits

Write your analysis as a producer or critic would think about the track's sonic fingerprint.
Return only the JSON profile.`;
}

function extractDescriptorSlugs(profile: Record<string, unknown>): string[] {
  const slugs: string[] = [];
  const arrayFields = [
    "tempo_feel","groove","drum_character","bass_character","harmonic_color",
    "melodic_character","vocal_character","texture","arrangement_energy_arc",
    "emotional_tone","era_lineage","environment_imagery","listener_use_case",
  ];
  for (const field of arrayFields) {
    const val = profile[field];
    if (Array.isArray(val)) slugs.push(...val);
  }
  return [...new Set(slugs)];
}

function validateProfile(profile: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const arrayFields = Object.keys(DESCRIPTOR_VOCABULARY) as Array<keyof typeof DESCRIPTOR_VOCABULARY>;
  for (const field of arrayFields) {
    const val = profile[field];
    if (!Array.isArray(val)) {
      errors.push(`Missing or non-array field: ${field}`);
      continue;
    }
    const allowed = DESCRIPTOR_VOCABULARY[field];
    for (const slug of val as string[]) {
      if (!allowed.includes(slug)) errors.push(`Invalid slug "${slug}" in ${field}`);
    }
  }
  if (!INTENSITY_LEVELS.includes(profile.intensity_level as string)) {
    errors.push(`Invalid intensity_level: ${profile.intensity_level}`);
  }
  if (!DANCEABILITY_FEELS.includes(profile.danceability_feel as string)) {
    errors.push(`Invalid danceability_feel: ${profile.danceability_feel}`);
  }
  if (
    typeof profile.confidence_score !== "number" ||
    (profile.confidence_score as number) < 0 ||
    (profile.confidence_score as number) > 1
  ) {
    errors.push(`Invalid confidence_score: ${profile.confidence_score}`);
  }
  return { valid: errors.length === 0, errors };
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { spotify_track_id, song_title, artist_name } = await req.json();

    if (!spotify_track_id || !song_title || !artist_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: spotify_track_id, song_title, artist_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Cache check ───────────────────────────────────────────────────────────
    const { data: existing } = await supabase
      .from("song_sonic_profiles")
      .select("*")
      .eq("spotify_track_id", spotify_track_id)
      .single();

    if (existing) {
      // v2 cache: canonical_descriptors already present — return immediately
      if (existing.profile_json?.canonical_descriptors) {
        console.log(`[sonic-profile] Cache HIT (v2): ${song_title} by ${artist_name}`);
        return new Response(
          JSON.stringify({
            profile: existing.profile_json,
            canonical_descriptors: existing.profile_json.canonical_descriptors,
            source: "cache",
            id: existing.id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // v1 cache: upgrade in place by adding canonical_descriptors
      console.log(`[sonic-profile] Upgrading v1 cache: ${song_title} by ${artist_name}`);
      const registry = await loadRegistry(supabase);
      const resolvedSlugs = resolveConflicts(existing.profile_json, registry);
      const canonical = buildCanonicalDescriptors(resolvedSlugs, registry);
      const upgradedProfile = { ...existing.profile_json, canonical_descriptors: canonical };

      await supabase
        .from("song_sonic_profiles")
        .update({ profile_json: upgradedProfile })
        .eq("id", existing.id);

      return new Response(
        JSON.stringify({
          profile: upgradedProfile,
          canonical_descriptors: canonical,
          source: "cache",
          id: existing.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Generate via Claude ───────────────────────────────────────────────────
    console.log(`[sonic-profile] Generating: "${song_title}" by ${artist_name}`);

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system:     buildSystemPrompt(),
        messages:   [{ role: "user", content: buildUserPrompt(song_title, artist_name) }],
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      throw new Error(`Claude API error: ${aiRes.status} — ${err.slice(0, 200)}`);
    }

    const aiData = await aiRes.json();
    const rawText = (aiData.content?.[0]?.text as string) || "";
    const jsonText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

    let profile: Record<string, unknown>;
    try {
      profile = JSON.parse(jsonText);
    } catch {
      throw new Error(`Failed to parse Claude JSON response: ${jsonText.slice(0, 300)}`);
    }

    const { valid, errors } = validateProfile(profile);
    if (!valid) {
      console.warn(`[sonic-profile] Validation warnings for "${song_title}":`, errors);
    }

    // Post-generation semantic compatibility check — removes misclassified descriptors
    const { profile: cleanedProfile, removals } = flagDescriptorConflicts(profile);
    if (removals.length > 0) {
      console.warn(`[sonic-profile] Removed incompatible descriptors for "${song_title}": ${removals.join(", ")}`);
    }
    profile = cleanedProfile;

    const confidenceScore = typeof profile.confidence_score === "number"
      ? Math.min(Math.max(profile.confidence_score as number, 0), 1)
      : 0.75;

    const descriptorSlugs = extractDescriptorSlugs(profile);

    // ── Conflict resolution + canonical ──────────────────────────────────────
    const registry = await loadRegistry(supabase);
    const resolvedSlugs = resolveConflicts(profile, registry);
    const canonical = buildCanonicalDescriptors(resolvedSlugs, registry);
    const enrichedProfile = { ...profile, canonical_descriptors: canonical };

    // ── Write to cache ────────────────────────────────────────────────────────
    const { data: inserted, error: insertError } = await supabase
      .from("song_sonic_profiles")
      .upsert({
        spotify_track_id,
        song_title,
        artist_name,
        profile_json:     enrichedProfile,
        confidence_score: confidenceScore,
        descriptor_slugs: descriptorSlugs,
      }, { onConflict: "spotify_track_id" })
      .select()
      .single();

    if (insertError) {
      console.error("[sonic-profile] Cache write error:", insertError.message);
    }

    console.log(
      `[sonic-profile] Generated "${song_title}" (confidence=${confidenceScore}, descriptors=${descriptorSlugs.length}, canonical=${canonical.display_descriptors.length})`,
    );

    return new Response(
      JSON.stringify({
        profile: enrichedProfile,
        canonical_descriptors: canonical,
        source: "generated",
        id: inserted?.id || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[sonic-profile] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
