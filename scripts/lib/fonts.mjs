/**
 * Loads the 5 brand font TTFs once and exports the resulting opentype.js Font
 * objects. Importers get the same shared instances.
 *
 * Fonts:
 *   cormorantBold    — Cormorant Garamond 700 (JACKPOT, J, stat numbers)
 *   cormorantRegular — Cormorant Garamond 400
 *   cormorantItalic  — Cormorant Garamond 400 italic (taglines)
 *   outfitLight      — Outfit 300 (THE)
 *   outfitRegular    — Outfit 400 (CHICAGO, captions)
 */

import opentype from 'opentype.js';
import { resolve } from 'path';

const FONT_DIR = resolve(import.meta.dirname, '../_fonts');

export const fonts = {
  cormorantBold: await opentype.load(`${FONT_DIR}/cormorant-bold.ttf`),
  cormorantRegular: await opentype.load(`${FONT_DIR}/cormorant-regular.ttf`),
  cormorantItalic: await opentype.load(`${FONT_DIR}/cormorant-italic.ttf`),
  outfitLight: await opentype.load(`${FONT_DIR}/outfit-light.ttf`),
  outfitRegular: await opentype.load(`${FONT_DIR}/outfit-regular.ttf`),
};
