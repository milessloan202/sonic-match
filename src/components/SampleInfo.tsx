import { motion } from "framer-motion";
import { Disc3 } from "lucide-react";
import type { SampleData } from "@/hooks/useSampleData";

interface SampleInfoProps {
  sample: SampleData;
}

const SampleInfo = ({ sample }: SampleInfoProps) => {
  const mbUrl = sample.sampled_recording_id
    ? `https://musicbrainz.org/recording/${sample.sampled_recording_id}`
    : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-5 space-y-2"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Disc3 className="w-4 h-4" />
        Contains a sample of
      </div>
      <p className="text-foreground font-semibold">
        {mbUrl ? (
          <a
            href={mbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 decoration-muted-foreground/40 hover:decoration-foreground transition-colors"
          >
            {sample.sampled_song_title}
          </a>
        ) : (
          sample.sampled_song_title
        )}{" "}
        <span className="font-normal text-muted-foreground">— {sample.sampled_artist_name}</span>
      </p>
      <p className="text-xs text-muted-foreground">Source: MusicBrainz</p>
    </motion.section>
  );
};

export default SampleInfo;
