import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import SEOHead from "@/components/SEOHead";
import DescriptorCarousel from "@/components/DescriptorCarousel";
import SoundDirectory from "@/components/SoundDirectory";
import SoundOfTheMoment from "@/components/SoundOfTheMoment";
import { useDescriptorRegistry } from "@/hooks/useExploreData";
import { DESCRIPTOR_CATEGORY_MAP, CATEGORY_GLOW_RGB } from "@/lib/exploreSounds";

/** Curated top-level chips for Section A */
const CURATED_CHIPS = [
  "dreamy", "hazy", "nocturnal", "cold", "metallic", "glossy",
  "nostalgic", "lush", "stomping", "driving", "gliding", "warm",
];

/** Descriptors featured as album carousels in Section B */
const CAROUSEL_DESCRIPTORS = [
  { slug: "dreamy", label: "Dreamy" },
  { slug: "cold", label: "Cold" },
  { slug: "nocturnal", label: "Nocturnal" },
  { slug: "metallic", label: "Metallic" },
  { slug: "nostalgic", label: "Nostalgic" },
];

export default function ExplorePage() {
  const { descriptors, grouped, loading } = useDescriptorRegistry();

  const labelMap = new Map(descriptors.map((d) => [d.slug, d]));

  return (
    <div className="min-h-screen px-4 py-12 sm:py-16 max-w-7xl mx-auto">
      <SEOHead
        title="Explore Sounds – SOUNDDNA"
        description="Browse music organized by Sonic DNA. Discover songs by texture, mood, energy, and more."
        path="/explore"
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-14 space-y-2"
      >
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Home
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Explore Sounds
        </h1>
        <p className="text-muted-foreground text-sm max-w-lg">
          A record store organized by sound. Browse by texture, mood, energy — not genre.
        </p>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-14">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-16">

          {/* SECTION 0 — Sound of the moment */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <SoundOfTheMoment descriptors={descriptors} />
          </motion.section>

          {/* SECTION A — Start with a sound */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Start with a sound
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {CURATED_CHIPS.map((slug) => (
                <ExplorePill
                  key={slug}
                  slug={slug}
                  label={labelMap.get(slug)?.label}
                  category={labelMap.get(slug)?.category ?? DESCRIPTOR_CATEGORY_MAP[slug]}
                />
              ))}
            </div>
          </motion.section>

          {/* SECTION B — Explore by sound (album carousels) */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="space-y-10"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Explore by sound
            </p>
            {CAROUSEL_DESCRIPTORS.map((d) => (
              <DescriptorCarousel
                key={d.slug}
                descriptorSlug={d.slug}
                descriptorLabel={d.label}
                limit={10}
              />
            ))}
          </motion.section>
        </div>

        {/* SECTION C — Sound directory (sidebar) */}
        <motion.aside
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full lg:w-64 shrink-0"
        >
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-4 w-24 bg-secondary rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <SoundDirectory grouped={grouped} />
          )}
        </motion.aside>
      </div>
    </div>
  );
}

/** Pill with Sonic DNA category color on hover */
const HOVER_BG: Record<string, string> = {
  emotional_tone:         "rgba(168,85,247,0.35)",
  energy_posture:         "rgba(59,130,246,0.35)",
  groove_character:       "rgba(99,102,241,0.35)",
  texture:                "rgba(6,182,212,0.35)",
  spatial_feel:           "rgba(14,165,233,0.35)",
  era_movement:           "rgba(245,158,11,0.35)",
  era_period:             "rgba(245,158,11,0.35)",
  environment_imagery:    "rgba(16,185,129,0.35)",
  listener_use_case:      "rgba(244,63,94,0.35)",
  drum_character:         "rgba(249,115,22,0.35)",
  bass_character:         "rgba(234,179,8,0.35)",
  harmonic_color:         "rgba(20,184,166,0.35)",
  melodic_character:      "rgba(236,72,153,0.35)",
  vocal_character:        "rgba(139,92,246,0.35)",
  arrangement_energy_arc: "rgba(132,204,22,0.35)",
};
const HOVER_BORDER: Record<string, string> = {
  emotional_tone:         "rgba(168,85,247,0.65)",
  energy_posture:         "rgba(59,130,246,0.65)",
  groove_character:       "rgba(99,102,241,0.65)",
  texture:                "rgba(6,182,212,0.65)",
  spatial_feel:           "rgba(14,165,233,0.65)",
  era_movement:           "rgba(245,158,11,0.65)",
  era_period:             "rgba(245,158,11,0.65)",
  environment_imagery:    "rgba(16,185,129,0.65)",
  listener_use_case:      "rgba(244,63,94,0.65)",
  drum_character:         "rgba(249,115,22,0.65)",
  bass_character:         "rgba(234,179,8,0.65)",
  harmonic_color:         "rgba(20,184,166,0.65)",
  melodic_character:      "rgba(236,72,153,0.65)",
  vocal_character:        "rgba(139,92,246,0.65)",
  arrangement_energy_arc: "rgba(132,204,22,0.65)",
};

function ExplorePill({ slug, label, category }: { slug: string; label?: string; category?: string }) {
  const [hovered, setHovered] = useState(false);
  const display = label ?? slug.replace(/-/g, " ");

  const style: React.CSSProperties = hovered && category
    ? {
        backgroundColor: HOVER_BG[category] ?? "hsl(0 0% 14% / 0.6)",
        borderColor: HOVER_BORDER[category] ?? "hsl(0 0% 100% / 0.3)",
      }
    : {};

  return (
    <Link to={`/sounds/${slug}`} className="block">
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="rounded-xl border border-border/60 bg-secondary/30 transition-all duration-200 px-4 py-3.5 text-center hover:scale-[1.03] active:scale-95"
        style={style}
      >
        <span className="text-sm font-medium text-foreground capitalize">{display}</span>
      </div>
    </Link>
  );
}
