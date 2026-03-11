import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import ResultSection from "../components/ResultSection";
import SEOHead from "../components/SEOHead";
import PageSkeleton from "../components/PageSkeleton";
import DiscoveryPath from "../components/DiscoveryPath";
import ViewToggle from "../components/ViewToggle";
import MusicMap from "../components/MusicMap";
import { supabase } from "@/integrations/supabase/client";
import { useSeoPage } from "../hooks/useSeoPage";
import { useDiscoveryPath } from "../hooks/useDiscoveryPath";
import { useSpotifyImages } from "../hooks/useSpotifyImages";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSampleData } from "@/hooks/useSampleData";
import { useSonicProfile } from "@/hooks/useSonicProfile";
import { useSongComparison } from "@/hooks/useSongComparison";
import SampleInfo from "@/components/SampleInfo";
import LinkedSummary from "../components/LinkedSummary";
import { MatchDNA } from "@/components/MatchDNA";
import { ExploreDNA } from "@/components/ExploreDNA";
import { DescriptorTag } from "@/components/DescriptorTag";

const SongPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const { data, loading, generating, error } = useSeoPage(slug, "song");
  const displayName = data?.heading?.replace(/^(?:Songs Like|Songs Similar to)\s*/i, "") || slug || "";
  const discoverySteps = useDiscoveryPath(displayName, location.pathname);
  const [view, setView] = useState<"list" | "map">("list");
  const isMobile = useIsMobile();

  // Extract song title and artist for sample lookup
  const songParts = displayName.split(/\s[–—-]\s/);
  const songTitleForSample = songParts[0] || undefined;
  const artistForSample = songParts[1] || data?.closest_matches?.[0]?.subtitle?.replace(/^by\s+/i, "") || undefined;
  const { sample } = useSampleData(songTitleForSample, artistForSample);

  // Spotify images — must be declared before sonic profile hooks that depend on it
  const allSongs = [...(data?.closest_matches || []), ...(data?.same_energy || [])];
  const { songImages, songMeta, artistImages, metaLoaded } = useSpotifyImages(allSongs, data?.related_artists || []);

  // Resolve the center song's Spotify identity via resolve-song.
  // seo_pages.spotify_track_id is null for all existing pages, and deriving the
  // track ID from useSpotifyImages returns the first *recommended* song's ID, not
  // the center song's. resolve-song gives us the correct track ID + clean title/artist.
  const [resolvedTrack, setResolvedTrack] = useState<{
    spotify_track_id: string;
    song_title: string;
    artist_name: string;
  } | null>(null);

  useEffect(() => {
    // Wait for page data, skip if we already have a track ID
    if (!data || data.spotify_track_id) return;
    // Use the slug as the query (e.g. "stronger kanye west") — more reliable than
    // the heading which may contain "Songs Like" / "Songs Similar to" prefixes.
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

  // Top recommended song for MatchDNA comparison
  const topMatchSong = data?.closest_matches?.[0] || data?.same_energy?.[0];
  const topMatchTrackId = topMatchSong?.spotify_id || null;
  const topMatchTitle = topMatchSong?.title || "";
  const topMatchArtist = topMatchSong?.subtitle?.replace(/\s*\(\d{4}\)\s*$/, "") || "";

  const { comparison, loading: comparisonLoading } = useSongComparison({
    songAId: centerTrackId,
    songBId: topMatchTrackId,
    autoGenerate: !!centerTrackId && !!topMatchTrackId,
  });

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
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">{data.heading}</h1>
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

        {/* Sonic DNA — this song's descriptor chips, shown directly under the prose */}
        {(profileLoading || (canonicalDescriptors?.display_descriptors.length ?? 0) > 0) && (
          <div className="space-y-2 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Sonic DNA</p>
            {profileLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Loading...
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {canonicalDescriptors!.display_descriptors.map((d) => (
                  <DescriptorTag key={d.slug} slug={d.slug} label={d.label} category={d.category} clickable size="sm" />
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {sample && <SampleInfo sample={sample} />}

      {activeView === "map" ? (
        <MusicMap
          centerLabel={displayName}
          closestMatches={data.closest_matches}
          sameEnergy={data.same_energy}
          relatedArtists={data.related_artists}
          relatedVibes={data.related_vibes}
          pageType="song"
        />
      ) : (
        <>
          {/* 1. Songs With Similar DNA — closest matches + same energy combined */}
          {allSongs.length > 0 && (
            <ResultSection title="Songs With Similar DNA" items={allSongs} linkPrefix="/songs-like" imageType="song" images={songImages} songMetaMap={songMeta} metaLoaded={metaLoaded} />
          )}

          {/* 2. Why These Work */}
          {data.why_these_work.length > 0 && (
            <ResultSection title="Why These Work" items={data.why_these_work} variant="explanation" />
          )}

          {/* 3. Explore This DNA — descriptor chips + sonic lineage */}
          {(profileLoading || (canonicalDescriptors && canonicalDescriptors.display_descriptors.length > 0)) && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Explore This DNA</h2>
              {profileLoading ? (
                <div className="flex items-center gap-3 text-muted-foreground text-sm">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Loading DNA...
                </div>
              ) : (
                <>
                  <MatchDNA
                    centerTitle={profileSongTitle}
                    centerArtist={profileArtistName}
                    comparedTitle={topMatchTitle || undefined}
                    comparedArtist={topMatchArtist || undefined}
                    comparison={comparison}
                    centerProfile={sonicProfile}
                    loading={comparisonLoading && !sonicProfile && !comparison}
                  />
                  <ExploreDNA
                    descriptors={canonicalDescriptors!.display_descriptors}
                    searchUrl={canonicalDescriptors!.descriptor_search_url}
                    songTitle={profileSongTitle || songTitleForSample}
                  />
                </>
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
