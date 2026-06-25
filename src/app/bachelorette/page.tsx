/**
 * /bachelorette — the dedicated bachelorette landing page (v2).
 *
 * Built as the arc of her weekend: arrival → it's already done → the crew
 * arrives → the days → the nights and mornings → what it costs (flipped
 * anchor) → proof → host → hold. Wrapped in the bachelorette rose-gold
 * theme (bachThemeVars) and an OccasionProvider preset to "bachelorette"
 * so the occasion-aware reused sections render tailored content. One CTA
 * spine throughout, routing into the bachelorette-seeded Olivia chat.
 */

import type { Viewport } from "next";

import { bachThemeVars } from "@/components/brand/bachTheme";
import { OccasionProvider } from "@/components/brand/OccasionProvider";
import { BacheloretteHero } from "@/components/sections/BacheloretteHero";
import { BachCost } from "@/components/sections/BachCost";
import { BachCrew } from "@/components/sections/BachCrew";
import { BachDays } from "@/components/sections/BachDays";
import { BachHold } from "@/components/sections/BachHold";
import { BachHost } from "@/components/sections/BachHost";
import { BachIncluded } from "@/components/sections/BachIncluded";
import { BachNights } from "@/components/sections/BachNights";
import { BachProof } from "@/components/sections/BachProof";
import { TrustBadges } from "@/components/sections/TrustBadges";
import { Testimonials } from "@/components/sections/Testimonials";

// Render edge-to-edge under the iPhone status bar / Dynamic Island so the
// hero video fills the top instead of a white safe-area bar. Scoped to this
// route; the hero pads its text by env(safe-area-inset-top). Re-declares the
// inherited fields alongside viewportFit.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  viewportFit: "cover",
};

export default function BachelorettePage() {
  return (
    <OccasionProvider initialOccasion="bachelorette">
      <main style={bachThemeVars}>
        {/* 1 arrival */} <BacheloretteHero />
        {/* 2 it's already done */} <BachIncluded />
        {/* 3 the crew arrives */} <BachCrew />
        {/* 4 the days */} <BachDays />
        {/* 5 the nights + mornings */} <BachNights />
        {/* 6 what it costs */} <BachCost />
        {/* 7 proof */} <BachProof />
        <Testimonials />
        <TrustBadges />
        {/* 8 host */} <BachHost />
        {/* 9 hold */} <BachHold />
      </main>
    </OccasionProvider>
  );
}
