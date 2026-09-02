-- CRITICAL: "Remove from history" let a BUYER erase a completed sale from the
-- SELLER's books and from platform revenue.
--
-- hide_my_order() set `orders.deleted_at = now()`. That column is the GLOBAL
-- soft-delete flag, and it is filtered by every seller and admin read:
--   get_seller_orders, get_seller_dashboard, recompute_seller_dashboard,
--   get_admin_dashboard, get_admin_stats, recompute_admin_dashboard
--
-- Verified against production (rolled back): a buyer hiding one delivered order
-- moved the seller's order count 3 -> 2 and platform revenue 84,500 -> 62,000.
-- The comment in components/BuyerOrders.tsx claimed "the seller's and admin's
-- records are unaffected" — that was simply not true.
--
-- It also explains the inconsistency reported from the buyer dashboard: "Total
-- Orders" and "Total Spent" dropped (they filter deleted_at) while "Reward
-- Points" did not (those live on profiles.points). Hiding a row was silently
-- rewriting financial history, and only partially.
--
-- FIX: hiding is a VIEW PREFERENCE, not a financial event. It now sets a
-- separate buyer-scoped column, so:
--   * the seller's and admin's records genuinely are unaffected
--   * the buyer's own lifetime stats stay intact, consistent with points
--   * only the buyer's order LIST hides the row

alter table public.orders
  add column if not exists hidden_at timestamptz;

comment on column public.orders.hidden_at is
  'Buyer-scoped "remove from history". View preference only — never filter this in seller/admin reads or in any stats calculation. Global deletion is deleted_at.';

-- Buyers list their own orders through get_buyer_orders; that is the only read
-- that should respect the flag.
create index if not exists idx_orders_user_hidden
  on public.orders (user_id, hidden_at);

-- ---------------------------------------------------------------------------
-- hide_my_order: set the buyer-scoped flag, not the global one.
-- ---------------------------------------------------------------------------
create or replace function public.hide_my_order(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  update orders
  set    hidden_at = now()
  where  id        = p_order
    and  user_id   = v_uid
    and  status    in ('delivered', 'cancelled', 'failed', 'refunded')
    and  deleted_at is null
    and  hidden_at  is null;

  if not found then
    raise exception 'Order not found, access denied, or not in a terminal state';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Un-hide, so "remove from history" is no longer a one-way door. The client
-- now confirms first, but a reversible action still beats a modal alone.
-- ---------------------------------------------------------------------------
create or replace function public.unhide_my_order(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  update orders
  set    hidden_at = null
  where  id      = p_order
    and  user_id = v_uid;

  if not found then
    raise exception 'Order not found or access denied';
  end if;
end;
$$;

revoke execute on function public.unhide_my_order(uuid) from public, anon;
grant  execute on function public.unhide_my_order(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Migrate rows hidden under the old behaviour: they were marked deleted_at by
-- a buyer, which wrongly removed them from seller/admin books. Restore them
-- globally and re-express the intent as a buyer-scoped hide.
--
-- Scoped to terminal statuses, i.e. exactly what hide_my_order could act on,
-- so genuine admin/system deletions of non-terminal orders are left alone.
-- ---------------------------------------------------------------------------
update public.orders
set    hidden_at  = coalesce(hidden_at, deleted_at),
       deleted_at = null
where  deleted_at is not null
  and  status in ('delivered', 'cancelled', 'failed', 'refunded');
