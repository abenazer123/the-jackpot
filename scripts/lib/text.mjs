/**
 * Helpers for converting SVG text to outlined paths via opentype.js.
 *
 * textToPathD — returns the `d` attribute string for a text run with optional
 *               letter-spacing. With letter-spacing, characters are rendered
 *               individually and advanced manually so the spacing is exact.
 *
 * measureText — returns the rendered width of a text run with letter-spacing,
 *               for layout calculations (right-aligning, centering, etc).
 */

import opentype from 'opentype.js';

export function textToPathD(font, text, fontSize, x, y, letterSpacing = 0) {
  if (letterSpacing === 0) {
    return font.getPath(text, x, y, fontSize).toPathData(2);
  }

  let currentX = x;
  const allCommands = [];

  for (const char of text) {
    const path = font.getPath(char, currentX, y, fontSize);
    allCommands.push(...path.commands);
    const glyph = font.charToGlyph(char);
    const advance = (glyph.advanceWidth / font.unitsPerEm) * fontSize;
    currentX += advance + letterSpacing;
  }

  const combinedPath = new opentype.Path();
  combinedPath.commands = allCommands;
  return combinedPath.toPathData(2);
}

export function measureText(font, text, fontSize, letterSpacing = 0) {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const glyph = font.charToGlyph(text[i]);
    width += (glyph.advanceWidth / font.unitsPerEm) * fontSize;
    if (i < text.length - 1) width += letterSpacing;
  }
  return width;
}
