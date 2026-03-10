// =============================================================================
// possessive — formatting helpers for artist names
// =============================================================================

/**
 * Returns the possessive form of a name.
 * Names ending in s/S get an apostrophe-only; all others get 's.
 *
 * Examples:
 *   Nas          → Nas'
 *   Glass Animals → Glass Animals'
 *   Young Nudy   → Young Nudy's
 *   SZA          → SZA's
 */
export function possessive(name: string): string {
  return /[sS]$/.test(name) ? `${name}'` : `${name}'s`;
}

/**
 * Converts a URL slug to a display name by splitting on hyphens and
 * title-casing each word.
 *
 * Examples:
 *   young-nudy    → Young Nudy
 *   glass-animals → Glass Animals
 *   sza           → Sza   (best-effort; canonical casing lives in DB)
 */
export function slugToName(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}
