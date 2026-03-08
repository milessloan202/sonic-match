import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import ResultSection from "../components/ResultSection";

const unslugify = (slug: string) =>
  slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const ArtistPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const title = unslugify(slug || "");

  return (
    <div className="min-h-screen px-4 py-16 max-w-2xl mx-auto space-y-12">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="space-y-3">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3 h-3" /> Back
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">Artists like {title}</h1>
        <p className="text-sm text-muted-foreground">Musicians who share a similar sound, style, and creative DNA.</p>
      </motion.div>

      <div className="space-y-10">
        <ResultSection title="Closest Matches" items={[
          { title: "Similar Artist A", subtitle: "Overlapping genre palette and vocal style", tag: "94%" },
          { title: "Similar Artist B", subtitle: "Shared production techniques and influences", tag: "89%" },
        ]} />
        <ResultSection title="Same Energy" items={[
          { title: "Energy Artist A", subtitle: "Matching live performance intensity" },
          { title: "Energy Artist B", subtitle: "Similar discography evolution" },
        ]} />
        <ResultSection title="Related Artists" items={[
          { title: "Collaborator One", subtitle: "Frequent collaborator and genre peer" },
          { title: "Influence Two", subtitle: "Cited as a major influence" },
        ]} />
        <ResultSection title="Why These Work" items={[
          { title: "Genre Overlap", subtitle: "These artists occupy similar spaces in the musical landscape." },
          { title: "Fan Crossover", subtitle: "High listener overlap based on streaming patterns." },
        ]} />
      </div>
    </div>
  );
};

export default ArtistPage;
