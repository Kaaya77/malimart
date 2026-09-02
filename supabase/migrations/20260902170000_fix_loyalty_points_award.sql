-- Fix: loyalty rewards never accrued. Every profile sat at points = 0 forever,
-- so the "Reward Points" KPI, the tier badge and the progress bar in
-- components/BuyerDashboard.tsx were permanently empty.
--
-- There were TWO loyalty functions in the database, and BOTH were dead:
--   public.fn_handle_loyalty_and_tiers()
--   public.handle_loyalty_points()
--
-- Each was broken in three independent ways:
--   1. NOT ATTACHED. Neither was referenced by any trigger — the only trigger
--      involving this feature at all was trg_generate_referral_code. So they
--      never ran.
--   2. WRONG COLUMN. Both do `UPDATE profiles SET loyalty_points = ...`, but
--      there is no `loyalty_points` column. It is `points`. Attaching them
--      as-is would raise 42703 and, since this fires on order status change,
--      would have broken order delivery outright.
--   3. ILLEGAL TIER VALUES. Both set tier to 'Balozi' / 'Mtembezi' / 'Msafiri',
--      but profiles_tier_check only permits
--      ('Bronze','Silver','Gold','Platinum'). Any tier write would violate the
--      constraint.
--
-- This migration adds ONE correct function and wires it up.
--
-- Deliberately does NOT write `profiles.tier`: the buyer dashboard derives the
-- tier from points at render time via getLoyaltyTier() in
-- components/buyer-dashboard/dashboardUtils.ts, so points are the single
-- source of truth. Writing tier would also be impossible to do correctly
-- today — the app's tiers are Starter/Bronze/Silver/Gold (thresholds
-- 0/500/3000/10000) while the CHECK constraint allows
-- Bronze/Silver/Gold/Platinum. 'Starter' cannot be stored at all. That
-- mismatch is left alone rather than silently resolved in either direction.
--
-- SECURITY DEFINER is required, not incidental: the order status transition to
-- 'delivered' is performed by the SELLER, and profiles RLS only permits a user
-- to update their own row. Awarding points to the BUYER as the seller would be
-- silently filtered out by RLS. The function is not exposed as an RPC (it
-- returns trigger, and EXECUTE is revoked below).

create or replace function public.award_loyalty_points()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  points_to_add integer;
begin
  -- Award once, on the transition into 'delivered'.
  if old.status is distinct from new.status and new.status = 'delivered' then
    points_to_add := floor(coalesce(new.total, 0) / 1000)::int;

    if points_to_add > 0 and new.user_id is not null then
      update public.profiles
         set points = coalesce(points, 0) + points_to_add
       where id = new.user_id;
    end if;
  end if;

  return new;
end;
$$;

-- Trigger functions are not RPCs (see 20260902120000_view_write_grant_lockdown).
revoke execute on function public.award_loyalty_points() from public, anon, authenticated;

drop trigger if exists trg_award_loyalty_points on public.orders;

create trigger trg_award_loyalty_points
  after update of status on public.orders
  for each row
  execute function public.award_loyalty_points();

-- ---------------------------------------------------------------------------
-- Backfill orders already delivered while the feature was dead.
--
-- Written as an ABSOLUTE set, not an increment, so re-running it is safe.
-- Every profile currently has points = 0, so nothing manually awarded is lost.
-- ---------------------------------------------------------------------------
update public.profiles p
   set points = coalesce(earned.pts, 0)
  from (
    select o.user_id, sum(floor(o.total / 1000))::int as pts
    from public.orders o
    where o.status = 'delivered' and o.deleted_at is null
    group by o.user_id
  ) as earned
 where p.id = earned.user_id
   and coalesce(p.points, 0) = 0;

-- NOTE: fn_handle_loyalty_and_tiers() and handle_loyalty_points() are left in
-- place rather than dropped (CLAUDE.md: never drop without explicit
-- instruction). They remain unattached, unreachable and broken — do not wire
-- either of them up. Use award_loyalty_points() above.
