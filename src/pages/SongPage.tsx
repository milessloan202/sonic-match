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
    <div className="min-h-screen px-4 py-16 max-w-2xl mx-auto space-y-12">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="space-y-3">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3 h-3" /> Back
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">
          Songs like {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Tracks that share the same sonic energy, mood, and texture.
        </p>
      </motion.div>

      <div className="space-y-10">
        <ResultSection title="Closest Matches" items={[
          { title: "Similar Track A", subtitle: "Shares tempo, key, and production style", tag: "96%" },
          { title: "Similar Track B", subtitle: "Matching vocal tone and instrumental layers", tag: "91%" },
        ]} />
        <ResultSection title="Same Energy" items={[
          { title: "Energy Track A", subtitle: "Same driving rhythm and emotional arc" },
          { title: "Energy Track B", subtitle: "Parallel mood progression and dynamics" },
        ]} />
        <ResultSection title="Related Artists" items={[
          { title: "Artist One", subtitle: "Known for similar production aesthetics" },
          { title: "Artist Two", subtitle: "Overlapping genre influences" },
        ]} />
        <ResultSection title="Why These Work" items={[
          { title: "Shared Sonic DNA", subtitle: "These tracks match in BPM, key signature, and harmonic structure." },
          { title: "Mood Alignment", subtitle: "Emotional arc and energy curves follow similar patterns." },
        ]} />
      </div>
    </div>
  );
};

export default SongPage;
