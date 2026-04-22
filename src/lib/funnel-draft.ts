/**
 * funnel-draft — tiny localStorage-backed memory for the booking funnel
 * so a guest who half-fills the hero, scrolls, and later opens the mobile
 * peek doesn't have to re-enter anything.
 *
 * Stored in localStorage under `jp_funnel_draft` as JSON with an
 * `updatedAt` timestamp. Reads auto-expire at 14 days so a stale draft
 * from months ago doesn't ambush a new visit.
 *
 * Surfaces that read/write:
 *   - HeroBookingBar (dates + email)
 *   - StickyBookingBar / mobile peek (dates)
 *   - BookingFunnelSteps (name + phone + guests + reason)
 *
 * Cleared on successful submission (success step reached).
 */

const STORAGE_KEY = "jp_funnel_draft";
const MAX_AGE_MS = 14 * 86_400_000; // 14 days

export interface FunnelDraft {
  arrival?: string;
  departure?: string;
  email?: string;
  name?: string;
  phone?: string;
  guests?: number;
  reason?: string;
}

interface StoredDraft extends FunnelDraft {
  updatedAt: number;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function readDraft(): FunnelDraft {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed || typeof parsed.updatedAt !== "number") return {};
    if (Date.now() - parsed.updatedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return {};
    }
    // Strip updatedAt before handing back — callers don't care.
    const { updatedAt: _u, ...rest } = parsed;
    void _u;
    return rest;
  } catch {
    return {};
  }
}

export function writeDraft(partial: FunnelDraft): void {
  if (!isBrowser()) return;
  try {
    const existing = readDraft();
    const merged: StoredDraft = {
      ...existing,
      ...partial,
      updatedAt: Date.now(),
    };
    // Drop empty-string / undefined values so cleared fields don't
    // linger and re-populate next visit.
    for (const key of Object.keys(merged) as Array<keyof StoredDraft>) {
      const v = merged[key];
      if (v === "" || v === undefined || v === null) {
        delete merged[key];
      }
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // quota / private-mode / SSR — silently skip
  }
}

export function clearDraft(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}
