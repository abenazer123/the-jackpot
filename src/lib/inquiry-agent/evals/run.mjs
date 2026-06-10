/**
 * Inquiry-agent eval runner.
 *
 *   npm run eval                 # run all fixtures
 *   npm run eval -- discount     # run fixtures whose name includes "discount"
 *
 * Drives each fixture through the REAL /api/inquiry-agent/turn endpoint
 * (so it exercises route + harness + tools + persistence), reads the
 * matching agent_activity row for the full action list, scores the
 * deterministic assertions, prints a report, and deletes the throwaway
 * sessions it created.
 *
 * Requirements: dev server on EVAL_BASE_URL (default localhost:3000)
 * and Supabase creds in .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

import { FIXTURES } from "./fixtures.mjs";

const BASE = process.env.EVAL_BASE_URL || "http://localhost:3000";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const FORBIDDEN = /\b(rental|listing|airbnb|property|party house|book now)\b/i;
const DASHES = /[—–]/; // em / en (hyphen handled by sanitizer; flag em/en only)
// Progress CLAIMS only. Deliberately excludes question forms like
// "is that weekend locked?" (a legitimate date-flexibility question)
// and "let me get you the number" when it's backed by advance. The
// original bug was standalone completion claims: "Pulling up...",
// "Locked.", "Checking those dates now." with nothing behind them.
const FAKE_PROGRESS = /\b(pulling (it|up|your|pricing|a (real )?number)|checking (the calendar|those? dates|availability|your dates)|one sec|loading|locked in|you'?re (all )?(set|locked)|hold tight)\b/i;

// ── assertion engine ──────────────────────────────────────────────

function checkTurn(expect, ctx) {
  // ctx: { body, widgets:[type], advance:bool, actions:[tool], slots:{} }
  const fails = [];
  const body = ctx.body || "";

  if (expect.bodyNoDashes && DASHES.test(body)) fails.push("dash in reply");
  if (expect.bodyNoForbidden && FORBIDDEN.test(body)) {
    fails.push(`forbidden word: ${body.match(FORBIDDEN)[0]}`);
  }
  if (expect.bodyMatches && !expect.bodyMatches.test(body)) {
    fails.push(`body did not match ${expect.bodyMatches}`);
  }
  if (expect.bodyNotMatches && expect.bodyNotMatches.test(body)) {
    fails.push(`body matched forbidden pattern ${expect.bodyNotMatches} ("${body.match(expect.bodyNotMatches)[0]}")`);
  }
  if (expect.widgetOneOf) {
    const hit = ctx.widgets.some((w) => expect.widgetOneOf.includes(w));
    if (!hit) fails.push(`expected a widget in [${expect.widgetOneOf}], got [${ctx.widgets}]`);
  }
  if (expect.noWidget && ctx.widgets.length) {
    fails.push(`expected no widget, got [${ctx.widgets}]`);
  }
  if (typeof expect.advance === "boolean" && ctx.advance !== expect.advance) {
    fails.push(`expected advance=${expect.advance}, got ${ctx.advance}`);
  }
  if (expect.actionFired && !ctx.actions.includes(expect.actionFired)) {
    fails.push(`expected action ${expect.actionFired}, got [${ctx.actions}]`);
  }
  if (expect.actionNotFired && ctx.actions.includes(expect.actionNotFired)) {
    fails.push(`action ${expect.actionNotFired} should not have fired`);
  }
  if (expect.noFakeProgress) {
    const claimsProgress = FAKE_PROGRESS.test(body);
    const backed =
      ctx.advance ||
      ctx.widgets.length > 0 ||
      ctx.actions.includes("notify_abe") ||
      ctx.actions.includes("advance_to_pricing") ||
      ctx.actions.includes("show_widget");
    if (claimsProgress && !backed) {
      fails.push(`FAKE PROGRESS: "${body.match(FAKE_PROGRESS)[0]}" with no action/widget/advance`);
    }
  }
  if (expect.slotEquals) {
    for (const [k, v] of Object.entries(expect.slotEquals)) {
      if (ctx.slots[k] !== v) fails.push(`slot ${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(ctx.slots[k])}`);
    }
  }
  return fails;
}

// ── per-turn driver ───────────────────────────────────────────────

async function postTurn(sessionId, body, phase, slots) {
  const res = await fetch(`${BASE}/api/inquiry-agent/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      message: { role: "user", body, ts: new Date().toISOString() },
      client_context: { phase, slots, viewport: "mobile", utm: { source: "eval" } },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Read the latest agent_activity row for a session to get the full
 *  action list. Merges output.actions (LLM-proposed) with
 *  actions_executed (what the harness actually ran) — the hard-trigger
 *  pre-check path fires tools via actions_executed without an LLM
 *  output, so checking only output.actions would miss them. */
async function latestActions(sessionId) {
  const { data } = await supabase
    .from("agent_activity")
    .select("output,actions_executed")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = data?.[0] || {};
  const proposed = (row.output?.actions || []).map((a) => a.tool);
  const executed = (row.actions_executed || []).map((a) => a.tool);
  return [...new Set([...proposed, ...executed])];
}

// ── main ──────────────────────────────────────────────────────────

const filter = process.argv[2];
const fixtures = filter ? FIXTURES.filter((f) => f.name.includes(filter)) : FIXTURES;
const createdSessions = [];
let totalChecks = 0;
let totalFails = 0;
const scenarioResults = [];

for (const fx of fixtures) {
  let sessionId = null;
  // Local mirror of slots so multi-turn scenarios accumulate context.
  const slots = { ...fx.startSlots };
  const turnReports = [];
  let scenarioFailed = false;

  for (let i = 0; i < fx.turns.length; i++) {
    const turn = fx.turns[i];
    let data;
    try {
      data = await postTurn(sessionId, turn.send, fx.startPhase, slots);
    } catch (err) {
      turnReports.push({ send: turn.send, fails: [`request failed: ${err.message}`] });
      scenarioFailed = true;
      break;
    }
    sessionId = data.session_id;
    if (!createdSessions.includes(sessionId)) createdSessions.push(sessionId);

    // Merge any extracted slots back so later turns carry them.
    Object.assign(slots, data.extracted_slots || {});

    const actions = await latestActions(sessionId);
    const ctx = {
      body: (data.messages?.[0]?.body) || "",
      widgets: (data.widgets || []).map((w) => w.type),
      advance: !!data.advance_to_pricing,
      actions,
      slots,
    };
    const fails = checkTurn(turn.expect || {}, ctx);
    totalChecks += 1;
    if (fails.length) {
      totalFails += 1;
      scenarioFailed = true;
    }
    turnReports.push({ send: turn.send, body: ctx.body, widgets: ctx.widgets, advance: ctx.advance, actions, fails });
  }

  scenarioResults.push({ name: fx.name, failed: scenarioFailed, turns: turnReports });
}

// ── report ────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════");
console.log("  INQUIRY AGENT EVALS");
console.log("══════════════════════════════════════════════════════\n");

for (const s of scenarioResults) {
  console.log(`${s.failed ? "✗" : "✓"} ${s.name}`);
  for (const t of s.turns) {
    console.log(`    > "${t.send}"`);
    if (t.body !== undefined) {
      console.log(`      olivia: ${t.body.slice(0, 100)}`);
      console.log(`      widgets=[${t.widgets}] advance=${t.advance} actions=[${t.actions}]`);
    }
    for (const f of t.fails) console.log(`      ✗ ${f}`);
  }
  console.log("");
}

const passed = scenarioResults.filter((s) => !s.failed).length;
console.log("──────────────────────────────────────────────────────");
console.log(`  ${passed}/${scenarioResults.length} scenarios passed  (${totalChecks - totalFails}/${totalChecks} turn-checks)`);
console.log("──────────────────────────────────────────────────────\n");

// ── cleanup ───────────────────────────────────────────────────────

if (createdSessions.length) {
  await supabase.from("inquiry_session").delete().in("id", createdSessions);
  console.log(`Cleaned up ${createdSessions.length} eval sessions.\n`);
}

process.exit(scenarioResults.some((s) => s.failed) ? 1 : 0);
