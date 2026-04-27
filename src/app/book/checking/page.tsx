"use client";

/**
 * /book/checking — Step 2 of the funnel.
 *
 * Reads dates + email from the funnel-draft localStorage. If
 * anything is missing, redirects back to `/` so the hero bar can
 * collect what's needed.
 *
 * Mounts BookingFunnelSteps with `initialStep="checking"`. The
 * component fires the draft POST + plays the branded animation; on
 * advance, it calls `onStepChange("form")` which we intercept to
 * router.push to `/book/details`.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BookingFunnelSteps, type FunnelStep } from "@/components/brand/BookingFunnelSteps";
import { readDraft } from "@/lib/funnel-draft";

export default function CheckingPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<{
    arrival: string;
    departure: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    // Defer state writes to stay off the effect's synchronous path
    // (react-hooks/set-state-in-effect).
    const t = window.setTimeout(() => {
      const d = readDraft();
      if (!d.arrival || !d.departure || !d.email) {
        router.replace("/");
        return;
      }
      setDraft({ arrival: d.arrival, departure: d.departure, email: d.email });
    }, 0);
    return () => window.clearTimeout(t);
  }, [router]);

  if (!draft) return null;

  const handleStepChange = (next: FunnelStep) => {
    if (next === "form") router.push("/book/details");
  };

  return (
    <BookingFunnelSteps
      arrival={draft.arrival}
      departure={draft.departure}
      email={draft.email}
      initialStep="checking"
      onClose={() => router.push("/")}
      onStepChange={handleStepChange}
      onSubmitSuccess={(_id, token) => router.push(`/book/quote/${token}`)}
    />
  );
}
