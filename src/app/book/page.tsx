"use client";

/**
 * /book — smart redirect.
 *
 * Reads the funnel-draft localStorage on mount and routes the
 * visitor to the deepest valid step:
 *
 *   1. Has a finalized share token            → /book/quote/[token]
 *   2. Has dates + email but no token         → /book/checking
 *   3. Empty / missing dates or email         → /
 *
 * Nobody types `/book` directly — they arrive via "Continue where
 * you left off →" from the hero or sticky bar. This makes that
 * link always do the right thing.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { readDraft } from "@/lib/funnel-draft";

export default function BookEntryPage() {
  const router = useRouter();

  useEffect(() => {
    const draft = readDraft();
    if (draft.shareToken) {
      router.replace(`/book/quote/${draft.shareToken}`);
      return;
    }
    if (draft.arrival && draft.departure && draft.email) {
      router.replace("/book/checking");
      return;
    }
    router.replace("/");
  }, [router]);

  return (
    <p
      style={{
        fontFamily: "var(--jp-font-body)",
        fontSize: 14,
        color: "var(--jp-text-secondary)",
      }}
    >
      Resuming&hellip;
    </p>
  );
}
