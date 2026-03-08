/**
 * Animated SVG crate-digger character.
 * Pure CSS keyframes — no external assets, ~2KB.
 * Respects prefers-reduced-motion automatically via the media query.
 */
const CrateDigger = ({ size = 80 }: { size?: number }) => (
  <div className="shrink-0" style={{ width: size, height: size }}>
    <style>{`
      @keyframes cd-arm {
        0%, 100% { transform: rotate(-12deg); }
        25% { transform: rotate(8deg); }
        50% { transform: rotate(-5deg); }
        75% { transform: rotate(12deg); }
      }
      @keyframes cd-record-1 {
        0%, 100% { transform: translateY(0); }
        30%, 50% { transform: translateY(-6px); }
      }
      @keyframes cd-record-2 {
        0%, 100% { transform: translateY(0); }
        60%, 80% { transform: translateY(-8px); }
      }
      @keyframes cd-record-3 {
        0%, 100% { transform: translateY(0); }
        45%, 65% { transform: translateY(-5px); }
      }
      @keyframes cd-head-bob {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-1.5px); }
      }
      @keyframes cd-body-sway {
        0%, 100% { transform: rotate(0deg); }
        30% { transform: rotate(-2deg); }
        70% { transform: rotate(1.5deg); }
      }
      .cd-arm { animation: cd-arm 2.4s ease-in-out infinite; transform-origin: 52px 32px; }
      .cd-record-1 { animation: cd-record-1 2.4s ease-in-out infinite; }
      .cd-record-2 { animation: cd-record-2 2.4s ease-in-out 0.3s infinite; }
      .cd-record-3 { animation: cd-record-3 2.4s ease-in-out 0.6s infinite; }
      .cd-head { animation: cd-head-bob 2.4s ease-in-out infinite; }
      .cd-body { animation: cd-body-sway 2.4s ease-in-out infinite; transform-origin: 42px 55px; }
      @media (prefers-reduced-motion: reduce) {
        .cd-arm, .cd-record-1, .cd-record-2, .cd-record-3, .cd-head, .cd-body {
          animation: none !important;
        }
      }
    `}</style>
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Character digging through record crates"
      width={size}
      height={size}
    >
      {/* Crate */}
      <rect x="10" y="48" width="36" height="26" rx="2" className="fill-muted stroke-muted-foreground" strokeWidth="1.5" />
      {/* Crate slats */}
      <line x1="10" y1="57" x2="46" y2="57" className="stroke-muted-foreground/40" strokeWidth="1" />
      <line x1="10" y1="66" x2="46" y2="66" className="stroke-muted-foreground/40" strokeWidth="1" />

      {/* Records in crate */}
      <g className="cd-record-1">
        <rect x="15" y="50" width="2" height="20" rx="0.5" className="fill-foreground/70" />
      </g>
      <g className="cd-record-2">
        <rect x="20" y="50" width="2" height="20" rx="0.5" className="fill-primary/80" />
      </g>
      <g className="cd-record-3">
        <rect x="25" y="50" width="2" height="20" rx="0.5" className="fill-foreground/50" />
      </g>
      <rect x="30" y="51" width="2" height="19" rx="0.5" className="fill-muted-foreground/40" />
      <rect x="35" y="51" width="2" height="19" rx="0.5" className="fill-muted-foreground/30" />
      <rect x="40" y="51" width="2" height="19" rx="0.5" className="fill-muted-foreground/20" />

      {/* Character body */}
      <g className="cd-body">
        {/* Torso */}
        <rect x="48" y="36" width="14" height="20" rx="4" className="fill-primary/80" />
        {/* Legs */}
        <rect x="49" y="54" width="5" height="14" rx="2" className="fill-muted-foreground/60" />
        <rect x="56" y="54" width="5" height="14" rx="2" className="fill-muted-foreground/60" />
        {/* Shoes */}
        <ellipse cx="51" cy="69" rx="4" ry="2.5" className="fill-foreground/70" />
        <ellipse cx="59" cy="69" rx="4" ry="2.5" className="fill-foreground/70" />
      </g>

      {/* Head */}
      <g className="cd-head">
        <circle cx="55" cy="28" r="9" className="fill-muted-foreground/80" />
        {/* Headphones band */}
        <path d="M46 26 Q55 16 64 26" className="stroke-primary" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Headphone pads */}
        <ellipse cx="46" cy="28" rx="3" ry="4" className="fill-primary" />
        <ellipse cx="64" cy="28" rx="3" ry="4" className="fill-primary" />
        {/* Eye */}
        <circle cx="58" cy="27" r="1.2" className="fill-background" />
      </g>

      {/* Arm reaching into crate */}
      <g className="cd-arm">
        <path
          d="M50 38 Q42 35 30 42"
          className="stroke-muted-foreground/80"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        {/* Hand */}
        <circle cx="30" cy="42" r="3" className="fill-muted-foreground/80" />
      </g>
    </svg>
  </div>
);

export default CrateDigger;
