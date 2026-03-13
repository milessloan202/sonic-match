import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { DescriptorTag } from "@/components/DescriptorTag";
import SEOHead from "@/components/SEOHead";

// =============================================================================
// SoundsPage (formerly DnaPage)
//
// Handles:
//   /sounds/:slug           — single descriptor discovery
//   /sounds/:slug/:slug2    — multi-descriptor (AND) discovery
//
// Shows all songs matching the descriptor(s) from song_sonic_profiles.
// =============================================================================

interface ProfileRow {
  spotify_track_id: string;
  song_title: string;
  artist_name: string;
  profile_json: any;
  descriptor_slugs: string[];
}

interface DescriptorRow {
  slug: string;
  label: string;
  category: string;
  description: string;
  is_seo_enabled: boolean;
}

interface RelatedDescriptor {
  slug: string;
  label: string;
  category: string;
  count: number;
}

export default function DnaPage() {
  const { slug, slug2 } = useParams<{ slug: string; slug2?: string }>();
  const navigate = useNavigate();

  const slugs = [slug, slug2].filter(Boolean) as string[];

  const [songs, setSongs]                     = useState<ProfileRow[]>([]);
  const [descriptors, setDescriptors]           = useState<DescriptorRow[]>([]);
  const [relatedSounds, setRelatedSounds]       = useState<RelatedDescriptor[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState<string | null>(null);

  useEffect(() => {
    if (slugs.length === 0) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        // Load descriptor metadata — only public descriptors
        const { data: descData } = await (supabase
          .from("descriptor_registry" as any)
          .select("slug, label, category, description, is_seo_enabled")
          .in("slug", slugs)
          .eq("is_public", true) as any);

        const publicDescs = (descData || []) as unknown as DescriptorRow[];
        if (cancelled) return;

        // If any requested slug has no public registry row, treat as not found
        if (publicDescs.length !== slugs.length) {
          setError("not_found");
          setLoading(false);
          return;
        }

        setDescriptors(publicDescs);

        // Query songs that contain ALL specified slugs
        // Uses the GIN index on descriptor_slugs array
        let query = supabase
          .from("song_sonic_profiles" as any)
          .select("spotify_track_id, song_title, artist_name, profile_json, descriptor_slugs")
          .order("song_title", { ascending: true })
          .limit(50) as any;

        // Each slug must be contained in descriptor_slugs
        for (const s of slugs) {
          query = query.contains("descriptor_slugs", [s]);
        }

        const { data: songData, error: songError } = await query;
        if (cancelled) return;

        if (songError) throw songError;
        setSongs((songData || []) as unknown as ProfileRow[]);

        // ── Co-occurrence: find related descriptors ──────────────────────
        // Fetch up to 200 profiles for co-occurrence (only need descriptor_slugs)
        let coQuery = supabase
          .from("song_sonic_profiles" as any)
          .select("descriptor_slugs")
          .limit(200) as any;
        for (const s of slugs) {
          coQuery = coQuery.contains("descriptor_slugs", [s]);
        }
        const { data: coData } = await coQuery;
        if (cancelled) return;

        // Count slug frequencies, excluding current slugs
        const freq = new Map<string, number>();
        for (const row of (coData || []) as { descriptor_slugs: string[] }[]) {
          for (const ds of row.descriptor_slugs || []) {
            if (!slugs.includes(ds)) {
              freq.set(ds, (freq.get(ds) || 0) + 1);
            }
          }
        }

        // Fetch registry rows for co-occurring slugs (public only)
        const coSlugs = [...freq.keys()];
        if (coSlugs.length > 0) {
          const { data: regData } = await (supabase
            .from("descriptor_registry" as any)
            .select("slug, label, category, is_public")
            .in("slug", coSlugs)
            .eq("is_public", true) as any);

          if (cancelled) return;

          const regMap = new Map<string, { label: string; category: string }>();
          for (const r of (regData || []) as { slug: string; label: string; category: string }[]) {
            regMap.set(r.slug, { label: r.label, category: r.category });
          }

          const ranked: RelatedDescriptor[] = [...freq.entries()]
            .filter(([s]) => regMap.has(s))
            .map(([s, count]) => ({ slug: s, label: regMap.get(s)!.label, category: regMap.get(s)!.category, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);

          setRelatedSounds(ranked);
        }

      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load songs");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug, slug2]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const primaryDescriptor = descriptors.find(d => d.slug === slug);
  const secondaryDescriptor = slug2 ? descriptors.find(d => d.slug === slug2) : null;

  const pageTitle = slugs
    .map(s => descriptors.find(d => d.slug === s)?.label || s.replace(/-/g, " "))
    .join(" + ");

  const metaDescription = primaryDescriptor
    ? `Discover songs with a ${primaryDescriptor.label.toLowerCase()} sound. ${primaryDescriptor.description}`
    : `Music with a ${pageTitle} sound — explore songs by sonic DNA.`;

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading sonic DNA...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title={`Songs with ${pageTitle} sound | Sonic DNA`}
        description={metaDescription}
        path={`/sounds/${slugs.join("/")}`}
      />

      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Breadcrumb */}
            <button
              onClick={() => navigate(-1)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>

            {/* Descriptor pills */}
            <div className="flex flex-wrap gap-2">
              {slugs.map(s => {
                const d = descriptors.find(dd => dd.slug === s);
                return (
                  <DescriptorTag
                    key={s}
                    slug={s}
                    label={d?.label}
                    category={d?.category}
                    size="md"
                    clickable
                  />
                );
              })}
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-foreground">
              {pageTitle}
            </h1>

            {/* Description */}
            {primaryDescriptor && (
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
                {primaryDescriptor.description}
                {secondaryDescriptor && (
                  <span> Combined with <strong>{secondaryDescriptor.label.toLowerCase()}</strong>: {secondaryDescriptor.description.toLowerCase()}</span>
                )}
              </p>
            )}

            {/* Search CTA */}
            <button
              onClick={() => navigate(`/search?descriptors=${slugs.join(",")}&mode=descriptor`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/20 transition-all"
            >
              Find songs with this DNA →
            </button>

            {/* Multi-descriptor navigation suggestion */}
            {slugs.length === 1 && (
              <p className="text-xs text-muted-foreground/60">
                Tip: combine descriptors for more precise discovery, e.g.{" "}
                <button
                   onClick={() => navigate(`/sounds/${slug}/nocturnal`)}
                   className="text-primary hover:underline"
                 >
                   /{slug}/nocturnal
                </button>
              </p>
            )}
          </motion.div>

          {/* Results */}
          {error === "not_found" ? (
            <div className="text-center py-16 space-y-4">
              <p className="text-4xl">🔇</p>
              <p className="text-foreground font-medium">Page not found</p>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                This descriptor page doesn't exist.
              </p>
              <button
                onClick={() => navigate("/")}
                className="mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all"
              >
                Go home
              </button>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Something went wrong loading this page.</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          ) : songs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 space-y-4"
            >
              <p className="text-4xl">🎵</p>
              <p className="text-foreground font-medium">No songs yet with this DNA</p>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Songs are added as people discover them. Search for a song and its sonic profile will be generated automatically.
              </p>
              <button
                onClick={() => navigate("/")}
                className="mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all"
              >
                Discover songs
              </button>
            </motion.div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                {songs.length} song{songs.length !== 1 ? "s" : ""} with this sound
              </p>

              <div className="grid gap-3">
                {songs.map((song, i) => (
                  <DnaSongRow
                    key={song.spotify_track_id}
                    song={song}
                    index={i}
                    activeDescriptors={slugs}
                    descriptorMeta={descriptors}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Related sounds — co-occurrence based */}
          {relatedSounds.length >= 2 && !error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              <h2 className="text-sm font-semibold text-foreground">Related sounds</h2>
              <div className="flex flex-wrap gap-2">
                {relatedSounds.map(rs => (
                  <DescriptorTag
                    key={rs.slug}
                    slug={rs.slug}
                    label={rs.label}
                    category={rs.category}
                    size="sm"
                    clickable
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Explore combinations — reuses relatedSounds data */}
          {relatedSounds.length >= 2 && !error && slugs.length === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-4"
            >
              <h2 className="text-sm font-semibold text-foreground">Explore combinations</h2>
              <p className="text-xs text-muted-foreground">
                Mix <strong>{primaryDescriptor?.label || slug}</strong> with related sounds to narrow your search.
              </p>
              <div className="flex flex-wrap gap-2">
                {relatedSounds.slice(0, 6).map(rs => (
                  <button
                    key={rs.slug}
                    onClick={() => navigate(`/search?descriptors=${slug},${rs.slug}&mode=descriptor`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/25 bg-primary/8 text-xs font-medium text-primary hover:bg-primary/18 hover:border-primary/40 transition-all"
                  >
                    {primaryDescriptor?.label || slug?.replace(/-/g, " ")} + {rs.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
}

// ── DnaSongRow ────────────────────────────────────────────────────────────────

interface DnaSongRowProps {
  song: ProfileRow;
  index: number;
  activeDescriptors: string[];
  descriptorMeta: DescriptorRow[];
}

function DnaSongRow({ song, index, activeDescriptors, descriptorMeta }: DnaSongRowProps) {
  const navigate = useNavigate();

  // Show the active descriptors first, then a few others from the profile
  const otherSlugs = (song.descriptor_slugs || [])
    .filter(s => !activeDescriptors.includes(s))
    .slice(0, 3);

  const toSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const songSlug = `${toSlug(song.song_title)}-${toSlug(song.artist_name)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group flex items-start gap-4 p-4 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors cursor-pointer"
      onClick={() => navigate(`/songs-like/${songSlug}`)}
    >
      {/* Index */}
      <span className="text-xs text-muted-foreground/40 tabular-nums pt-0.5 w-5 shrink-0 text-right">
        {index + 1}
      </span>

      {/* Song info */}
      <div className="flex-1 min-w-0 space-y-2">
        <div>
          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
            {song.song_title}
          </p>
          <p className="text-xs text-muted-foreground">{song.artist_name}</p>
        </div>

        {/* Descriptor tags — stop propagation so tag clicks don't navigate to song page */}
        <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          {activeDescriptors.map(s => {
            const meta = descriptorMeta.find(d => d.slug === s);
            return (
              <DescriptorTag
                key={s}
                slug={s}
                label={meta?.label}
                category={meta?.category}
                size="sm"
                clickable
              />
            );
          })}
          {otherSlugs.map(s => (
            <DescriptorTag key={s} slug={s} size="sm" clickable />
          ))}
        </div>
      </div>

      <span className="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors text-sm">
        →
      </span>
    </motion.div>
  );
}
