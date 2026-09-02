-- ═══════════════════════════════════════════════════════════════════════════
-- get_shared_engagements — the orders two people in a conversation share.
--
-- The messaging details panel could say who someone was, but not what we had
-- actually done together, which is the question a seller opening a buyer's
-- chat is really asking ("have they bought from me before?").
--
-- It has to work in BOTH directions from one call:
--   * I am the buyer, they are the seller  → my orders containing their items
--   * I am the seller, they are the buyer  → their orders containing my items
--
-- order_items carries seller_id directly, so neither direction needs to walk
-- through products.
--
-- Deliberately NOT admin-aware: an admin looking at a support thread is not a
-- party to the trade, and returning two other people's order history into a
-- chat panel is a wider disclosure than this feature needs. Admins have the
-- order tools on their own dashboard. The function is scoped to auth.uid()
-- being one of the two sides, always.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.get_shared_engagements(
  p_peer  uuid,
  p_limit integer default 6
)
returns table (
  order_id   uuid,
  created_at timestamptz,
  status     text,
  total      numeric,
  item_count bigint,
  direction  text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (select auth.uid() as uid)
  select o.id,
         o.created_at,
         o.status::text,
         o.total,
         count(oi.id),
         case when o.user_id = (select uid from me) then 'i_bought' else 'i_sold' end
    from public.orders o
    cross join me
    join public.order_items oi
      on oi.order_id = o.id
     and oi.deleted_at is null
   where me.uid is not null
     and p_peer is not null
     and p_peer <> me.uid
     and o.deleted_at is null
     and (
       -- I bought, they sold it
       (o.user_id = me.uid and oi.seller_id = p_peer)
       -- They bought, I sold it
       or (o.user_id = p_peer and oi.seller_id = me.uid)
     )
   group by o.id, o.created_at, o.status, o.total, o.user_id
   order by o.created_at desc
   limit least(greatest(coalesce(p_limit, 6), 1), 20);
$$;

revoke all on function public.get_shared_engagements(uuid, integer) from public, anon;
grant execute on function public.get_shared_engagements(uuid, integer) to authenticated;

-- The "their orders containing my items" direction filters order_items by
-- seller; without this it is a scan per conversation opened.
create index if not exists idx_order_items_seller_order
  on public.order_items (seller_id, order_id);
