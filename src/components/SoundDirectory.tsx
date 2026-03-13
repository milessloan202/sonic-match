import { Link } from "react-router-dom";
import type { RegistryDescriptor } from "@/hooks/useExploreData";

/** Human-friendly category labels */
const CATEGORY_LABELS: Record<string, string> = {
  emotional_tone: "Emotion",
  energy_posture: "Energy",
  groove_character: "Groove",
  texture: "Texture",
  spatial_feel: "Space",
  era_movement: "Era / Movement",
  era_period: "Era",
  environment_imagery: "Atmosphere",
  listener_use_case: "Use Case",
  drum_character: "Drums",
  bass_character: "Bass",
  harmonic_color: "Harmony",
  melodic_character: "Melody",
  vocal_character: "Vocals",
  arrangement_energy_arc: "Arrangement",
};

interface Props {
  grouped: Record<string, RegistryDescriptor[]>;
}

export default function SoundDirectory({ grouped }: Props) {
  const categories = Object.keys(grouped).sort((a, b) =>
    (CATEGORY_LABELS[a] ?? a).localeCompare(CATEGORY_LABELS[b] ?? b)
  );

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-foreground tracking-wide uppercase">
        Browse sounds
      </h2>
      {categories.map((cat) => (
        <div key={cat} className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            {CATEGORY_LABELS[cat] ?? cat.replace(/_/g, " ")}
          </p>
          <div className="flex flex-col gap-0.5">
            {grouped[cat].map((d) => (
              <Link
                key={d.slug}
                to={`/sounds/${d.slug}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors py-0.5 pl-1"
              >
                {d.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
