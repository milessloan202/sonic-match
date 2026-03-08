import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import ResultSection from "../components/ResultSection";

const unslugify = (slug: string) =>
  slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const VibePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const title = unslugify(slug || "");

  return (
    <div className="min-h-screen px-4 py-12 max-w-3xl mx-auto space-y-10">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
          <span className="text-gradient">{title}</span> vibes
        </h1>
        <p className="text-muted-foreground">
          Songs and artists that capture this exact mood and atmosphere.
        </p>
      </motion.div>

      <ResultSection
        title="🎯 Closest Matches"
        items={[
          { title: "Vibe Track A", subtitle: "Perfectly captures the mood you're looking for", tag: "98%" },
          { title: "Vibe Track B", subtitle: "Atmospheric alignment with this energy", tag: "93%" },
        ]}
      />
      <ResultSection
        title="⚡ Same Energy"
        items={[
          { title: "Mood Track A", subtitle: "Emotional resonance and sonic texture match" },
          { title: "Mood Track B", subtitle: "Complementary atmosphere and pacing" },
        ]}
      />
      <ResultSection
        title="🎤 Related Artists"
        items={[
          { title: "Vibe Artist One", subtitle: "Known for creating this exact atmosphere" },
          { title: "Vibe Artist Two", subtitle: "Consistently delivers this mood" },
        ]}
      />
      <ResultSection
        title="💡 Why These Work"
        items={[
          { title: "Atmospheric Match", subtitle: "Instrumentation, tempo, and production create the same space." },
          { title: "Emotional Curve", subtitle: "The emotional journey mirrors the vibe you described." },
        ]}
      />
    </div>
  );
};

export default VibePage;
