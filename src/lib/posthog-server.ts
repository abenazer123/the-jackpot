/**
 * PostHog server singleton — used only by route handlers to fire
 * authoritative server-side events (e.g. `booking_inquiry_submitted`).
 * Client-side events live in `components/brand/PostHogProvider.tsx`.
 *
 * If POSTHOG env vars aren't set, `serverCapture` no-ops — the API route
 * keeps working without analytics.
 */

import { PostHog } from "posthog-node";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!KEY) return null;
  if (client) return client;
  client = new PostHog(KEY, { host: HOST });
  return client;
}

interface ServerCaptureArgs {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
  setOnce?: Record<string, unknown>;
  set?: Record<string, unknown>;
}

export async function serverCapture(args: ServerCaptureArgs): Promise<void> {
  const ph = getClient();
  if (!ph) return;
  try {
    ph.capture({
      distinctId: args.distinctId,
      event: args.event,
      properties: {
        ...(args.properties ?? {}),
        ...(args.set ? { $set: args.set } : {}),
        ...(args.setOnce ? { $set_once: args.setOnce } : {}),
      },
    });
    // Ensure the event flushes before the serverless function exits.
    await ph.flush();
  } catch {
    // swallow — analytics failures must never break the API response
  }
}
