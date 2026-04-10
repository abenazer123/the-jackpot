/**
 * Build the OG image (1200×630) — the link preview card for thejackpotchi.com.
 * Output: brand/social/og-image.{svg,png}
 *
 * Layout:
 *   - Full gradient bg at 135°
 *   - Asymmetric wordmark on the left: THE / JACKPOT / tagline
 *   - Right-aligned: small starburst divider + CHICAGO
 *   - Background decorations: ghosted J watermark + faint large starburst
 *
 * Usage: node scripts/build-og.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import sharp from 'sharp';
import { fonts } from './lib/fonts.mjs';
import { textToPathD, measureText } from './lib/text.mjs';
import { starburst } from './lib/starburst.mjs';

const OUT = resolve(import.meta.dirname, '../brand/social');
mkdirSync(OUT, { recursive: true });

const W = 1200;
const H = 630;

const GRADIENT_DEFS = `<defs>
    <linearGradient id="jp-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e0a520"/>
      <stop offset="20%" stop-color="#e8b020"/>
      <stop offset="45%" stop-color="#f0a830"/>
      <stop offset="70%" stop-color="#f09040"/>
      <stop offset="100%" stop-color="#ee8045"/>
    </linearGradient>
  </defs>`;

function buildOG() {
  const cormorant = fonts.cormorantBold;
  const cormorantItalic = fonts.cormorantItalic;
  const outfitLight = fonts.outfitLight;
  const outfitRegular = fonts.outfitRegular;

  // ============ Layout constants ============
  // Generous left padding so the text block doesn't feel pinned to the edge.
  // Baselines are computed dynamically from font metrics so the tagline never
  // overlaps the J's descender, and the whole text block sits optically
  // centered in the frame.
  const leftPad = 135;
  const rightPad = 90;

  // Measure actual font extents for the layout math.
  const theBbox = outfitLight.getPath('THE', 0, 0, 24).getBoundingBox();
  const jackpotBbox = cormorant.getPath('JACKPOT', 0, 0, 180).getBoundingBox();
  const taglineBbox = cormorantItalic.getPath('you found something special', 0, 0, 32).getBoundingBox();

  const theCapHeight = -theBbox.y1;            // distance from baseline to top of caps
  const jackpotCapHeight = -jackpotBbox.y1;    // distance from baseline to top of caps
  const jackpotDescent = jackpotBbox.y2;       // distance from baseline to bottom of J descender
  const taglineAscent = -taglineBbox.y1;       // distance from baseline to top of italic ascenders
  const taglineDescent = taglineBbox.y2;       // distance from baseline to bottom of italic descenders

  // Vertical rhythm:
  //   THE baseline -> JACKPOT cap top: visual gap of GAP_THE_JACKPOT
  //   J descender bottom -> tagline top: clear space of GAP_J_TAGLINE
  const GAP_THE_JACKPOT = 12;
  const GAP_J_TAGLINE = 25;

  // Compute baselines symbolically, then center the whole block in the canvas.
  // Let theBaselineY = T, jackpotBaselineY = J, taglineBaselineY = G.
  //   J = T + theCapHeight + GAP_THE_JACKPOT? Actually:
  //   THE bottom is at T (no descender on caps).
  //   JACKPOT cap top is at J - jackpotCapHeight.
  //   Gap = (J - jackpotCapHeight) - T = GAP_THE_JACKPOT
  //   => J = T + jackpotCapHeight + GAP_THE_JACKPOT
  //
  //   J descender bottom = J + jackpotDescent
  //   Tagline top = G - taglineAscent
  //   (G - taglineAscent) - (J + jackpotDescent) = GAP_J_TAGLINE
  //   => G = J + jackpotDescent + GAP_J_TAGLINE + taglineAscent
  //
  // Block top = T - theCapHeight
  // Block bottom = G + taglineDescent
  // Block center = (T - theCapHeight + G + taglineDescent) / 2 = H/2
  //   => T + G = H + theCapHeight - taglineDescent
  // Substituting G:
  //   T + (T + jackpotCapHeight + GAP_THE_JACKPOT + jackpotDescent + GAP_J_TAGLINE + taglineAscent) = H + theCapHeight - taglineDescent
  //   2T = H + theCapHeight - taglineDescent - jackpotCapHeight - GAP_THE_JACKPOT - jackpotDescent - GAP_J_TAGLINE - taglineAscent
  //   T = (H + theCapHeight - taglineDescent - jackpotCapHeight - GAP_THE_JACKPOT - jackpotDescent - GAP_J_TAGLINE - taglineAscent) / 2

  const theBaselineY = Math.round(
    (H + theCapHeight - taglineDescent - jackpotCapHeight - GAP_THE_JACKPOT - jackpotDescent - GAP_J_TAGLINE - taglineAscent) / 2
  );
  const jackpotBaselineY = Math.round(theBaselineY + jackpotCapHeight + GAP_THE_JACKPOT);
  const taglineBaselineY = Math.round(jackpotBaselineY + jackpotDescent + GAP_J_TAGLINE + taglineAscent);
  const chicagoBaselineY = taglineBaselineY;

  // ============ Foreground wordmark ============

  // THE — Outfit Light, 24px, letter-spacing 10
  const thePath = textToPathD(outfitLight, 'THE', 24, leftPad, theBaselineY, 10);

  // JACKPOT — Cormorant Bold, 180px, letter-spacing 4
  const jackpotPath = textToPathD(cormorant, 'JACKPOT', 180, leftPad, jackpotBaselineY, 4);

  // Tagline — Cormorant Italic, 32px (left-aligned, just below JACKPOT)
  const taglineText = 'you found something special';
  const taglinePath = textToPathD(cormorantItalic, taglineText, 32, leftPad + 6, taglineBaselineY, 0);

  // CHICAGO — Outfit Regular, 22px, letter-spacing 7, right-aligned at the same baseline as tagline
  const chicagoText = 'CHICAGO';
  const chicagoLs = 7;
  const chicagoFontSize = 22;
  const chicagoWidth = measureText(outfitRegular, chicagoText, chicagoFontSize, chicagoLs);
  const chicagoX = W - rightPad - chicagoWidth;
  const chicagoPath = textToPathD(outfitRegular, chicagoText, chicagoFontSize, chicagoX, chicagoBaselineY, chicagoLs);

  // Small starburst divider between tagline and CHICAGO (just left of CHICAGO)
  const starSize = 8;            // radius — total span 16
  const starGap = 18;            // gap between starburst and CHICAGO
  const starX = chicagoX - starGap - starSize;
  const starY = chicagoBaselineY - 8;  // center vertically with CHICAGO's x-height
  const dividerStarburst = starburst({
    size: starSize,
    tier: 8,
    color: '#ffffff',
    secondary: '#ffffff',
    center: '#ffffff',
    axisOpacity: 0.85,
    diagOpacity: 0.6,
    terOpacity: 0.4,
  });

  // ============ Background decorations ============

  // Large ghosted J watermark on the right side, opacity 0.05
  const ghostJSize = 520;
  const ghostJGlyph = cormorant.charToGlyph('J');
  const ghostBbox = ghostJGlyph.getPath(0, 0, ghostJSize).getBoundingBox();
  const ghostVcX = (ghostBbox.x1 + ghostBbox.x2) / 2;
  const ghostVcY = (ghostBbox.y1 + ghostBbox.y2) / 2;
  // Position the J's visual center in the right portion of the canvas
  const ghostCenterX = W - 230;
  const ghostCenterY = H / 2 + 30;
  const ghostBaselineX = ghostCenterX - ghostVcX;
  const ghostBaselineY = ghostCenterY - ghostVcY;
  const ghostJPath = textToPathD(cormorant, 'J', ghostJSize, ghostBaselineX, ghostBaselineY);

  // Faint large starburst behind the J watermark
  const bgStarSize = 170;
  const bgStarX = W - 240;
  const bgStarY = 200;
  const bgStarburst = starburst({
    size: bgStarSize,
    tier: 8,
    color: '#ffffff',
    secondary: '#ffffff',
    center: '#ffffff',
    axisOpacity: 1,
    diagOpacity: 0.7,
    terOpacity: 0.4,
  });

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${GRADIENT_DEFS}
  <rect width="${W}" height="${H}" fill="url(#jp-gradient)"/>

  <!-- Background: ghosted J watermark + faint large starburst -->
  <g opacity="0.06">
    <g transform="translate(${bgStarX},${bgStarY})">
      ${bgStarburst}
    </g>
  </g>
  <g opacity="0.05">
    <path d="${ghostJPath}" fill="#ffffff"/>
  </g>

  <!-- Foreground wordmark -->
  <path d="${thePath}" fill="#ffffff"/>
  <path d="${jackpotPath}" fill="#ffffff"/>
  <path d="${taglinePath}" fill="#ffffff" opacity="0.92"/>

  <!-- Right-aligned starburst divider + CHICAGO -->
  <g transform="translate(${starX.toFixed(2)},${starY.toFixed(2)})">
    ${dividerStarburst}
  </g>
  <path d="${chicagoPath}" fill="#ffffff" opacity="0.88"/>
</svg>`;
}

const svg = buildOG();
writeFileSync(`${OUT}/og-image.svg`, svg + '\n');
console.log('✓ og-image.svg');

await sharp(`${OUT}/og-image.svg`)
  .resize(W, H)
  .png({ compressionLevel: 9, palette: false })
  .toFile(`${OUT}/og-image.png`);
console.log('✓ og-image.png');

console.log('\nDone.');
