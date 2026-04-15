/**
 * GroundingLine — the small "luxury group home in Chicago" subtitle.
 * Outfit detail style: 11px, letter-spacing 3px, uppercase, white at 55% opacity.
 */

interface GroundingLineProps {
  children: React.ReactNode;
  className?: string;
}

export function GroundingLine({ children, className = "" }: GroundingLineProps) {
  return (
    <div
      className={`font-body text-[11px] font-normal uppercase tracking-[3px] text-white/55 ${className}`}
    >
      {children}
    </div>
  );
}
