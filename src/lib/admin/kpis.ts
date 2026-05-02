/**
 * KPI metadata — single source of truth for every metric on
 * /admin. Each entry powers two surfaces:
 *
 *   1. The click-to-explain modal on each KPI card (what is
 *      it / relevance / what it tells us / how it's computed).
 *   2. The "Methodology" disclosure block at the bottom of
 *      /admin (same content, all listed at once).
 *
 * If a KPI is added to the dashboard, add it here too — the
 * page imports `KPI_META[key]` and renders the explanation in
 * both places.
 */

export type KpiCategory = "cost" | "drift" | "pricing";

export interface KpiMeta {
  /** Stable identifier — matches the key the page uses. */
  key: string;
  /** Group on the methodology page. */
  category: KpiCategory;
  /** Card title. Modal heading. */
  label: string;
  /** "What is it" — one or two sentence definition. */
  whatIs: string;
  /** "Why it matters" — the strategic relevance. */
  relevance: string;
  /** "What it tells us about the business" — interpretation. */
  business: string;
  /** "How it's computed" — formula in plain SQL/code. */
  formula: string;
}

export const KPI_META: Record<string, KpiMeta> = {
  baseline_implied: {
    key: "baseline_implied",
    category: "cost",
    label: "Baseline implied",
    whatIs:
      "The expected monthly fixed cost of running The Jackpot before any per-booking variable costs — what a typical month costs even with zero guests.",
    relevance:
      "It's the floor the property has to clear every month to break even on cash. Knowing this number is the starting point for every pricing and revenue decision.",
    business:
      "If actual months consistently exceed this, fixed costs have crept (utility hikes, software bloat, missing line items). If they're under, baselines may be stale. The variance pill on the Avg monthly card compares directly to this number.",
    formula:
      "SUM(active A1 monthly baselines) + SUM(capex_items.monthly_amortization_cents). A1 baselines come from expense_categories.baseline_amount_cents where bucket='A1' and frequency='monthly' and active=true.",
  },
  avg_monthly_3mo: {
    key: "avg_monthly_3mo",
    category: "cost",
    label: "Avg monthly (3mo)",
    whatIs:
      "Trailing three-month average of total monthly spend. The 'current run-rate' for cost.",
    relevance:
      "Short window, so it reflects what's happening *now* — recent rate hikes, seasonal swings, repair clusters. The variance pill compares it to the implied baseline so drift surfaces immediately.",
    business:
      "If 3mo > 12mo, costs are accelerating; if 3mo < 12mo, a recent improvement is sticking. Compare to baseline implied to see whether actuals are tracking the cost-structure doc.",
    formula:
      "Group expense_entries by period_month, sum amount_cents per month, take the mean of the last 3 months that had any entries (skip empty months so they don't drag the avg down).",
  },
  avg_monthly_12mo: {
    key: "avg_monthly_12mo",
    category: "cost",
    label: "Avg monthly (12mo)",
    whatIs:
      "Trailing twelve-month average of total monthly spend. The annualized run-rate.",
    relevance:
      "Long window smooths out one-off repairs and seasonal noise. Best estimate of 'what does a year actually cost?'.",
    business:
      "Annualize × 12 to compare against the KB §2.2 stated $71,880/yr fixed-cost figure. Material drift is a signal that the master KB needs updating.",
    formula:
      "Same shape as Avg monthly (3mo), but over the last 12 calendar months. Months with zero entries are skipped.",
  },
  this_month_spend: {
    key: "this_month_spend",
    category: "cost",
    label: "This month spend",
    whatIs:
      "Total amount spent so far in the current calendar month, summed across every expense entry logged.",
    relevance:
      "Real-time visibility. Useful end-of-month: how much have I logged versus what's typical? Useful mid-month: am I tracking?",
    business:
      "Compare to baseline implied (typical month) to see if you're on pace, ahead, or behind. A low number near month-end usually means entries are missing, not that costs went down.",
    formula:
      "SUM(amount_cents) of expense_entries where entry_date >= start of current calendar month.",
  },
  ytd_a1_pacing: {
    key: "ytd_a1_pacing",
    category: "drift",
    label: "YTD A1 pacing",
    whatIs:
      "Year-to-date A1 fixed spend versus the linearly-extrapolated baseline expectation — 'how am I tracking against expected fixed costs for the year so far?'.",
    relevance:
      "A1 is the predictable, recurring core of the cost base. If actuals diverge from the linear baseline, something has shifted — utility rate change, software added, or a baseline that's wrong.",
    business:
      "Variance pill green/under means fixed costs are coming in lower than expected (good); red/over means they're running hot (investigate). Compounds across the year, so a small monthly variance becomes a noticeable annual one.",
    formula:
      "Actual: SUM(A1 entries this calendar year). Expected: monthsElapsed × baselineA1 (where monthsElapsed is fractional — May 15 ≈ 4.45). Variance = (actual − expected) ÷ expected.",
  },
  repair_pulse: {
    key: "repair_pulse",
    category: "drift",
    label: "Repair pulse (C1)",
    whatIs:
      "Count and dollar value of irregular repair entries (C1 bucket) — plumbing, HVAC, hot tub, snow removal, appliance fixes — for the current month and the trailing 90-day average.",
    relevance:
      "Repair clusters are an early warning. A spike often indicates equipment failing or a guest-caused incident. Catching it fast shapes whether it's a one-off or a pattern.",
    business:
      "If this month's count is materially above the 90d average, the property is in an unusual state — investigate. If consistently zero, either operations are smooth or entries aren't being logged.",
    formula:
      "This month: COUNT and SUM of expense_entries where category bucket='C1' and period_month=current. 90d average: SUM(C1 entries last 90 days) ÷ 3.",
  },
  capex_lifetime: {
    key: "capex_lifetime",
    category: "drift",
    label: "Capex lifetime",
    whatIs:
      "Total dollars spent on long-lived purchases (furniture, appliances, hot tub, electronics, mattresses) since the property opened — the cumulative invested capital outside mortgage.",
    relevance:
      "Tracks the owner's contributed capital beyond the mortgage. Useful for tax accounting (depreciation schedules) and for understanding effective cost of ownership.",
    business:
      "The monthly carry (amortized) sits in the fixed-cost stack and shows up in baseline implied. Lifetime tells the story of total investment; monthly carry tells the story of what it's costing right now.",
    formula:
      "SUM(capex_items.amount_cents) across all rows. Monthly carry = SUM(monthly_amortization_cents) which is amount_cents ÷ lifespan_months per item.",
  },
  baseline_coverage: {
    key: "baseline_coverage",
    category: "drift",
    label: "Baseline coverage",
    whatIs:
      "How many active A1 monthly categories have a baseline number set, expressed as a fraction.",
    relevance:
      "Anything without a baseline can't be checked for drift, can't roll into 'baseline implied,' and can't trigger variance alerts. Coverage is a data-quality KPI for the cost-tracking system itself.",
    business:
      "X/Y means Y categories are tracked, X have known baselines. Click through to /admin/categories?bucket=A1 and fill in the missing ones (Vercel, Supabase, Resend, etc.) to firm up every other KPI.",
    formula:
      "COUNT(active A1 monthly categories with baseline_amount_cents NOT NULL) / COUNT(active A1 monthly categories).",
  },
  adr_180d: {
    key: "adr_180d",
    category: "pricing",
    label: "ADR (180d realized)",
    whatIs:
      "Average daily rate over the trailing 180 days — total realized rental revenue divided by total nights booked.",
    relevance:
      "ADR is the headline pricing KPI. KB §5.1 baselines: $841 blended (current), $1,094+ at $175K floor, $1,111+ at $200K stretch. Every revenue management decision pivots off where ADR is and where it's headed.",
    business:
      "Compare to KB targets. Trending up = pricing is firming, demand strong. Trending down = either deliberate calibration (early review velocity) or demand softening. Currently single-channel (Airbnb only) — VRBO blending is on the watchlist.",
    formula:
      "SUM(rental_revenue) ÷ SUM(no_of_days) across all booked PriceLabs reservations in the trailing 180 days, single listing (the one in pricing_config.pricelabs_listing_id).",
  },
  avg_los: {
    key: "avg_los",
    category: "pricing",
    label: "Avg LOS (180d)",
    whatIs:
      "Average length of stay per booking over the trailing 180 days, in nights.",
    relevance:
      "Drives variable cost per night (B1 turn cost ÷ LOS). Longer stays spread the $540 cleaning/laundry/supplies over more nights, which lowers the per-night cost floor and raises contribution margin.",
    business:
      "Group composition shifts LOS — peak-summer wedding-guest 4-night stays look different from winter 2-night couples. Compare to KB §2.6 use-case profile to see which guest type is dominant.",
    formula:
      "SUM(no_of_days) ÷ COUNT(bookings) across the same 180-day window.",
  },
  var_per_night: {
    key: "var_per_night",
    category: "pricing",
    label: "Variable / night",
    whatIs:
      "Direct variable cost spread across the nights of an average stay — what each night-of-occupancy actually costs in cleaning, laundry, and supplies.",
    relevance:
      "This is the floor the nightly rate has to clear before contribution margin is even positive. Below this, every booked night is cash-negative.",
    business:
      "If LOS rises, this drops mechanically (same $540 ÷ more nights). Marketing toward longer-stay guests (wedding-guest, family reunion) directly improves this number without any rate change.",
    formula:
      "B1 baseline (sum of active per-booking baselines) ÷ avg LOS. Channel fees are NOT included here (data-watchlist §1).",
  },
  contribution_margin: {
    key: "contribution_margin",
    category: "pricing",
    label: "Contribution margin",
    whatIs:
      "Dollars left over from each night's ADR after direct variable costs are covered — the cash that contributes to fixed-cost coverage and profit.",
    relevance:
      "Classic CVP framework: every night-booked contributes this much to covering fixed costs. Multiply by booked nights in a month and you get the cushion above break-even.",
    business:
      "Higher CM means each booking does more work toward profitability. Two ways to grow it: raise ADR or lower variable cost per night (longer LOS, cleaner contracts, leaner supplies). Channel fees would reduce CM further once added.",
    formula:
      "ADR − variable cost per night. Excludes channel fees in this stopgap (~15.5% Airbnb, ~5% VRBO) which would bring CM down. Tracked in data-watchlist §1.",
  },
  cm_ratio: {
    key: "cm_ratio",
    category: "pricing",
    label: "CM ratio",
    whatIs:
      "Contribution margin as a percentage of ADR — what fraction of every dollar of nightly revenue survives variable costs.",
    relevance:
      "Margin compression / expansion at a glance. If ADR rises $100 but CM ratio stays flat, variable costs scaled too. If CM ratio expands, you're getting operating leverage.",
    business:
      "Compare across seasons — peak summer's high ADR should produce a high CM ratio if supply/cleaning costs aren't inflating proportionally. Winter at $625 ADR with the same $540 turn cost gives a much lower ratio.",
    formula:
      "(Contribution margin ÷ ADR) × 100. Expressed as a percentage.",
  },
  break_even_nights: {
    key: "break_even_nights",
    category: "pricing",
    label: "Break-even nights / mo",
    whatIs:
      "How many nights you need to sell at the current ADR to fully cover monthly fixed costs (mortgage, utilities, capex carry) — the operating break-even.",
    relevance:
      "The most actionable number on the dashboard. KB §2.5 goal architecture is built around achievable nights × achievable ADR. This is the floor; everything above contributes to profit.",
    business:
      "If break-even is ~9 nights/mo and you're booking 11, you have 2 nights of cushion contributing to profit. If break-even is 16 and you typically book 13, the math doesn't work — raise rates, cut fixed costs, or accept losses. Calculator for re-pricing decisions.",
    formula:
      "Total fixed monthly (A1 + A2÷12 + capex carry) ÷ contribution margin per night. If CM is zero or negative, break-even is infinite — the pricing is structurally unprofitable.",
  },
};
