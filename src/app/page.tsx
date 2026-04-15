import { StickyBookingBar } from "@/components/brand/StickyBookingBar";
import { HeroSection } from "@/components/sections/HeroSection";
import { HighlightsSection } from "@/components/sections/HighlightsSection";
import { LocationSection } from "@/components/sections/LocationSection";
import { Testimonials } from "@/components/sections/Testimonials";
import { TrustBadges } from "@/components/sections/TrustBadges";

export default function Home() {
  return (
    <>
      <HeroSection animate={false} />
      <TrustBadges />
      <HighlightsSection />
      <LocationSection />
      <Testimonials />
      <StickyBookingBar />
    </>
  );
}
