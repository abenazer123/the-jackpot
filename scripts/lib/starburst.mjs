/**
 * Renders a starburst as SVG markup, centered at (0,0).
 * Caller wraps in <g transform="translate(x,y)"> to position it.
 *
 * Tiers (graceful degradation for shrinking sizes):
 *   8 — full: 2 axes + 2 diagonals + 4 tertiary lines
 *   6 — drop the near-horizontal tertiary pair: 2 axes + 2 diagonals + 2 tertiary
 *   4 — minimal: 2 axes + 2 diagonals
 *   1 — center dot only (used at favicon-16 size)
 *
 * Geometry derives from the existing monogram twinkle so size=15 produces
 * visually-identical output to the original monogram-jtwinkle SVGs.
 *
 * @param {object} opts
 * @param {number} opts.size            radius (half the bounding box)
 * @param {1|4|6|8} [opts.tier=8]
 * @param {string} [opts.color]         primary stroke color (axes, diagonals)
 * @param {string} [opts.secondary]     tertiary stroke color (the "neon bleed")
 * @param {string} [opts.center]        center dot fill color
 * @param {number} [opts.axisOpacity]   default 0.9
 * @param {number} [opts.diagOpacity]   default 0.65
 * @param {number} [opts.terOpacity]    default 0.4
 * @param {number} [opts.centerOpacity] dot opacity (default 1 — fully opaque)
 * @param {number} [opts.axisW]         override the auto-calculated axis stroke width
 * @param {number} [opts.diagW]         override the auto-calculated diagonal stroke width
 * @param {number} [opts.terW]          override the auto-calculated tertiary stroke width
 * @param {number} [opts.dotR]          override the auto-calculated dot radius
 */
export function starburst({
  size,
  tier = 8,
  color = '#d4a930',
  secondary = '#e8a040',
  center = '#ff9050',
  axisOpacity = 0.9,
  diagOpacity = 0.65,
  terOpacity = 0.4,
  centerOpacity = 1,
  axisW: axisWOverride,
  diagW: diagWOverride,
  terW: terWOverride,
  dotR,
}) {
  // Derived stroke widths — ratios match the existing monogram twinkle
  const axisW = axisWOverride ?? size * 0.12;            // 1.8 at size=15
  const diagW = diagWOverride ?? axisW * (1.1 / 1.8);    // 1.1 at size=15
  const terW  = terWOverride  ?? axisW * (0.6 / 1.8);    // 0.6 at size=15

  const diag = size * 0.7;              // 10.5 at size=15
  const tertOffset = size * (4 / 15);   // 4   at size=15
  const tertLength = size * (14.5 / 15);// 14.5 at size=15
  const r = dotR ?? size * (2.8 / 15);  // 2.8 at size=15

  const dotOpacityAttr = centerOpacity === 1 ? '' : ` opacity="${centerOpacity}"`;

  if (tier === 1) {
    return `<circle cx="0" cy="0" r="${fmt(r)}" fill="${center}"${dotOpacityAttr}/>`;
  }

  const lines = [];

  // Axes
  lines.push(`<line x1="0" y1="${fmt(-size)}" x2="0" y2="${fmt(size)}" stroke="${color}" stroke-width="${fmt(axisW)}" opacity="${axisOpacity}"/>`);
  lines.push(`<line x1="${fmt(-size)}" y1="0" x2="${fmt(size)}" y2="0" stroke="${color}" stroke-width="${fmt(axisW)}" opacity="${axisOpacity}"/>`);

  // Diagonals
  lines.push(`<line x1="${fmt(-diag)}" y1="${fmt(-diag)}" x2="${fmt(diag)}" y2="${fmt(diag)}" stroke="${color}" stroke-width="${fmt(diagW)}" opacity="${diagOpacity}"/>`);
  lines.push(`<line x1="${fmt(diag)}" y1="${fmt(-diag)}" x2="${fmt(-diag)}" y2="${fmt(diag)}" stroke="${color}" stroke-width="${fmt(diagW)}" opacity="${diagOpacity}"/>`);

  // Tertiary near-vertical pair (kept in tier 6 and 8)
  if (tier >= 6) {
    lines.push(`<line x1="${fmt(-tertOffset)}" y1="${fmt(-tertLength)}" x2="${fmt(tertOffset)}" y2="${fmt(tertLength)}" stroke="${secondary}" stroke-width="${fmt(terW)}" opacity="${terOpacity}"/>`);
    lines.push(`<line x1="${fmt(tertOffset)}" y1="${fmt(-tertLength)}" x2="${fmt(-tertOffset)}" y2="${fmt(tertLength)}" stroke="${secondary}" stroke-width="${fmt(terW)}" opacity="${terOpacity}"/>`);
  }

  // Tertiary near-horizontal pair (only in full tier 8)
  if (tier === 8) {
    lines.push(`<line x1="${fmt(-tertLength)}" y1="${fmt(-tertOffset)}" x2="${fmt(tertLength)}" y2="${fmt(tertOffset)}" stroke="${secondary}" stroke-width="${fmt(terW)}" opacity="${terOpacity}"/>`);
    lines.push(`<line x1="${fmt(-tertLength)}" y1="${fmt(tertOffset)}" x2="${fmt(tertLength)}" y2="${fmt(-tertOffset)}" stroke="${secondary}" stroke-width="${fmt(terW)}" opacity="${terOpacity}"/>`);
  }

  // Center dot
  lines.push(`<circle cx="0" cy="0" r="${fmt(r)}" fill="${center}"${dotOpacityAttr}/>`);

  return lines.join('\n    ');
}

// Trim trailing zeros to keep SVGs compact
function fmt(n) {
  return Number(n.toFixed(3)).toString();
}
