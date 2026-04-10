function Starburst({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={className}>
      <g transform="translate(7,7)">
        <line x1="0" y1="-6" x2="0" y2="6" stroke="#e8a040" strokeWidth="0.8" opacity="0.6" />
        <line x1="-6" y1="0" x2="6" y2="0" stroke="#e8a040" strokeWidth="0.8" opacity="0.6" />
        <line x1="-4" y1="-4" x2="4" y2="4" stroke="#d4a930" strokeWidth="0.5" opacity="0.4" />
        <line x1="4" y1="-4" x2="-4" y2="4" stroke="#d4a930" strokeWidth="0.5" opacity="0.4" />
        <circle cx="0" cy="0" r="1.2" fill="#ff9050" />
      </g>
    </svg>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-jp-bg px-8">
      <main className="flex flex-col items-center text-center">
        {/* Brand lockup */}
        <div className="font-body text-[13px] font-light tracking-[7px] uppercase text-jp-peach">
          THE
        </div>
        <h1 className="mt-1 font-display text-[clamp(48px,8vw,80px)] font-bold leading-[0.85] tracking-[4px] text-jp-gold">
          JACKPOT
        </h1>
        <div className="mt-4 flex items-center gap-3">
          <p className="font-display text-base italic text-jp-text-secondary">
            you found something special
          </p>
          <Starburst />
          <span className="font-body text-[11px] font-normal tracking-[5px] uppercase text-jp-text-secondary opacity-70">
            CHICAGO
          </span>
        </div>

        {/* Gradient divider */}
        <div
          className="mt-10 h-px w-48"
          style={{ background: "var(--jp-gradient)" }}
        />

        {/* Tagline */}
        <p className="mt-10 max-w-md font-body text-[15px] font-light leading-relaxed text-jp-text">
          A luxury group home in Chicago that sleeps 14. Hot tub, cinema, game
          room, and a fire pit under the stars.
        </p>

        {/* CTA buttons */}
        <div className="mt-8 flex gap-4">
          <a
            href="#"
            className="rounded-full bg-gradient-to-br from-jp-gold-bright to-jp-peach px-7 py-3 font-body text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Book now
          </a>
          <a
            href="#"
            className="rounded-full border-[1.5px] border-jp-gold px-7 py-3 font-body text-[13px] font-medium text-jp-gold transition-colors hover:bg-jp-gold-10"
          >
            Explore
          </a>
        </div>

        {/* Tags */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {["Hot tub", "Cinema", "Game room", "Fire pit"].map((tag, i) => {
            const tints = [
              ["bg-jp-gold-10", "text-jp-gold"],
              ["bg-jp-peach-10", "text-jp-peach"],
              ["bg-jp-sage-10", "text-jp-sage"],
              ["bg-jp-terra-10", "text-jp-terra"],
            ];
            return (
              <span
                key={tag}
                className={`rounded-full px-3.5 py-1.5 font-body text-[11px] font-normal uppercase tracking-[2px] ${tints[i][0]} ${tints[i][1]}`}
              >
                {tag}
              </span>
            );
          })}
        </div>
      </main>
    </div>
  );
}
