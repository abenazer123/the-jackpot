import type { CSSProperties } from "react";

/**
 * Bachelorette scoped palette — a documented exception (same idea as the
 * confetti palette), NOT brand-wide. Applied as INLINE custom properties
 * on a wrapper so it reliably cascades to shared components (the Olivia
 * chat reads `var(--jp-gold)`) and can't be pruned by the CSS compiler.
 * Retints the gold accent toward rose and exposes `--jp-bach-*` tokens for
 * bespoke art direction. Body text stays warm olive (set elsewhere).
 *
 * Used by the /bachelorette hero and the chat session when
 * occasion=bachelorette.
 */
export const bachThemeVars = {
  "--jp-gold": "#e0608c",
  "--jp-gold-bright": "#ec5f8a",
  "--jp-gold-deep": "#cf4f78",

  "--jp-bach-rose": "#f7a8c4",
  "--jp-bach-pink": "#ec5f8a",
  "--jp-bach-coral": "#f0506a",
  "--jp-bach-blush": "#f9d9d2",
  "--jp-bach-gradient":
    "linear-gradient(135deg, #ea5a86 0%, #f06d80 22%, #f78a63 50%, #f2a52e 80%, #ec8a3a 100%)",
} as CSSProperties;
