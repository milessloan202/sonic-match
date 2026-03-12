import { motion } from "framer-motion";
import type { SongComparison } from "@/hooks/useSongComparison";
import { DescriptorTag } from "@/components/DescriptorTag";

// =============================================================================
// MatchDNA
//
// Full sonic comparison module shown on SongPage beneath recommendation sections.
// Shows shared traits, differences, explanation, and the center song's full
// sonic descriptor tags.
//
// Usage:
//   <MatchDNA
//     centerTitle="Blinding Lights"
//     centerArtist="The Weeknd"
//     comparedTitle="Take On Me"
//     comparedArtist="a-ha"
//     comparison={comparison}
//     centerProfile={profile}
//   />
// =============================================================================

interface MatchDNAProps {
  centerTitle: string;
  comparedTitle?: string;
  comparedArtist?: string;
  comparison: SongComparison | null;
  loading?: boolean;
}

function MatchStrengthBar({ strength }: { strength: number }) {
  const pct  = Math.round(strength * 100);
  const color =
    strength >= 0.8 ? "bg-emerald-400" :
    strength >= 0.6 ? "bg-cyan-400"    :
    strength >= 0.4 ? "bg-amber-400"   :
    "bg-rose-400";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
        />
      </div>
      <span className="text-xs font-medium text-white/60 tabular-nums w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

export function MatchDNA({
  centerTitle,
  comparedTitle,
  comparedArtist,
  comparison,
  loading = false,
}: MatchDNAProps) {

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-3 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-24" />
        <div className="h-3 bg-white/10 rounded w-full" />
        <div className="h-3 bg-white/10 rounded w-4/5" />
        <div className="h-3 bg-white/10 rounded w-3/5" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >

      {/* ── Comparison section (only if we have a comparison target) ── */}
      {comparison && comparedTitle && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1">
                Match DNA
              </h3>
              <p className="text-sm text-white/70">
                <span className="text-white font-medium">{centerTitle}</span>
                <span className="text-white/40 mx-2">↔</span>
                <span className="text-white font-medium">{comparedTitle}</span>
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-white/40 mb-1">Match</p>
              <p className="text-lg font-bold text-white tabular-nums">
                {Math.round(comparison.match_strength * 100)}%
              </p>
            </div>
          </div>

          {/* Match strength bar */}
          <MatchStrengthBar strength={comparison.match_strength} />

          {/* Shared traits */}
          {comparison.shared_traits.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                Shared
              </p>
              <ul className="space-y-1.5">
                {comparison.shared_traits.slice(0, 3).map((trait, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    className="flex items-start gap-2 text-sm text-white/80"
                  >
                    <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                    <span>{trait}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}

          {/* Differences */}
          {comparison.differences.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                Difference
              </p>
              <p className="text-sm text-white/60 italic">
                {comparison.differences[0]}
              </p>
            </div>
          )}

          {/* Long explanation */}
          {comparison.long_reason && (
            <div className="pt-1 border-t border-white/8">
              <p className="text-sm text-white/70 leading-relaxed">
                {comparison.long_reason}
              </p>
            </div>
          )}
        </div>
      )}

    </motion.div>
  );
}

// ── MatchDNACompact ───────────────────────────────────────────────────────────
// Minimal version for ResultCard — shows 2–3 descriptor slugs + short reason

interface MatchDNACompactProps {
  topDescriptors: string[];  // Pre-computed from getTopDescriptors()
  shortReason?: string;
  matchStrength?: number;
}

export function MatchDNACompact({
  topDescriptors,
  shortReason,
  matchStrength,
}: MatchDNACompactProps) {
  if (topDescriptors.length === 0 && !shortReason) return null;

  return (
    <div className="space-y-1.5">
      {topDescriptors.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {topDescriptors.map((slug) => (
            <DescriptorTag key={slug} slug={slug} size="sm" />
          ))}
        </div>
      )}
      {shortReason && (
        <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2">
          {shortReason}
        </p>
      )}
    </div>
  );
}
