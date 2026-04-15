/**
 * Starburst — inline SVG starburst with degradation tiers.
 *
 * Mirrors scripts/lib/starburst.mjs so the visual is consistent with the
 * production logos. Server component, no client-side JS.
 *
 * Tiers:
 *   8 — full: 2 axes + 2 diagonals + 4 tertiary lines
 *   6 — drop the near-horizontal tertiary pair: 2 axes + 2 diagonals + 2 tertiary
 *   4 — minimal: 2 axes + 2 diagonals
 *   1 — center dot only (used at very small sizes)
 */

type Tier = 1 | 4 | 6 | 8;

interface StarburstProps {
  /** Half the bounding box (radius). Default: 14 */
  size?: number;
  /** Number of lines. Default: 8 */
  tier?: Tier;
  /** Primary stroke color (axes + diagonals) */
  color?: string;
  /** Tertiary stroke color (the "neon bleed") */
  secondary?: string;
  /** Center dot fill */
  center?: string;
  /** 0–1, default 0.9 */
  axisOpacity?: number;
  /** 0–1, default 0.65 */
  diagOpacity?: number;
  /** 0–1, default 0.4 */
  terOpacity?: number;
  /** 0–1, default 1 */
  centerOpacity?: number;
  className?: string;
  /** Inline style passthrough (for absolute positioning, animations, etc.) */
  style?: React.CSSProperties;
}

export function Starburst({
  size = 14,
  tier = 8,
  color = "#d4a930",
  secondary = "#e8a040",
  center = "#ff9050",
  axisOpacity = 0.9,
  diagOpacity = 0.65,
  terOpacity = 0.4,
  centerOpacity = 1,
  className,
  style,
}: StarburstProps) {
  // Derived stroke widths — ratios match the existing monogram twinkle
  const axisW = size * 0.12;
  const diagW = axisW * (1.1 / 1.8);
  const terW = axisW * (0.6 / 1.8);
  const diag = size * 0.7;
  const tertOffset = size * (4 / 15);
  const tertLength = size * (14.5 / 15);
  const dotR = size * (2.8 / 15);
  const view = size * 2;

  return (
    <svg
      width={view}
      height={view}
      viewBox={`${-size} ${-size} ${view} ${view}`}
      className={className}
      style={style}
      aria-hidden="true"
    >
      {tier !== 1 && (
        <>
          {/* Axes */}
          <line x1="0" y1={-size} x2="0" y2={size} stroke={color} strokeWidth={axisW} opacity={axisOpacity} />
          <line x1={-size} y1="0" x2={size} y2="0" stroke={color} strokeWidth={axisW} opacity={axisOpacity} />
          {/* Diagonals */}
          <line x1={-diag} y1={-diag} x2={diag} y2={diag} stroke={color} strokeWidth={diagW} opacity={diagOpacity} />
          <line x1={diag} y1={-diag} x2={-diag} y2={diag} stroke={color} strokeWidth={diagW} opacity={diagOpacity} />
          {/* Tertiary near-vertical pair (kept in tier 6 and 8) */}
          {tier >= 6 && (
            <>
              <line x1={-tertOffset} y1={-tertLength} x2={tertOffset} y2={tertLength} stroke={secondary} strokeWidth={terW} opacity={terOpacity} />
              <line x1={tertOffset} y1={-tertLength} x2={-tertOffset} y2={tertLength} stroke={secondary} strokeWidth={terW} opacity={terOpacity} />
            </>
          )}
          {/* Tertiary near-horizontal pair (only in full tier 8) */}
          {tier === 8 && (
            <>
              <line x1={-tertLength} y1={-tertOffset} x2={tertLength} y2={tertOffset} stroke={secondary} strokeWidth={terW} opacity={terOpacity} />
              <line x1={-tertLength} y1={tertOffset} x2={tertLength} y2={-tertOffset} stroke={secondary} strokeWidth={terW} opacity={terOpacity} />
            </>
          )}
        </>
      )}
      <circle cx="0" cy="0" r={dotR} fill={center} opacity={centerOpacity} />
    </svg>
  );
}
