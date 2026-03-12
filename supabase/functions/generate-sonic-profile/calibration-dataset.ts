// =============================================================================
// Sonic DNA Calibration Dataset  v3
//
// Curated reference songs anchoring descriptor meanings across genres:
//   hip-hop · r&b · pop · indie/rock · electronic · ambient/dream-pop
//
// Each entry defines:
//   must_have     — slugs that MUST appear in the generated profile
//   must_not_have — slugs that MUST NOT appear (misclassification targets)
//   reasoning     — why these expectations are set
//
// All slugs must exist in DESCRIPTOR_VOCABULARY in generate-sonic-profile.
//
// Sections:
//   1.  Aggressive / Confrontational  (hip-hop)
//   2.  Cold / Icy / Menacing         (trap / hip-hop)
//   3.  Defiant / Triumphant          (hip-hop / pop)
//   4.  Laid-back / Genuinely Relaxed
//   5.  Warm Soul / R&B
//   6.  Alternative R&B / Contemporary
//   7.  Dreamy / Floating             (dream-pop / psychedelic)
//   8.  Euphoric / Anthemic           (pop / rock)
//   9.  Electronic / Synth-pop
//  10.  Post-punk / Indie Rock
//  11.  Indie Folk / Bedroom Pop
//  12.  Art-pop / Cross-genre
//  13.  Distinction Calibration       ← focused tests for known problem pairs
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

  // ── 1. Aggressive / Confrontational ─────────────────────────────────────────

  {
    title: "Black Skinhead",
    artist: "Kanye West",
    archetype: "industrial rap / confrontational",
    must_have: ["immediate-impact", "swaggering", "punchy", "driving"],
    must_not_have: ["laid-back", "relaxed", "wistful", "floating", "tender", "warm"],
    reasoning: "Industrial, relentless, hard-hitting. Stomping drums and confrontational energy. The defining example of energy_posture that must never be tagged laid-back or relaxed.",
  },
  {
    title: "DNA.",
    artist: "Kendrick Lamar",
    archetype: "aggressive / commanding",
    must_have: ["commanding", "swaggering", "punchy"],
    must_not_have: ["laid-back", "relaxed", "wistful", "tender", "floating", "warm"],
    reasoning: "Confrontational, lyrically dominant. Kendrick's most assertive vocal performance. Mid-track beat change amplifies aggression.",
  },
  {
    title: "HUMBLE.",
    artist: "Kendrick Lamar",
    archetype: "minimalist trap / confrontational",
    must_have: ["swaggering", "commanding", "immediate-impact", "punchy", "charging"],
    must_not_have: ["laid-back", "relaxed", "wistful", "tender", "warm", "floating"],
    reasoning: "Stark minimalist beat with hard snares. Kendrick is confrontational and dominant throughout. charging energy_posture is correct — the song surges forward.",
  },
  {
    title: "POWER",
    artist: "Kanye West",
    archetype: "cinematic / grandiose confrontation",
    must_have: ["triumphant", "swaggering", "cinematic", "immediate-impact", "widescreen"],
    must_not_have: ["laid-back", "relaxed", "wistful", "tender", "intimate", "dry"],
    reasoning: "Epic arena-scale hip-hop. Choral sample, confrontational bars, wall-of-sound production. widescreen spatial_feel is essential — it's stadium rap.",
  },

  // ── 2. Cold / Icy / Menacing ────────────────────────────────────────────────

  {
    title: "Heartless",
    artist: "The Weeknd",
    archetype: "cold / icy trap-soul / emotional subtext",
    must_have: ["cold", "sparse", "lonely"],
    must_not_have: ["laid-back", "relaxed", "playful", "warm", "euphoric"],
    reasoning: "PRIMARY CALIBRATION CASE. Tests two things: (1) cold + sparse must never be read as laid-back or relaxed — cold emotional character overrides slow tempo and sparse texture. (2) Emotional layering — lonely must coexist with cold. Cold is the outward armored presentation; lonely is the underlying subtext. Both must appear. wistful removed from must_not_have since cold+wistful coexistence is now supported.",
  },
  {
    title: "The Hills",
    artist: "The Weeknd",
    archetype: "cold / menacing / nocturnal",
    must_have: ["cold", "sparse", "simmering", "menacing"],
    must_not_have: ["laid-back", "relaxed", "euphoric", "warm", "playful", "wistful"],
    reasoning: "Menacing, dark, predatory. Distorted bass and cold vocal. Simmering tension throughout. menacing is the correct emotional_tone — not just cold but actively threatening.",
  },
  {
    title: "Mask Off",
    artist: "Future",
    archetype: "hypnotic minimal trap / cold",
    must_have: ["hypnotic", "sparse", "808-heavy"],
    must_not_have: ["laid-back", "relaxed", "euphoric", "playful", "warm"],
    reasoning: "Hypnotic flute loop over sparse 808 trap. Detached and cold. Repetitive by design — hypnotic, not relaxed.",
  },
  {
    title: "Runaway",
    artist: "Kanye West",
    archetype: "cold / cinematic / grand",
    must_have: ["cold", "cinematic", "slow-build"],
    must_not_have: ["laid-back", "relaxed", "playful", "warm"],
    reasoning: "Epic but cold. Piano-led melodic line over minimal production that builds to orchestra. Emotional in content but emotionally distancing in texture.",
  },
  {
    title: "Obstacle 1",
    artist: "Interpol",
    archetype: "post-punk-revival / stalking / cold",
    must_have: ["cold", "post-punk-revival", "stalking"],
    must_not_have: ["laid-back", "relaxed", "warm", "playful", "intimate", "floating"],
    reasoning: "Locked, menacing, deliberately paced. Carlos D's bass stalks beneath Paul Banks' icy delivery. stalking is the defining energy_posture — controlled threat with no release.",
  },

  // ── 3. Defiant / Triumphant ──────────────────────────────────────────────────

  {
    title: "Alright",
    artist: "Kendrick Lamar",
    archetype: "triumphant / defiant hip-hop",
    must_have: ["triumphant", "driving", "commanding", "defiant"],
    must_not_have: ["cold", "nocturnal", "laid-back", "relaxed", "tender", "wistful"],
    reasoning: "Defiant and ultimately uplifting. Hard-hitting but resolves toward triumph rather than menace. defiant is essential — it's a protest anthem built on refusal.",
  },
  {
    title: "Formation",
    artist: "Beyoncé",
    archetype: "defiant / stomping pop-trap",
    must_have: ["defiant", "swaggering", "stomping", "charging"],
    must_not_have: ["laid-back", "relaxed", "wistful", "tender", "floating", "intimate"],
    reasoning: "Maximum ownership and defiant authority. The groove is stomping — physical, weighted, assertive. charging energy throughout. widescreen production scope.",
  },

  // ── 4. Laid-back / Genuinely Relaxed ────────────────────────────────────────

  {
    title: "Passionfruit",
    artist: "Drake",
    archetype: "laid-back / dancehall-influenced",
    must_have: ["laid-back", "relaxed", "seductive"],
    must_not_have: ["immediate-impact", "punchy", "commanding", "cold", "stomping"],
    reasoning: "Genuinely easygoing — dancehall-influenced warmth, unhurried delivery. Both laid-back AND relaxed are correct. The antithesis of Heartless.",
  },
  {
    title: "Dreams",
    artist: "Fleetwood Mac",
    archetype: "laid-back / warm classic rock",
    must_have: ["laid-back", "relaxed", "wistful", "hypnotic"],
    must_not_have: ["cold", "punchy", "immediate-impact", "swaggering", "commanding", "stomping"],
    reasoning: "The textbook laid-back song. Warm, hypnotic, genuinely unhurried. Comfortable and unforced. relaxed confirms the ease — no suppressed force.",
  },
  {
    title: "Redbone",
    artist: "Childish Gambino",
    archetype: "laid-back / 70s soul",
    must_have: ["laid-back", "gliding", "wistful", "falsetto-led"],
    must_not_have: ["cold", "punchy", "immediate-impact", "swaggering", "commanding"],
    reasoning: "70s soul influence. Slow, warm, falsetto-led. gliding is the correct energy_posture — the song moves forward with no friction or effort.",
  },
  {
    title: "Get Lucky",
    artist: "Daft Punk",
    archetype: "laid-back / disco-funk",
    must_have: ["laid-back", "locked-in", "warm", "strutting"],
    must_not_have: ["cold", "swaggering", "punchy", "immediate-impact", "menacing"],
    reasoning: "Warm disco-funk. Nile Rodgers guitar locked into an easy groove. strutting groove_character is correct — it carries attitude without aggression.",
  },

  // ── 5. Warm Soul / R&B ────────────────────────────────────────────────────────

  {
    title: "Pink + White",
    artist: "Frank Ocean",
    archetype: "warm / tender R&B",
    must_have: ["tender", "warm", "intimate"],
    must_not_have: ["cold", "swaggering", "punchy", "immediate-impact", "widescreen"],
    reasoning: "One of Frank Ocean's most tender songs. Soft, intimate, warm production. intimate spatial_feel is essential — it feels like a private moment.",
  },
  {
    title: "Sweet Life",
    artist: "Frank Ocean",
    archetype: "warm / optimistic soul",
    must_have: ["wistful", "warm"],
    must_not_have: ["cold", "swaggering", "punchy", "immediate-impact"],
    reasoning: "Warm, optimistic R&B. Smooth production and an easy emotional register. Summer and comfort.",
  },
  {
    title: "Golden",
    artist: "Jill Scott",
    archetype: "warm / celebratory neo-soul",
    must_have: ["warm", "euphoric", "neo-soul"],
    must_not_have: ["cold", "swaggering", "punchy", "nocturnal", "menacing"],
    reasoning: "Warm, joyful, celebratory neo-soul. Summer energy and emotional generosity. neo-soul era_movement is certain.",
  },
  {
    title: "I Want You Back",
    artist: "The Jackson 5",
    archetype: "warm / joyful Motown pop-soul",
    must_have: ["playful", "warm", "bouncy"],
    must_not_have: ["cold", "swaggering", "punchy", "nocturnal", "simmering", "menacing"],
    reasoning: "Exuberant, joyful, warm. The Motown bounce and Michael's youthful energy leave no room for coldness or menace. bouncy groove_character is the defining rhythmic feel.",
  },

  // ── 6. Alternative R&B / Contemporary ─────────────────────────────────────────

  {
    title: "Nights",
    artist: "Frank Ocean",
    archetype: "alternative-rnb / nocturnal / gliding",
    must_have: ["alternative-rnb", "warm", "intimate", "nocturnal"],
    must_not_have: ["cold", "punchy", "swaggering", "stomping", "immediate-impact", "widescreen"],
    reasoning: "Frank Ocean's most cinematic personal statement. The beat switch is the song's pivot but the emotional character is consistent: nocturnal introspection and intimacy. alternative-rnb defines the movement.",
  },
  {
    title: "Bad Guy",
    artist: "Billie Eilish",
    archetype: "bedroom-pop / cold / airless",
    must_have: ["cold", "airless"],
    must_not_have: ["laid-back", "relaxed", "warm", "widescreen", "reverb-drenched", "cavernous"],
    reasoning: "The signature of Finneas's production is vacuum-tight, no reverb, everything close-mic'd. airless spatial_feel is the defining characteristic. cold emotional character despite the playful delivery.",
  },

  // ── 7. Dreamy / Floating ──────────────────────────────────────────────────────

  {
    title: "Space Song",
    artist: "Beach House",
    archetype: "dream-pop / floating / wistful",
    must_have: ["floating", "hazy", "wistful", "dream-pop"],
    must_not_have: ["punchy", "cold", "immediate-impact", "swaggering", "laid-back", "stomping"],
    reasoning: "Quintessential dream-pop. Woozy, suspended, emotionally weightless. dream-pop era_movement is the stylistic home. floating energy_posture is essential — pure suspension, not ease.",
  },
  {
    title: "How to Disappear Completely",
    artist: "Radiohead",
    archetype: "art-pop / ambient / floating",
    must_have: ["floating", "hazy", "wistful", "slow-build"],
    must_not_have: ["punchy", "stomping", "swaggering", "laid-back", "immediate-impact", "dry"],
    reasoning: "Kid A's most purely weightless moment. Strings dissolve into reverb. The song floats rather than drives. reverb-drenched and cavernous production.",
  },
  {
    title: "Let It Happen",
    artist: "Tame Impala",
    archetype: "psychedelic / slow-build",
    must_have: ["hazy", "slow-build"],
    must_not_have: ["cold", "punchy", "commanding", "immediate-impact", "dry"],
    reasoning: "Slow-building psychedelic with layered synths. Hazy and expansive — builds tension over 7 minutes. The eventual payoff is euphoric rather than aggressive.",
  },
  {
    title: "Electric Feel",
    artist: "MGMT",
    archetype: "hypnotic / seductive psychedelic",
    must_have: ["hypnotic", "seductive", "warm"],
    must_not_have: ["cold", "punchy", "swaggering", "immediate-impact", "menacing"],
    reasoning: "Warm, hypnotic psychedelic-funk. Earthy groove with dreamy synths. seductive emotional_tone is precisely calibrated — not cold, not dominant.",
  },

  // ── 8. Euphoric / Anthemic ────────────────────────────────────────────────────

  {
    title: "Blinding Lights",
    artist: "The Weeknd",
    archetype: "euphoric / 80s-revival synth-pop",
    must_have: ["driving", "80s-revival", "triumphant", "charging"],
    must_not_have: ["cold", "sparse", "wistful", "laid-back", "relaxed", "nocturnal"],
    reasoning: "High-energy 80s synth-pop. Propulsive and euphoric — the opposite of The Weeknd's cold catalog. charging energy_posture confirms the kinetic forward drive.",
  },
  {
    title: "Mr. Brightside",
    artist: "The Killers",
    archetype: "anthemic / restless indie rock",
    must_have: ["driving", "restless", "explosive-chorus", "charging"],
    must_not_have: ["laid-back", "relaxed", "cold", "nocturnal", "tender", "floating"],
    reasoning: "High-energy, emotionally agitated indie rock. Builds to anthemic explosive chorus. restless and charging throughout. The arena-sized production warrants widescreen.",
  },
  {
    title: "Take On Me",
    artist: "A-ha",
    archetype: "euphoric / classic 80s synth-pop",
    must_have: ["driving", "80s-revival", "bright", "charging"],
    must_not_have: ["cold", "sparse", "nocturnal", "laid-back", "relaxed", "simmering"],
    reasoning: "Energetic, bright, classic 80s synth-pop. Propulsive synths and yearning falsetto. charging and bright — no room for coldness or suppressed tension.",
  },

  // ── 9. Electronic / Synth-pop ─────────────────────────────────────────────────

  {
    title: "Blue Monday",
    artist: "New Order",
    archetype: "driving synth-pop / cold electronic",
    must_have: ["driving", "electronic", "hypnotic"],
    must_not_have: ["warm", "analog", "laid-back", "relaxed", "wistful", "menacing"],
    reasoning: "Cold, machine-driven synth-pop. Propulsive sequencer. Electronic and precise — not warm, not menacing, but unyielding.",
  },
  {
    title: "Midnight City",
    artist: "M83",
    archetype: "euphoric / widescreen 80s-revival",
    must_have: ["euphoric", "lush-texture", "80s-revival", "widescreen"],
    must_not_have: ["sparse", "cold", "punchy", "swaggering", "intimate", "dry"],
    reasoning: "Lush, anthemic, wall-of-sound 80s dream-pop. Builds to a euphoric saxophone outro. widescreen spatial_feel is essential — it's engineered for scale.",
  },

  // ── 10. Post-punk / Indie Rock ────────────────────────────────────────────────

  {
    title: "How Soon Is Now?",
    artist: "The Smiths",
    archetype: "moody / hypnotic post-punk",
    must_have: ["wistful", "hypnotic", "minor-key", "simmering"],
    must_not_have: ["laid-back", "euphoric", "triumphant", "punchy", "warm", "stomping"],
    reasoning: "Dark, hypnotic tremolo guitar. Morrissey's yearning delivery. simmering tension — never releases, never relaxes. reverb-drenched production.",
  },
  {
    title: "Fake Plastic Trees",
    artist: "Radiohead",
    archetype: "moody / wistful / intimate rock",
    must_have: ["wistful", "slow-build", "yearning", "intimate"],
    must_not_have: ["cold", "swaggering", "punchy", "immediate-impact", "widescreen", "stomping"],
    reasoning: "Sparse, emotionally devastating. Thom Yorke's most yearning vocal. Builds from quiet to orchestral without ever being cold. intimate scale throughout.",
  },
  {
    title: "Only Shallow",
    artist: "My Bloody Valentine",
    archetype: "shoegaze / reverb-drenched / coiled",
    must_have: ["lush-texture", "reverb-drenched", "hazy", "coiled"],
    must_not_have: ["cold", "dry", "airless", "punchy", "swaggering", "laid-back"],
    reasoning: "Oceanic guitar distortion, buried vocals, massive reverb. reverb-drenched and lush-texture are the defining production signatures. coiled energy_posture — the song is loaded but doesn't fully release.",
  },

  // ── 11. Indie Folk / Bedroom Pop ──────────────────────────────────────────────

  {
    title: "Skinny Love",
    artist: "Bon Iver",
    archetype: "indie-folk-revival / intimate / raw",
    must_have: ["wistful", "indie-folk-revival", "intimate", "organic"],
    must_not_have: ["cold", "swaggering", "stomping", "808-heavy", "electronic", "widescreen"],
    reasoning: "Sparse, raw, emotionally exposed. Acoustic guitar, grain in the voice, no production gloss. indie-folk-revival and organic anchor the sonic movement. intimate spatial scale throughout.",
  },
  {
    title: "Ribs",
    artist: "Lorde",
    archetype: "bedroom-pop / intimate / coiled",
    must_have: ["bedroom-pop", "intimate", "restless", "coiled"],
    must_not_have: ["laid-back", "relaxed", "swaggering", "stomping", "widescreen", "808-heavy"],
    reasoning: "A teenager's anxiety captured in DIY pop production. bedroom-pop is the stylistic home. coiled energy_posture — suppressed anxiety rather than release. intimate and restless throughout.",
  },
  {
    title: "Holocene",
    artist: "Bon Iver",
    archetype: "indie-folk-revival / wistful / cavernous",
    must_have: ["wistful", "indie-folk-revival", "slow-build"],
    must_not_have: ["cold", "punchy", "swaggering", "immediate-impact", "stomping", "menacing"],
    reasoning: "Panoramic and emotionally vast. Builds from intimate acoustic to full-band. wistful throughout. The production expands to widescreen despite intimate origins.",
  },

  // ── 12. Art-pop / Cross-genre ──────────────────────────────────────────────────

  {
    title: "Cellophane",
    artist: "FKA Twigs",
    archetype: "art-pop / intimate / yearning",
    must_have: ["art-pop", "yearning", "slow-build", "intimate"],
    must_not_have: ["swaggering", "punchy", "immediate-impact", "cold", "widescreen", "stomping"],
    reasoning: "Structural vulnerability across 5 minutes. art-pop because it refuses genre expectations. yearning vocal and intimate production scale. slow-build from solo voice to orchestral peak.",
  },
  {
    title: "Midnight Rain",
    artist: "Taylor Swift",
    archetype: "art-pop / dreamy / bittersweet",
    must_have: ["wistful", "art-pop", "hazy"],
    must_not_have: ["cold", "swaggering", "stomping", "menacing", "punchy"],
    reasoning: "Midnights-era atmospheric pop. Pitch-shifted vocal anchor and synth textures create dreamy, bittersweet distance. art-pop because the production exceeds conventional pop formulas.",
  },

  // ── 13. Distinction Calibration ───────────────────────────────────────────────
  //
  // Each entry below targets a specific known misclassification pair.
  // These are not just genre anchors — they are precision tests for the
  // distinctions that are most likely to fail: cold vs lonely, sparse vs
  // laid-back, hazy vs spacious, aggressive vs simmering, nostalgic vs
  // euphoric, intimate vs widescreen, and emotional layering.

  // ── cold vs lonely ────────────────────────────────────────────────────────────

  {
    title: "Hotline Bling",
    artist: "Drake",
    archetype: "lonely / vulnerable pop-rap — NOT cold",
    must_have: ["lonely", "nocturnal"],
    must_not_have: ["cold", "swaggering", "menacing", "triumphant", "punchy", "immediate-impact"],
    reasoning: "Tests cold vs lonely. Drake's most nakedly vulnerable hit — the emotional register is yearning isolation, not detachment or dominance. lonely must be the primary emotional_tone. cold would be wrong: the song is hurt and exposed, not armored.",
  },
  {
    title: "After Hours",
    artist: "The Weeknd",
    archetype: "cold + lonely coexistence / emotional layering",
    must_have: ["cold", "lonely", "nocturnal"],
    must_not_have: ["laid-back", "relaxed", "playful", "warm", "triumphant"],
    reasoning: "Tests emotional layering: cold outward presentation over lonely subtext. Both must coexist — cold is the armor, lonely is what's underneath. nocturnal atmosphere throughout. The companion test to Heartless, confirming cold+lonely coexistence across The Weeknd's catalog.",
  },

  // ── sparse vs laid-back ───────────────────────────────────────────────────────

  {
    title: "Swimming Pools (Drank)",
    artist: "Kendrick Lamar",
    archetype: "sparse / hypnotic trap — NOT laid-back",
    must_have: ["hypnotic", "sparse", "minor-key"],
    must_not_have: ["laid-back", "relaxed", "warm", "playful", "triumphant"],
    reasoning: "Tests sparse vs laid-back. Minimal production and slow BPM could mislead into laid-back, but the song is hypnotic and predatory — a trap, not a chill track. The dark drinking-culture critique is cold and looping, not easygoing.",
  },
  {
    title: "Motion Picture Soundtrack",
    artist: "Radiohead",
    archetype: "sparse / yearning / wistful — NOT cold",
    must_have: ["wistful", "yearning", "intimate"],
    must_not_have: ["cold", "swaggering", "punchy", "driving", "laid-back", "immediate-impact"],
    reasoning: "Tests sparse+wistful vs sparse+cold. The sparseness here is tenderness, not detachment — music-box piano over Thom Yorke's most fragile vocal. yearning confirms the inward emotional direction. intimate spatial scale throughout. Cold would be the wrong reading of quiet+sparse.",
  },

  // ── aggressive vs simmering ───────────────────────────────────────────────────

  {
    title: "Teardrop",
    artist: "Massive Attack",
    archetype: "simmering / coiled trip-hop — NOT aggressive",
    must_have: ["simmering", "hypnotic", "minor-key"],
    must_not_have: ["explosive", "immediate-impact", "driving", "laid-back", "warm", "triumphant"],
    reasoning: "Tests aggressive vs simmering. The coiled, held tension never erupts — it sustains dread without releasing. The sparse beat and haunting vocal create simmering throughout. Must not receive explosive or immediate-impact: this song withholds, it does not discharge.",
  },
  {
    title: "Killing in the Name",
    artist: "Rage Against the Machine",
    archetype: "explosive / charging / aggressive — NOT simmering",
    must_have: ["charging", "defiant", "immediate-impact", "driving"],
    must_not_have: ["laid-back", "relaxed", "simmering", "wistful", "floating", "tender"],
    reasoning: "Tests aggressive vs simmering. This song discharges immediately and fully — no restraint. immediate-impact and charging confirm the eruption. simmering would be wrong: the energy is released throughout, not held back. defiant emotional_tone is essential.",
  },

  // ── nostalgic vs euphoric ─────────────────────────────────────────────────────

  {
    title: "September",
    artist: "Earth, Wind & Fire",
    archetype: "euphoric / celebratory funk — NOT nostalgic",
    must_have: ["euphoric", "warm", "bouncy", "playful"],
    must_not_have: ["cold", "nostalgic", "wistful", "simmering", "menacing", "nocturnal"],
    reasoning: "Tests nostalgic vs euphoric. Pure present-tense celebration — no backward-looking register. The warm horn section, bouncy groove, and joyful delivery are definitively euphoric. nostalgic would be wrong: this song has no bittersweet or retrospective quality.",
  },
  {
    title: "Last Nite",
    artist: "The Strokes",
    archetype: "nostalgic / locked-in indie rock — NOT euphoric",
    must_have: ["nostalgic", "locked-in", "minor-key"],
    must_not_have: ["euphoric", "laid-back", "warm", "triumphant", "floating", "tender"],
    reasoning: "Tests nostalgic vs euphoric. The Strokes' dusty analog recording and garage-rock tone create a definitively nostalgic harmonic register. The energy is locked-in and slightly anxious, not celebratory. minor-key harmonic color confirms the undercurrent. Not euphoric.",
  },

  // ── intimate vs widescreen ────────────────────────────────────────────────────

  {
    title: "Lover",
    artist: "Taylor Swift",
    archetype: "intimate / tender pop — NOT widescreen",
    must_have: ["tender", "intimate", "warm"],
    must_not_have: ["cold", "widescreen", "swaggering", "punchy", "menacing", "stomping"],
    reasoning: "Tests intimate vs widescreen. Deliberately small-scale production — waltz tempo and soft synths create a personal domestic scene. intimate spatial_feel is essential. Despite Taylor Swift's arena-scale career, this song was engineered small and should not receive widescreen.",
  },
  {
    title: "Fix You",
    artist: "Coldplay",
    archetype: "widescreen / slow-build / triumphant — NOT intimate",
    must_have: ["widescreen", "slow-build", "triumphant"],
    must_not_have: ["cold", "intimate", "punchy", "menacing", "laid-back"],
    reasoning: "Tests intimate vs widescreen. Opens sparse but builds to definitively widescreen scale — engineered for arenas. triumphant emotional arc and slow-build arrangement are essential. The opening could deceive into intimate, but the destination is always widescreen.",
  },

  // ── hazy vs spacious ──────────────────────────────────────────────────────────

  {
    title: "Ultralight Beam",
    artist: "Kanye West",
    archetype: "widescreen / euphoric / gospel — NOT hazy",
    must_have: ["widescreen", "gospel-rich", "triumphant", "euphoric"],
    must_not_have: ["hazy", "cold", "intimate", "nocturnal", "airless", "sparse"],
    reasoning: "Tests hazy vs spacious. The gospel-rap maximalism is definitively widescreen — not blurred or woozy. gospel-rich harmonic color and euphoric upward movement distinguish it from atmospheric dreaminess. hazy would be wrong: every element is intentional and luminous, not blurred.",
  },
  {
    title: "The Less I Know the Better",
    artist: "Tame Impala",
    archetype: "strutting / seductive psychedelic — neither hazy nor cold",
    must_have: ["strutting", "seductive", "minor-key"],
    must_not_have: ["laid-back", "relaxed", "cold", "swaggering", "menacing", "floating"],
    reasoning: "Tests precision in groove and emotional register. The infectious disco-rock groove is strutting — it carries attitude without aggression. seductive emotional_tone is exact: not cold, not warm, an in-between tension. Minor key adds emotional complexity without darkness.",
  },
];
