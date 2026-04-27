"use client";

/**
 * /book/details — Step 3 of the funnel (name / phone / guests /
 * occasion). On submit, the finalize POST returns inquiry_id +
 * share_token; `onSubmitSuccess` navigates to /book/quote/[token].
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BookingFunnelSteps } from "@/components/brand/BookingFunnelSteps";
import { readDraft } from "@/lib/funnel-draft";

export default function DetailsPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<{
    arrival: string;
    departure: string;
    email: string;
  } | null>(null);

  useEffect(() => {
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

  return (
    <BookingFunnelSteps
      arrival={draft.arrival}
      departure={draft.departure}
      email={draft.email}
      initialStep="form"
      onClose={() => router.push("/")}
      onSubmitSuccess={(_id, token) => router.push(`/book/quote/${token}`)}
    />
  );
}
