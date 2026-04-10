# The Jackpot Chicago — Brand Assets Manifest

Complete inventory of every asset in `brand/`. Open `brand/_audit.html` in a browser for the visual showcase.

**Total: 65 production files** across logos, favicons, social, patterns, overlays, PNG exports, tokens, docs, and the audit page.

---

## 1 · Logos — `brand/logos/` (10 SVGs)

All text outlined as paths via `opentype.js` — fonts are not required to render. Built by `scripts/outline-svgs.mjs`.

| File | Dimensions | Purpose | Status |
|---|---|---|---|
| `wordmark-primary-gold.svg` | 600 × 180 | Stacked lockup: THE / JACKPOT / tagline + starburst + CHICAGO. For light backgrounds. | ✓ verified |
| `wordmark-primary-white.svg` | 600 × 180 | Same lockup, white variant for gradient/dark backgrounds. | ✓ verified |
| `wordmark-compact-gold.svg` | 372 × 48 | Inline single-line lockup for headers, nav, footers. | ✓ verified |
| `wordmark-compact-white.svg` | 372 × 48 | Same compact lockup, white variant. | ✓ verified |
| `monogram-jtwinkle-gold.svg` | 200 × 180 | J letterform with starburst at upper-right. App icons, profile pictures, decorative accents. | ✓ verified |
| `monogram-jtwinkle-white.svg` | 200 × 180 | Same monogram, white variant. | ✓ verified |
| `starburst-full-gold.svg` | 120 × 120 | Detailed starburst motif (8 lines, peach center). Standalone decorative element. | ✓ verified |
| `starburst-full-white.svg` | 120 × 120 | Same, white variant. | ✓ verified |
| `starburst-simple-gold.svg` | 48 × 48 | Minimal 4-line starburst. Bullets, dividers, small accents. | ✓ verified |
| `starburst-simple-white.svg` | 48 × 48 | Same, white variant. | ✓ verified |

---

## 2 · Favicons — `brand/favicons/` (11 files)

Five SVG masters and PNG exports plus a multi-resolution `.ico`. Each size is a deliberate redesign — the twinkle degrades from 8 lines (full) → 6 lines → 4 lines → dot only as the canvas shrinks. Built by `scripts/build-favicons.mjs`.

| File | Dimensions | Twinkle | Use case | Status |
|---|---|---|---|---|
| `favicon-512.svg` + `.png` | 512 × 512 | 8 lines (full) | PWA / app icon | ✓ verified |
| `favicon-192.svg` + `.png` | 192 × 192 | 6 lines | Android / PWA | ✓ verified |
| `favicon-180.svg` + `.png` | 180 × 180 | 6 lines | Apple touch icon | ✓ verified |
| `favicon-32.svg` + `.png` | 32 × 32 | 4 lines minimal | Browser tab (high-DPI) | ✓ verified |
| `favicon-16.svg` + `.png` | 16 × 16 | dot only | Browser tab (low-DPI) | ✓ verified |
| `favicon.ico` | 16 + 32 multi-res | — | Legacy fallback (`<link rel="icon">`) | ✓ verified |

---

## 3 · Social — `brand/social/` (4 files)

| File | Dimensions | Purpose | Status |
|---|---|---|---|
| `og-image.svg` + `.png` | 1200 × 630 | Open Graph link preview card. Asymmetric wordmark on gradient with ghosted J watermark. | ✓ verified |
| `social-avatar-1080.svg` + `.png` | 1080 × 1080 | Instagram profile picture. J + twinkle composite centered for circular crop. | ✓ verified |

---

## 4 · Pattern Tiles — `brand/patterns/` (2 SVGs)

Seamless 80 × 80 repeating starbursts for `background: url(...) repeat`. Built by `scripts/build-patterns.mjs`.

| File | Dimensions | Purpose | Status |
|---|---|---|---|
| `pattern-starburst-gold.svg` | 80 × 80 | Subtle gold/peach starburst on linen. For content sections on linen backgrounds. | ✓ verified |
| `pattern-starburst-white.svg` | 80 × 80 | Faint white starburst on transparent. For overlaying on the brand gradient. | ✓ verified |

---

## 5 · Photo Overlay — `brand/overlays/` (1 SVG)

| File | Dimensions | Purpose | Status |
|---|---|---|---|
| `photo-overlay.svg` | 1200 × 800 (scales) | Vertical linear gradient: transparent → `#c88c1e` @ 40% opacity. Place over property photos for white text legibility. Never dark. | ✓ verified |

---

## 6 · PNG Exports — `brand/png/` (30 PNGs)

Every logo SVG exported at @1×, @2×, @4× with transparent background. Built by `scripts/build-png-exports.mjs`. Organized by mark family.

### `wordmark-primary/` — 6 files
| File | Dimensions |
|---|---|
| `wordmark-primary-gold@1x.png` | 600 × 180 |
| `wordmark-primary-gold@2x.png` | 1200 × 360 |
| `wordmark-primary-gold@4x.png` | 2400 × 720 |
| `wordmark-primary-white@1x.png` | 600 × 180 |
| `wordmark-primary-white@2x.png` | 1200 × 360 |
| `wordmark-primary-white@4x.png` | 2400 × 720 |

### `wordmark-compact/` — 6 files
| File | Dimensions |
|---|---|
| `wordmark-compact-gold@1x.png` | 372 × 48 |
| `wordmark-compact-gold@2x.png` | 744 × 96 |
| `wordmark-compact-gold@4x.png` | 1488 × 192 |
| `wordmark-compact-white@1x.png` | 372 × 48 |
| `wordmark-compact-white@2x.png` | 744 × 96 |
| `wordmark-compact-white@4x.png` | 1488 × 192 |

### `monogram/` — 6 files
| File | Dimensions |
|---|---|
| `monogram-jtwinkle-gold@1x.png` | 200 × 180 |
| `monogram-jtwinkle-gold@2x.png` | 400 × 360 |
| `monogram-jtwinkle-gold@4x.png` | 800 × 720 |
| `monogram-jtwinkle-white@1x.png` | 200 × 180 |
| `monogram-jtwinkle-white@2x.png` | 400 × 360 |
| `monogram-jtwinkle-white@4x.png` | 800 × 720 |

### `starburst/` — 12 files
| File | Dimensions |
|---|---|
| `starburst-full-gold@1x.png` | 120 × 120 |
| `starburst-full-gold@2x.png` | 240 × 240 |
| `starburst-full-gold@4x.png` | 480 × 480 |
| `starburst-full-white@1x.png` | 120 × 120 |
| `starburst-full-white@2x.png` | 240 × 240 |
| `starburst-full-white@4x.png` | 480 × 480 |
| `starburst-simple-gold@1x.png` | 48 × 48 |
| `starburst-simple-gold@2x.png` | 96 × 96 |
| `starburst-simple-gold@4x.png` | 192 × 192 |
| `starburst-simple-white@1x.png` | 48 × 48 |
| `starburst-simple-white@2x.png` | 96 × 96 |
| `starburst-simple-white@4x.png` | 192 × 192 |

All PNGs verified to have 4 channels with alpha (true transparency).

---

## 7 · Design Tokens — `brand/tokens/` (2 files)

| File | Purpose | Status |
|---|---|---|
| `brand.css` | CSS custom properties (`--jp-*`). Single source of truth for colors, typography, spacing, radii. Imported at app root. | ✓ verified |
| `tokens.ts` | TypeScript mirror for component-level access. Same values, typed. | ✓ verified |

---

## 8 · Reference Documentation — `brand/docs/`

| File | Purpose | Status |
|---|---|---|
| `design-system.md` | Non-negotiable brand rules. Color tokens, typography, spacing, lockup recipes, what NOT to do. | ✓ canonical |
| `brand-system.html` | Living visual brand reference. Open in browser for an interactive style guide. | ✓ canonical |
| `photos/patio.png` | Sample property photo (golden-hour patio with hot tub). Used for photo overlay verification. | sample |
| `photos/dining.jpg` | Sample property photo (interior dining room). Used for photo overlay verification. | sample |

---

## 9 · Audit Page

| File | Purpose | Status |
|---|---|---|
| `brand/_audit.html` | Permanent comprehensive showcase of every asset across all 7 sections. Open in a browser to inspect the full inventory visually. | ✓ verified |

---

## Build Pipeline — `scripts/`

Not part of `brand/` but documented here for completeness. Re-running these scripts regenerates the production assets.

### `scripts/_fonts/` — 5 TTF files
Cormorant Garamond (400, 700, 400-italic) and Outfit (300, 400). Used by the outlining pipeline.

### `scripts/lib/` — Shared helpers
| File | Exports |
|---|---|
| `fonts.mjs` | `fonts` — pre-loaded `opentype.js` Font objects |
| `text.mjs` | `textToPathD()`, `measureText()` — text-to-outlined-path conversion with letter-spacing support |
| `starburst.mjs` | `starburst({ size, tier, ... })` — generates starburst SVG markup with tier degradation (8/6/4/1 lines) and per-stroke overrides |

### Build scripts (run from project root)
| Script | Output | What it produces |
|---|---|---|
| `node scripts/outline-svgs.mjs` | `brand/logos/*.svg` | Re-outlines the 6 wordmark/monogram SVGs (starbursts are pure geometry, untouched) |
| `node scripts/build-favicons.mjs` | `brand/favicons/*` | All 5 favicon SVGs + PNGs + `favicon.ico` |
| `node scripts/build-og.mjs` | `brand/social/og-image.{svg,png}` | OG link preview card |
| `node scripts/build-social-avatar.mjs` | `brand/social/social-avatar-1080.{svg,png}` | Instagram profile picture |
| `node scripts/build-patterns.mjs` | `brand/patterns/*.svg` | Both pattern tiles |
| `node scripts/build-png-exports.mjs` | `brand/png/**/*.png` | All 30 logo PNG exports |

To rebuild everything from scratch:
```bash
node scripts/outline-svgs.mjs && \
node scripts/build-favicons.mjs && \
node scripts/build-og.mjs && \
node scripts/build-social-avatar.mjs && \
node scripts/build-patterns.mjs && \
node scripts/build-png-exports.mjs
```

(The photo overlay SVG is handcrafted — no script needed.)

### Dev dependencies
- `opentype.js@1.3.4` — font parsing + path generation
- `sharp@0.34.5` — SVG → PNG rasterization
- `png-to-ico` — multi-resolution `.ico` generation

---

## Notable design decisions

- **Cormorant Bold's J descender** extends below the baseline by ~24% of font size. The original master monogram (200×160) clipped this. **Fixed in Phase 7:** monogram canvas bumped to 200×180 so the descender curl renders fully without clipping.
- **Favicon J + twinkle relationship** uses a fixed proportional formula (`twinkleGapRatio: 0.26`, `twinkleTopRatio: 0.15`, `opticalShift: 5px`) tuned through three iterations to balance brand presence with breathing room at small sizes.
- **Social avatar centering** uses the combined J+twinkle bounding box centroid (not the J alone) so the composite reads as balanced inside Instagram's circular crop. Centering error: dx=0.00, dy=0.00.
- **Pattern tile visibility** was bumped 2× from the brief's spec because the original opacities were below the threshold of perception. The current values are still subtle enough that text on top remains fully readable.
- **Photo overlay is warm gold, never dark.** The gradient peaks at `#c88c1e` @ 40% opacity at the bottom — designed to feel like golden hour light pooling under the image, not a shadow scrim.

---

*Last updated: 2026-04-10*
