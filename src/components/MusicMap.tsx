import { useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MapNode {
  id: string;
  label: string;
  subtitle?: string;
  category: string;
  linkTo: string;
  color: string;
  shape: "circle" | "rect"; // artists → circle, songs/vibes → rect
}

interface RelatedLink {
  name: string;
  slug: string;
}

interface MusicMapProps {
  centerLabel: string;
  centerSubtitle?: string;
  closestMatches?: { title: string; subtitle?: string }[];
  sameEnergy?: { title: string; subtitle?: string }[];
  relatedArtists?: { title: string; subtitle?: string }[];
  relatedVibes?: RelatedLink[];
  pageType: "song" | "artist" | "producer" | "vibe";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  "Closest Matches": "hsl(200, 80%, 60%)",
  "Same Energy":     "hsl(280, 70%, 65%)",
  "Related Artists": "hsl(340, 70%, 60%)",
  "Related Vibes":   "hsl(160, 60%, 50%)",
};

const PAGE_TYPE_LABEL: Record<string, string> = {
  song:     "SONG",
  artist:   "ARTIST",
  producer: "PRODUCER",
  vibe:     "VIBE",
};

const ALL_FILTER = "All";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toSlug = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function extractArtist(subtitle?: string): string {
  if (!subtitle) return "";
  return subtitle.replace(/\s*\(\d{4}\)\s*$/, "").trim();
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function buildNodes(props: MusicMapProps): MapNode[] {
  const nodes: MapNode[] = [];

  const addSongs = (
    items: { title: string; subtitle?: string }[] | undefined,
    category: string,
  ) => {
    (items || []).slice(0, 6).forEach((item) => {
      const artist = extractArtist(item.subtitle);
      const slug = artist
        ? `${toSlug(item.title)}-${toSlug(artist)}`
        : toSlug(item.title);
      nodes.push({
        id: `${category}-${item.title}-${artist}`,
        label: item.title,
        subtitle: item.subtitle,
        category,
        linkTo: `/songs-like/${slug}`,
        color: CATEGORY_COLORS[category] || "hsl(0, 0%, 60%)",
        shape: "rect",
      });
    });
  };

  const addArtists = (
    items: { title: string; subtitle?: string }[] | undefined,
    category: string,
    prefix: string,
  ) => {
    (items || []).slice(0, 6).forEach((item) => {
      nodes.push({
        id: `${category}-${item.title}`,
        label: item.title,
        subtitle: item.subtitle,
        category,
        linkTo: `${prefix}/${toSlug(item.title)}`,
        color: CATEGORY_COLORS[category] || "hsl(0, 0%, 60%)",
        shape: "circle",
      });
    });
  };

  addSongs(props.closestMatches, "Closest Matches");
  addSongs(props.sameEnergy, "Same Energy");
  addArtists(props.relatedArtists, "Related Artists", "/artists-like");

  (props.relatedVibes || []).slice(0, 6).forEach((item) => {
    nodes.push({
      id: `Related Vibes-${item.name}`,
      label: item.name,
      subtitle: undefined,
      category: "Related Vibes",
      linkTo: `/vibes/${item.slug}`,
      color: CATEGORY_COLORS["Related Vibes"] || "hsl(0, 0%, 60%)",
      shape: "rect",
    });
  });

  return nodes;
}

// ─── NodeShape ────────────────────────────────────────────────────────────────

interface NodeShapeProps {
  x: number;
  y: number;
  r: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  shape: "circle" | "rect";
  index: number;
}

const NodeShape = ({
  x, y, r, fill, stroke, strokeWidth, strokeOpacity, shape, index,
}: NodeShapeProps) => {
  const common = { fill, stroke, strokeWidth, strokeOpacity };
  const anim = {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { delay: index * 0.04, duration: 0.3 },
    style: { transformOrigin: `${x}px ${y}px` },
  };

  if (shape === "rect") {
    const w = r * 2.2;
    const h = r * 1.6;
    return (
      <motion.rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={6}
        {...common}
        {...anim}
      />
    );
  }
  return (
    <motion.circle
      cx={x}
      cy={y}
      r={r}
      {...common}
      {...anim}
    />
  );
};

// ─── MusicMap ─────────────────────────────────────────────────────────────────

const MusicMap = (props: MusicMapProps) => {
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>(ALL_FILTER);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const allNodes = useMemo(() => buildNodes(props), [props]);

  const visibleIds = useMemo(() => {
    if (activeFilter === ALL_FILTER) return new Set(allNodes.map((n) => n.id));
    return new Set(allNodes.filter((n) => n.category === activeFilter).map((n) => n.id));
  }, [allNodes, activeFilter]);

  const WIDTH = 720;
  const HEIGHT = 520;
  const CX = WIDTH / 2;
  const CY = HEIGHT / 2;
  const RADIUS = 200;
  const NODE_R = 28;

  const positioned = useMemo(() => {
    const total = allNodes.length;
    if (total === 0) return [];
    return allNodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / total - Math.PI / 2;
      const r = RADIUS + (i % 3 === 0 ? -18 : i % 3 === 1 ? 0 : 18);
      return {
        ...node,
        x: CX + r * Math.cos(angle),
        y: CY + r * Math.sin(angle),
        floatDelay: i * 0.3,
      };
    });
  }, [allNodes, CX, CY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 64,
    });
  }, []);

  const hoveredNode = positioned.find((n) => n.id === hoveredId);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    return allNodes
      .filter((n) => {
        if (seen.has(n.category)) return false;
        seen.add(n.category);
        return true;
      })
      .map((n) => ({ label: n.category, color: n.color }));
  }, [allNodes]);

  if (allNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No data to visualize
      </div>
    );
  }

  const centerTypeLabel = PAGE_TYPE_LABEL[props.pageType] || "";

  return (
    <div className="space-y-3">

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => setActiveFilter(ALL_FILTER)}
          className={`px-3 py-1 rounded-full border transition-colors ${
            activeFilter === ALL_FILTER
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.label}
            onClick={() =>
              setActiveFilter(activeFilter === cat.label ? ALL_FILTER : cat.label)
            }
            className={`px-3 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${
              activeFilter === cat.label
                ? "border-transparent text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            style={
              activeFilter === cat.label
                ? { backgroundColor: cat.color, borderColor: cat.color }
                : {}
            }
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: cat.color }}
            />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Shape legend */}
      <div className="flex items-center gap-5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <svg width="14" height="10" viewBox="0 0 14 10">
            <rect x="0" y="0" width="14" height="10" rx="2" fill="hsl(0,0%,40%)" />
          </svg>
          Songs / Vibes
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 11 11">
            <circle cx="5.5" cy="5.5" r="5" fill="hsl(0,0%,40%)" />
          </svg>
          Artists
        </div>
      </div>

      {/* SVG map */}
      <div className="relative w-full overflow-hidden rounded-xl border border-border bg-card/50">
        {/* Pure CSS float animations — no JS timers or re-renders */}
        <style>{`
          @keyframes map-float-0 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
          @keyframes map-float-1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
          @keyframes map-float-2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
          .map-float-0 { animation: map-float-0 4.2s ease-in-out infinite; }
          .map-float-1 { animation: map-float-1 5.1s ease-in-out infinite; }
          .map-float-2 { animation: map-float-2 6.0s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) {
            .map-float-0, .map-float-1, .map-float-2 { animation: none !important; }
          }
        `}</style>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto"
          style={{ maxHeight: "520px" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredId(null)}
        >
          {/* Connection lines */}
          {positioned.map((node) => {
            const dimmed = !visibleIds.has(node.id);
            const isHovered = hoveredId === node.id;
            return (
              <motion.line
                key={`line-${node.id}`}
                x1={CX}
                y1={CY}
                x2={node.x}
                y2={node.y}
                stroke={isHovered ? node.color : "hsl(0, 0%, 25%)"}
                strokeWidth={isHovered ? 1.5 : 0.5}
                strokeOpacity={dimmed ? 0.07 : isHovered ? 0.9 : 0.35}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.15, duration: 0.5 }}
              />
            );
          })}

          {/* Outer nodes */}
          {positioned.map((node, i) => {
            const dimmed = !visibleIds.has(node.id);
            const isHovered = hoveredId === node.id;
            const floatClass = `map-float-${i % 3}`;
            const r = isHovered ? NODE_R + 4 : NODE_R;

            return (
              <g
                key={node.id}
                className={`cursor-pointer ${floatClass}`}
                style={{
                  animationDelay: `${node.floatDelay}s`,
                  opacity: dimmed ? 0.15 : 1,
                  transition: "opacity 0.2s ease",
                }}
                onClick={() => !dimmed && navigate(node.linkTo)}
                onMouseEnter={() => !dimmed && setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <NodeShape
                  x={node.x}
                  y={node.y}
                  r={r}
                  fill={isHovered ? node.color : "hsl(0, 0%, 10%)"}
                  stroke={node.color}
                  strokeWidth={isHovered ? 2 : 1}
                  strokeOpacity={isHovered ? 1 : 0.6}
                  shape={node.shape}
                  index={i}
                />
                <motion.text
                  x={node.x}
                  y={node.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isHovered ? "hsl(0, 0%, 4%)" : "hsl(0, 0%, 88%)"}
                  fontSize="8.5"
                  fontFamily="var(--font-display)"
                  fontWeight={isHovered ? 600 : 400}
                  className="pointer-events-none select-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 + 0.1 }}
                >
                  {truncate(node.label, 18)}
                </motion.text>
              </g>
            );
          })}

          {/* Center node */}
          <motion.circle
            cx={CX}
            cy={CY}
            r={40}
            fill="hsl(0, 0%, 100%)"
            stroke="hsl(0, 0%, 100%)"
            strokeWidth={2}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          />
          {/* Center: main label */}
          <text
            x={CX}
            y={CY - 7}
            textAnchor="middle"
            dominantBaseline="central"
            fill="hsl(0, 0%, 4%)"
            fontSize="8.5"
            fontFamily="var(--font-display)"
            fontWeight={700}
            className="pointer-events-none select-none"
          >
            {truncate(props.centerLabel, 17)}
          </text>
          {/* Center: page type badge */}
          <text
            x={CX}
            y={CY + 9}
            textAnchor="middle"
            dominantBaseline="central"
            fill="hsl(0, 0%, 42%)"
            fontSize="5.5"
            fontFamily="var(--font-display)"
            fontWeight={600}
            letterSpacing="0.1em"
            className="pointer-events-none select-none"
          >
            {centerTypeLabel}
          </text>
          {/* Center: optional subtitle */}
          {props.centerSubtitle && (
            <text
              x={CX}
              y={CY + 21}
              textAnchor="middle"
              dominantBaseline="central"
              fill="hsl(0, 0%, 45%)"
              fontSize="6"
              fontFamily="var(--font-display)"
              className="pointer-events-none select-none"
            >
              {truncate(props.centerSubtitle, 22)}
            </text>
          )}
        </svg>

        {/* Hover tooltip */}
        <AnimatePresence>
          {hoveredNode && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute pointer-events-none z-10 px-3 py-2 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg text-xs max-w-[220px]"
              style={{
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`,
                transform: "translateX(-50%)",
              }}
            >
              <p className="font-medium truncate">{hoveredNode.label}</p>
              {hoveredNode.subtitle && (
                <p className="text-muted-foreground mt-0.5 line-clamp-2">
                  {hoveredNode.subtitle}
                </p>
              )}
              <p className="mt-1 text-[10px] font-medium" style={{ color: hoveredNode.color }}>
                {hoveredNode.category}
              </p>
              <p className="text-muted-foreground/60 text-[10px] mt-0.5">Click to explore →</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MusicMap;
