/**
 * PostHogProvider — initializes the PostHog browser SDK once on client mount
 * and fires manual `$pageview` events on every App Router route change
 * (App Router doesn't auto-capture pageviews).
 *
 * If the POSTHOG env vars aren't set (e.g. local dev without credentials),
 * the component silently skips init — the rest of the app keeps working.
 *
 * Usage: wrap the app in `src/app/layout.tsx` inside the HostPresenceProvider.
 *
 * Event conventions (the contract between client + server):
 *   booking_cta_clicked        client | { surface: "hero" | "sticky_desktop" | "peek_mobile" }
 *   booking_funnel_step_viewed client | { step: "collect" | "checking" | "form" | "success" }
 *   booking_inquiry_submitted  server | identifies by email; tracks outcome
 */

"use client";

import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { Suspense, useEffect, type ReactNode } from "react";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let initialized = false;

function initPostHog() {
  if (initialized || typeof window === "undefined" || !KEY) return;
  posthog.init(KEY, {
    api_host: HOST,
    // Don't create person profiles for anonymous visitors — only identified
    // ones (i.e. after they submit the form with an email).
    person_profiles: "identified_only",
    // App Router has no built-in pageview event; we fire it ourselves.
    capture_pageview: false,
    capture_pageleave: true,
    defaults: "2025-05-24",
  });
  initialized = true;
}

/** Fires `$pageview` whenever pathname or query changes. */
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!KEY || !pathname) return;
    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  if (!KEY) {
    // No analytics in envs without the key — app still renders normally.
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      {/* useSearchParams needs a Suspense boundary in App Router. */}
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}

/** Safe client-side capture helper used throughout the booking funnel.
 *  No-ops if PostHog isn't initialized. */
export function capture(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined" || !initialized) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // swallow — analytics failures must never break UX
  }
}

/** Identify the current anonymous session with a real email. */
export function identify(
  email: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined" || !initialized) return;
  try {
    posthog.identify(email, properties);
  } catch {
    // swallow
  }
}
