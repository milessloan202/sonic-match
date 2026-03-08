import { Link } from "react-router-dom";
import { useMemo, Fragment } from "react";

const toSlug = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

interface LinkedSummaryProps {
  text: string;
  artistNames: string[];
}

/**
 * Renders summary text with recognized artist names as internal links.
 * Only links names present in the page's related_artists data.
 */
const LinkedSummary = ({ text, artistNames }: LinkedSummaryProps) => {
  const segments = useMemo(() => {
    if (!artistNames.length) return [{ type: "text" as const, value: text }];

    // Sort by length descending so longer names match first (e.g. "Joe Budden" before "Joe")
    const sorted = [...artistNames].sort((a, b) => b.length - a.length);
    // Escape regex special chars
    const escaped = sorted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp(`(${escaped.join("|")})`, "gi");

    const parts: { type: "text" | "artist"; value: string }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
      }
      parts.push({ type: "artist", value: match[1] });
      lastIndex = pattern.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push({ type: "text", value: text.slice(lastIndex) });
    }
    return parts;
  }, [text, artistNames]);

  return (
    <p className="text-muted-foreground">
      {segments.map((seg, i) =>
        seg.type === "artist" ? (
          <Link
            key={i}
            to={`/artists-like/${toSlug(seg.value)}`}
            className="text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
          >
            {seg.value}
          </Link>
        ) : (
          <Fragment key={i}>{seg.value}</Fragment>
        )
      )}
    </p>
  );
};

export default LinkedSummary;
