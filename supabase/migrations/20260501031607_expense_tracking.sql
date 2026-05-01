-- Expense tracking — operational accounting for The Jackpot.
--
-- Three tables that together capture the cost structure
-- documented in docs/second-brain/cost-structure.md:
--
--   expense_categories — canonical category definitions (the
--                        baseline values from the doc). Seeded
--                        with all known recurring + per-booking
--                        items so variance against baseline can
--                        be detected on day one.
--   expense_entries    — actual money-out events. Tagged by
--                        category, optionally by reservation
--                        for variable cost analysis.
--   capex_items        — long-lived purchases with built-in
--                        monthly amortization (generated column).
--
-- Bucket taxonomy (from cost-structure.md §1):
--   A1 — Monthly recurring fixed
--   A2 — Annual recurring fixed
--   B1 — Per-booking turn costs
--   B2 — Channel fees (derived from reservations; not entered manually)
--   B3 — Payment processing
--   C1 — Repairs (irregular)
--   C2 — Capex / replacements
--   C3 — Compliance / professional services
--   C4 — Marketing / promo
--   D1 — Maintenance reserve (modeled, not actual cash)
--   D2 — Capex amortization (modeled, derived from capex_items)

-- ─────────────────────────────────────────────────────────────────
-- expense_categories
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.expense_categories (
  category_id   text primary key,
  bucket        text not null check (bucket in (
                  'A1','A2','B1','B2','B3',
                  'C1','C2','C3','C4',
                  'D1','D2'
                )),
  display_name  text not null,
  vendor        text,
  -- baseline_amount_cents: the canonical "expected" amount per the
  -- cost-structure doc. Variance against actuals is the signal
  -- the Second Brain watches.
  baseline_amount_cents integer,
  frequency     text check (frequency in (
                  'monthly','annual','per_booking','per_incident'
                )),
  seasonality_notes text,
  notes         text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists expense_categories_bucket_idx
  on public.expense_categories (bucket) where active;

alter table public.expense_categories enable row level security;

-- ─────────────────────────────────────────────────────────────────
-- expense_entries
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.expense_entries (
  entry_id       bigserial primary key,
  category_id    text references public.expense_categories(category_id),
  -- entry_date: when money actually left the account (or invoice
  -- date for things tracked by service date).
  entry_date     date not null,
  -- period_month: for monthly recurring entries (A1), the
  -- accounting period this entry belongs to. YYYY-MM-01.
  -- Null for one-time/per-incident entries.
  period_month   date,
  amount_cents   integer not null check (amount_cents >= 0),
  vendor         text,
  description    text,
  -- reservation_id: for B1 per-booking entries, ties the cost to
  -- the specific booking it was incurred for. Lets us compute
  -- true cost-per-booking for any given reservation.
  reservation_id text,
  receipt_url    text,
  notes          text,
  created_at     timestamptz not null default now(),
  created_by     text -- 'operator' | 'auto' (for derived entries)
);

create index if not exists expense_entries_date_idx
  on public.expense_entries (entry_date desc);

create index if not exists expense_entries_period_idx
  on public.expense_entries (period_month) where period_month is not null;

create index if not exists expense_entries_category_idx
  on public.expense_entries (category_id, entry_date desc);

create index if not exists expense_entries_reservation_idx
  on public.expense_entries (reservation_id) where reservation_id is not null;

alter table public.expense_entries enable row level security;

-- ─────────────────────────────────────────────────────────────────
-- capex_items
-- ─────────────────────────────────────────────────────────────────
-- Capex sits separate because the right accounting treatment is
-- amortization, not single-month expensing. The
-- monthly_amortization_cents column is generated so reports can
-- always pull the true monthly carry without re-deriving.
create table if not exists public.capex_items (
  item_id        bigserial primary key,
  purchase_date  date not null,
  description    text not null,
  amount_cents   integer not null check (amount_cents > 0),
  lifespan_months integer not null check (lifespan_months > 0),
  category       text, -- 'furniture' | 'appliance' | 'mattress' | 'electronics' | 'hot_tub' | 'linens' | 'outdoor' | 'game_room' | 'kitchen'
  vendor         text,
  receipt_url    text,
  notes          text,
  -- Monthly carrying cost — derived. Reports sum this across all
  -- items to get the D2 capex amortization line.
  monthly_amortization_cents integer
    generated always as (amount_cents / lifespan_months) stored,
  created_at     timestamptz not null default now()
);

create index if not exists capex_items_purchase_date_idx
  on public.capex_items (purchase_date desc);

create index if not exists capex_items_category_idx
  on public.capex_items (category);

alter table public.capex_items enable row level security;

-- ─────────────────────────────────────────────────────────────────
-- Seed: expense_categories
-- ─────────────────────────────────────────────────────────────────
-- All values from docs/second-brain/cost-structure.md §2-§3.
-- Categories with TBD baseline values are inserted with NULL
-- baseline_amount_cents so the operator can fill them in later
-- without losing the category structure.

insert into public.expense_categories
  (category_id, bucket, display_name, vendor, baseline_amount_cents, frequency, seasonality_notes, notes)
values
  -- A1 — Monthly recurring fixed (current baseline)
  ('mortgage_piti', 'A1', 'Mortgage (PITI)', 'Bank',
   521000, 'monthly', null,
   'Includes property tax + insurance escrow'),

  ('electric', 'A1', 'Electric', 'ComEd',
   25000, 'monthly', 'Higher in summer (AC) and winter (heating)',
   'Avg; varies seasonally'),

  ('gas', 'A1', 'Gas (utility)', 'Utility',
   25000, 'monthly', 'Range $100-$500. Winter (Nov-Mar) adds +$250 to baseline = $500/mo effective.',
   'Track winter actuals separately to confirm uplift'),

  ('hot_tub_chemicals', 'A1', 'Hot tub chemicals', 'Supplier',
   15000, 'monthly', 'Slight winter uplift',
   'Year-round'),

  ('internet', 'A1', 'Internet', 'ISP',
   9000, 'monthly', null,
   'Guest-required; cannot reduce'),

  ('pricelabs', 'A1', 'PriceLabs subscription', 'PriceLabs',
   4000, 'monthly', null,
   'Pricing engine'),

  -- A1 — software/SaaS lines (TBD; operator to confirm tier)
  ('vercel', 'A1', 'Vercel hosting', 'Vercel',
   null, 'monthly', null,
   'TBD: hobby tier $0 vs Pro $20/mo'),

  ('supabase', 'A1', 'Supabase', 'Supabase',
   null, 'monthly', null,
   'TBD: free tier $0 vs Pro $25/mo'),

  ('resend', 'A1', 'Resend (email)', 'Resend',
   null, 'monthly', null,
   'TBD: free tier likely sufficient at current volume'),

  ('domain_email', 'A1', 'Domain email forwarding', null,
   null, 'monthly', null,
   'TBD: Google Workspace ~$6/user if active'),

  ('business_phone', 'A1', 'Business phone', null,
   null, 'monthly', null,
   'TBD: if separate from personal'),

  -- A2 — Annual recurring (currently uncaptured; baseline TBD)
  ('domain_renewal', 'A2', 'Domain renewal', null,
   1500, 'annual', null,
   'thejackpotchi.com — ~$15/year'),

  ('chicago_str_license', 'A2', 'Chicago STR license fee', 'City of Chicago',
   null, 'annual', null,
   'Either Shared Housing Unit or Vacation Rental category; confirm which + fee'),

  ('llc_annual_report', 'A2', 'IL LLC annual report', 'IL Secretary of State',
   7500, 'annual', null,
   'Stravon Group LLC — ~$75/year'),

  ('liability_insurance', 'A2', 'General liability insurance', null,
   null, 'annual', null,
   'TBD: separate from mortgage escrow?'),

  ('umbrella_insurance', 'A2', 'Umbrella liability policy', null,
   null, 'annual', null,
   'Optional but recommended for STR exposure'),

  ('accounting', 'A2', 'Accounting / tax prep', null,
   null, 'annual', null,
   'CPA fee at year-end'),

  ('legal_compliance', 'A2', 'Legal review (compliance)', null,
   null, 'per_incident', null,
   'Napolitano ordinance, license renewals, complaints'),

  -- B1 — Per-booking turn costs (current baseline)
  ('cleaning_per_turn', 'B1', 'Cleaning', 'Cleaner',
   35000, 'per_booking', null,
   'Standard turnover'),

  ('laundry_per_turn', 'B1', 'Laundry', 'Laundry service',
   15000, 'per_booking', null,
   'Linens + towels per turn'),

  ('welcome_supplies', 'B1', 'Welcome gifts / supplies', null,
   4000, 'per_booking', null,
   'Restocking consumables'),

  -- B1 — currently rolled into above; flagged for breakout
  ('linen_replacement', 'B1', 'Linen depreciation / replacement', null,
   null, 'per_booking', null,
   'Sheets, towels wear out; amortize replacement against bookings'),

  ('hot_tub_consumables_var', 'B1', 'Hot tub minor consumables (variable)', null,
   null, 'per_booking', null,
   'Above the $150/mo chemicals — filter changes etc. accelerate with use'),

  -- B2 — Channel fees (derived from reservation_data; not manually entered)
  ('airbnb_fee', 'B2', 'Airbnb host fee', 'Airbnb',
   null, 'per_booking', null,
   'Derived: 15.5% of total_cost (17.5% if Super Strict). Auto-computed.'),

  ('vrbo_fee', 'B2', 'Vrbo host fee', 'Vrbo',
   null, 'per_booking', null,
   'Derived: 5% (PMS-connected) or ~8% (pay-per-booking)'),

  ('bcom_fee', 'B2', 'Booking.com fee', 'Booking.com',
   null, 'per_booking', null,
   'Derived; rate varies by listing'),

  -- B3 — Payment processing (Phase 8)
  ('stripe_processing', 'B3', 'Payment processing', 'Stripe',
   null, 'per_booking', null,
   '~2.9% + $0.30 per transaction. Direct bookings only (Phase 8)'),

  -- C1 — Repairs (per-incident; no baseline)
  ('repair_plumbing', 'C1', 'Plumbing', null,
   null, 'per_incident', null, null),
  ('repair_electrical', 'C1', 'Electrical', null,
   null, 'per_incident', null, null),
  ('repair_hvac', 'C1', 'HVAC service / repair', null,
   null, 'per_incident', null, null),
  ('repair_appliance', 'C1', 'Appliance repair', null,
   null, 'per_incident', null,
   'Dishwasher, washer/dryer, fridge, oven'),
  ('repair_hot_tub', 'C1', 'Hot tub repair', null,
   null, 'per_incident', null,
   'Above chemicals; pump, heater, jets'),
  ('pest_control', 'C1', 'Pest control', null,
   null, 'per_incident', null, null),
  ('snow_removal', 'C1', 'Snow removal', null,
   null, 'per_incident', 'Chicago winter Nov-Mar',
   'Likely needed multiple times per season'),
  ('lawn_landscaping', 'C1', 'Lawn / landscaping', null,
   null, 'per_incident', 'Spring-Fall',
   'Mowing, leaf clearing, gutter cleaning'),
  ('window_cleaning', 'C1', 'Window cleaning', null,
   null, 'per_incident', null, null),
  ('carpet_cleaning', 'C1', 'Carpet / deep cleaning', null,
   null, 'per_incident', null,
   'Beyond turn-cleaning'),

  -- C3 — Compliance / professional (one-offs)
  ('city_violation', 'C3', 'City violation / fine', 'City of Chicago',
   null, 'per_incident', null,
   'Hopefully zero. $2,500-$10,000/offense per KB §3.2'),

  -- C4 — Marketing / promo (zero today; placeholder)
  ('airbnb_promotion', 'C4', 'Paid Airbnb promotion', 'Airbnb',
   null, 'per_incident', null,
   'Sponsored listing slots'),
  ('google_ads', 'C4', 'Google Ads', 'Google',
   null, 'monthly', null,
   'Direct booking marketing (Phase 8)'),
  ('photography', 'C4', 'Photography (refresh)', null,
   null, 'per_incident', null,
   'Periodic content refresh')

on conflict (category_id) do nothing;
