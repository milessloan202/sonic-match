import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import ResultSection from "../components/ResultSection";

const unslugify = (slug: string) =>
  slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const SongPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const title = unslugify(slug || "");

  return (
    <div className="min-h-screen px-4 py-12 max-w-3xl mx-auto space-y-10">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
          Songs like <span className="text-gradient">{title}</span>
        </h1>
        <p className="text-muted-foreground">
          Tracks that share the same sonic energy, mood, and texture.
        </p>
      </motion.div>

      <ResultSection
        title="🎯 Closest Matches"
        items={[
          { title: "Similar Track A", subtitle: "Shares tempo, key, and production style", tag: "96%" },
          { title: "Similar Track B", subtitle: "Matching vocal tone and instrumental layers", tag: "91%" },
        ]}
      />
      <ResultSection
        title="⚡ Same Energy"
        items={[
          { title: "Energy Track A", subtitle: "Same driving rhythm and emotional arc" },
          { title: "Energy Track B", subtitle: "Parallel mood progression and dynamics" },
        ]}
      />
      <ResultSection
        title="🎤 Related Artists"
        items={[
          { title: "Artist One", subtitle: "Known for similar production aesthetics" },
          { title: "Artist Two", subtitle: "Overlapping genre influences" },
        ]}
      />
      <ResultSection
        title="💡 Why These Work"
        items={[
          { title: "Shared Sonic DNA", subtitle: "These tracks match in BPM, key signature, and harmonic structure." },
          { title: "Mood Alignment", subtitle: "Emotional arc and energy curves follow similar patterns." },
        ]}
      />
    </div>
  );
};

export default SongPage;
