import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

interface MapNode {
  id: string;
  label: string;
  subtitle?: string;
  category: string;
  linkTo: string;
  color: string;
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

const toSlug = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const CATEGORY_COLORS: Record<string, string> = {
  "Closest Matches": "hsl(200, 80%, 60%)",
  "Same Energy": "hsl(280, 70%, 65%)",
  "Related Artists": "hsl(340, 70%, 60%)",
  "Related Vibes": "hsl(160, 60%, 50%)",
};

const CATEGORY_LINK_PREFIX: Record<string, string> = {
  "Closest Matches": "",  // set dynamically
  "Same Energy": "",
  "Related Artists": "/artists-like",
  "Related Vibes": "/vibes",
};

function buildNodes(
  props: MusicMapProps
): MapNode[] {
  const nodes: MapNode[] = [];
  const linkPrefix =
    props.pageType === "song"
      ? "/songs-like"
      : props.pageType === "artist"
      ? "/artists-like"
      : props.pageType === "producer"
      ? "/producers-like"
      : "/vibes";

  const add = (items: { title: string; subtitle?: string }[] | undefined, category: string, prefix: string) => {
    (items || []).slice(0, 6).forEach((item) => {
      nodes.push({
        id: `${category}-${item.title}`,
        label: item.title,
        subtitle: item.subtitle,
        category,
        linkTo: `${prefix}/${toSlug(item.title)}`,
        color: CATEGORY_COLORS[category] || "hsl(0, 0%, 60%)",
      });
    });
  };

  add(props.closestMatches, "Closest Matches", linkPrefix);
  add(props.sameEnergy, "Same Energy", linkPrefix);
  add(props.relatedArtists, "Related Artists", "/artists-like");

  // Related vibes have a different shape: { name, slug }
  (props.relatedVibes || []).slice(0, 6).forEach((item) => {
    nodes.push({
      id: `Related Vibes-${item.name}`,
      label: item.name,
      subtitle: undefined,
      category: "Related Vibes",
      linkTo: `/vibes/${item.slug}`,
      color: CATEGORY_COLORS["Related Vibes"] || "hsl(0, 0%, 60%)",
    });
  });

  return nodes;
}

const MusicMap = (props: MusicMapProps) => {
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const nodes = useMemo(() => buildNodes(props), [props]);

  // Layout: center node + radial placement
  const WIDTH = 700;
  const HEIGHT = 500;
  const CX = WIDTH / 2;
  const CY = HEIGHT / 2;
  const RADIUS = 180;

  const positioned = useMemo(() => {
    const total = nodes.length;
    if (total === 0) return [];
    return nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / total - Math.PI / 2;
      // Add slight randomness for organic feel
      const r = RADIUS + (i % 3 - 1) * 15;
      return {
        ...node,
        x: CX + r * Math.cos(angle),
        y: CY + r * Math.sin(angle),
      };
    });
  }, [nodes, CX, CY]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 60,
      });
    },
    []
  );

  const hoveredNode = positioned.find((n) => n.id === hoveredId);

  // Unique categories for legend
  const categories = useMemo(() => {
    const seen = new Set<string>();
    return nodes
      .filter((n) => {
        if (seen.has(n.category)) return false;
        seen.add(n.category);
        return true;
      })
      .map((n) => ({ label: n.category, color: n.color }));
  }, [nodes]);

  // Floating animation offsets
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(interval);
  }, []);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No data to visualize
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {categories.map((cat) => (
          <div key={cat.label} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: cat.color }}
            />
            <span className="text-muted-foreground">{cat.label}</span>
          </div>
        ))}
      </div>

      {/* SVG Map */}
      <div className="relative w-full overflow-hidden rounded-xl border border-border bg-card/50">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto"
          style={{ maxHeight: "500px" }}
          onMouseMove={handleMouseMove}
        >
          {/* Connection lines */}
          {positioned.map((node) => (
            <motion.line
              key={`line-${node.id}`}
              x1={CX}
              y1={CY}
              x2={node.x}
              y2={node.y}
              stroke={hoveredId === node.id ? node.color : "hsl(0, 0%, 25%)"}
              strokeWidth={hoveredId === node.id ? 1.5 : 0.5}
              strokeOpacity={hoveredId === node.id ? 0.8 : 0.3}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            />
          ))}

          {/* Outer nodes */}
          {positioned.map((node, i) => {
            const isHovered = hoveredId === node.id;
            // Subtle float offset
            const floatY = Math.sin((tick + i) * 0.5) * 3;
            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onClick={() => navigate(node.linkTo)}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <motion.circle
                  cx={node.x}
                  cy={node.y + floatY}
                  r={isHovered ? 26 : 22}
                  fill={isHovered ? node.color : "hsl(0, 0%, 12%)"}
                  stroke={node.color}
                  strokeWidth={isHovered ? 2 : 1}
                  strokeOpacity={isHovered ? 1 : 0.5}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                />
                <motion.text
                  x={node.x}
                  y={node.y + floatY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isHovered ? "hsl(0, 0%, 4%)" : "hsl(0, 0%, 85%)"}
                  fontSize="7"
                  fontFamily="var(--font-display)"
                  fontWeight={isHovered ? 600 : 400}
                  className="pointer-events-none select-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 + 0.1 }}
                >
                  {node.label.length > 14
                    ? node.label.slice(0, 13) + "…"
                    : node.label}
                </motion.text>
              </g>
            );
          })}

          {/* Center node */}
          <motion.circle
            cx={CX}
            cy={CY}
            r={34}
            fill="hsl(0, 0%, 100%)"
            stroke="hsl(0, 0%, 100%)"
            strokeWidth={2}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          />
          <text
            x={CX}
            y={CY - 4}
            textAnchor="middle"
            dominantBaseline="central"
            fill="hsl(0, 0%, 4%)"
            fontSize="8"
            fontFamily="var(--font-display)"
            fontWeight={600}
            className="pointer-events-none select-none"
          >
            {props.centerLabel.length > 16
              ? props.centerLabel.slice(0, 15) + "…"
              : props.centerLabel}
          </text>
          {props.centerSubtitle && (
            <text
              x={CX}
              y={CY + 10}
              textAnchor="middle"
              dominantBaseline="central"
              fill="hsl(0, 0%, 50%)"
              fontSize="6"
              fontFamily="var(--font-display)"
              className="pointer-events-none select-none"
            >
              {props.centerSubtitle.length > 20
                ? props.centerSubtitle.slice(0, 19) + "…"
                : props.centerSubtitle}
            </text>
          )}
        </svg>

        {/* Tooltip overlay */}
        <AnimatePresence>
          {hoveredNode && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute pointer-events-none z-10 px-3 py-2 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg text-xs max-w-[200px]"
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
              <p className="mt-1" style={{ color: hoveredNode.color }}>
                {hoveredNode.category}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MusicMap;
