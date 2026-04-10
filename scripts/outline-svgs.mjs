/**
 * Build the 6 wordmark/monogram logos with text outlined as paths.
 * Starburst SVGs in /brand/logos/ are pure geometry — already correct, not regenerated.
 *
 * Usage: node scripts/outline-svgs.mjs
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { fonts } from './lib/fonts.mjs';
import { textToPathD, measureText } from './lib/text.mjs';

const LOGO_DIR = resolve(import.meta.dirname, '../brand/logos');

// ============================================
// BUILDERS
// ============================================

function buildWordmarkPrimary(variant) {
  const isGold = variant === 'gold';

  const theColor = isGold ? '#ff9050' : '#ffffff';
  const theOpacity = isGold ? '1' : '0.7';
  const jackpotColor = isGold ? '#d4a930' : '#ffffff';
  const taglineColor = isGold ? '#a08840' : '#ffffff';
  const taglineOpacity = isGold ? '1' : '0.75';
  const chicagoColor = isGold ? '#a08840' : '#ffffff';
  const chicagoOpacity = isGold ? '1' : '0.7';
  const starStroke1 = isGold ? '#d4a930' : '#ffffff';
  const starStroke2 = isGold ? '#d4a930' : '#ffffff';
  const starCenter = isGold ? '#ff9050' : '#ffffff';
  const lineStroke = isGold ? '#d4a930' : '#ffffff';

  const thePath = textToPathD(fonts.outfitLight, 'THE', 14, 4, 38, 7);
  const jackpotPath = textToPathD(fonts.cormorantBold, 'JACKPOT', 84, 0, 118, 4);
  const taglinePath = textToPathD(fonts.cormorantItalic, 'you found something special', 18, 4, 155, 0);

  const chicagoText = 'CHICAGO';
  const chicagoWidth = measureText(fonts.outfitRegular, chicagoText, 14, 5);
  const chicagoX = 596 - chicagoWidth;
  const chicagoPath = textToPathD(fonts.outfitRegular, chicagoText, 14, chicagoX, 153, 5);

  return `<svg width="600" height="180" viewBox="0 0 600 180" xmlns="http://www.w3.org/2000/svg">
  <path d="${thePath}" fill="${theColor}"${theOpacity !== '1' ? ` opacity="${theOpacity}"` : ''}/>
  <path d="${jackpotPath}" fill="${jackpotColor}"/>
  <path d="${taglinePath}" fill="${taglineColor}"${taglineOpacity !== '1' ? ` opacity="${taglineOpacity}"` : ''}/>
  <line x1="420" y1="148" x2="448" y2="148" stroke="${lineStroke}" stroke-width="0.5" opacity="0.3"/>
  <g transform="translate(460,148)"><line x1="0" y1="-5" x2="0" y2="5" stroke="${starStroke1}" stroke-width="0.8" opacity="0.6"/><line x1="-5" y1="0" x2="5" y2="0" stroke="${starStroke1}" stroke-width="0.8" opacity="0.6"/><line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5" stroke="${starStroke2}" stroke-width="0.5" opacity="0.4"/><line x1="3.5" y1="-3.5" x2="-3.5" y2="3.5" stroke="${starStroke2}" stroke-width="0.5" opacity="0.4"/><circle cx="0" cy="0" r="1" fill="${starCenter}" opacity="0.8"/></g>
  <path d="${chicagoPath}" fill="${chicagoColor}"${chicagoOpacity !== '1' ? ` opacity="${chicagoOpacity}"` : ''}/>
</svg>`;
}

function buildWordmarkCompact(variant) {
  const isGold = variant === 'gold';

  const theColor = isGold ? '#ff9050' : '#ffffff';
  const theOpacity = isGold ? '1' : '0.7';
  const jackpotColor = isGold ? '#d4a930' : '#ffffff';
  const chicagoColor = isGold ? '#a08840' : '#ffffff';
  const chicagoOpacity = isGold ? '1' : '0.6';
  const starStroke = isGold ? '#d4a930' : '#ffffff';
  const starCenter = isGold ? '#ff9050' : '#ffffff';

  const thePath = textToPathD(fonts.outfitLight, 'THE', 13, 0, 34, 5);
  const jackpotPath = textToPathD(fonts.cormorantBold, 'JACKPOT', 42, 56, 36, 3);
  const jackpotWidth = measureText(fonts.cormorantBold, 'JACKPOT', 42, 3);
  const starX = 56 + jackpotWidth + 12;

  const chicagoX = starX + 15;
  const chicagoPath = textToPathD(fonts.outfitRegular, 'CHICAGO', 12, chicagoX, 34, 4);
  const chicagoWidth = measureText(fonts.outfitRegular, 'CHICAGO', 12, 4);

  const totalWidth = Math.ceil(chicagoX + chicagoWidth + 8);

  return `<svg width="${totalWidth}" height="48" viewBox="0 0 ${totalWidth} 48" xmlns="http://www.w3.org/2000/svg">
  <path d="${thePath}" fill="${theColor}"${theOpacity !== '1' ? ` opacity="${theOpacity}"` : ''}/>
  <path d="${jackpotPath}" fill="${jackpotColor}"/>
  <g transform="translate(${Math.round(starX)},28)"><line x1="0" y1="-3" x2="0" y2="3" stroke="${starStroke}" stroke-width="0.6" opacity="0.5"/><line x1="-3" y1="0" x2="3" y2="0" stroke="${starStroke}" stroke-width="0.6" opacity="0.5"/><circle cx="0" cy="0" r="0.8" fill="${starCenter}" opacity="0.7"/></g>
  <path d="${chicagoPath}" fill="${chicagoColor}"${chicagoOpacity !== '1' ? ` opacity="${chicagoOpacity}"` : ''}/>
</svg>`;
}

function buildMonogram(variant) {
  const isGold = variant === 'gold';

  const jColor = isGold ? '#d4a930' : '#ffffff';
  const starPrimary = isGold ? '#d4a930' : '#ffffff';
  const starSecondary = isGold ? '#e8a040' : '#ffffff';
  const starCenter = isGold ? '#ff9050' : '#ffffff';
  const starSecondaryOpacity = '0.4';

  const jPath = textToPathD(fonts.cormorantBold, 'J', 160, 60, 128, 0);

  // viewBox is 200x180 (not 160) so the J's descender curl fits without clipping.
  // The J at fontSize 160 has bbox y from -100 to +38.72; with baseline at y=128
  // the descender bottom lands at y=166.72, which would clip in a 160-tall canvas.
  return `<svg width="200" height="180" viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">
  <path d="${jPath}" fill="${jColor}"/>
  <g transform="translate(158,18)">
    <line x1="0" y1="-15" x2="0" y2="15" stroke="${starPrimary}" stroke-width="1.8" opacity="0.9"/>
    <line x1="-15" y1="0" x2="15" y2="0" stroke="${starPrimary}" stroke-width="1.8" opacity="0.9"/>
    <line x1="-10.5" y1="-10.5" x2="10.5" y2="10.5" stroke="${starPrimary}" stroke-width="1.1" opacity="0.65"/>
    <line x1="10.5" y1="-10.5" x2="-10.5" y2="10.5" stroke="${starPrimary}" stroke-width="1.1" opacity="0.65"/>
    <line x1="-4" y1="-14.5" x2="4" y2="14.5" stroke="${starSecondary}" stroke-width="0.6" opacity="${starSecondaryOpacity}"/>
    <line x1="4" y1="-14.5" x2="-4" y2="14.5" stroke="${starSecondary}" stroke-width="0.6" opacity="${starSecondaryOpacity}"/>
    <line x1="-14.5" y1="-4" x2="14.5" y2="4" stroke="${starSecondary}" stroke-width="0.6" opacity="${starSecondaryOpacity}"/>
    <line x1="-14.5" y1="4" x2="14.5" y2="-4" stroke="${starSecondary}" stroke-width="0.6" opacity="${starSecondaryOpacity}"/>
    <circle cx="0" cy="0" r="2.8" fill="${starCenter}"/>
  </g>
</svg>`;
}

// ============================================
// GENERATE
// ============================================

const files = [
  ['wordmark-primary-gold.svg', () => buildWordmarkPrimary('gold')],
  ['wordmark-primary-white.svg', () => buildWordmarkPrimary('white')],
  ['wordmark-compact-gold.svg', () => buildWordmarkCompact('gold')],
  ['wordmark-compact-white.svg', () => buildWordmarkCompact('white')],
  ['monogram-jtwinkle-gold.svg', () => buildMonogram('gold')],
  ['monogram-jtwinkle-white.svg', () => buildMonogram('white')],
];

for (const [filename, builder] of files) {
  writeFileSync(`${LOGO_DIR}/${filename}`, builder() + '\n');
  console.log(`✓ ${filename}`);
}

console.log('✓ starburst files unchanged (already pure geometry)');
console.log('\nDone. All text outlined.');
