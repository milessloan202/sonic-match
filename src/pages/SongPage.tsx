import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, X, ExternalLink, Network, Layers, Map } from "lucide-react";
import ResultSection from "../components/ResultSection";
import SEOHead from "../components/SEOHead";
import PageSkeleton from "../components/PageSkeleton";
import DiscoveryPath from "../components/DiscoveryPath";
import ViewToggle from "../components/ViewToggle";
import MusicMap from "../components/MusicMap";
import { supabase } from "@/integrations/supabase/client";
import { useSeoPage } from "../hooks/useSeoPage";
import { useDiscoveryPath } from "../hooks/useDiscoveryPath";
import { useSpotifyImages, songKey } from "../hooks/useSpotifyImages";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSampleData } from "@/hooks/useSampleData";
import { useSonicProfile } from "@/hooks/useSonicProfile";
import { useSongComparison } from "@/hooks/useSongComparison";
import SampleInfo from "@/components/SampleInfo";
import LinkedSummary from "../components/LinkedSummary";
import { MatchDNA } from "@/components/MatchDNA";
import { ExploreDNA } from "@/components/ExploreDNA";
import { DescriptorTag } from "@/components/DescriptorTag";
import ResultCard, { Thumbnail } from "../components/ResultCard";
import type { CanonicalDescriptor } from "@/hooks/useSonicProfile";

// All category groups for the unified top Sonic DNA display
const SONIC_DNA_GROUPS: { key: string; label: string }[] = [
  { key: "emotional_tone",         label: "Mood"        },
  { key: "energy_posture",         label: "Energy"      },
  { key: "texture",                label: "Texture"     },
  { key: "groove_character",       label: "Groove"      },
  { key: "drum_character",         label: "Drums"       },
  { key: "bass_character",         label: "Bass"        },
  { key: "vocal_character",        label: "Vocals"      },
  { key: "melodic_character",      label: "Melody"      },
  { key: "harmonic_color",         label: "Harmony"     },
  { key: "arrangement_energy_arc", label: "Energy Arc"  },
  { key: "era_movement",           label: "Era"         },
  { key: "era_period",             label: "Period"      },
  { key: "spatial_feel",           label: "Space"       },
  { key: "environment_imagery",    label: "Environment" },
  { key: "listener_use_case",      label: "Best For"    },
  { key: "intensity",              label: "Intensity"   },
  { key: "danceability",           label: "Danceability"},
];

const DNA_CATEGORY_LIMIT = 4;

// For "Keep Exploring" — strongest identity-defining sonic categories,
// in priority order.
const CORE_SONIC_CATEGORIES = [
  "emotional_tone", "energy_posture", "texture", "groove_character",
  "drum_character", "bass_character", "vocal_character", "melodic_character", "harmonic_color",
];
// Categories that are weak / contextual — excluded from exploration slugs.
const WEAK_CATEGORIES = new Set([
  "intensity", "danceability", "listener_use_case", "era_movement", "era_period",
]);

type SongItem = { title: string; subtitle?: string; tag?: string; spotify_id?: string | null };

const SongPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const { data, loading, generating, error } = useSeoPage(slug, "song");
  const displayName = data?.heading?.replace(/^(?:Songs Like|Songs Similar to)\s*/i, "") || slug || "";
  const discoverySteps = useDiscoveryPath(displayName, location.pathname);
  const [view, setView] = useState<"list" | "map">("list");
  const isMobile = useIsMobile();

  // ── Descriptor stacking state ──────────────────────────────────────────────
  const [activeSlugs, setActiveSlugs] = useState(new Set<string>());
  const [descriptorMap, setDescriptorMap] = useState<Record<string, CanonicalDescriptor>>({});
  const [dnaFilteredSongs, setDnaFilteredSongs] = useState<SongItem[] | null>(null);
  const [dnaSearching, setDnaSearching] = useState(false);

  const toggleDescriptor = useCallback((slug: string) => {
    setActiveSlugs(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  // ── Extract song title and artist for sample lookup ────────────────────────
  const songParts = displayName.split(/\s[–—-]\s/);
  const songTitleForSample = songParts[0] || undefined;
  const artistForSample = songParts[1] || data?.closest_matches?.[0]?.subtitle?.replace(/^by\s+/i, "") || undefined;
  const { sample } = useSampleData(songTitleForSample, artistForSample);

  // ── Spotify images ─────────────────────────────────────────────────────────
  const allSongs = [...(data?.closest_matches || []), ...(data?.same_energy || [])];
  // Only include the center song in the batch fetch when it doesn't already
  // have a pre-fetched image stored on the seo_pages row.
  const centerSongItem = (songTitleForSample && artistForSample)
    ? [{ title: songTitleForSample, subtitle: artistForSample, spotify_id: data?.spotify_track_id ?? null }]
    : [];
  const { songImages, songMeta, artistImages, metaLoaded } = useSpotifyImages(
    [...allSongs, ...centerSongItem],
    data?.related_artists || [],
  );
  const centerImageUrl = (songTitleForSample && artistForSample)
    ? (songImages[songKey(songTitleForSample, artistForSample)] ?? null)
    : null;

  // ── Resolve center song Spotify identity ───────────────────────────────────
  const [resolvedTrack, setResolvedTrack] = useState<{
    spotify_track_id: string;
    song_title: string;
    artist_name: string;
  } | null>(null);

  useEffect(() => {
    if (!data || data.spotify_track_id) return;
    const query = (slug || "").replace(/-/g, " ");
    if (!query) return;
    supabase.functions.invoke("resolve-song", { body: { query } })
      .then(({ data: r }) => {
        if (r?.spotify_track_id) setResolvedTrack(r);
      });
  }, [data?.heading]); // eslint-disable-line react-hooks/exhaustive-deps

  const centerTrackId = data?.spotify_track_id || resolvedTrack?.spotify_track_id;
  const profileSongTitle = resolvedTrack?.song_title || songTitleForSample || "";
  const profileArtistName = resolvedTrack?.artist_name || (artistForSample?.replace(/\s*\(\d{4}\)\s*$/, "") || "");

  const { profile: sonicProfile, canonical: canonicalDescriptors, loading: profileLoading } = useSonicProfile({
    spotifyTrackId: centerTrackId,
    songTitle: profileSongTitle,
    artistName: profileArtistName,
    autoGenerate: !!centerTrackId && !!profileSongTitle && !!profileArtistName,
  });

  // Unified descriptor list: canonical descriptors (proper labels) merged with
  // raw profile slugs for categories not covered by the canonical set.
  const unifiedDescriptors = useMemo((): CanonicalDescriptor[] => {
    const result: CanonicalDescriptor[] = [];
    const seen = new Set<string>();

    // 1. Canonical descriptors first — they have curated labels
    for (const d of canonicalDescriptors?.display_descriptors ?? []) {
      if (!seen.has(d.slug)) {
        result.push(d);
        seen.add(d.slug);
      }
    }

    if (sonicProfile) {
      const addSlugs = (slugs: string[], category: string) => {
        for (const slug of slugs) {
          if (!seen.has(slug)) {
            result.push({
              slug,
              label: slug.replace(/-/g, " "),
              category,
              is_clickable: true,
              search_url: `/search?descriptors=${slug}`,
              dna_url: `/search?descriptors=${slug}&mode=lineage`,
            });
            seen.add(slug);
          }
        }
      };

      // 2. Raw profile arrays — fills in any slugs not already in canonical set
      // Guard with || [] to handle v1 profiles that use different key names
      addSlugs(sonicProfile.emotional_tone         || [], "emotional_tone");
      addSlugs(sonicProfile.energy_posture         || [], "energy_posture");
      addSlugs(sonicProfile.texture                || [], "texture");
      addSlugs(sonicProfile.groove_character       || [], "groove_character");
      addSlugs(sonicProfile.drum_character         || [], "drum_character");
      addSlugs(sonicProfile.bass_character         || [], "bass_character");
      addSlugs(sonicProfile.vocal_character        || [], "vocal_character");
      addSlugs(sonicProfile.melodic_character      || [], "melodic_character");
      addSlugs(sonicProfile.harmonic_color         || [], "harmonic_color");
      addSlugs(sonicProfile.arrangement_energy_arc || [], "arrangement_energy_arc");
      addSlugs(sonicProfile.spatial_feel           || [], "spatial_feel");
      addSlugs(sonicProfile.era_movement           || [], "era_movement");
      addSlugs(sonicProfile.era_period             || [], "era_period");
      addSlugs(sonicProfile.environment_imagery    || [], "environment_imagery");
      addSlugs(sonicProfile.listener_use_case      || [], "listener_use_case");

      // 3. Scalar fields as pseudo-categories
      if (sonicProfile.intensity_level && !seen.has(sonicProfile.intensity_level)) {
        result.push({
          slug: sonicProfile.intensity_level,
          label: sonicProfile.intensity_level.replace(/-/g, " "),
          category: "intensity",
          is_clickable: true,
          search_url: `/search?descriptors=${sonicProfile.intensity_level}`,
          dna_url: `/search?descriptors=${sonicProfile.intensity_level}&mode=lineage`,
        });
      }
      if (sonicProfile.danceability_feel && !seen.has(sonicProfile.danceability_feel)) {
        result.push({
          slug: sonicProfile.danceability_feel,
          label: sonicProfile.danceability_feel.replace(/-/g, " "),
          category: "danceability",
          is_clickable: true,
          search_url: `/search?descriptors=${sonicProfile.danceability_feel}`,
          dna_url: `/search?descriptors=${sonicProfile.danceability_feel}&mode=lineage`,
        });
      }
    }

    return result;
  }, [canonicalDescriptors, sonicProfile]);

  // Build a slug→descriptor lookup from the unified set for the Active DNA Mix panel
  useEffect(() => {
    const map: Record<string, CanonicalDescriptor> = {};
    for (const d of unifiedDescriptors) map[d.slug] = d;
    setDescriptorMap(map);
  }, [unifiedDescriptors]);

  // ── Keep Exploring — derived exploration URLs ─────────────────────────────
  // All sonic slugs (weak/era categories excluded), capped at 10.
  const explorationSlugs = useMemo(
    () => unifiedDescriptors.filter(d => !WEAK_CATEGORIES.has(d.category)).slice(0, 10).map(d => d.slug),
    [unifiedDescriptors],
  );

  // Top 3 identity-defining slugs — prefer strongest sonic categories first.
  const coreTraitSlugs = useMemo(() => {
    const core = unifiedDescriptors.filter(d => CORE_SONIC_CATEGORIES.includes(d.category));
    const other = unifiedDescriptors.filter(d => !CORE_SONIC_CATEGORIES.includes(d.category) && !WEAK_CATEGORIES.has(d.category));
    return [...core, ...other].slice(0, 3).map(d => d.slug);
  }, [unifiedDescriptors]);

  const exploreDnaUrl = explorationSlugs.length > 0
    ? `/search?descriptors=${explorationSlugs.join(",")}&mode=descriptor`
    : null;

  const coreTraitsUrl = coreTraitSlugs.length > 0
    ? `/search?descriptors=${coreTraitSlugs.join(",")}&mode=descriptor`
    : null;

  function scrollToMap() {
    setView("map");
    setTimeout(() => document.getElementById("music-map-section")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  // ── Top recommended song for MatchDNA comparison ──────────────────────────
  const topMatchSong = data?.closest_matches?.[0] || data?.same_energy?.[0];
  const topMatchTrackId = topMatchSong?.spotify_id || null;
  const topMatchTitle = topMatchSong?.title || "";
  const topMatchArtist = topMatchSong?.subtitle?.replace(/\s*\(\d{4}\)\s*$/, "") || "";

  const { comparison, loading: comparisonLoading } = useSongComparison({
    songAId: centerTrackId,
    songBId: topMatchTrackId,
    autoGenerate: !!centerTrackId && !!topMatchTrackId,
  });

  // ── Descriptor-filtered song search ───────────────────────────────────────
  useEffect(() => {
    if (activeSlugs.size === 0) {
      setDnaFilteredSongs(null);
      return;
    }
    setDnaSearching(true);
    supabase.functions.invoke("search-by-descriptors", {
      body: { descriptors: [...activeSlugs], limit: 12 },
    }).then(({ data: r }) => {
      if (r?.results) {
        setDnaFilteredSongs(
          (r.results as any[]).map((res) => ({
            title: res.song_title,
            subtitle: res.artist_name,
            spotify_id: res.spotify_track_id,
          }))
        );
      }
      setDnaSearching(false);
    });
  }, [activeSlugs]);

  // ── Early returns ──────────────────────────────────────────────────────────
  if (loading) return <PageSkeleton generating={generating} />;
  if (error) {
    return (
      <div className="min-h-screen px-4 py-12 max-w-3xl mx-auto space-y-4">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }
  if (!data) return null;

  const activeView = isMobile ? "list" : view;
  const activeSlugList = [...activeSlugs];

  return (
    <div className="min-h-screen px-4 py-12 max-w-3xl mx-auto space-y-10">
      <SEOHead title={data.title} description={data.meta_description || undefined} path={`/songs-like/${slug}`} />
      <DiscoveryPath steps={discoverySteps} />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <ViewToggle view={view} onChange={setView} />
        </div>
        <div className="flex items-center gap-4">
          <Thumbnail url={centerImageUrl} type="song" alt={displayName} size="w-20 h-20" />
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">{data.heading}</h1>
        </div>
        {data.summary && (
          <LinkedSummary
            text={data.summary}
            artistNames={[
              ...(data.related_artists || []).map((a: any) => a.title),
              ...(data.related_artist_links || []).map((a: any) => a.title),
              ...(data.closest_matches || []).flatMap((s: any) => {
                const m = s.subtitle?.match(/^(.+?)\s*\(\d{4}\)\s*$/);
                return m ? [m[1]] : [];
              }),
              ...(data.same_energy || []).flatMap((s: any) => {
                const m = s.subtitle?.match(/^(.+?)\s*\(\d{4}\)\s*$/);
                return m ? [m[1]] : [];
              }),
            ]}
            vibeNames={(data.related_vibes || []).map((v: any) => v.title)}
          />
        )}

        {/* Sonic DNA — unified grouped descriptor profile */}
        {(profileLoading || unifiedDescriptors.length > 0) && (
          <div className="space-y-2 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Sonic DNA</p>
            {profileLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Loading...
              </div>
            ) : (
              <div className="grid gap-3">
                {SONIC_DNA_GROUPS.map(({ key, label }) => {
                  const chips = unifiedDescriptors
                    .filter(d => d.category === key)
                    .slice(0, DNA_CATEGORY_LIMIT);
                  if (chips.length === 0) return null;
                  return (
                    <div key={key} className="flex items-start gap-3">
                      <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider pt-0.5 w-20 shrink-0 text-right leading-5">
                        {label}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {chips.map(d => (
                          <DescriptorTag
                            key={d.slug}
                            slug={d.slug}
                            label={d.label}
                            category={d.category}
                            clickable
                            active={activeSlugs.has(d.slug)}
                            size="sm"
                            onClick={() => toggleDescriptor(d.slug)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Active DNA Mix — inline stacking panel */}
        <AnimatePresence>
          {activeSlugs.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="rounded-xl border border-border bg-card/60 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Active DNA Mix
                </p>
                <button
                  onClick={() => setActiveSlugs(new Set())}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeSlugList.map(slug => {
                  const d = descriptorMap[slug];
                  return (
                    <button
                      key={slug}
                      onClick={() => toggleDescriptor(slug)}
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium tracking-wide transition-all hover:brightness-110 active:scale-95 bg-primary/20 text-primary border-primary/40"
                    >
                      {d?.label || slug.replace(/-/g, " ")}
                      <X className="w-2.5 h-2.5 opacity-60" />
                    </button>
                  );
                })}
              </div>
              <Link
                to={`/search?descriptors=${activeSlugList.join(",")}&mode=lineage`}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Open this mix in Search
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Keep Exploring */}
      {!profileLoading && unifiedDescriptors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Keep Exploring
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">

            {/* 1. Explore this DNA mix */}
            {exploreDnaUrl && (
              <Link
                to={exploreDnaUrl}
                className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-3.5 hover:border-primary/40 hover:bg-card/60 hover:-translate-y-1 transition-all duration-200"
              >
                <Network className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    Explore this DNA mix
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                    {explorationSlugs.length} traits
                  </p>
                </div>
              </Link>
            )}

            {/* 2. Explore core traits */}
            {coreTraitsUrl && (
              <Link
                to={coreTraitsUrl}
                className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-3.5 hover:border-primary/40 hover:bg-card/60 hover:-translate-y-1 transition-all duration-200"
              >
                <Layers className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    Explore core traits
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5 truncate">
                    {coreTraitSlugs.join(" · ")}
                  </p>
                </div>
              </Link>
            )}

            {/* 3. View in Music Map — desktop only */}
            {!isMobile && activeView !== "map" && (
              <button
                onClick={scrollToMap}
                className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-3.5 hover:border-primary/40 hover:bg-card/60 hover:-translate-y-1 transition-all duration-200 text-left"
              >
                <Map className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    View in Music Map
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                    Spatial view
                  </p>
                </div>
              </button>
            )}

          </div>
        </motion.div>
      )}

      {sample && <SampleInfo sample={sample} />}

      {activeView === "map" ? (
        <div id="music-map-section">
          <MusicMap
            centerLabel={displayName}
            closestMatches={data.closest_matches}
            sameEnergy={data.same_energy}
            relatedArtists={data.related_artists}
            relatedVibes={data.related_vibes}
            pageType="song"
          />
        </div>
      ) : (
        <>
          {/* 1. Songs With Similar DNA — shows descriptor-filtered results when mix is active */}
          {activeSlugs.size > 0 ? (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <motion.h2
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xl font-semibold text-foreground"
                >
                  Songs With Similar DNA
                </motion.h2>
                <span className="text-xs text-muted-foreground">filtered by mix</span>
              </div>
              {dnaSearching ? (
                <div className="flex items-center gap-3 text-muted-foreground text-sm py-4">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Finding matches...
                </div>
              ) : dnaFilteredSongs && dnaFilteredSongs.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {dnaFilteredSongs.map((item, i) => (
                    <ResultCard
                      key={item.title + i}
                      title={item.title}
                      subtitle={item.subtitle}
                      index={i}
                      linkPrefix="/songs-like"
                      imageType="song"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4">
                  No songs found for this mix yet.{" "}
                  <Link
                    to={`/search?descriptors=${activeSlugList.join(",")}&mode=lineage`}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Try in Search
                  </Link>
                </p>
              )}
            </section>
          ) : (
            allSongs.length > 0 && (
              <ResultSection title="Songs With Similar DNA" items={allSongs} linkPrefix="/songs-like" imageType="song" images={songImages} songMetaMap={songMeta} metaLoaded={metaLoaded} />
            )
          )}

          {/* 2. Why These Work */}
          {data.why_these_work.length > 0 && (
            <ResultSection title="Why These Work" items={data.why_these_work} variant="explanation" />
          )}

          {/* 3. Explore This DNA — match comparison + search CTA */}
          {(comparisonLoading || !!comparison || (canonicalDescriptors && canonicalDescriptors.display_descriptors.length > 0)) && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Explore This DNA</h2>
              {(comparisonLoading || !!comparison) && (
                <MatchDNA
                  centerTitle={profileSongTitle}
                  comparedTitle={topMatchTitle || undefined}
                  comparedArtist={topMatchArtist || undefined}
                  comparison={comparison}
                  loading={comparisonLoading && !comparison}
                />
              )}
              {canonicalDescriptors && canonicalDescriptors.display_descriptors.length > 0 && (
                <ExploreDNA
                  descriptors={canonicalDescriptors.display_descriptors}
                  searchUrl={canonicalDescriptors.descriptor_search_url}
                  songTitle={profileSongTitle || songTitleForSample}
                />
              )}
            </div>
          )}

          {/* 4. Related Artists */}
          {data.related_artists.length > 0 && (
            <ResultSection title="Related Artists" items={data.related_artists} linkPrefix="/artists-like" imageType="artist" images={artistImages} />
          )}
        </>
      )}

    </div>
  );
};

export default SongPage;
