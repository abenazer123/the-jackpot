/**
 * One-shot analysis: aggregate stats across all agent_activity rows +
 * session outcomes. Feeds the 2026-06-10 system analysis doc.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: acts } = await c.from('agent_activity').select('*').order('created_at', { ascending: true });
const { data: sessions } = await c.from('inquiry_session').select('*').order('created_at', { ascending: true });

// Activity stats
const byStatus = {};
const byTrigger = {};
let totalLatency = 0, latencyCount = 0, maxLatency = 0;
let totalCost = 0, totalIn = 0, totalOut = 0;
const validationErrors = [];
for (const a of acts ?? []) {
  byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
  byTrigger[a.trigger] = (byTrigger[a.trigger] ?? 0) + 1;
  if (a.latency_ms && a.status === 'success') { totalLatency += a.latency_ms; latencyCount++; maxLatency = Math.max(maxLatency, a.latency_ms); }
  totalCost += a.cost_cents ?? 0;
  totalIn += a.input_tokens ?? 0;
  totalOut += a.output_tokens ?? 0;
  if (a.status === 'validation_failed') validationErrors.push((a.error_message ?? '').slice(0, 120));
}

// Session stats
const byPhase = {};
let withContact = 0, reachedSlots = 0;
for (const s of sessions ?? []) {
  byPhase[s.phase] = (byPhase[s.phase] ?? 0) + 1;
  const slots = s.slots ?? {};
  if (slots.email) withContact++;
  if (slots.arrival && slots.guest_count) reachedSlots++;
}

console.log(JSON.stringify({
  activity: {
    total: acts?.length ?? 0,
    by_status: byStatus,
    by_trigger: byTrigger,
    avg_latency_ms: latencyCount ? Math.round(totalLatency / latencyCount) : null,
    max_latency_ms: maxLatency,
    total_cost_cents: totalCost,
    total_input_tokens: totalIn,
    total_output_tokens: totalOut,
    validation_error_samples: [...new Set(validationErrors)].slice(0, 8),
  },
  sessions: {
    total: sessions?.length ?? 0,
    by_phase: byPhase,
    with_contact: withContact,
    with_dates_and_count: reachedSlots,
  },
}, null, 2));
