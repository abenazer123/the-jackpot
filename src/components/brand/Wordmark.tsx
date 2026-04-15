/**
 * Wordmark — the THE / JACKPOT / starburst+CHICAGO lockup, rendered as text.
 *
 * Uses the brand's actual fonts (Cormorant Bold for JACKPOT, Outfit for the
 * eyebrow + CHICAGO line). Renders as text rather than as an embedded SVG so
 * it can scale fluidly with clamp() and remain crisp at any size.
 *
 * For fixed-size lockups (footer, nav scrolled state), prefer the production
 * SVG at brand/logos/wordmark-primary-{gold,white}.svg.
 */

import { Starburst } from "./Starburst";

type Size = "sm" | "md" | "lg" | "xl";
type Color = "white" | "gold" | "gradient";
type Align = "left" | "center";

interface WordmarkProps {
  size?: Size;
  color?: Color;
  align?: Align;
  /** "JACKPOT" tag — defaults to h1 for the hero, can be h2/h3/div elsewhere */
  as?: "h1" | "h2" | "h3" | "div";
  className?: string;
}

const sizeClasses: Record<Size, { jackpot: string; the: string; chicago: string; gap: string }> = {
  sm: {
    jackpot: "text-[clamp(36px,4.5vw,56px)]",
    the: "text-[11px] tracking-[6px] mb-1",
    chicago: "text-[10px] tracking-[5px]",
    gap: "gap-2",
  },
  md: {
    jackpot: "text-[clamp(48px,6vw,72px)]",
    the: "text-[12px] tracking-[7px] mb-1",
    chicago: "text-[11px] tracking-[5px]",
    gap: "gap-2.5",
  },
  lg: {
    jackpot: "text-[clamp(56px,7.5vw,96px)]",
    the: "text-[13px] tracking-[7px] mb-1",
    chicago: "text-[12px] tracking-[6px]",
    gap: "gap-3",
  },
  xl: {
    jackpot: "text-[clamp(64px,8.5vw,124px)]",
    the: "text-[13px] tracking-[8px] mb-1.5",
    chicago: "text-[12px] tracking-[6px]",
    gap: "gap-3.5",
  },
};

const colorClasses: Record<Color, { jackpot: string; the: string; chicago: string; star: string }> = {
  white: {
    jackpot: "text-white",
    the: "text-white/85",
    chicago: "text-white/70",
    star: "#ffffff",
  },
  gold: {
    jackpot: "text-jp-gold",
    the: "text-jp-peach",
    chicago: "text-jp-text-secondary",
    star: "#d4a930",
  },
  gradient: {
    jackpot:
      "bg-clip-text text-transparent [background-image:var(--jp-gradient)] pb-[0.18em]",
    the: "text-jp-peach",
    chicago: "text-jp-text-secondary",
    star: "#d4a930",
  },
};

export function Wordmark({
  size = "lg",
  color = "white",
  align = "left",
  as: Heading = "h1",
  className = "",
}: WordmarkProps) {
  const s = sizeClasses[size];
  const c = colorClasses[color];
  const alignClass = align === "center" ? "items-center text-center" : "items-start text-left";

  return (
    <div className={`flex flex-col ${alignClass} ${className}`}>
      <div className={`font-body font-light uppercase ${s.the} ${c.the}`}>THE</div>
      <Heading
        className={`font-display font-bold leading-[0.92] tracking-[3px] pb-[0.18em] ${s.jackpot} ${c.jackpot}`}
      >
        JACKPOT
      </Heading>
      <div className={`flex items-center mt-1 ${s.gap}`}>
        <Starburst
          size={7}
          tier={4}
          color={c.star}
          secondary={c.star}
          center={c.star}
          axisOpacity={0.8}
          diagOpacity={0.55}
        />
        <span className={`font-body font-light uppercase ${s.chicago} ${c.chicago}`}>
          CHICAGO
        </span>
      </div>
    </div>
  );
}
