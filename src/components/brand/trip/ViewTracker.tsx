/**
 * ViewTracker — fires a single POST to /api/trip-view/[token] on
 * mount so the server can bump `share_views` (cookie-deduped over
 * a 30-min window). Renders nothing.
 *
 * Lives as a client component because we only want to count REAL
 * page views — not link-preview unfurls, not search crawlers, not
 * SSR re-renders. Bots that don't run JS won't fire the POST.
 */

"use client";

import { useEffect } from "react";

export function ViewTracker({ token }: { token: string }) {
  useEffect(() => {
    // Fire-and-forget. Errors swallowed — view tracking failing
    // shouldn't cause a console error in front of the visitor.
    void fetch(`/api/trip-view/${token}`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }, [token]);
  return null;
}
