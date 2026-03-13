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
