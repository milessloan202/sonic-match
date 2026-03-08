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
    <div className="min-h-screen px-4 py-16 max-w-2xl mx-auto space-y-12">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="space-y-3">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3 h-3" /> Back
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">{title} vibes</h1>
        <p className="text-sm text-muted-foreground">Songs and artists that capture this exact mood and atmosphere.</p>
      </motion.div>

      <div className="space-y-10">
        <ResultSection title="Closest Matches" items={[
          { title: "Vibe Track A", subtitle: "Perfectly captures the mood you're looking for", tag: "98%" },
          { title: "Vibe Track B", subtitle: "Atmospheric alignment with this energy", tag: "93%" },
        ]} />
        <ResultSection title="Same Energy" items={[
          { title: "Mood Track A", subtitle: "Emotional resonance and sonic texture match" },
          { title: "Mood Track B", subtitle: "Complementary atmosphere and pacing" },
        ]} />
        <ResultSection title="Related Artists" items={[
          { title: "Vibe Artist One", subtitle: "Known for creating this exact atmosphere" },
          { title: "Vibe Artist Two", subtitle: "Consistently delivers this mood" },
        ]} />
        <ResultSection title="Why These Work" items={[
          { title: "Atmospheric Match", subtitle: "Instrumentation, tempo, and production create the same space." },
          { title: "Emotional Curve", subtitle: "The emotional journey mirrors the vibe you described." },
        ]} />
      </div>
    </div>
  );
};

export default VibePage;
