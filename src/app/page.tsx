import { OccasionProvider } from "@/components/brand/OccasionProvider";
import { StickyBookingBar } from "@/components/brand/StickyBookingBar";
import { HeroSection } from "@/components/sections/HeroSection";
import { HighlightsSection } from "@/components/sections/HighlightsSection";
import { LocationSection } from "@/components/sections/LocationSection";
import { OccasionSelector } from "@/components/sections/OccasionSelector";
import { Testimonials } from "@/components/sections/Testimonials";
import { TrustBadges } from "@/components/sections/TrustBadges";

export default function Home() {
  return (
    <OccasionProvider>
      <HeroSection animate={false} />
      <TrustBadges />
      <OccasionSelector />
      <HighlightsSection />
      <LocationSection />
      <Testimonials />
      <StickyBookingBar />
    </OccasionProvider>
  );
}
