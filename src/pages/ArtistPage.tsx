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
    <div className="min-h-screen px-4 py-12 max-w-3xl mx-auto space-y-10">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
          Artists like <span className="text-gradient">{title}</span>
        </h1>
        <p className="text-muted-foreground">
          Musicians who share a similar sound, style, and creative DNA.
        </p>
      </motion.div>

      <ResultSection
        title="🎯 Closest Matches"
        items={[
          { title: "Similar Artist A", subtitle: "Overlapping genre palette and vocal style", tag: "94%" },
          { title: "Similar Artist B", subtitle: "Shared production techniques and influences", tag: "89%" },
        ]}
      />
      <ResultSection
        title="⚡ Same Energy"
        items={[
          { title: "Energy Artist A", subtitle: "Matching live performance intensity" },
          { title: "Energy Artist B", subtitle: "Similar discography evolution" },
        ]}
      />
      <ResultSection
        title="🎤 Related Artists"
        items={[
          { title: "Collaborator One", subtitle: "Frequent collaborator and genre peer" },
          { title: "Influence Two", subtitle: "Cited as a major influence" },
        ]}
      />
      <ResultSection
        title="💡 Why These Work"
        items={[
          { title: "Genre Overlap", subtitle: "These artists occupy similar spaces in the musical landscape." },
          { title: "Fan Crossover", subtitle: "High listener overlap based on streaming patterns." },
        ]}
      />
    </div>
  );
};

export default ArtistPage;
