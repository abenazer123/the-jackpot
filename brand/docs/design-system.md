# The Jackpot Chicago — Design System Rules

> This file is the mandatory reference for any developer, designer, or AI agent working on this codebase. Read it before writing any code. Every visual decision in this project flows from the brand system defined here. When in doubt, reference the tokens in `/brand/tokens/tokens.ts` and `/brand/tokens/brand.css`.

---

## The Brand in One Sentence

The Jackpot is a luxury group home in Chicago (sleeps 14) whose brand feels like **fruit bowl and brunch at golden hour** — warm, bright, celebratory, and alive. Never dark. Never cold. Never stiff.

---

## Non-Negotiable Rules

These rules are absolute. They override any subjective design judgment.

1. **JACKPOT is never in a dark color.** Not dark gray, not espresso, not black. Gold, gradient, or white only.
2. **JACKPOT never appears on a dark background.** The darkest background is terracotta, and even that glows.
3. **No black anywhere in the brand.** Text is warm olive `#7a6030`. Borders are warm olive at low opacity. Shadows are warm olive at low opacity. Never `#000`, never `#333`, never `rgb(0,0,0)`.
4. **No cool colors.** No blue, no gray, no silver, no cool-toned anything. Every neutral skews warm.
5. **No espresso/dark brown.** This was explicitly removed from the palette.
6. **The gradient is always 135 degrees.** The angle is as much a brand element as the colors.
7. **Body text is never gold, peach, or sage.** These colors fail WCAG AA for body text. They are display/large-text only.
8. **Cormorant Garamond is for display. Outfit is for function.** Never swap them.

---

## Design Tokens

### Where They Live

- **TypeScript tokens:** `/brand/tokens/tokens.ts` — import into components
- **CSS variables:** `/brand/tokens/brand.css` — import in root layout
- **Never hardcode** a color, font size, spacing value, or radius. Always reference tokens.

### Colors

| Token | Value | Use |
|-------|-------|-----|
| `--jp-gold` | `#d4a930` | Primary brand color, headlines, accents |
| `--jp-gold-bright` | `#e8b923` | Brighter gold for gradient start, focus rings |
| `--jp-peach` | `#ff9050` | Spark accent (~25% visual weight), CTAs |
| `--jp-linen` | `#faf6ef` | Secondary background, cards |
| `--jp-sage` | `#8aa077` | Nature accent, success states |
| `--jp-terra` | `#c08050` | Warm accent, warmth moments |
| `--jp-olive` | `#7a6030` | Primary text color |
| `--jp-text-primary` | `#7a6030` | Body text, headings |
| `--jp-text-secondary` | `#a08840` | Captions, metadata |
| `--jp-text-tertiary` | `#b09860` | Placeholders, hints, fine print |
| `--jp-text-link` | `#c49025` | Hyperlinks |
| `--jp-bg-primary` | `#ffffff` | Default page background |
| `--jp-bg-secondary` | `#faf6ef` | Alternate sections, cards |
| `--jp-bg-tertiary` | `#f5eddd` | Inset areas, footer |
| `--jp-gradient` | 5-stop gold-to-peach | Hero sections, CTAs, feature moments |

### Typography

**Fonts:**
- Display: `Cormorant Garamond` — weights 400, 500, 600, 700 (+ italics)
- Body: `Outfit` — weights 300, 400, 500

**When to use which:**
- **Cormorant Garamond:** Page titles, section headlines, taglines, pull quotes, stat numbers ($57, 14), emotional/editorial moments, the word JACKPOT
- **Outfit:** Body copy, captions, buttons, navigation, form labels, error messages, metadata, social captions, anything functional

**The type scale:**
- Display XL: Cormorant 700, 48-100px — JACKPOT hero moments
- Display L: Cormorant 600, 28-48px — section headlines
- Display M: Cormorant 400 italic, 22-32px — taglines, quotes
- Display S: Cormorant 500, 20-26px — card headings
- H1-H2: Cormorant 600 — page/section titles
- H3-H4: Outfit 500 — subsection titles
- Body: Outfit 300, 15-18px — all readable copy
- Label: Outfit 500, 13px — buttons, nav, form labels
- Detail: Outfit 400, 11px, uppercase, wide tracking — CHICAGO, handles, fine print
- Stat: Cormorant 700, 48-80px — big numbers

### Spacing

All spacing uses an **8px base grid**. Every margin, padding, and gap must be a multiple of 8.

```
8px   -> --jp-space-1  (tight: label to input)
16px  -> --jp-space-2  (default: between paragraphs, card gaps)
24px  -> --jp-space-3  (comfortable: headline to body, card padding)
32px  -> --jp-space-4  (section title to content)
48px  -> --jp-space-6  (between subsections)
64px  -> --jp-space-8  (between major sections)
80px  -> --jp-space-10 (page-level breathing room)
```

Maximum line width for body text: `640px` (~65-70 characters).

### Border Radius

- `--jp-radius-sm: 8px` — small elements, inputs
- `--jp-radius-md: 12px` — default cards, containers
- `--jp-radius-lg: 16px` — featured cards, modals
- `--jp-radius-xl: 24px` — hero sections
- `--jp-radius-full: 9999px` — pills, buttons, tags

### Shadows

Shadows are **always warm**, never gray.
```css
box-shadow: 0 2px 12px rgba(139, 112, 64, 0.08);  /* subtle */
box-shadow: 0 4px 24px rgba(139, 112, 64, 0.12);  /* elevated */
```
Never use `rgba(0, 0, 0, ...)` for shadows.

---

## Brand Lockup Typography

These are **fixed recipes**. Never improvise the brand name treatment.

| Element | Font | Weight | Letter-spacing | Rules |
|---------|------|--------|----------------|-------|
| THE | Outfit | 300 | 7px | Uppercase. ~15% of JACKPOT size. Always above JACKPOT. |
| JACKPOT | Cormorant | 700 | 4px | Uppercase. Gold, gradient, or white. NEVER dark. Never below 36px. |
| CHICAGO | Outfit | 400 | 5px | Uppercase. ~12% of JACKPOT size. 50-80% opacity. Below or right of JACKPOT. |
| Tagline | Cormorant | 400 italic | 0 | Lowercase. Always italic. Text: "you found something special" |
| Starburst | SVG | — | — | Scales proportionally. Center dot is peach. Lines are gold with peach tips. |

---

## Component Patterns

### Buttons

Primary — gradient pill with white text. Secondary — gold outline. See tokens for exact values.

### Cards

- Always use `--jp-bg-secondary` (linen) or `--jp-gradient` as card backgrounds
- Card padding: `24-32px`
- Card radius: `--jp-radius-md` to `--jp-radius-lg`
- Card shadow: warm, never gray

### Tags / Pills

- Background: color tint at 10%
- Text: full color
- Font: detail size (11px), uppercase, letter-spacing 2px
- Radius: full (pill shape)

### Text on Images

- **Always use a warm gold overlay**, never a dark scrim
- Overlay: `linear-gradient(180deg, rgba(240,168,48,0.0) 40%, rgba(200,140,30,0.35) 100%)`
- Text on images is always white
- Minimum text size: 18px (Outfit) or 24px (Cormorant)
- Never place gold or olive text on photos

---

## Logo Files

Located in `/brand/logos/`. These are the master SVGs.

| File | Use |
|------|-----|
| `wordmark-asymmetric-gradient.svg` | Primary logo on gradient background |
| `wordmark-asymmetric-transparent.svg` | Primary logo for light backgrounds |
| `wordmark-centered.svg` | Formal centered version |
| `monogram-gold-filled.svg` | Instagram avatar, app icon |
| `monogram-starburst.svg` | Featured monogram with starburst pattern |
| `monogram-gold-ring.svg` | Print applications |
| `monogram-peach-ring.svg` | Social fun variant |
| `monogram-sage-ring.svg` | Nature variant |
| `starburst-motif.svg` | Standalone decorative element |

---

## The Starburst Motif

The starburst is a geometric sunburst with gold lines and peach-tipped edges (the "neon bleed"). It has three intensity levels:

- **100%** — logo mark, hero moments
- **30%** — divider, decorative accent
- **5%** — watermark, background texture

When rendering the starburst in code:
- Primary axes (vertical + horizontal): thicker lines, higher opacity
- Diagonal axes: medium lines, medium opacity
- Tertiary lines: thin, low opacity
- Center: small circle in `--jp-peach`
- Tip color on thin lines fades toward peach

---

## Photography & Image Direction

- **Color grading:** Warm highlights pushed toward gold, shadows warm (never blue/cool), greens slightly desaturated toward sage
- **Lighting:** Natural light, golden hour, warm ambient. Never flash, never clinical.
- **Content:** Lifestyle over architectural. People using the space, not empty rooms.
- **No cool tones** in any photography used in the brand

---

## Voice & Copy

- **Tone:** Confident without bragging. Warm without being cheesy. The friend who always finds the best spot.
- **Hero lines:** "You just hit the Jackpot" - "You found something special" - "Stop scrolling. You found it."
- **Words to use:** home (not house), crew/group (not party), celebration (not event)
- **Words to avoid:** rental, listing, Airbnb, party house
- **Bullet character:** starburst (U+2726) in gold, or middle dot. Never standard bullet.
- **Quotes:** Always smart curly. Em dashes with thin spaces.

---

## Accessibility

| Combination | Contrast | Rating |
|-------------|----------|--------|
| Olive `#7a6030` on White `#fff` | ~5.5:1 | AA |
| Olive `#7a6030` on Linen `#faf6ef` | ~5.0:1 | AA |
| Gold `#d4a930` on White | 2.21 | Large text only |
| Peach `#ff9050` on White | 2.24 | Large text only |
| White on Gradient (mid) | ~2.2 | Large text only |
| White on Terracotta | 3.26 | AA-Large |

**Rule:** Gold, peach, and sage are never used for body-sized text. They are headline/display only.

---

## What NOT to Do

- Use Inter, Roboto, Arial, or any generic sans-serif
- Use pink (use peach instead)
- Use gambling imagery (no dice, cards, slot machines)
- Use dark backgrounds
- Use gray shadows or borders
- Use flat black for text
- Use blue, gray, or silver anywhere
- Add drop shadows, glows, or 3D effects to the logo
- Stretch, rotate, or rearrange logo elements
- Use a different typeface for the brand name
- Reference "Airbnb" or "rental" in marketing copy
