import { Link } from "react-router-dom";
import { useMemo, Fragment } from "react";

const toSlug = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const clean = (arr: string[]) =>
  arr.filter((n): n is string => typeof n === "string" && n.length > 0);

interface LinkedSummaryProps {
  text: string;
  artistNames?: string[];
  vibeNames?: string[];
  /** Max number of links to render (default 4) */
  maxLinks?: number;
}

type Segment =
  | { type: "text"; value: string }
  | { type: "artist"; value: string }
  | { type: "vibe"; value: string };

/**
 * Renders summary text with recognized artist names and vibe/style phrases
 * as internal navigation links. Only links names present in page data.
 * Caps total links to maxLinks (default 4) for readability.
 */
const LinkedSummary = ({
  text,
  artistNames = [],
  vibeNames = [],
  maxLinks = 4,
}: LinkedSummaryProps) => {
  const segments = useMemo((): Segment[] => {
    // Build combined lookup: label → { type, slug }
    const lookup = new Map<string, { type: "artist" | "vibe"; label: string }>();

    // Vibes first (longer phrases get priority via sort)
    for (const v of clean(vibeNames)) {
      lookup.set(v.toLowerCase(), { type: "vibe", label: v });
    }
    // Artists
    for (const a of clean(artistNames)) {
      lookup.set(a.toLowerCase(), { type: "artist", label: a });
    }

    if (lookup.size === 0) return [{ type: "text", value: text }];

    // Sort longest first so multi-word phrases match before single words
    const terms = [...lookup.keys()].sort((a, b) => b.length - a.length);
    const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp(`(${escaped.join("|")})`, "gi");

    const parts: Segment[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
      }
      const entry = lookup.get(match[1].toLowerCase());
      if (entry) {
        parts.push({ type: entry.type, value: match[1] });
      } else {
        parts.push({ type: "text", value: match[1] });
      }
      lastIndex = pattern.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push({ type: "text", value: text.slice(lastIndex) });
    }
    return parts;
  }, [text, artistNames, vibeNames]);

  // Enforce maxLinks cap: demote excess links to plain text
  let linkCount = 0;
  const capped: Segment[] = segments.map((seg) => {
    if (seg.type !== "text") {
      if (linkCount < maxLinks) {
        linkCount++;
        return seg;
      }
      return { type: "text", value: seg.value };
    }
    return seg;
  });

  return (
    <p className="text-muted-foreground">
      {capped.map((seg, i) => {
        if (seg.type === "artist") {
          return (
            <Link
              key={i}
              to={`/artists-like/${toSlug(seg.value)}`}
              className="text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
            >
              {seg.value}
            </Link>
          );
        }
        if (seg.type === "vibe") {
          return (
            <Link
              key={i}
              to={`/vibes/${toSlug(seg.value)}`}
              className="text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
            >
              {seg.value}
            </Link>
          );
        }
        return <Fragment key={i}>{seg.value}</Fragment>;
      })}
    </p>
  );
};

export default LinkedSummary;
