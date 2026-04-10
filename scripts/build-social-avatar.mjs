/**
 * Build the social avatar (1080×1080) — Instagram profile picture.
 * Output: brand/social/social-avatar-1080.{svg,png}
 *
 * Layout:
 *   - Full gradient bg, NO rounded corners (Instagram applies its own circle crop)
 *   - White J + twinkle composite, optically centered
 *   - The J + twinkle must fit inside the inscribed circle (radius 540 from center)
 *     so nothing gets clipped when IG circle-crops the square
 *
 * Usage: node scripts/build-social-avatar.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import sharp from 'sharp';
import { fonts } from './lib/fonts.mjs';
import { textToPathD } from './lib/text.mjs';
import { starburst } from './lib/starburst.mjs';

const OUT = resolve(import.meta.dirname, '../brand/social');
mkdirSync(OUT, { recursive: true });

const SIZE = 1080;
const CENTER = SIZE / 2;
const INSCRIBED_RADIUS = SIZE / 2;  // 540

const GRADIENT_DEFS = `<defs>
    <linearGradient id="jp-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e0a520"/>
      <stop offset="20%" stop-color="#e8b020"/>
      <stop offset="45%" stop-color="#f0a830"/>
      <stop offset="70%" stop-color="#f09040"/>
      <stop offset="100%" stop-color="#ee8045"/>
    </linearGradient>
  </defs>`;

/**
 * @param {object} [opts]
 * @param {'combined' | 'j' | 'midpoint'} [opts.centering='combined']
 *   - 'combined': center the J+twinkle bounding box as a single unit (default)
 *   - 'j':        center the J's bbox alone (twinkle floats off to the right)
 *   - 'midpoint': center the midpoint between the J center and the twinkle center
 * @param {boolean} [opts.debug=false] — render the crosshair / bbox / circle overlay
 */
export function buildSocialAvatar({ centering = 'combined', debug = false } = {}) {
  const cormorant = fonts.cormorantBold;

  // J font size — large enough to dominate the canvas, small enough that the
  // J + twinkle composite fits inside the inscribed circle with margin.
  const jSize = 620;

  // Same proportional twinkle parameters as the favicons
  const twinkleRadiusRatio = 0.105;
  const twinkleGapRatio = 0.26;
  const twinkleTopRatio = 0.15;

  // Get J glyph metrics
  const jGlyph = cormorant.charToGlyph('J');
  const jBbox = jGlyph.getPath(0, 0, jSize).getBoundingBox();

  const twinkleRadius = twinkleRadiusRatio * jSize;

  // ============ Step 1: Position twinkle relative to J in temp coords ============
  // Temporarily place J with baseline at origin (0, 0). The J occupies
  //   x: [jBbox.x1, jBbox.x2]    y: [jBbox.y1, jBbox.y2]
  // Twinkle position formula (matches favicons):
  //   right edge = J right + 0.26 * jSize
  //   top edge   = J top   - 0.15 * jSize
  const tempTwinkleRightEdge = jBbox.x2 + twinkleGapRatio * jSize;
  const tempTwinkleTopEdge = jBbox.y1 - twinkleTopRatio * jSize;
  const tempTwinkleX = tempTwinkleRightEdge - twinkleRadius;
  const tempTwinkleY = tempTwinkleTopEdge + twinkleRadius;

  // ============ Step 2: Compute centering anchors (in temp coords) ============
  // Combined bbox of J + twinkle as a single unit
  const combinedLeft = Math.min(jBbox.x1, tempTwinkleX - twinkleRadius);
  const combinedRight = Math.max(jBbox.x2, tempTwinkleX + twinkleRadius);
  const combinedTop = Math.min(jBbox.y1, tempTwinkleY - twinkleRadius);
  const combinedBottom = Math.max(jBbox.y2, tempTwinkleY + twinkleRadius);
  const combinedCenterX = (combinedLeft + combinedRight) / 2;
  const combinedCenterY = (combinedTop + combinedBottom) / 2;

  // J's own bbox center
  const jCenterX = (jBbox.x1 + jBbox.x2) / 2;
  const jCenterY = (jBbox.y1 + jBbox.y2) / 2;

  // Twinkle's own bbox center (its conceptual center, which is tempTwinkleX/Y)
  const tCenterX = tempTwinkleX;
  const tCenterY = tempTwinkleY;

  // Pick the centering anchor based on the chosen mode
  let anchorX, anchorY;
  if (centering === 'j') {
    anchorX = jCenterX;
    anchorY = jCenterY;
  } else if (centering === 'midpoint') {
    anchorX = (jCenterX + tCenterX) / 2;
    anchorY = (jCenterY + tCenterY) / 2;
  } else {
    // 'combined' (default)
    anchorX = combinedCenterX;
    anchorY = combinedCenterY;
  }

  // ============ Step 3: Translate so the chosen anchor sits at canvas center ============
  const offsetX = CENTER - anchorX;
  const offsetY = CENTER - anchorY;

  const baselineX = offsetX;
  const baselineY = offsetY;
  const twinkleX = tempTwinkleX + offsetX;
  const twinkleY = tempTwinkleY + offsetY;

  // Outlined J path
  const jPathD = textToPathD(cormorant, 'J', jSize, baselineX, baselineY);

  // J's actual rendered bbox (for clearance check below)
  const jRenderedX1 = baselineX + jBbox.x1;
  const jRenderedX2 = baselineX + jBbox.x2;
  const jRenderedY1 = baselineY + jBbox.y1;
  const jRenderedY2 = baselineY + jBbox.y2;

  // Center dot — ~2% of canvas width (same rule as favicons for the larger sizes)
  const dotR = 0.02 * SIZE;

  const burstSvg = starburst({
    size: twinkleRadius,
    tier: 8,
    color: '#ffffff',
    secondary: '#ffffff',
    center: '#ffffff',
    dotR,
  });

  // ============ Inscribed circle clearance check ============
  // Compute the maximum distance from canvas center to any extreme point of the
  // J + twinkle composite. Must be < INSCRIBED_RADIUS so nothing clips when IG
  // circle-crops the square.
  const extremePoints = [
    [jRenderedX1, jRenderedY1],
    [jRenderedX2, jRenderedY1],
    [jRenderedX1, jRenderedY2],
    [jRenderedX2, jRenderedY2],
    // Twinkle bounding box corners
    [twinkleX - twinkleRadius, twinkleY - twinkleRadius],
    [twinkleX + twinkleRadius, twinkleY - twinkleRadius],
    [twinkleX - twinkleRadius, twinkleY + twinkleRadius],
    [twinkleX + twinkleRadius, twinkleY + twinkleRadius],
  ];
  let maxDist = 0;
  for (const [x, y] of extremePoints) {
    const dist = Math.hypot(x - CENTER, y - CENTER);
    if (dist > maxDist) maxDist = dist;
  }
  console.log(`  Inscribed circle radius: ${INSCRIBED_RADIUS}`);
  console.log(`  Max distance from center: ${maxDist.toFixed(1)}`);
  console.log(`  Margin from circle: ${(INSCRIBED_RADIUS - maxDist).toFixed(1)}px`);
  if (maxDist >= INSCRIBED_RADIUS) {
    throw new Error(`J+twinkle composite exceeds inscribed circle! Reduce jSize.`);
  }

  // ============ Combined-bbox sanity check (crosshair-style audit) ============
  // Compute the rendered combined bbox (J + twinkle in canvas coords) and
  // confirm its center is exactly (CENTER, CENTER).
  const renderedCombinedLeft = Math.min(jRenderedX1, twinkleX - twinkleRadius);
  const renderedCombinedRight = Math.max(jRenderedX2, twinkleX + twinkleRadius);
  const renderedCombinedTop = Math.min(jRenderedY1, twinkleY - twinkleRadius);
  const renderedCombinedBottom = Math.max(jRenderedY2, twinkleY + twinkleRadius);
  const renderedCenterX = (renderedCombinedLeft + renderedCombinedRight) / 2;
  const renderedCenterY = (renderedCombinedTop + renderedCombinedBottom) / 2;
  console.log(`  Combined bbox: x=[${renderedCombinedLeft.toFixed(1)}, ${renderedCombinedRight.toFixed(1)}] y=[${renderedCombinedTop.toFixed(1)}, ${renderedCombinedBottom.toFixed(1)}]`);
  console.log(`  Combined center: (${renderedCenterX.toFixed(1)}, ${renderedCenterY.toFixed(1)})`);
  console.log(`  Canvas center:   (${CENTER}, ${CENTER})`);
  console.log(`  Centering error: dx=${(renderedCenterX - CENTER).toFixed(2)}  dy=${(renderedCenterY - CENTER).toFixed(2)}`);

  // Optional debug overlay: render guide lines at the canvas center and the
  // combined-bbox edges. Makes it visually obvious where the centering anchor sits.
  const debugCrosshair = (debug || process.env.DEBUG_CROSSHAIR === '1') ? `
  <!-- DEBUG: canvas center crosshair -->
  <line x1="0" y1="${CENTER}" x2="${SIZE}" y2="${CENTER}" stroke="#000" stroke-width="2" stroke-dasharray="6,6" opacity="0.6"/>
  <line x1="${CENTER}" y1="0" x2="${CENTER}" y2="${SIZE}" stroke="#000" stroke-width="2" stroke-dasharray="6,6" opacity="0.6"/>
  <!-- DEBUG: combined bbox outline -->
  <rect x="${renderedCombinedLeft}" y="${renderedCombinedTop}" width="${renderedCombinedRight - renderedCombinedLeft}" height="${renderedCombinedBottom - renderedCombinedTop}" fill="none" stroke="#ff0000" stroke-width="2" stroke-dasharray="8,4"/>
  <!-- DEBUG: inscribed circle outline -->
  <circle cx="${CENTER}" cy="${CENTER}" r="${INSCRIBED_RADIUS}" fill="none" stroke="#0066ff" stroke-width="2" stroke-dasharray="4,4"/>
  ` : '';

  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  ${GRADIENT_DEFS}
  <rect width="${SIZE}" height="${SIZE}" fill="url(#jp-gradient)"/>
  <path d="${jPathD}" fill="#ffffff"/>
  <g transform="translate(${twinkleX.toFixed(2)},${twinkleY.toFixed(2)})">
    ${burstSvg}
  </g>${debugCrosshair}
</svg>`;
}

if (import.meta.main) {
  console.log('Building social avatar...');
  const svg = buildSocialAvatar();
  writeFileSync(`${OUT}/social-avatar-1080.svg`, svg + '\n');
  console.log('  ✓ social-avatar-1080.svg');

  await sharp(`${OUT}/social-avatar-1080.svg`)
    .resize(SIZE, SIZE)
    .png({ compressionLevel: 9, palette: false })
    .toFile(`${OUT}/social-avatar-1080.png`);
  console.log('  ✓ social-avatar-1080.png');

  console.log('\nDone.');
}
