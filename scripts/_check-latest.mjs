import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await c.from('agent_activity').select('*').order('created_at', { ascending: false }).limit(1);
const row = data[0];
console.log(JSON.stringify({
  status: row.status,
  output_extracted: row.output?.extracted_slots,
  output_actions: row.output?.actions,
  actions_executed: row.actions_executed,
  actions_drafted: row.actions_drafted,
  actions_skipped: row.actions_skipped,
}, null, 2));
