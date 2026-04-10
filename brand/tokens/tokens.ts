/**
 * THE JACKPOT CHICAGO — Design Tokens
 *
 * This is the single source of truth for all visual design decisions.
 * Every component, page, and template in this project MUST reference
 * these tokens. Never hardcode colors, font sizes, or spacing values.
 *
 * Usage:
 *   import { colors, typography, spacing } from '@/brand/tokens'
 */

export const colors = {
  // --- Primary Palette ---
  gold: {
    DEFAULT: '#d4a930',
    bright: '#e8b923',
    deep: '#c49025',
    10: '#fbf6ea',
    25: '#f4eacb',
    50: '#ead498',
    75: '#dfbe64',
  },
  peach: {
    DEFAULT: '#ff9050',
    soft: '#e8a040',
    10: '#fff4ee',
    25: '#ffe3d3',
    50: '#ffc8a8',
    75: '#ffac7c',
  },
  linen: {
    DEFAULT: '#faf6ef',
    mid: '#f5eddd',
    deep: '#f0e4cc',
  },
  sage: {
    DEFAULT: '#8aa077',
    deep: '#6a8a55',
    10: '#f3f6f1',
    25: '#e2e7dd',
    50: '#c4d0bb',
  },
  terra: {
    DEFAULT: '#c08050',
    deep: '#b07242',
    10: '#f9f2ee',
    25: '#efdfd3',
    50: '#e0c0a8',
  },
  olive: {
    DEFAULT: '#7a6030',
    light: '#a08840',
    soft: '#b09860',
  },
  error: '#d45a30',

  // --- Semantic Assignments ---
  text: {
    primary: '#7a6030',
    secondary: '#a08840',
    tertiary: '#b09860',
    link: '#c49025',
    linkHover: '#e8a040',
    onColor: '#ffffff',
  },
  bg: {
    primary: '#ffffff',
    secondary: '#faf6ef',
    tertiary: '#f5eddd',
    wash: 'rgba(212, 169, 48, 0.06)',
  },
  border: {
    default: 'rgba(139, 112, 64, 0.12)',
    hover: 'rgba(139, 112, 64, 0.25)',
    focus: '#e8b923',
    accent: '#d4a930',
  },
  divider: 'rgba(139, 112, 64, 0.10)',
  shadow: 'rgba(139, 112, 64, 0.08)',
} as const;

export const gradient = {
  brand: 'linear-gradient(135deg, #e0a520 0%, #e8b020 20%, #f0a830 45%, #f09040 70%, #ee8045 100%)',
  angle: '135deg',
  stops: ['#e0a520', '#e8b020', '#f0a830', '#f09040', '#ee8045'],
  fallback: '#e8a040',
  button: 'linear-gradient(135deg, #e8b923, #ff9050)',
} as const;

export const typography = {
  // --- Font Families ---
  family: {
    display: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    body: "'Outfit', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  },

  // --- Type Scale ---
  scale: {
    displayXl: { family: 'display' as const, weight: 700, size: 'clamp(48px, 8vw, 100px)', lineHeight: 0.85, letterSpacing: '3px' },
    displayL:  { family: 'display' as const, weight: 600, size: 'clamp(28px, 4vw, 48px)',  lineHeight: 1.1,  letterSpacing: '2px' },
    displayM:  { family: 'display' as const, weight: 400, size: 'clamp(22px, 2.5vw, 32px)', lineHeight: 1.2,  letterSpacing: '0', style: 'italic' as const },
    displayS:  { family: 'display' as const, weight: 500, size: 'clamp(20px, 2vw, 26px)',  lineHeight: 1.25, letterSpacing: '0.5px' },
    h1:        { family: 'display' as const, weight: 600, size: 'clamp(26px, 3vw, 36px)',  lineHeight: 1.15, letterSpacing: '0' },
    h2:        { family: 'display' as const, weight: 600, size: 'clamp(20px, 2.2vw, 28px)', lineHeight: 1.2,  letterSpacing: '0' },
    h3:        { family: 'body' as const,    weight: 500, size: 'clamp(17px, 1.6vw, 20px)', lineHeight: 1.3,  letterSpacing: '0' },
    h4:        { family: 'body' as const,    weight: 500, size: 'clamp(15px, 1.2vw, 17px)', lineHeight: 1.35, letterSpacing: '0' },
    bodyLg:    { family: 'body' as const,    weight: 300, size: 'clamp(16px, 1.3vw, 18px)', lineHeight: 1.7,  letterSpacing: '0' },
    body:      { family: 'body' as const,    weight: 300, size: '15px',                      lineHeight: 1.7,  letterSpacing: '0' },
    bodySm:    { family: 'body' as const,    weight: 400, size: '13px',                      lineHeight: 1.6,  letterSpacing: '0' },
    label:     { family: 'body' as const,    weight: 500, size: '13px',                      lineHeight: 1.4,  letterSpacing: '0.5px' },
    detail:    { family: 'body' as const,    weight: 400, size: '11px',                      lineHeight: 1.4,  letterSpacing: '4px', transform: 'uppercase' as const },
    stat:      { family: 'display' as const, weight: 700, size: 'clamp(48px, 6vw, 80px)',   lineHeight: 0.85, letterSpacing: '0' },
  },

  // --- Brand Lockup Recipes (fixed, never improvise) ---
  lockup: {
    THE:       { family: 'body' as const,    weight: 300, letterSpacing: '7px', transform: 'uppercase' as const, sizeRatio: 0.15 },
    JACKPOT:   { family: 'display' as const, weight: 700, letterSpacing: '4px', transform: 'uppercase' as const, minSize: '36px', color: 'gold' as const, neverDark: true },
    CHICAGO:   { family: 'body' as const,    weight: 400, letterSpacing: '5px', transform: 'uppercase' as const, sizeRatio: 0.12, opacity: 0.7 },
    tagline:   { family: 'display' as const, weight: 400, style: 'italic' as const, letterSpacing: '0', transform: 'none' as const, text: 'you found something special' },
  },

  // --- Pairing Rules ---
  // Cormorant (display): headlines, taglines, quotes, stat numbers, emotional moments
  // Outfit (body): body copy, captions, buttons, nav, labels, form fields, errors
} as const;

export const spacing = {
  // 8px base grid
  1: '8px',
  2: '16px',
  3: '24px',
  4: '32px',
  5: '40px',
  6: '48px',
  8: '64px',
  10: '80px',

  // Semantic spacing
  headlineToBody: '24px',
  betweenParagraphs: '16px',
  sectionToContent: '32px',
  betweenSections: '64px',
  cardPadding: '24px',
  cardGap: '16px',
  maxLineWidth: '640px',
} as const;

export const radius = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  full: '9999px',
} as const;

export const transition = {
  default: '200ms ease',
  slow: '400ms ease',
} as const;

/** Image overlay for text on photos — warm gold wash, never dark scrim */
export const imageOverlay =
  'linear-gradient(180deg, rgba(240,168,48,0.0) 40%, rgba(200,140,30,0.35) 100%)';

// --- Brand Rules (enforced by convention) ---
// JACKPOT is NEVER in a dark color
// JACKPOT NEVER appears on a dark background
// No espresso, no black backgrounds anywhere in the brand
// The darkest element is terracotta — even that glows
// Text is warm olive, never black
// Gold, peach, sage are display-only — never body text (fails WCAG)
// The brand gradient is 135 degrees, always
// Photo overlays use warm gold wash, never dark scrim
// Bullets use ✦ in gold, not standard dots
// Smart curly quotes always (" " not " ")
// Em dashes with thin spaces ( — )
