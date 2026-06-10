/**
 * Debug helper: list the N most recent inquiry_session rows with a
 * summary line each. Use a session_id to drill in via _check-activity
 * and _check-session.
 *
 *   node scripts/_recent-sessions.mjs [limit=10]
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const limit = Number.parseInt(process.argv[2] ?? "10", 10);
const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await c
  .from("inquiry_session")
  .select(
    "id, created_at, last_activity_at, phase, slots, signals, transcript, utm, ip, last_mirror_event",
  )
  .order("created_at", { ascending: false })
  .limit(limit);

if (error) {
  console.error(error);
  process.exit(1);
}

for (const row of data ?? []) {
  const transcript = row.transcript ?? [];
  const userMsgs = transcript.filter((m) => m.role === "user").length;
  const oliviaMsgs = transcript.filter((m) => m.role === "olivia").length;
  const slots = row.slots ?? {};
  const signals = row.signals ?? {};
  const utm = row.utm ?? {};
  console.log(
    JSON.stringify(
      {
        id: row.id,
        created_at: row.created_at,
        last_activity_at: row.last_activity_at,
        phase: row.phase,
        last_mirror_event: row.last_mirror_event,
        msgs: `${userMsgs}u/${oliviaMsgs}o`,
        ip: row.ip,
        utm_source: utm.source ?? null,
        slots: {
          name: slots.name ?? null,
          email: slots.email ?? null,
          phone: slots.phone ?? null,
          arrival: slots.arrival ?? null,
          departure: slots.departure ?? null,
          guest_count: slots.guest_count ?? null,
          occasion: slots.occasion ?? null,
          price_response: slots.price_response ?? null,
        },
        intent: signals.intent ?? null,
      },
      null,
      2,
    ),
  );
  console.log("---");
}
