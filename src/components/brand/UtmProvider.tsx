/**
 * UtmProvider — captures UTM params (+ referrer + landing path) on first
 * arrival and persists them in localStorage for 30 days. Last-touch wins:
 * a fresh UTM set on a later visit overwrites any prior snapshot.
 *
 * Stored in localStorage (not sessionStorage) because the sales cycle for
 * a group STR is ~4 months — a visitor may click a Batch listing Tuesday,
 * browse, leave, and come back Saturday to submit. sessionStorage would
 * give that Batch click zero credit.
 *
 * `current_path` is NOT persisted — it's read live at consumption time so
 * we can tell "landed on /, submitted from /wedding" once we have more
 * than one landing page.
 */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "jp_attribution";
const MAX_AGE_MS = 30 * 86_400_000; // 30 days

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "msclkid",
] as const;

type UtmKey = (typeof UTM_KEYS)[number];

interface StoredAttribution {
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
  captured_at: number;
}

export interface Attribution {
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
  /** Path at the moment of consumption (submission time). */
  current_path?: string;
}

const UtmContext = createContext<Attribution>({});

function readStored(): StoredAttribution | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAttribution;
    if (!parsed || typeof parsed.captured_at !== "number") return null;
    if (Date.now() - parsed.captured_at > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(snapshot: StoredAttribution): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // quota / privacy-mode / SSR — silently skip
  }
}

export function UtmProvider({ children }: { children: ReactNode }) {
  const [attribution, setAttribution] = useState<Attribution>({});

  useEffect(() => {
    // Deferred via setTimeout(…, 0) so the setState call is off the effect's
    // synchronous path (react-hooks/set-state-in-effect). Same pattern used
    // in BookingFunnelSteps' checking beat.
    const t = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const fresh: Partial<Record<UtmKey, string>> = {};
      let anyFresh = false;
      for (const key of UTM_KEYS) {
        const v = params.get(key);
        if (v) {
          fresh[key] = v;
          anyFresh = true;
        }
      }

      let stored: StoredAttribution | null;
      if (anyFresh) {
        // New attribution on this visit — last-touch wins.
        stored = {
          ...fresh,
          referrer: document.referrer || undefined,
          landing_path: window.location.pathname || undefined,
          captured_at: Date.now(),
        };
        writeStored(stored);
      } else {
        // No fresh UTMs — fall back to prior stored snapshot (if within 30d).
        stored = readStored();
      }

      setAttribution({
        utm_source: stored?.utm_source,
        utm_medium: stored?.utm_medium,
        utm_campaign: stored?.utm_campaign,
        utm_term: stored?.utm_term,
        utm_content: stored?.utm_content,
        gclid: stored?.gclid,
        fbclid: stored?.fbclid,
        msclkid: stored?.msclkid,
        referrer: stored?.referrer,
        landing_path: stored?.landing_path,
        current_path: window.location.pathname,
      });
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <UtmContext.Provider value={attribution}>{children}</UtmContext.Provider>
  );
}

export function useUtm(): Attribution {
  return useContext(UtmContext);
}
