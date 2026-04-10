/**
 * Build the two seamless pattern tiles (80×80) used as subtle background texture.
 * Output: brand/patterns/pattern-starburst-{gold,white}.svg
 *
 *   - GOLD tile: linen background, low-opacity gold + peach starburst (8 lines).
 *                Tiles over linen surfaces as warm texture.
 *   - WHITE tile: transparent background, low-opacity white starburst (4 lines).
 *                 Tiles over the brand gradient as faint sparkle.
 *
 * Both tiles place the starburst at the center of the 80×80 tile. The starburst
 * doesn't reach the tile edges, so when the pattern repeats the seam between
 * tiles is just background-color → background-color (fully seamless, no
 * edge-wrapping needed).
 *
 * Usage: node scripts/build-patterns.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { starburst } from './lib/starburst.mjs';

const OUT = resolve(import.meta.dirname, '../brand/patterns');
mkdirSync(OUT, { recursive: true });

const TILE = 80;
const CENTER = TILE / 2;
const STARBURST_RADIUS = 18;  // total span ~36px = 45% of tile

// ============================================
// GOLD TILE — full 8-line starburst on linen
// ============================================
function buildGoldPattern() {
  const burst = starburst({
    size: STARBURST_RADIUS,
    tier: 8,
    color: '#d4a930',         // axes + diagonals (gold)
    secondary: '#e8a040',     // tertiary (peach soft)
    center: '#ff9050',        // dot (peach)
    axisW: 1.1,
    diagW: 0.8,
    terW: 0.5,
    dotR: 1.8,
    axisOpacity: 0.28,
    diagOpacity: 0.20,
    terOpacity: 0.14,
    centerOpacity: 0.40,
  });

  return `<svg width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${TILE}" height="${TILE}" fill="#faf6ef"/>
  <g transform="translate(${CENTER},${CENTER})">
    ${burst}
  </g>
</svg>`;
}

// ============================================
// WHITE TILE — simplified 4-line starburst on transparent
// ============================================
function buildWhitePattern() {
  const burst = starburst({
    size: STARBURST_RADIUS,
    tier: 4,                   // axes + diagonals only (no tertiary)
    color: '#ffffff',
    center: '#ffffff',
    axisW: 1.1,
    diagW: 0.8,
    dotR: 1.8,
    axisOpacity: 0.22,
    diagOpacity: 0.15,
    centerOpacity: 0.32,
  });

  return `<svg width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${CENTER},${CENTER})">
    ${burst}
  </g>
</svg>`;
}

// ============================================
// BUILD
// ============================================
console.log('Building pattern tiles...');

writeFileSync(`${OUT}/pattern-starburst-gold.svg`, buildGoldPattern() + '\n');
console.log('  ✓ pattern-starburst-gold.svg');

writeFileSync(`${OUT}/pattern-starburst-white.svg`, buildWhitePattern() + '\n');
console.log('  ✓ pattern-starburst-white.svg');

console.log('\nDone.');
