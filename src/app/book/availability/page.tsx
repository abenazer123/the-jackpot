"use client";

/**
 * /book/availability — Step 1 of the funnel (collect missing fields).
 *
 * Only reached when the entry point didn't capture everything (e.g.
 * desktop sticky bar with dates but no email; mobile peek with
 * neither). When all three are already present we redirect straight
 * to /book/checking.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BookingFunnelSteps, type FunnelStep } from "@/components/brand/BookingFunnelSteps";
import { readDraft } from "@/lib/funnel-draft";

export default function AvailabilityPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<{
    arrival: string;
    departure: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const d = readDraft();
      if (d.arrival && d.departure && d.email) {
        router.replace("/book/checking");
        return;
      }
      setDraft({
        arrival: d.arrival ?? "",
        departure: d.departure ?? "",
        email: d.email ?? "",
      });
    }, 0);
    return () => window.clearTimeout(t);
  }, [router]);

  if (!draft) return null;

  const handleStepChange = (next: FunnelStep) => {
    if (next === "checking") router.push("/book/checking");
    else if (next === "form") router.push("/book/details");
  };

  return (
    <BookingFunnelSteps
      arrival={draft.arrival}
      departure={draft.departure}
      email={draft.email}
      initialStep="collect"
      onClose={() => router.push("/")}
      onStepChange={handleStepChange}
      onSubmitSuccess={(_id, token) => router.push(`/book/quote/${token}`)}
    />
  );
}
