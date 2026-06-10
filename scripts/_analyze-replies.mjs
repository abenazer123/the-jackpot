/** Per-turn detail: latency, reply length, fake-progress detection. */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: acts } = await c.from('agent_activity').select('*').eq('status','success').order('created_at',{ascending:true});

const FAKE_PROGRESS = /pulling|checking|one sec|let me get|let me pull|locked|i'?ll flag|loading|hold tight|on it/i;

for (const a of acts ?? []) {
  const out = a.output ?? {};
  const body = out.next_message?.body ?? '';
  const actions = (out.actions ?? []).map(x => x.tool);
  const widgets = out.next_message?.widgets_to_show ?? [];
  const fake = FAKE_PROGRESS.test(body) && !actions.includes('notify_abe') && !actions.includes('show_widget');
  console.log(JSON.stringify({
    t: a.created_at?.slice(5,16),
    lat_s: Math.round((a.latency_ms ?? 0)/1000),
    in: a.input_tokens, out_tok: a.output_tokens,
    actions, widgets,
    routing: out.routing?.next_step,
    fake_progress_risk: fake || undefined,
    body: body.slice(0, 110),
  }));
}
