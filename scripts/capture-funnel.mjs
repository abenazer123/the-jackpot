/**
 * capture-funnel.mjs
 *
 * Drives the booking funnel via puppeteer-core and saves canonical UX
 * states as PNGs into screenshots/. Re-runnable.
 *
 * Run: node scripts/capture-funnel.mjs
 * Requires the dev server on http://localhost:3000.
 *
 * Design notes (after debugging the first run):
 * - All sleeps are NODE-SIDE (`await sleep(ms)`) not in-page evaluates.
 *   Stacking page.evaluate setTimeout calls hit the CDP protocolTimeout.
 * - Each shot gets a fresh page (newPage / close) — state pollution
 *   between shots was destabilizing later runs.
 * - protocolTimeout bumped to 120s for slow operations.
 * - Failures in one shot don't kill the run; we log and continue.
 */

import puppeteer from "puppeteer-core";
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = "http://localhost:3000";
const OUT_ROOT = path.resolve("screenshots");

// Mobile-only catalog. We emulate an iPhone 14-class device — viewport
// 390×844 at 2x DPR, real iOS Safari user-agent, touch enabled, and
// isMobile=true so the matchMedia "(max-width: 767px)" branches in
// HeroBookingBar / StickyBookingBar pick the BookingBottomSheet path.
const MOBILE_VIEWPORT = {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------
async function freshPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(MOBILE_UA);
  await page.setViewport(MOBILE_VIEWPORT);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  await sleep(800);
  return page;
}

async function pickCalendarDate(page, iso) {
  // Advance month chevron until target appears, then click it.
  for (let i = 0; i < 24; i++) {
    const found = await page.evaluate(
      (d) => !!document.querySelector(`button[aria-label="${d}"]`),
      iso,
    );
    if (found) break;
    const advanced = await page.evaluate(() => {
      const next = document.querySelector('button[aria-label="Next month"]');
      if (!next) return false;
      next.click();
      return true;
    });
    if (!advanced) break;
    await sleep(140);
  }
  await page.evaluate((d) => {
    const btn = document.querySelector(`button[aria-label="${d}"]`);
    btn?.click();
  }, iso);
}

async function setReactInput(page, selector, value) {
  await page.evaluate(
    ({ s, v }) => {
      const el = document.querySelector(s);
      if (!el) return false;
      const proto =
        el.tagName === "TEXTAREA"
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    { s: selector, v: value },
  );
}

async function setReactSelect(page, selector, value) {
  await page.evaluate(
    ({ s, v }) => {
      const el = document.querySelector(s);
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      ).set;
      setter.call(el, v);
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    { s: selector, v: value },
  );
}

/**
 * Submit hero form with date + email pre-filled. Lands the user on
 * Step 2 (checking beats) inside the modal/sheet.
 */
async function fillAndSubmitHero(page, { arrival, departure, email }) {
  // Open arrival cal — it's a button whose text starts with "Arrival"
  await page.evaluate(() => {
    Array.from(document.querySelectorAll("button"))
      .find((b) => b.textContent?.startsWith("Arrival"))
      ?.click();
  });
  await sleep(350);
  await pickCalendarDate(page, arrival);
  await sleep(400); // departure cal auto-opens after 150ms
  await pickCalendarDate(page, departure);
  await sleep(250);
  await setReactInput(page, 'input[type="email"]', email);
  await sleep(150);
  // Submit hero form (the visible form, not the funnel form)
  await page.evaluate(() => {
    const heroForm = Array.from(document.querySelectorAll("form")).find((f) =>
      f.querySelector('button[type="submit"]'),
    );
    heroForm?.requestSubmit();
  });
}

/**
 * Patches setTimeout in-page so the Step 2 beat orchestrator queues
 * its 4 timeouts (insight/teaser/resolve/advance) into a global array
 * we can fire one at a time.
 */
async function installBeatCapture(page) {
  await page.evaluate(() => {
    if (window.__beatCaptureInstalled) return;
    window.__beatCaptureInstalled = true;
    window.__queuedTimeouts = [];
    const orig = window.setTimeout;
    window.setTimeout = function (fn, ms, ...args) {
      if (typeof ms === "number" && ms >= 400) {
        window.__queuedTimeouts.push(fn);
        return -1;
      }
      return orig(fn, ms, ...args);
    };
  });
}

async function fireNextBeat(page) {
  await page.evaluate(() => {
    const fn = window.__queuedTimeouts?.shift();
    if (fn) fn();
  });
  await sleep(350);
}

async function fireAllBeats(page) {
  await page.evaluate(() => {
    while (window.__queuedTimeouts?.length) {
      window.__queuedTimeouts.shift()();
    }
  });
  await sleep(700);
}

async function fillStep3(page) {
  await page.evaluate(() => {
    const dlg = document.querySelector("dialog[open]");
    if (!dlg) return;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set;
    dlg.querySelectorAll("input").forEach((inp) => {
      if (inp.placeholder?.match(/name/i)) {
        setter.call(inp, "Sample Lead");
        inp.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (inp.type === "tel") {
        setter.call(inp, "555-867-5309");
        inp.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    Array.from(dlg.querySelectorAll("button"))
      .find((b) => b.textContent?.trim() === "Bachelor/ette")
      ?.click();
  });
  await sleep(150);
}

async function setGuestCount(page, n) {
  await page.evaluate((count) => {
    const dlg = document.querySelector("dialog[open]");
    const sel = dlg?.querySelector("select");
    if (!sel) return false;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    ).set;
    setter.call(sel, String(count));
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, n);
  await sleep(120);
}

async function submitFunnelStep(page) {
  await page.evaluate(() => {
    const dlg = document.querySelector("dialog[open]");
    dlg?.querySelector("form")?.requestSubmit();
  });
  await sleep(800);
}

async function clickSkipIfPresent(page) {
  await page.evaluate(() => {
    const skip = Array.from(document.querySelectorAll("button")).find((b) =>
      /skip/i.test(b.textContent || ""),
    );
    skip?.click();
  });
  await sleep(700);
}

// ---------------------------------------------------------------------
// Capture flows — each returns a configured page ready to screenshot.
// All take (browser, viewport) and produce a fresh page.
// ---------------------------------------------------------------------

async function capHeroEmpty(browser, v) {
  return await freshPage(browser);
}

async function capStickyPeek(browser, v) {
  const page = await freshPage(browser);
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2));
  await sleep(700);
  return page;
}

async function capArrivalCal(browser, v) {
  const page = await freshPage(browser);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll("button"))
      .find((b) => b.textContent?.startsWith("Arrival"))
      ?.click();
  });
  await sleep(450);
  return page;
}

async function capDepartureRangeHover(browser, v) {
  const page = await freshPage(browser);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll("button"))
      .find((b) => b.textContent?.startsWith("Arrival"))
      ?.click();
  });
  await sleep(400);
  await pickCalendarDate(page, "2026-06-19");
  await sleep(450);
  // Departure cal now open — hover over Jun 22 to show range
  await page.evaluate(() => {
    const day = document.querySelector('button[aria-label="2026-06-22"]');
    if (!day) return;
    day.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    const r = day.getBoundingClientRect();
    day.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX: r.x + r.width / 2,
        clientY: r.y + r.height / 2,
      }),
    );
  });
  await sleep(250);
  return page;
}

async function capModalStep1Filled(browser, v) {
  // Reach Step 1 inside the modal/sheet WITHOUT prefilling. We click
  // the sticky peek button (which mounts the modal at Step 1 collect).
  const page = await freshPage(browser);
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2));
  await sleep(700);
  await page.evaluate(() => {
    // Click the sticky/peek CTA — its text varies by surface but
    // contains "see the price" or "check dates"
    const btn = Array.from(document.querySelectorAll("button")).find(
      (b) =>
        /see the price|check dates/i.test(b.textContent || "") &&
        b.getBoundingClientRect().y < 200,
    );
    btn?.click();
  });
  await sleep(700);
  // Now inside the modal at Step 1 — fill it
  await page.evaluate(() => {
    const dlg = document.querySelector("dialog[open]");
    Array.from(dlg?.querySelectorAll("button") || [])
      .find((b) => b.textContent?.startsWith("Arrival"))
      ?.click();
  });
  await sleep(400);
  await pickCalendarDate(page, "2026-06-19");
  await sleep(450);
  await pickCalendarDate(page, "2026-06-22");
  await sleep(250);
  await setReactInput(
    page,
    'dialog[open] input[type="email"]',
    "sample@thejackpotchi.com",
  );
  await sleep(200);
  return page;
}

async function capStep2Beat(browser, v, beatIdx) {
  const page = await freshPage(browser);
  await installBeatCapture(page);
  await fillAndSubmitHero(page, {
    arrival: "2026-06-19",
    departure: "2026-06-22",
    email: "sample@thejackpotchi.com",
  });
  await sleep(700); // let modal open + Step 2 enter
  for (let i = 0; i < beatIdx; i++) await fireNextBeat(page);
  return page;
}

async function capStep3Filled(browser, v) {
  const page = await freshPage(browser);
  await installBeatCapture(page);
  await fillAndSubmitHero(page, {
    arrival: "2026-06-19",
    departure: "2026-06-22",
    email: "sample@thejackpotchi.com",
  });
  await sleep(700);
  await fireAllBeats(page);
  await sleep(500);
  await fillStep3(page);
  return page;
}

async function capStep4Shape(browser, v) {
  const page = await freshPage(browser);
  await installBeatCapture(page);
  await fillAndSubmitHero(page, {
    arrival: "2026-06-19",
    departure: "2026-06-22",
    email: "sample@thejackpotchi.com",
  });
  await sleep(700);
  await fireAllBeats(page);
  await sleep(500);
  await fillStep3(page);
  await setGuestCount(page, 8); // trips the gate (>=6 guests)
  await submitFunnelStep(page);
  // Wait for the shape step to render
  await sleep(700);
  // Pick the second tier card to show the highlight state
  await page.evaluate(() => {
    const dlg = document.querySelector("dialog[open]");
    const cards = dlg?.querySelectorAll('[class*="tierCard"]');
    if (cards && cards[1]) cards[1].click();
  });
  await sleep(300);
  return page;
}

async function capQuoteDefault(browser, v) {
  const page = await freshPage(browser);
  await installBeatCapture(page);
  await fillAndSubmitHero(page, {
    arrival: "2026-06-19",
    departure: "2026-06-22",
    email: "sample@thejackpotchi.com",
  });
  await sleep(700);
  await fireAllBeats(page);
  await sleep(500);
  await fillStep3(page);
  await submitFunnelStep(page);
  await clickSkipIfPresent(page);
  await sleep(800);
  return page;
}

async function capQuoteEventNudge(browser, v) {
  const page = await freshPage(browser);
  await installBeatCapture(page);
  await fillAndSubmitHero(page, {
    arrival: "2026-07-30",
    departure: "2026-08-02",
    email: "sample@thejackpotchi.com",
  });
  await sleep(700);
  await fireAllBeats(page);
  await sleep(500);
  await fillStep3(page);
  await submitFunnelStep(page);
  await clickSkipIfPresent(page);
  await sleep(800);
  return page;
}

async function capQuoteHotelAnchor(browser, v) {
  const page = await freshPage(browser);
  await installBeatCapture(page);
  await fillAndSubmitHero(page, {
    arrival: "2026-06-19",
    departure: "2026-06-22",
    email: "sample@thejackpotchi.com",
  });
  await sleep(700);
  await fireAllBeats(page);
  await sleep(500);
  await fillStep3(page);
  await setGuestCount(page, 14);
  await submitFunnelStep(page);
  await clickSkipIfPresent(page);
  await sleep(800);
  return page;
}

async function capQuoteCtaAcknowledged(browser, v) {
  const page = await capQuoteDefault(browser, v);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      /i.?m interested/i.test(b.textContent || ""),
    );
    btn?.click();
  });
  await sleep(250);
  return page;
}

async function capDetailsTab(browser, v, tab) {
  const page = await capQuoteDefault(browser, v);
  await page.evaluate(() => {
    const btn = Array.from(
      document.querySelectorAll('button[aria-expanded]'),
    ).find((b) => /details/i.test(b.textContent || ""));
    btn?.click();
  });
  await sleep(550);
  if (tab === "included") {
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('[role="tab"]'))
        .find((t) => /included/i.test(t.textContent || ""))
        ?.click();
    });
    await sleep(280);
  }
  return page;
}

async function capPersonalAppeal(browser, v) {
  const page = await capQuoteDefault(browser, v);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button[aria-expanded]'))
      .find((b) => /numbers/i.test(b.textContent || ""))
      ?.click();
  });
  await sleep(550);
  return page;
}

async function capNoQuoteSuccess(browser, v) {
  // A far-future date that's likely to have unavailable nights in
  // PriceLabs. If quote actually computes, the shot still lands as
  // "success-with-quote" — Abe can re-run with a known-blocked date.
  const page = await freshPage(browser);
  await installBeatCapture(page);
  await fillAndSubmitHero(page, {
    arrival: "2027-02-10",
    departure: "2027-02-13",
    email: "sample@thejackpotchi.com",
  });
  await sleep(700);
  await fireAllBeats(page);
  await sleep(500);
  await fillStep3(page);
  await submitFunnelStep(page);
  await clickSkipIfPresent(page);
  await sleep(800);
  return page;
}

// ---------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------
const MANIFEST = [];
function shot(section, num, slug, viewport, description, fn) {
  MANIFEST.push({ section, num, slug, viewport, description, fn });
}

function buildManifest() {
  // Mobile only. Every shot at iPhone-class viewport (390×844, iOS UA,
  // touch). Per Abe's direction: focus catalog on the actual mobile
  // experience — the bottom sheet, the peek tab, the device-emulated
  // funnel.
  const v = "m";
  shot("01-hero", 1, "empty", v, "Hero booking bar — no fields filled.", capHeroEmpty);
  shot("01-hero", 2, "sticky-peek", v, "Sticky bar / peek tab after scrolling past hero.", capStickyPeek);
  shot("02-calendar", 1, "arrival-cal-open", v, "Arrival calendar popover open from hero.", capArrivalCal);
  shot("02-calendar", 2, "departure-range-hover", v, "Departure calendar with range-hover bar between arrival and hovered date.", capDepartureRangeHover);
  shot("03-step1-collect", 1, "modal-filled", v, "Bottom sheet Step 1 with dates + email filled (entered via sticky peek).", capModalStep1Filled);
  shot("04-step2-beats", 1, "beat1-pulse", v, "Step 2 beat 1 — pulse / 'Checking availability'.", (b, vp) => capStep2Beat(b, vp, 0));
  shot("04-step2-beats", 2, "beat2-insight", v, "Step 2 beat 2 — italic insight line.", (b, vp) => capStep2Beat(b, vp, 1));
  shot("04-step2-beats", 3, "beat3-teaser", v, "Step 2 beat 3 — empty-frame teaser card.", (b, vp) => capStep2Beat(b, vp, 2));
  shot("04-step2-beats", 4, "beat4-resolve", v, "Step 2 beat 4 — resolved checkmark / final reveal.", (b, vp) => capStep2Beat(b, vp, 3));
  shot("05-step3-form", 1, "filled", v, "Step 3 form filled (name, phone, occasion chip).", capStep3Filled);
  shot("06-step4-shape", 1, "tier-picked", v, "Shape Your Stay step with a tier highlighted.", capStep4Shape);
  shot("07-quote-reveal", 1, "default", v, "Quote reveal with primary CTA + subhead.", capQuoteDefault);
  shot("07-quote-reveal", 2, "event-nudge", v, "Quote reveal during Lollapalooza weekend — event-specific nudge.", capQuoteEventNudge);
  shot("07-quote-reveal", 3, "hotel-anchor", v, "Quote reveal for a 14-person stay — hotel anchor visible.", capQuoteHotelAnchor);
  shot("07-quote-reveal", 4, "cta-acknowledged", v, "Primary CTA after click — 'Got it — Abe will be in touch'.", capQuoteCtaAcknowledged);
  shot("08-quote-details", 1, "breakdown-tab", v, "'The details' expander open, Breakdown tab.", (b, vp) => capDetailsTab(b, vp, "breakdown"));
  shot("08-quote-details", 2, "included-tab", v, "'The details' expander open, What's included tab.", (b, vp) => capDetailsTab(b, vp, "included"));
  shot("08-quote-details", 3, "personal-appeal", v, "Personal note expander open with appeal form.", capPersonalAppeal);
  shot("09-no-quote", 1, "fallback", v, "Success page when no quote was computed.", capNoQuoteSuccess);
}

// ---------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------
/**
 * Pre-flight check: takes one screenshot of the hero at mobile viewport
 * AND reports key matchMedia/window values so we can confirm the
 * emulation is producing the actual mobile experience before running
 * the full catalog.
 *
 * Saves to screenshots/_probe-mobile.png. Logs viewport diagnostics.
 * Run with `node scripts/capture-funnel.mjs --verify`.
 */
async function verifyMobile() {
  console.log("[verify] launching browser to probe mobile viewport…");
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    defaultViewport: null,
    protocolTimeout: 120_000,
  });
  const page = await freshPage(browser);
  const diag = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    matchesMobile: window.matchMedia("(max-width: 767px)").matches,
    matches640: window.matchMedia("(max-width: 640px)").matches,
    userAgent: navigator.userAgent,
    hasTouch: "ontouchstart" in window,
  }));
  if (!existsSync(OUT_ROOT)) await mkdir(OUT_ROOT, { recursive: true });
  const probePath = path.join(OUT_ROOT, "_probe-mobile.png");
  await page.screenshot({ path: probePath, fullPage: false });
  console.log("[verify] diag:", diag);
  console.log(`[verify] saved → ${probePath}`);
  await page.close();
  await browser.close();

  // Hard checks — if any fail, exit non-zero so it's loud.
  const fails = [];
  if (diag.innerWidth !== 390) fails.push(`innerWidth=${diag.innerWidth}, expected 390`);
  if (!diag.matchesMobile) fails.push(`matchMedia(max-width:767px) is FALSE — mobile-only branches won't render`);
  if (!/iPhone/i.test(diag.userAgent)) fails.push(`UA doesn't look mobile: ${diag.userAgent}`);
  if (fails.length) {
    console.error("[verify] ✗ FAILED:");
    for (const f of fails) console.error("  -", f);
    process.exit(2);
  }
  console.log("[verify] ✓ mobile emulation looks correct");
}

async function run({ onlyMissing = false, freshBrowserPerShot = false } = {}) {
  buildManifest();
  let queue = MANIFEST;
  if (onlyMissing) {
    queue = MANIFEST.filter((s) => {
      const filename = `${String(s.num).padStart(2, "0")}-${s.slug}-${s.viewport}.png`;
      return !existsSync(path.join(OUT_ROOT, s.section, filename));
    });
  }
  console.log(
    `[capture] ${queue.length} of ${MANIFEST.length} shots queued${onlyMissing ? " (missing only)" : ""}${freshBrowserPerShot ? ", fresh browser per shot" : ""}`,
  );

  // When freshBrowserPerShot=false, launch one shared browser. Otherwise
  // each shot gets its own fresh browser — slower but avoids the CDP
  // protocol-timeout failures we saw when one Chrome instance ran the
  // full manifest end-to-end.
  let sharedBrowser = null;
  if (!freshBrowserPerShot) {
    sharedBrowser = await puppeteer.launch({
      executablePath: CHROME,
      headless: false,
      defaultViewport: null,
      protocolTimeout: 120_000,
    });
  }

  let ok = 0;
  let fail = 0;
  const failures = [];

  for (const s of queue) {
    const filename = `${String(s.num).padStart(2, "0")}-${s.slug}-${s.viewport}.png`;
    const dir = path.join(OUT_ROOT, s.section);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    const filepath = path.join(dir, filename);
    process.stdout.write(`[${s.section}/${filename}] `);
    let page = null;
    let browser = sharedBrowser;
    let ownsBrowser = false;
    if (freshBrowserPerShot) {
      browser = await puppeteer.launch({
        executablePath: CHROME,
        headless: false,
        defaultViewport: null,
        protocolTimeout: 240_000,
      });
      ownsBrowser = true;
    }
    try {
      page = await s.fn(browser, s.viewport);
      await sleep(250);
      await page.screenshot({ path: filepath, fullPage: false });
      console.log("✓");
      ok++;
    } catch (e) {
      console.log(`✗ ${e.message?.slice(0, 80) ?? e}`);
      fail++;
      failures.push({ filename: `${s.section}/${filename}`, error: String(e.message || e).slice(0, 200) });
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {}
      }
      if (ownsBrowser && browser) {
        try {
          await browser.close();
        } catch {}
      }
    }
  }

  // INDEX.md
  const groups = {};
  for (const s of MANIFEST) {
    if (!groups[s.section]) groups[s.section] = [];
    const filename = `${String(s.num).padStart(2, "0")}-${s.slug}-${s.viewport}.png`;
    groups[s.section].push({ filename, description: s.description });
  }
  const md = [
    "# Booking Funnel — Screenshot Catalog",
    "",
    "Generated by `scripts/capture-funnel.mjs`. Re-run after UI changes.",
    "",
    "Each shot captures a canonical state in the inquiry/quote flow at",
    "**desktop (1440×900)** or **mobile (390×844)**. Some short-lived",
    "states (CTA acknowledgement, personal appeal) are desktop-only.",
    "",
  ];
  for (const section of Object.keys(groups).sort()) {
    md.push(`## ${section}`, "");
    for (const r of groups[section]) {
      md.push(`- **${r.filename}** — ${r.description}`);
    }
    md.push("");
  }
  if (failures.length) {
    md.push("## ⚠️ Failures", "");
    for (const f of failures) {
      md.push(`- \`${f.filename}\` — ${f.error}`);
    }
    md.push("");
  }
  await writeFile(path.join(OUT_ROOT, "INDEX.md"), md.join("\n"));

  console.log(`\nDone. ${ok} ok, ${fail} failed. → ${OUT_ROOT}`);
  if (sharedBrowser) {
    try {
      await sharedBrowser.close();
    } catch {}
  }
}

const args = process.argv.slice(2);
let main;
if (args.includes("--verify")) {
  main = () => verifyMobile();
} else if (args.includes("--retry-missing")) {
  main = () => run({ onlyMissing: true, freshBrowserPerShot: true });
} else {
  main = () => run();
}
main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
