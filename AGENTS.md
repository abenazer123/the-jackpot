<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design System

Before writing any visual code, read `/brand/docs/design-system.md`. It contains non-negotiable brand rules that override all subjective design judgment.

- **Tokens (CSS):** `/brand/tokens/brand.css` — imported at app root, provides all `--jp-*` variables
- **Tokens (TypeScript):** `/brand/tokens/tokens.ts` — import into components for JS/TS access
- **Tailwind utilities:** All brand tokens are mapped in `globals.css` via `@theme inline` (e.g. `text-jp-gold`, `bg-jp-linen`, `font-display`, `font-body`)
- **Reference docs:** `/brand/docs/brand-system.html` (visual reference), `/brand/docs/design-system.md` (rules)
- **Logos:** `/brand/logos/` (SVG masters)

## Critical rules (read design-system.md for the full list)

1. No black (`#000`, `#333`, `rgb(0,0,0)`) anywhere — text is warm olive `#7a6030`
2. No dark backgrounds — the brand is always warm and light
3. No cool colors — no blue, gray, silver
4. Never hardcode colors, fonts, spacing, or radii — always use tokens
5. Cormorant Garamond = display. Outfit = function. Never swap them.
6. Gold, peach, sage are display/large-text only — they fail WCAG AA for body text
7. Shadows and borders use warm olive at low opacity, never gray
