/**
 * StatStrip — inline horizontal stats with hairline separators.
 *
 * Used in the hero to show "14 sleeps · 5 BR · 3 BA · 5.0 ★ 47" as a small
 * editorial detail strip below the tagline. Light tone is white-on-gradient,
 * dark tone is olive-on-linen.
 */

export interface Stat {
  /** The big number — supports a string so things like "5.0 ★ 47" can render */
  value: string;
  /** The small label below/beside */
  label: string;
}

interface StatStripProps {
  stats: Stat[];
  tone?: "light" | "dark";
  className?: string;
}

export function StatStrip({ stats, tone = "light", className = "" }: StatStripProps) {
  const numColor = tone === "light" ? "text-white" : "text-jp-olive";
  const labelColor = tone === "light" ? "text-white/70" : "text-jp-text-secondary";
  const sepColor = tone === "light" ? "bg-white/25" : "bg-jp-border";

  return (
    <div
      className={`flex flex-wrap items-center gap-[18px] font-body text-[11px] font-normal uppercase tracking-[2.5px] ${className}`}
    >
      {stats.map((stat, i) => (
        <div key={`${stat.label}-${i}`} className="contents">
          {i > 0 && <span className={`block h-[18px] w-px ${sepColor}`} aria-hidden="true" />}
          <span className="inline-flex items-baseline gap-1.5">
            <span className={`font-display text-[18px] font-bold tracking-normal ${numColor}`}>
              {stat.value}
            </span>
            <span className={labelColor}>{stat.label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
