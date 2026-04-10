/**
 * Export all 10 logo SVGs to PNGs at @1×, @2×, @4× with transparent backgrounds.
 * Organized by mark family in brand/png/.
 *
 * Output:
 *   brand/png/wordmark-primary/wordmark-primary-{gold,white}@{1,2,4}x.png
 *   brand/png/wordmark-compact/wordmark-compact-{gold,white}@{1,2,4}x.png
 *   brand/png/monogram/monogram-jtwinkle-{gold,white}@{1,2,4}x.png
 *   brand/png/starburst/starburst-full-{gold,white}@{1,2,4}x.png
 *   brand/png/starburst/starburst-simple-{gold,white}@{1,2,4}x.png
 *
 * Total: 30 PNGs (10 marks × 3 zoom levels).
 *
 * Usage: node scripts/build-png-exports.mjs
 */

import { mkdirSync, readFileSync } from 'fs';
import { resolve, basename } from 'path';
import sharp from 'sharp';

const ROOT = resolve(import.meta.dirname, '..');
const LOGOS_DIR = `${ROOT}/brand/logos`;
const PNG_DIR = `${ROOT}/brand/png`;

// Map each logo to its destination subdirectory
const LOGOS = [
  { svg: 'wordmark-primary-gold.svg',   group: 'wordmark-primary' },
  { svg: 'wordmark-primary-white.svg',  group: 'wordmark-primary' },
  { svg: 'wordmark-compact-gold.svg',   group: 'wordmark-compact' },
  { svg: 'wordmark-compact-white.svg',  group: 'wordmark-compact' },
  { svg: 'monogram-jtwinkle-gold.svg',  group: 'monogram' },
  { svg: 'monogram-jtwinkle-white.svg', group: 'monogram' },
  { svg: 'starburst-full-gold.svg',     group: 'starburst' },
  { svg: 'starburst-full-white.svg',    group: 'starburst' },
  { svg: 'starburst-simple-gold.svg',   group: 'starburst' },
  { svg: 'starburst-simple-white.svg',  group: 'starburst' },
];

const ZOOM_LEVELS = [1, 2, 4];

// Parse the SVG's intrinsic dimensions from its viewBox
function getSvgDimensions(svgPath) {
  const content = readFileSync(svgPath, 'utf-8');
  const match = content.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!match) throw new Error(`No viewBox found in ${svgPath}`);
  return {
    width: parseFloat(match[1]),
    height: parseFloat(match[2]),
  };
}

console.log('Exporting PNGs...\n');

let count = 0;
for (const { svg, group } of LOGOS) {
  const svgPath = `${LOGOS_DIR}/${svg}`;
  const groupDir = `${PNG_DIR}/${group}`;
  mkdirSync(groupDir, { recursive: true });

  const { width, height } = getSvgDimensions(svgPath);
  const baseName = basename(svg, '.svg');

  for (const zoom of ZOOM_LEVELS) {
    const outW = Math.round(width * zoom);
    const outH = Math.round(height * zoom);
    const outPath = `${groupDir}/${baseName}@${zoom}x.png`;

    await sharp(svgPath)
      .resize(outW, outH)
      .png({ compressionLevel: 9 })  // transparent background by default for SVGs without bg
      .toFile(outPath);

    console.log(`  ✓ ${group}/${baseName}@${zoom}x.png  (${outW}×${outH})`);
    count++;
  }
}

console.log(`\nDone. ${count} PNGs exported.`);
