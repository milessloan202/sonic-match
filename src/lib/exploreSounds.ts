// ── Shared exploration configuration ─────────────────────────────────────────
// Used by Index.tsx (homepage) and SearchPage.tsx (idle exploration state).
// Keep both pages in sync by editing this file only.

/** Curated descriptor pool grouped by category for balanced chip rotation. */
export const HOMEPAGE_DESCRIPTOR_POOL = {
  emotional: ["nocturnal", "dreamy", "melancholic", "euphoric", "cold", "playful"],
  texture:   ["metallic", "hazy", "lush", "widescreen", "airless", "glassy"],
  groove:    ["stomping", "gliding", "punchy", "driving", "swaggering", "pulsing"],
} as const;

/** Curated multi-descriptor cards displayed in the "Starter Mixes" section. */
export const STARTER_MIXES: { name: string; descriptors: string[] }[] = [
  { name: "Night Drive",   descriptors: ["nocturnal", "glossy", "driving"] },
  { name: "Cold Pressure", descriptors: ["metallic", "airless", "stomping"] },
  { name: "Velvet Fog",    descriptors: ["hazy", "lush", "late-night-walk"] },
  { name: "Victory Lap",   descriptors: ["swaggering", "punchy", "widescreen"] },
];

/**
 * Maps every slug in the pools / mixes to its Sonic DNA CSS category.
 * Drives glow color (mix cards) and chip color (descriptor tags on hover).
 */
export const DESCRIPTOR_CATEGORY_MAP: Record<string, string> = {
  nocturnal:  "emotional_tone", dreamy:      "emotional_tone", melancholic: "emotional_tone",
  euphoric:   "emotional_tone", cold:        "emotional_tone", playful:     "emotional_tone",
  metallic:   "texture",        hazy:        "texture",        lush:        "texture",
  widescreen: "texture",        airless:     "texture",        glassy:      "texture",
  glossy:     "texture",
  stomping:   "groove_character", gliding:   "groove_character", punchy:    "groove_character",
  driving:    "groove_character", swaggering:"groove_character", pulsing:   "groove_character",
  "late-night-walk": "environment_imagery",
};

/**
 * RGB triplets matching the Tailwind *-500 colors in DescriptorTag's
 * CATEGORY_COLORS / CATEGORY_HOVER_COLORS — for box-shadow glow values.
 */
export const CATEGORY_GLOW_RGB: Record<string, string> = {
  emotional_tone:         "168, 85, 247",  // purple-500
  energy_posture:         "59, 130, 246",  // blue-500
  groove_character:       "99, 102, 241",  // indigo-500
  texture:                "6, 182, 212",   // cyan-500
  spatial_feel:           "14, 165, 233",  // sky-500
  era_movement:           "245, 158, 11",  // amber-500
  era_period:             "245, 158, 11",
  environment_imagery:    "16, 185, 129",  // emerald-500
  listener_use_case:      "244, 63, 94",   // rose-500
  drum_character:         "249, 115, 22",  // orange-500
  bass_character:         "234, 179, 8",   // yellow-500
  harmonic_color:         "20, 184, 166",  // teal-500
  melodic_character:      "236, 72, 153",  // pink-500
  vocal_character:        "139, 92, 246",  // violet-500
  arrangement_energy_arc: "132, 204, 22",  // lime-500
};

export type DescriptorChip = { slug: string; cssCategory: string };

function pickRandom<T>(arr: readonly T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

/**
 * Returns a random 3-descriptor mix: 1 emotional, 1 texture, 1 groove.
 * Picks one from each category pool — no duplicates by construction.
 */
export function getRandomMix(): string[] {
  return [
    pickRandom(HOMEPAGE_DESCRIPTOR_POOL.emotional, 1)[0],
    pickRandom(HOMEPAGE_DESCRIPTOR_POOL.texture, 1)[0],
    pickRandom(HOMEPAGE_DESCRIPTOR_POOL.groove, 1)[0],
  ];
}

/**
 * Returns exactly 6 category-balanced descriptor chips for exploration UIs.
 * Picks 2 emotional, 2 texture, 2 groove — randomly on each call.
 * Initialise with useState(() => getRotatingHomepageDescriptors()) for
 * stable chips across re-renders within a single page mount.
 */
export function getRotatingHomepageDescriptors(): DescriptorChip[] {
  return [
    ...pickRandom(HOMEPAGE_DESCRIPTOR_POOL.emotional, 2).map(slug => ({ slug, cssCategory: "emotional_tone" })),
    ...pickRandom(HOMEPAGE_DESCRIPTOR_POOL.texture, 2).map(slug => ({ slug, cssCategory: "texture" })),
    ...pickRandom(HOMEPAGE_DESCRIPTOR_POOL.groove, 2).map(slug => ({ slug, cssCategory: "groove_character" })),
  ];
}
