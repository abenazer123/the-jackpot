/**
 * PillButton — the brand CTA pill.
 *
 * Variants:
 *   - white:    white background, gold text (default — for use on gradient backgrounds)
 *   - gradient: brand gradient background, white text (for use on linen/light)
 *   - outline:  transparent background, gold border + text (secondary CTA)
 *
 * Renders as <a> when href is provided, otherwise <button>.
 */

interface PillButtonProps {
  variant?: "white" | "gradient" | "outline";
  href?: string;
  children: React.ReactNode;
  className?: string;
  type?: "button" | "submit";
}

const baseClasses =
  "inline-flex items-center gap-2.5 rounded-full px-9 py-[17px] font-body text-[13px] font-medium tracking-wide no-underline transition-all duration-200 ease-out hover:-translate-y-px";

const variantClasses: Record<NonNullable<PillButtonProps["variant"]>, string> = {
  white:
    "bg-white text-jp-gold-deep hover:shadow-[0_8px_24px_rgba(255,255,255,0.18)]",
  gradient:
    "bg-[image:var(--jp-gradient-button)] text-white hover:shadow-[0_8px_24px_rgba(212,169,48,0.28)]",
  outline:
    "border-[1.5px] border-jp-gold bg-transparent text-jp-gold hover:bg-jp-gold-10",
};

export function PillButton({
  variant = "white",
  href,
  children,
  className = "",
  type = "button",
}: PillButtonProps) {
  const cls = `${baseClasses} ${variantClasses[variant]} ${className}`;

  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }

  return (
    <button type={type} className={cls}>
      {children}
    </button>
  );
}
