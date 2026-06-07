/**
 * One-shot debug helper: dump the most recent agent_activity row for
 * a given session_id. Not committed long-term — purely for verifying
 * Phase 1 harness behavior.
 *
 *   node scripts/_check-activity.mjs <session_id>
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

const sessionId = process.argv[2];
if (!sessionId) {
  console.error("Usage: node scripts/_check-activity.mjs <session_id>");
  process.exit(1);
}

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await client
  .from("agent_activity")
  .select("*")
  .eq("session_id", sessionId)
  .order("created_at", { ascending: false });

if (error) {
  console.error(error);
  process.exit(1);
}

for (const row of data ?? []) {
  console.log(JSON.stringify(row, null, 2));
}
