-- SECURITY: close unauthenticated write-through on public views.
--
-- THE HOLE
-- Supabase's default ACL for the `public` schema grants ALL privileges
-- (arwdDxtm) on every new relation to `anon` and `authenticated`. For TABLES
-- that is fine — RLS gates the write. For VIEWS it is not:
--   * a view has no RLS of its own;
--   * a view is SECURITY DEFINER by default (security_invoker = off), so it
--     executes as its owner, `postgres`;
--   * `postgres` owns the base tables, and those tables have
--     relforcerowsecurity = false, so RLS is NOT enforced against the owner;
--   * a simple single-table view is auto-updatable (is_updatable = YES).
--
-- Chained together, `public_profiles` and `public_vendor_profiles` let ANY
-- anonymous caller write straight through to `profiles` / `vendor_profiles`
-- with RLS bypassed entirely, e.g.
--     PATCH /rest/v1/public_profiles?id=eq.<victim>   {"role":"admin"}
--     DELETE /rest/v1/public_profiles
-- i.e. unauthenticated privilege escalation to admin, and mass data deletion.
-- `wishlist` is the same shape over `wishlist_items`.
--
-- THE FIX
-- These views exist purely to expose a safe column subset for public reads,
-- and the app only ever SELECTs from them (verified: no write call sites).
-- So we keep SECURITY DEFINER — which is what makes the public read work at
-- all, since `profiles` RLS is own-row/admin only — and strip every write
-- privilege. Reads are unaffected.
--
-- Applied to ALL views in `public`, not just the known-exploitable ones, so
-- the non-updatable views are covered too and stay covered.

do $$
declare
  v record;
begin
  for v in
    select table_name
    from information_schema.views
    where table_schema = 'public'
  loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on public.%I from anon, authenticated',
      v.table_name
    );
  end loop;
end $$;

-- Read grants are then set EXPLICITLY per view rather than blanket-granted.
-- (A uniform `grant select ... to anon` across all views is wrong: it hands
-- anonymous users the views that were never meant to be public.)
--
-- Public browsing surface — anonymous reads intentional, safe column subsets:
grant select on public.public_profiles        to anon, authenticated;
grant select on public.public_vendor_profiles to anon, authenticated;
grant select on public.public_recent_activity to anon, authenticated;

-- Referenced nowhere in the app (verified by grep across components, pages,
-- context, hooks, services, api). SECURITY DEFINER, so a read through them
-- bypasses RLS on orders / shipments / wishlist_items. Locked to service_role.
revoke all on public.wishlist                    from anon, authenticated;
revoke all on public.v_order_fulfillment_summary from anon, authenticated;
revoke all on public.v_shipment_timeline         from anon, authenticated;

-- Trigger functions are not app RPCs. PostgREST rejects trigger-returning
-- functions, so this is defence in depth rather than a live exploit, but it
-- clears the advisor findings and keeps the RPC surface honest.
--
-- NOTE: these carry `=X/postgres` in proacl — EXECUTE is granted to PUBLIC,
-- not to anon/authenticated directly, so revoking from those two roles alone
-- is a silent no-op. The revoke must name PUBLIC.
--
-- Safe to revoke: Postgres checks EXECUTE on a trigger function when the
-- TRIGGER IS CREATED, not when it fires, so existing triggers keep working.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- `profiles` had two permissive SELECT policies for `authenticated`, so both
-- were evaluated for every row of the hottest table in the app. Same result,
-- one pass.
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_select_own   on public.profiles;

create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select is_admin()));
