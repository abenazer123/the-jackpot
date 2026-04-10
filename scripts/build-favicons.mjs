/**
 * Build the 5 favicon SVGs and PNGs, plus the multi-resolution favicon.ico.
 * Output: brand/favicons/favicon-{16,32,180,192,512}.{svg,png} + favicon.ico
 *
 * Each favicon is a deliberate redesign for its size, not a mechanical resize:
 *   - 512: full 8-line twinkle, large dot
 *   - 192: 6-line twinkle (drops near-horizontal tertiary pair)
 *   - 180: 6-line twinkle (Apple touch icon)
 *   - 32:  4-line minimal twinkle (axes + diagonals only), thicker strokes
 *   - 16:  J + a single dot where the twinkle would be (intentional degradation)
 *
 * Usage: node scripts/build-favicons.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { fonts } from './lib/fonts.mjs';
import { textToPathD } from './lib/text.mjs';
import { starburst } from './lib/starburst.mjs';

const OUTPUT_DIR = resolve(import.meta.dirname, '../brand/favicons');
mkdirSync(OUTPUT_DIR, { recursive: true });

// ============================================
// CONFIG
// ============================================

// opticalShift: pixels to shift the J UP from math-centered. Small values give a
// gentle nudge so the descender doesn't feel cramped while the J+twinkle as a
// combined mass still feels optically centered in the canvas.
const FAVICONS = [
  { size: 512, jSize: 360, rx: 96, tier: 8, opticalShift: 5 },
  { size: 192, jSize: 140, rx: 38, tier: 6, opticalShift: 2 },
  { size: 180, jSize: 132, rx: 36, tier: 6, opticalShift: 2 },
  { size: 32,  jSize: 26,  rx: 6,  tier: 4, opticalShift: 0, twinkleStrokeOverrides: { axisW: 1.4, diagW: 0.9 } },
  { size: 16,  jSize: 14,  rx: 3,  tier: 1, opticalShift: 0 },
];

const GRADIENT_DEFS = `<defs>
    <linearGradient id="jp-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e0a520"/>
      <stop offset="20%" stop-color="#e8b020"/>
      <stop offset="45%" stop-color="#f0a830"/>
      <stop offset="70%" stop-color="#f09040"/>
      <stop offset="100%" stop-color="#ee8045"/>
    </linearGradient>
  </defs>`;

// ============================================
// BUILD ONE FAVICON
// ============================================

/**
 * Build a single favicon SVG.
 *
 * @param {object} cfg
 * @param {number} cfg.size                — canvas dimensions (square)
 * @param {number} cfg.jSize               — J font size
 * @param {number} cfg.rx                  — corner radius for the bg rect
 * @param {1|4|6|8} cfg.tier               — twinkle degradation tier
 * @param {number} [cfg.opticalShift=0]    — pixels to shift J UP from math-centered
 * @param {number} [cfg.leftBiasRatio=0.04] — J horizontal offset left, as % of canvas
 * @param {number} [cfg.twinkleRadiusRatio=0.105] — twinkle radius as % of jSize
 * @param {number} [cfg.twinkleGapRatio=0.26] — twinkle right edge offset beyond J right, as % of jSize
 * @param {number} [cfg.twinkleTopRatio=0.15] — twinkle top edge offset above J top, as % of jSize
 * @param {number} [cfg.dotR]              — center dot radius (override)
 * @param {object} [cfg.twinkleStrokeOverrides] — passed through to starburst()
 */
export function buildFavicon({
  size,
  jSize,
  rx,
  tier,
  opticalShift = 0,
  leftBiasRatio = 0.04,
  twinkleRadiusRatio = 0.105,
  twinkleGapRatio = 0.26,
  twinkleTopRatio = 0.15,
  dotR: dotROverride,
  twinkleStrokeOverrides = {},
}) {
  const cormorant = fonts.cormorantBold;

  // Get J glyph metrics in absolute glyph coords (baseline at 0,0)
  const jGlyph = cormorant.charToGlyph('J');
  const jBbox = jGlyph.getPath(0, 0, jSize).getBoundingBox();

  const jVisualCenterX = (jBbox.x1 + jBbox.x2) / 2;
  const jVisualCenterY = (jBbox.y1 + jBbox.y2) / 2;

  // Center J on canvas with slight left bias to balance the twinkle on the right.
  // Apply opticalShift to nudge the J UP from math-centered — compensates for the
  // descender's visual weight which otherwise makes the J feel like it sits too low.
  const leftBias = size * leftBiasRatio;
  const baselineX = size / 2 - jVisualCenterX - leftBias;
  const baselineY = size / 2 - jVisualCenterY - opticalShift;

  // Outlined J path
  const jPathD = textToPathD(cormorant, 'J', jSize, baselineX, baselineY);

  // J's actual rendered bbox
  const jRenderedX2 = baselineX + jBbox.x2;
  const jRenderedY1 = baselineY + jBbox.y1;

  // Twinkle radius
  const twinkleRadius = twinkleRadiusRatio * jSize;

  // Twinkle position:
  //   right edge is twinkleGapRatio * jSize beyond the J's right edge
  //   top edge is twinkleTopRatio * jSize above the J's top edge
  const twinkleRightEdge = jRenderedX2 + twinkleGapRatio * jSize;
  const twinkleTopEdge = jRenderedY1 - twinkleTopRatio * jSize;
  const twinkleX = twinkleRightEdge - twinkleRadius;  // center
  const twinkleY = twinkleTopEdge + twinkleRadius;    // center

  // Center dot — ~2% of canvas width (with floor for the smallest sizes)
  let dotR = dotROverride;
  if (dotR === undefined) {
    if (size === 16) dotR = 1.2;
    else if (size === 32) dotR = 1.0;
    else dotR = 0.02 * size;
  }

  const burstSvg = starburst({
    size: twinkleRadius,
    tier,
    color: '#ffffff',
    secondary: '#ffffff',
    center: '#ffffff',
    dotR,
    ...twinkleStrokeOverrides,
  });

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  ${GRADIENT_DEFS}
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#jp-gradient)"/>
  <path d="${jPathD}" fill="#ffffff"/>
  <g transform="translate(${twinkleX.toFixed(2)},${twinkleY.toFixed(2)})">
    ${burstSvg}
  </g>
</svg>`;
}

// ============================================
// RUNNER (only when invoked directly, not when imported)
// ============================================

if (import.meta.main) {
  await runBuild();
}

async function runBuild() {
console.log('Building SVGs...');
for (const config of FAVICONS) {
  const svg = buildFavicon(config);
  const filename = `favicon-${config.size}.svg`;
  writeFileSync(`${OUTPUT_DIR}/${filename}`, svg + '\n');
  console.log(`  ✓ ${filename}`);
}

// ============================================
// EXPORT PNGs via sharp
// ============================================

console.log('\nExporting PNGs...');
for (const config of FAVICONS) {
  const svgPath = `${OUTPUT_DIR}/favicon-${config.size}.svg`;
  const pngPath = `${OUTPUT_DIR}/favicon-${config.size}.png`;
  await sharp(svgPath)
    .resize(config.size, config.size)
    .png()
    .toFile(pngPath);
  console.log(`  ✓ favicon-${config.size}.png`);
}

// ============================================
// BUILD favicon.ico (16 + 32 multi-resolution)
// ============================================

console.log('\nBuilding favicon.ico...');
const icoBuffer = await pngToIco([
  `${OUTPUT_DIR}/favicon-16.png`,
  `${OUTPUT_DIR}/favicon-32.png`,
]);
writeFileSync(`${OUTPUT_DIR}/favicon.ico`, icoBuffer);
console.log('  ✓ favicon.ico (16+32)');

console.log('\nDone.');
}
