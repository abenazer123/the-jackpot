/**
 * Supabase server client — uses the service-role key so server inserts
 * bypass RLS. IMPORTANT: never import this from a client component.
 * Only called from route handlers.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client: SupabaseClient | null = null;

export function supabaseServer(): SupabaseClient {
  if (client) return client;
  if (!URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are both required on the server.",
    );
  }
  client = createClient(URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
