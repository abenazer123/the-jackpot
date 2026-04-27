/**
 * Dynamic OG image for /trip/[token].
 *
 * When the coordinator pastes the URL into iMessage / WhatsApp /
 * Slack, the unfurl preview IS the first impression. A blank card
 * means nobody taps. A hero photo + dates + per-person price
 * means the group chat lights up.
 *
 * Renders 1200×630 — the standard OG / Twitter card aspect. The
 * cover photo from `BRAND_PHOTOS` runs full-bleed; a dark gradient
 * overlay keeps the text legible.
 *
 * Falls back to a tasteful brand-color card with no photo if the
 * inquiry isn't found (still better than a blank unfurl).
 */

import { ImageResponse } from "next/og";

import { COVER_PHOTO } from "@/lib/property/photos";
import type { Quote } from "@/lib/pricing/types";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const alt = "The Jackpot Chicago — group home invitation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface OGProps {
  params: Promise<{ token: string }>;
}

const TOKEN_RE = /^[0-9A-Za-z_-]{22}$/;

function isoToShort(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fmt(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function originUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export default async function Image({ params }: OGProps) {
  const { token } = await params;

  let dateRange = "";
  let perPerson = "";
  let occasion = "";

  if (TOKEN_RE.test(token)) {
    const { data } = await supabaseServer()
      .from("inquiries")
      .select("arrival, departure, guests, reason, quote_snapshot")
      .eq("share_token", token)
      .maybeSingle();
    if (data) {
      const arrival = data.arrival as string;
      const departure = data.departure as string;
      const guests = (data.guests as number) ?? 0;
      const quote = (data.quote_snapshot ?? null) as Quote | null;
      const a = new Date(arrival + "T00:00:00");
      const d = new Date(departure + "T00:00:00");
      const nights = Math.max(
        1,
        Math.round((d.getTime() - a.getTime()) / 86_400_000),
      );
      dateRange = `${isoToShort(arrival)} \u2013 ${isoToShort(departure)}`;
      occasion = ((data.reason as string) ?? "").toLowerCase();
      if (quote && guests > 0) {
        const perPersonCents = Math.round(
          quote.totalCents / guests / Math.max(1, nights),
        );
        perPerson = `${fmt(perPersonCents)}/person/night`;
      }
    }
  }

  // Static photo URL the OG renderer can fetch over the public
  // origin. NEXT_PUBLIC_SITE_URL must be set in prod; on localhost
  // we fall back to localhost:3000 (the dev server).
  const photoUrl = `${originUrl()}${COVER_PHOTO.src.src}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          position: "relative",
          background: "#faf6ef",
        }}
      >
        {/* Hero photo full-bleed */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        {/* Dark gradient overlay for text legibility */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(20,12,0,0.05) 0%, rgba(20,12,0,0.55) 60%, rgba(20,12,0,0.85) 100%)",
            display: "flex",
          }}
        />

        {/* Content stack — bottom-anchored */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            padding: "0 64px 56px",
            color: "#ffffff",
          }}
        >
          <div
            style={{
              fontFamily: "serif",
              fontStyle: "italic",
              fontSize: 22,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#f0c870",
              marginBottom: 16,
              opacity: 0.95,
            }}
          >
            The Jackpot Chicago
          </div>
          <div
            style={{
              fontFamily: "serif",
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: 64,
              lineHeight: 1.05,
              letterSpacing: -1,
              marginBottom: 12,
              display: "flex",
            }}
          >
            {dateRange || "Group home in Chicago"}
          </div>
          <div
            style={{
              fontFamily: "sans-serif",
              fontWeight: 500,
              fontSize: 28,
              opacity: 0.9,
              display: "flex",
              gap: 16,
              alignItems: "center",
            }}
          >
            {perPerson ? <span>{perPerson}</span> : null}
            {perPerson && occasion ? (
              <span style={{ opacity: 0.6 }}>&middot;</span>
            ) : null}
            {occasion ? <span>{occasion} weekend</span> : null}
            {!perPerson && !occasion ? <span>Sleeps 14 &middot; 5BR &middot; 3BA</span> : null}
          </div>
        </div>

        {/* Bottom-right wordmark */}
        <div
          style={{
            position: "absolute",
            top: 36,
            right: 48,
            fontFamily: "sans-serif",
            fontSize: 18,
            letterSpacing: 3,
            color: "#ffffff",
            opacity: 0.85,
            textTransform: "uppercase",
            fontWeight: 600,
            display: "flex",
          }}
        >
          thejackpotchi.com
        </div>
      </div>
    ),
    { ...size },
  );
}
