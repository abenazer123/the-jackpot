-- Vote ladder reshape — add the high-conviction "love" tier to
-- trip_votes alongside the existing yes/maybe. The "no" value
-- stays allowed by the constraint so historical rows keep
-- working, but the API + UI no longer surface it.
--
-- New value semantics:
--   yes   → "I like it"     — soft positive
--   love  → "This is it"    — gold middle button, max enthusiasm
--   maybe → "Not sure yet"
--   no    → (legacy only — accepted on DB read, not offered in UI)

alter table public.trip_votes
  drop constraint trip_votes_vote_check;

alter table public.trip_votes
  add constraint trip_votes_vote_check
  check (vote in ('yes', 'love', 'maybe', 'no'));
