import { useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import ResultSection from "../components/ResultSection";
import RelatedPages from "../components/RelatedPages";
import SEOHead from "../components/SEOHead";
import PageSkeleton from "../components/PageSkeleton";
import DiscoveryPath from "../components/DiscoveryPath";
import ViewToggle from "../components/ViewToggle";
import MusicMap from "../components/MusicMap";
import { useSeoPage } from "../hooks/useSeoPage";
import { useDiscoveryPath } from "../hooks/useDiscoveryPath";
import { useSpotifyImages } from "../hooks/useSpotifyImages";
import { useIsMobile } from "@/hooks/use-mobile";

const ArtistPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const { data, loading, generating, error } = useSeoPage(slug, "artist");
  const displayName = data?.heading?.replace(/^Artists Like\s*/i, "") || slug || "";
  const discoverySteps = useDiscoveryPath(displayName, location.pathname);
  const [view, setView] = useState<"list" | "map">("list");
  const isMobile = useIsMobile();

  const allSongs = [...(data?.closest_matches || []), ...(data?.same_energy || [])];
  const { songImages, songMeta, artistImages } = useSpotifyImages(allSongs, data?.related_artists || []);

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
      <SEOHead title={data.title} description={data.meta_description || undefined} path={`/artists-like/${slug}`} />
      <DiscoveryPath steps={discoverySteps} />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <ViewToggle view={view} onChange={setView} />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">{data.heading}</h1>
        {data.summary && <p className="text-muted-foreground">{data.summary}</p>}
      </motion.div>

      {activeView === "map" ? (
        <MusicMap
          centerLabel={displayName}
          closestMatches={data.closest_matches}
          sameEnergy={data.same_energy}
          relatedArtists={data.related_artists}
          relatedVibes={data.related_vibes}
          pageType="artist"
        />
      ) : (
        <>
          {data.closest_matches.length > 0 && (
            <ResultSection title="Closest Matches" items={data.closest_matches} linkPrefix="/songs-like" imageType="song" images={songImages} songMetaMap={songMeta} />
          )}
          {data.same_energy.length > 0 && (
            <ResultSection title="Same Energy" items={data.same_energy} linkPrefix="/songs-like" imageType="song" images={songImages} songMetaMap={songMeta} />
          )}
          {data.related_artists.length > 0 && (
            <ResultSection title="Related Artists" items={data.related_artists} linkPrefix="/artists-like" imageType="artist" images={artistImages} />
          )}
          {data.why_these_work.length > 0 && (
            <ResultSection title="Why These Work" items={data.why_these_work} variant="explanation" />
          )}
        </>
      )}

      <RelatedPages relatedSongs={data.related_songs} relatedArtists={data.related_artist_links} relatedVibes={data.related_vibes} />
    </div>
  );
};

export default ArtistPage;
