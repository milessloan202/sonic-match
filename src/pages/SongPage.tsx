import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import ResultSection from "../components/ResultSection";
import RelatedPages from "../components/RelatedPages";
import SEOHead from "../components/SEOHead";
import PageSkeleton from "../components/PageSkeleton";
import { useSeoPage } from "../hooks/useSeoPage";

const SongPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data, loading, generating, error } = useSeoPage(slug, "song");

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

  return (
    <div className="min-h-screen px-4 py-12 max-w-3xl mx-auto space-y-10">
      <SEOHead
        title={data.title}
        description={data.meta_description || undefined}
        path={`/songs-like/${slug}`}
      />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">{data.heading}</h1>
        {data.summary && <p className="text-muted-foreground">{data.summary}</p>}
      </motion.div>

      {data.closest_matches.length > 0 && (
        <ResultSection title="Closest Matches" items={data.closest_matches} />
      )}
      {data.same_energy.length > 0 && (
        <ResultSection title="Same Energy" items={data.same_energy} />
      )}
      {data.related_artists.length > 0 && (
        <ResultSection title="Related Artists" items={data.related_artists} />
      )}
      {data.why_these_work.length > 0 && (
        <ResultSection title="Why These Work" items={data.why_these_work} />
      )}

      <RelatedPages
        relatedSongs={data.related_songs}
        relatedArtists={data.related_artist_links}
        relatedVibes={data.related_vibes}
      />
    </div>
  );
};

export default SongPage;
