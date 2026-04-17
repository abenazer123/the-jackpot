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
