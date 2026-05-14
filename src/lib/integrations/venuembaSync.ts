/**
 * Fire-and-forget mirror of finalized booking inquiries into VenueMBA's
 * inbox. Creates Contact + Conversation + Inquiry in the configured
 * workspace, then VenueMBA decides whether to fire its AI qualifier.
 *
 * Same fail-quiet pattern as the Resend confirmation emails: never await
 * from the caller, log on failure, never block the funnel response or
 * surface errors to the guest.
 *
 * Idempotent on `sourceId` — safe to invoke multiple times for the same
 * inquiry uuid.
 */

import type { InquiryPayload } from "@/lib/email/types";
import type { Quote } from "@/lib/pricing/types";

const WORKSPACE_SLUG = "the-jackpot";

interface SyncArgs {
  /** Supabase inquiry uuid — used as the idempotency key on the VenueMBA side. */
  sourceId: string;
  payload: InquiryPayload;
  quote: Quote | null;
  shareToken: string | null;
  /** Funnel CTA tag ("hero" | "sticky_desktop" | "peek_mobile"). */
  funnelSource?: string | null;
  /** Reveal-screen interaction flags, if any have been set. */
  revealFields?: {
    appeal_text?: string | null;
    appeal_stretch_level?: string | null;
    alt_dates_requested?: boolean;
    share_requested?: boolean;
    split_pay_requested?: boolean;
    primary_cta_path?: string | null;
  };
}

function normalizePhone(raw: string): string | undefined {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("+")) {
    return /^\+[1-9]\d{1,14}$/.test(digits) ? digits : undefined;
  }
  // Bare 10-digit US numbers → +1XXXXXXXXXX
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  return undefined;
}

export function syncInquiryToVenueMBA(args: SyncArgs): void {
  const baseUrl = process.env.VENUEMBA_WEBHOOK_URL;
  const secret = process.env.VENUEMBA_WEBHOOK_SECRET;
  if (!baseUrl || !secret) {
    console.warn(
      "[venuembaSync] VENUEMBA_WEBHOOK_URL or VENUEMBA_WEBHOOK_SECRET not set — skipping",
    );
    return;
  }

  const { payload, quote, shareToken, funnelSource, revealFields, sourceId } = args;
  const phone = normalizePhone(payload.phone);

  const body = {
    sourceId,
    name: payload.name,
    email: payload.email,
    phone,
    inquiry: {
      eventDate: payload.arrival,
      eventType: payload.reason,
      guestCount: payload.guests,
    },
    customFields: {
      checkInDate: payload.arrival,
      checkOutDate: payload.departure,
      nights: payload.nights,
      occasion: payload.reason,
      weddingVenue: payload.venue ?? null,
      funnelSource: funnelSource ?? payload.source ?? null,
      shareToken,
      tripUrl: payload.tripUrl ?? null,
      attribution: payload.attribution ?? null,
      reveal: revealFields ?? null,
      quote: quote
        ? {
            currency: quote.currency,
            nights: quote.nights,
            totalCents: quote.totalCents,
            perGuestCents: quote.perGuestCents,
            subtotalCents: quote.subtotalCents,
            cleaningCents: quote.cleaningCents,
          }
        : null,
    },
  };

  const url = `${baseUrl.replace(/\/$/, "")}/api/inbound/${WORKSPACE_SLUG}/inquiry`;

  // Fire-and-forget — never awaited from the caller.
  fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-secret": secret,
    },
    body: JSON.stringify(body),
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(
          `[venuembaSync] ${res.status} ${res.statusText} for sourceId=${sourceId} body=${text.slice(0, 500)}`,
        );
      }
    })
    .catch((err) => {
      console.error(`[venuembaSync] fetch failed for sourceId=${sourceId}`, err);
    });
}
