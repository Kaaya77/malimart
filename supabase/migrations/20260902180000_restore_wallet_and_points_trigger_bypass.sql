-- Fix: wallet credits AND loyalty points were both blocked in production by
-- the profiles privilege-escalation guard.
--
-- REGRESSION. Migration 20260706113000_wallet_trigger_bypass.sql taught
-- prevent_privilege_escalation() to honour a transaction-local GUC set by
-- _credit_wallet(), so internal ledger writes could update wallet_balance
-- while direct client writes stayed blocked. That fix is NO LONGER LIVE —
-- both halves were overwritten by a later change:
--
--   live prevent_privilege_escalation(): no 'malimart.internal_wallet_write'
--     branch, and prosecdef flipped true -> false, search_path changed to
--     'public, extensions, pg_temp' (i.e. a later hardening pass recreated it
--     from the pre-bypass source)
--   live _credit_wallet(): no set_config() marking at all
--
-- Verified against production: calling _credit_wallet() in a buyer session
-- raises 'Unauthorized: wallet must be modified through wallet_transactions'.
-- So every refund credit, referral reward payout and checkout wallet debit
-- fails for any non-admin session.
--
-- This migration restores that bypass and extends the identical pattern to
-- `points`, which needs it for the same reason: the loyalty trigger added in
-- 20260902170000 fires when the SELLER marks an order delivered, so auth.uid()
-- is the seller — not an admin, and not null — and the points branch rejects
-- the write.
--
-- Why a GUC and not just SECURITY DEFINER: auth.uid() reads the request JWT
-- claim, which SECURITY DEFINER does NOT clear. Running as postgres therefore
-- does not make the guard treat the write as a system operation. The GUC can
-- only be set server-side inside these functions — PostgREST gives clients no
-- way to smuggle it in — and both writer functions have EXECUTE revoked from
-- anon/authenticated, so the ledger-only invariant is preserved.

-- ---------------------------------------------------------------------------
-- 1. _credit_wallet: current live body, plus the internal-write mark.
-- ---------------------------------------------------------------------------
create or replace function public._credit_wallet(
  p_profile_id  uuid,
  p_amount      numeric,
  p_type        text,
  p_description text,
  p_order_id    uuid default null,
  p_reference   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _tx_id uuid;
  _rows  integer;
begin
  if p_profile_id is null then raise exception 'wallet: missing profile'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'wallet: amount must be positive';
  end if;
  if p_type not in ('credit', 'debit') then
    raise exception 'wallet: invalid type %', p_type;
  end if;

  -- The mark must stay set across BOTH writes to profiles.wallet_balance.
  -- The second one is not obvious: trg_sync_wallet_balance on
  -- wallet_transactions fires AFTER INSERT and recomputes the balance from the
  -- ledger, so it touches profiles too. The original 20260706113000 cleared
  -- the mark before that INSERT, which is why restoring it verbatim still
  -- failed with 'Unauthorized: wallet must be modified through
  -- wallet_transactions' — the guard caught the ledger sync, not the direct
  -- update. Clear it only at the very end.
  perform set_config('malimart.internal_wallet_write', 'on', true);

  if p_type = 'credit' then
    update profiles set wallet_balance = coalesce(wallet_balance, 0) + p_amount, updated_at = now()
    where id = p_profile_id;
  else
    update profiles set wallet_balance = greatest(coalesce(wallet_balance, 0) - p_amount, 0), updated_at = now()
    where id = p_profile_id;
  end if;

  -- Capture the row count explicitly: `PERFORM set_config(...)` would itself
  -- set FOUND to true, so the original `IF NOT FOUND` check after it could
  -- never fire and a credit to a non-existent profile passed silently.
  get diagnostics _rows = row_count;
  if _rows = 0 then raise exception 'wallet: profile not found'; end if;

  insert into wallet_transactions (profile_id, order_id, amount, type, status, reference_id, description, created_at)
  values (p_profile_id, p_order_id, p_amount, p_type, 'completed', p_reference, p_description, now())
  returning id into _tx_id;

  perform set_config('malimart.internal_wallet_write', '', true);

  return _tx_id;
end;
$function$;

revoke all on function public._credit_wallet(uuid, numeric, text, text, uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The guard: same rules, plus both internal-write exceptions.
--    Keeps the CURRENT live search_path and SECURITY INVOKER — this migration
--    restores the bypass without silently reverting the later hardening pass.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_privilege_escalation()
returns trigger
language plpgsql
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
begin
  -- System operations (e.g. auth triggers) run without a JWT.
  if auth.uid() is null then
    return new;
  end if;

  -- Non-admins cannot change their own role. No exception, ever.
  if new.role is distinct from old.role then
    if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'::user_role) then
      raise exception 'Unauthorized: cannot change role';
    end if;
  end if;

  -- Non-admins cannot directly modify wallet_balance.
  -- Exception: writes from public._credit_wallet, which marks itself.
  if new.wallet_balance is distinct from old.wallet_balance then
    if coalesce(current_setting('malimart.internal_wallet_write', true), '') <> 'on'
       and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'::user_role) then
      raise exception 'Unauthorized: wallet must be modified through wallet_transactions';
    end if;
  end if;

  -- Non-admins cannot directly modify points.
  -- Exception: writes from public.award_loyalty_points, which marks itself.
  if new.points is distinct from old.points then
    if coalesce(current_setting('malimart.internal_points_write', true), '') <> 'on'
       and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'::user_role) then
      raise exception 'Unauthorized: points must be modified through the rewards system';
    end if;
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. The loyalty trigger marks its own write.
-- ---------------------------------------------------------------------------
create or replace function public.award_loyalty_points()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  points_to_add integer;
begin
  if old.status is distinct from new.status and new.status = 'delivered' then
    points_to_add := floor(coalesce(new.total, 0) / 1000)::int;

    if points_to_add > 0 and new.user_id is not null then
      perform set_config('malimart.internal_points_write', 'on', true);

      update public.profiles
         set points = coalesce(points, 0) + points_to_add
       where id = new.user_id;

      perform set_config('malimart.internal_points_write', '', true);
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.award_loyalty_points() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. The SECOND guard on profiles.
--
-- `trg_profiles_freeze` runs freeze_privileged_columns('role','is_admin',
-- 'is_banned','wallet_balance','points') as a BEFORE UPDATE trigger, and it
-- fires AFTER profiles_prevent_escalation (trigger order is alphabetical).
--
-- Unlike the escalation guard it does not raise — it SILENTLY restores the old
-- value with jsonb_set. So even once the escalation guard was taught to allow
-- internal writes, wallet credits and loyalty points still evaporated with no
-- error at all: the ledger row was inserted, _credit_wallet returned a tx id,
-- and the balance stayed 0. That silence is what made this so hard to see.
--
-- Teach it the same two internal-write marks, per column. role / is_admin /
-- is_banned stay frozen unconditionally — there is no bypass for those.
-- ---------------------------------------------------------------------------
create or replace function public.freeze_privileged_columns()
returns trigger
language plpgsql
as $function$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_key text;
begin
  -- Admins (and internal SECURITY DEFINER callers running as the table owner,
  -- where auth.uid() is NULL) bypass the freeze.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  foreach v_key in array tg_argv loop
    -- Server-only marks, set inside public._credit_wallet and
    -- public.award_loyalty_points. Clients cannot set a GUC via PostgREST.
    if (v_key = 'wallet_balance'
        and coalesce(current_setting('malimart.internal_wallet_write', true), '') = 'on')
    or (v_key = 'points'
        and coalesce(current_setting('malimart.internal_points_write', true), '') = 'on')
    then
      continue;
    end if;

    if (v_old ? v_key) and (v_new -> v_key is distinct from v_old -> v_key) then
      v_new := jsonb_set(v_new, array[v_key], v_old -> v_key);
    end if;
  end loop;

  new := jsonb_populate_record(new, v_new);
  return new;
end;
$function$;

revoke execute on function public.freeze_privileged_columns() from public, anon, authenticated;
