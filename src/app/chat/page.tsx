/**
 * /chat — test route for the conversational inquiry experience.
 *
 * Hero only (no TrustBadges/Highlights/etc.) so we can iterate on the
 * chat UI in isolation. State 1 lives in InquiryChat — later states
 * (date picker, group + occasion, budget filter, price reveal) plug
 * into the same card shell on this same page.
 */

import { HeroChatSection } from "@/components/sections/HeroChatSection";

export default function ChatLandingPage() {
  return <HeroChatSection />;
}
