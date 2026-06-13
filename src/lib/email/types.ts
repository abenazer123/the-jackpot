/** Shared payload shape used by both the notification + confirmation emails. */
export interface InquiryPayload {
  arrival: string; // YYYY-MM-DD
  departure: string; // YYYY-MM-DD
  nights: number;
  email: string;
  name: string;
  phone: string;
  guests: number;
  reason: string;
  source?: string;
  /** Wedding venue — only populated when occasion === "wedding". */
  venue?: string;
  /** Public trip portal URL (`/trip/[share-token]`). Set when the
   *  finalize POST resolves; emails link to this so the coordinator
   *  has the share artifact at her fingertips three days later. */
  tripUrl?: string;
  /** What the guest did at the price reveal — surfaced in the host
   *  notification so Abe sees their intent, not just their contact. */
  reveal?: {
    primary_cta_path?: string | null;
    appeal_text?: string | null;
    appeal_stretch_level?: string | null;
    alt_dates_requested?: boolean;
    share_requested?: boolean;
    split_pay_requested?: boolean;
  };
  /** Attribution snapshot from UtmProvider — populated when UTMs were
   *  present at first landing (localStorage persists 30 days). */
  attribution?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
    gclid?: string;
    fbclid?: string;
    msclkid?: string;
    referrer?: string;
    landing_path?: string;
    current_path?: string;
  };
}

export function formatIsoDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || name;
}
