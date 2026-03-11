// =============================================================================
// Sonic DNA Calibration Dataset
//
// Curated reference songs for evaluating descriptor generation accuracy.
// Each entry defines:
//   must_have     — slugs that MUST appear in the generated profile
//   must_not_have — slugs that MUST NOT appear (misclassification targets)
//   reasoning     — why these expectations are set
//
// All slugs must exist in DESCRIPTOR_VOCABULARY inside generate-sonic-profile.
//
// To add a new entry: append to CALIBRATION_SONGS.
// To extend an archetype: add entries to the matching section below.
// =============================================================================

export interface CalibrationEntry {
  title: string;
  artist: string;
  archetype: string;
  must_have: string[];
  must_not_have: string[];
  reasoning: string;
}

export const CALIBRATION_SONGS: CalibrationEntry[] = [

  // ── Aggressive / Confrontational ────────────────────────────────────────────

  {
    title: "Black Skinhead",
    artist: "Kanye West",
    archetype: "aggressive",
    must_have: ["immediate-impact", "swaggering", "punchy", "driving"],
    must_not_have: ["laid-back", "wistful", "floating", "tender", "warm"],
    reasoning: "Industrial, relentless, hard-hitting. Stomping drums and confrontational energy leave no room for ease or softness.",
  },
  {
    title: "DNA.",
    artist: "Kendrick Lamar",
    archetype: "aggressive",
    must_have: ["commanding", "swaggering", "punchy"],
    must_not_have: ["laid-back", "wistful", "tender", "floating", "warm"],
    reasoning: "Confrontational, lyrically dominant. Kendrick's most assertive vocal performance. The beat change mid-track amplifies aggression.",
  },
  {
    title: "HUMBLE.",
    artist: "Kendrick Lamar",
    archetype: "aggressive / confrontational",
    must_have: ["swaggering", "commanding", "immediate-impact", "punchy"],
    must_not_have: ["laid-back", "wistful", "tender", "warm", "floating"],
    reasoning: "Stark minimalist beat with hard snares. Kendrick is confrontational and dominant throughout.",
  },
  {
    title: "POWER",
    artist: "Kanye West",
    archetype: "grandiose / confrontational",
    must_have: ["triumphant", "swaggering", "cinematic", "immediate-impact"],
    must_not_have: ["laid-back", "wistful", "tender", "sparse"],
    reasoning: "Epic arena-scale hip-hop. Choral sample, confrontational bars, wall-of-sound production.",
  },
  {
    title: "Alright",
    artist: "Kendrick Lamar",
    archetype: "triumphant / defiant",
    must_have: ["triumphant", "driving", "commanding"],
    must_not_have: ["cold", "nocturnal", "laid-back", "tender", "wistful"],
    reasoning: "Defiant and ultimately uplifting. Hard-hitting but resolves toward triumph rather than menace.",
  },

  // ── Cold / Icy / Nocturnal ───────────────────────────────────────────────────

  {
    title: "Heartless",
    artist: "The Weeknd",
    archetype: "cold / icy",
    must_have: ["cold", "sparse"],
    must_not_have: ["laid-back", "playful", "wistful", "warm", "euphoric"],
    reasoning: "PRIMARY CALIBRATION CASE. Sparse, cold, arrogant trap-soul. The defining example of a song that must never be tagged laid-back. Cold emotional character overrides slow tempo and sparse texture.",
  },
  {
    title: "No Church in the Wild",
    artist: "Jay-Z",
    archetype: "cold / cinematic",
    must_have: ["cold", "cinematic", "swaggering"],
    must_not_have: ["laid-back", "playful", "euphoric", "warm", "wistful"],
    reasoning: "Dark, philosophical, cold grandeur. Pulsing drum loop with cinematic harmonic color. Cold and assertive despite its philosophical depth.",
  },
  {
    title: "Mask Off",
    artist: "Future",
    archetype: "minimal trap / cold",
    must_have: ["hypnotic", "sparse", "808-heavy"],
    must_not_have: ["laid-back", "euphoric", "playful", "warm"],
    reasoning: "Hypnotic flute loop over sparse 808 trap. Detached and cold. Repetitive by design — hypnotic, not relaxed.",
  },
  {
    title: "The Hills",
    artist: "The Weeknd",
    archetype: "cold / menacing",
    must_have: ["cold", "sparse", "simmering"],
    must_not_have: ["laid-back", "euphoric", "warm", "playful", "wistful"],
    reasoning: "Menacing, dark, predatory. Distorted bass and cold vocal. Simmering tension throughout.",
  },
  {
    title: "Runaway",
    artist: "Kanye West",
    archetype: "cold / cinematic",
    must_have: ["cold", "cinematic", "slow-build"],
    must_not_have: ["laid-back", "playful", "warm"],
    reasoning: "Epic but cold. Piano-led melodic line over minimal production. Emotional in content but emotionally distancing in texture.",
  },

  // ── Laid Back / Mellow / Genuinely Relaxed ──────────────────────────────────

  {
    title: "Passionfruit",
    artist: "Drake",
    archetype: "laid-back / tropical",
    must_have: ["laid-back", "seductive"],
    must_not_have: ["aggressive", "immediate-impact", "punchy", "commanding", "cold"],
    reasoning: "Genuinely easygoing — dancehall-influenced warmth, unhurried delivery. The antithesis of Heartless. laid-back is correct here.",
  },
  {
    title: "Dreams",
    artist: "Fleetwood Mac",
    archetype: "laid-back / classic rock",
    must_have: ["laid-back", "wistful", "hypnotic"],
    must_not_have: ["cold", "punchy", "immediate-impact", "swaggering", "commanding"],
    reasoning: "The textbook laid-back song. Warm, hypnotic, genuinely unhurried. Comfortable and unforced.",
  },
  {
    title: "Redbone",
    artist: "Childish Gambino",
    archetype: "laid-back / soul",
    must_have: ["laid-back", "wistful", "falsetto-led"],
    must_not_have: ["cold", "punchy", "immediate-impact", "swaggering", "commanding"],
    reasoning: "70s soul influence. Slow, warm, falsetto-led. Genuinely relaxed — groove is easy and unforced.",
  },
  {
    title: "Get Lucky",
    artist: "Daft Punk",
    archetype: "laid-back / funk",
    must_have: ["laid-back", "locked-in", "warm"],
    must_not_have: ["cold", "swaggering", "punchy", "immediate-impact"],
    reasoning: "Warm disco-funk. Nile Rodgers guitar locked into an easy groove. Repetitive and comfortable — genuinely laid-back.",
  },
  {
    title: "Sweet Life",
    artist: "Frank Ocean",
    archetype: "warm / soul",
    must_have: ["wistful", "warm"],
    must_not_have: ["cold", "swaggering", "punchy", "immediate-impact", "aggressive"],
    reasoning: "Warm, optimistic R&B. Smooth production and an easy emotional register. Summer and comfort.",
  },

  // ── Dreamy / Atmospheric ──────────────────────────────────────────────────────

  {
    title: "Midnight City",
    artist: "M83",
    archetype: "dreamy / euphoric",
    must_have: ["euphoric", "lush-texture", "80s-revival"],
    must_not_have: ["sparse", "cold", "punchy", "swaggering"],
    reasoning: "Lush, anthemic, wall-of-sound 80s dream pop. Builds to a euphoric saxophone outro.",
  },
  {
    title: "Space Song",
    artist: "Beach House",
    archetype: "dreamy / atmospheric",
    must_have: ["floating", "hazy", "wistful"],
    must_not_have: ["punchy", "cold", "immediate-impact", "swaggering", "laid-back"],
    reasoning: "Quintessential dream pop. Woozy, suspended, emotionally weightless. Floating — not laid-back (no easygoing groove — pure suspension).",
  },
  {
    title: "Let It Happen",
    artist: "Tame Impala",
    archetype: "dreamy / psychedelic",
    must_have: ["hazy", "slow-build"],
    must_not_have: ["cold", "punchy", "commanding", "immediate-impact"],
    reasoning: "Slow-building psychedelic with layered synths. Hazy and expansive — builds tension over 7 minutes.",
  },
  {
    title: "Electric Feel",
    artist: "MGMT",
    archetype: "hypnotic / warm",
    must_have: ["hypnotic", "seductive"],
    must_not_have: ["cold", "punchy", "swaggering", "immediate-impact"],
    reasoning: "Warm, hypnotic psychedelic-funk. Earthy groove with dreamy synths.",
  },

  // ── Euphoric / Anthemic ────────────────────────────────────────────────────────

  {
    title: "Blinding Lights",
    artist: "The Weeknd",
    archetype: "euphoric / synth-pop",
    must_have: ["driving", "80s-revival", "triumphant"],
    must_not_have: ["cold", "sparse", "wistful", "laid-back", "nocturnal"],
    reasoning: "High-energy 80s synth-pop. Propulsive and euphoric — the opposite of The Weeknd's cold catalog.",
  },
  {
    title: "Take On Me",
    artist: "A-ha",
    archetype: "euphoric / synth-pop",
    must_have: ["driving", "80s-revival", "bright"],
    must_not_have: ["cold", "sparse", "nocturnal", "laid-back", "simmering"],
    reasoning: "Energetic, bright, classic 80s synth-pop. Propulsive synths and yearning falsetto.",
  },
  {
    title: "Mr. Brightside",
    artist: "The Killers",
    archetype: "anthemic / restless",
    must_have: ["driving", "restless", "explosive-chorus"],
    must_not_have: ["laid-back", "cold", "nocturnal", "tender", "floating"],
    reasoning: "High-energy, emotionally agitated indie rock. Builds to anthemic explosive chorus. Restless throughout.",
  },

  // ── Hard-Hitting Hip-Hop / Trap ───────────────────────────────────────────────

  {
    title: "Sicko Mode",
    artist: "Travis Scott",
    archetype: "hard-hitting trap",
    must_have: ["808-heavy", "swaggering"],
    must_not_have: ["laid-back", "tender", "wistful", "warm", "floating"],
    reasoning: "High-energy trap with multiple beat switches. 808-heavy throughout. No relaxation.",
  },
  {
    title: "XO Tour Llif3",
    artist: "Lil Uzi Vert",
    archetype: "emo-trap",
    must_have: ["restless", "808-heavy"],
    must_not_have: ["laid-back", "warm", "tender", "wistful", "playful"],
    reasoning: "Emotionally raw, frenetic emo-trap. Restless and cold energy despite its melodic delivery.",
  },

  // ── Glossy Synth-Pop / Electronic ─────────────────────────────────────────────

  {
    title: "Blue Monday",
    artist: "New Order",
    archetype: "glossy / driving synth-pop",
    must_have: ["driving", "electronic", "hypnotic"],
    must_not_have: ["warm", "analog", "laid-back", "wistful", "sparse"],
    reasoning: "Cold, machine-driven synth-pop. Propulsive sequencer. Electronic and precise — not warm.",
  },

  // ── Warm Soul / R&B ───────────────────────────────────────────────────────────

  {
    title: "Pink + White",
    artist: "Frank Ocean",
    archetype: "warm / tender",
    must_have: ["tender", "warm"],
    must_not_have: ["cold", "swaggering", "punchy", "immediate-impact", "aggressive"],
    reasoning: "One of Frank Ocean's most tender songs. Soft, intimate, warm production. Pure emotional softness.",
  },
  {
    title: "Golden",
    artist: "Jill Scott",
    archetype: "warm / celebratory soul",
    must_have: ["warm", "euphoric"],
    must_not_have: ["cold", "swaggering", "punchy", "aggressive", "nocturnal"],
    reasoning: "Warm, joyful, celebratory neo-soul. Summer energy and emotional generosity.",
  },
  {
    title: "I Want You Back",
    artist: "The Jackson 5",
    archetype: "warm / joyful pop-soul",
    must_have: ["playful", "warm"],
    must_not_have: ["cold", "swaggering", "punchy", "nocturnal", "simmering"],
    reasoning: "Exuberant, joyful, warm. The Motown bounce and Michael's youthful energy leave no room for coldness.",
  },

  // ── Moody Alternative ─────────────────────────────────────────────────────────

  {
    title: "How Soon Is Now?",
    artist: "The Smiths",
    archetype: "moody / hypnotic",
    must_have: ["wistful", "hypnotic", "minor-key", "simmering"],
    must_not_have: ["laid-back", "euphoric", "triumphant", "punchy", "warm"],
    reasoning: "Dark, hypnotic tremolo guitar. Morrissey's yearning delivery. Simmering tension — never releases.",
  },
  {
    title: "Fake Plastic Trees",
    artist: "Radiohead",
    archetype: "moody / wistful",
    must_have: ["wistful", "slow-build", "yearning"],
    must_not_have: ["cold", "swaggering", "punchy", "immediate-impact"],
    reasoning: "Sparse, emotionally devastating. Thom Yorke's most yearning vocal. Builds from quiet to orchestral without ever being cold or confrontational.",
  },
];
