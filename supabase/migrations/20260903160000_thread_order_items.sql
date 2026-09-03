-- ═══════════════════════════════════════════════════════════════════════════
-- get_thread_page: carry the ITEMS of a referenced order, not just its id.
--
-- A message tagged "about order #4A2B91C7" could only ever render that opaque
-- id. There is no per-order route that works for both sides of a conversation
-- (/order/:id/receipt is buyer-shaped and bounces a seller whose RLS cannot
-- read it), so the reference had nowhere useful to go.
--
-- What someone actually wants from "about this order" is the thing that was
-- ordered. Returning the order's items lets the tag render them and link each
-- one straight to its product page.
--
-- ENTITLEMENT — this function is SECURITY DEFINER, so the visibility rule is
-- written out rather than inherited:
--   * the BUYER on the order (orders.user_id) sees every item
--   * a SELLER sees only the items they sold (order_items.seller_id)
-- A seller therefore never learns what a buyer bought from a competitor in
-- the same basket, which a naive "join the order" would have leaked.
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.get_thread_page(uuid, timestamptz, integer);

create or replace function public.get_thread_page(
  p_peer   uuid,
  p_before timestamptz default null,
  p_limit  integer default 30
)
returns table (
  id                 uuid,
  sender_id          uuid,
  receiver_id        uuid,
  body               text,
  read               boolean,
  created_at         timestamptz,
  deleted_at         timestamptz,
  attachment_url     text,
  attachment_type    text,
  reply_to_id        uuid,
  reply_to_body      text,
  reply_to_sender_id uuid,
  product            jsonb,
  order_id           uuid,
  order_items        jsonb,
  reactions          jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (select auth.uid() as uid),
  page as (
    select m.*
      from public.messages m, me
     where me.uid is not null
       and ((m.sender_id = me.uid and m.receiver_id = p_peer and m.sender_deleted_at is null)
         or (m.sender_id = p_peer and m.receiver_id = me.uid and m.receiver_deleted_at is null))
       and (p_before is null or m.created_at < p_before)
     order by m.created_at desc
     limit least(greatest(coalesce(p_limit, 30), 1), 100)
  )
  select pg.id,
         pg.sender_id,
         pg.receiver_id,
         case when pg.deleted_at is not null then null else pg.body end,
         pg.read,
         pg.created_at,
         pg.deleted_at,
         case when pg.deleted_at is not null then null else pg.attachment_url end,
         pg.attachment_type,
         pg.reply_to_id,
         case when r.deleted_at is not null then null else r.body end,
         r.sender_id,
         case when pr.id is null then null else jsonb_build_object(
           'id', pr.id, 'name', pr.name, 'price', pr.price,
           'slug', pr.slug, 'image', pr.images[1]
         ) end,
         nullif(pg.metadata->>'order_id', '')::uuid,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', oip.id,
                    'name', oip.name,
                    'image', oip.images[1],
                    'quantity', oi.quantity,
                    'price', oi.price_at_purchase
                  ) order by oi.created_at)
             from public.order_items oi
             join public.orders o on o.id = oi.order_id
             join public.products oip on oip.id = oi.product_id
            where oi.order_id = nullif(pg.metadata->>'order_id', '')::uuid
              and oi.deleted_at is null
              and o.deleted_at is null
              -- Buyer on the order sees all items; a seller sees only theirs.
              and (o.user_id = (select uid from me) or oi.seller_id = (select uid from me))
         ), '[]'::jsonb),
         coalesce((
           select jsonb_agg(jsonb_build_object('emoji', mr.emoji, 'user_id', mr.user_id)
                            order by mr.created_at)
             from public.message_reactions mr
            where mr.message_id = pg.id
         ), '[]'::jsonb)
    from page pg
    left join public.messages r on r.id = pg.reply_to_id
    left join public.products pr on pr.id = pg.product_id
   order by pg.created_at desc;
$$;

revoke all on function public.get_thread_page(uuid, timestamptz, integer) from public, anon;
grant execute on function public.get_thread_page(uuid, timestamptz, integer) to authenticated;

-- The per-message item lookup is keyed on order_id.
create index if not exists idx_order_items_order
  on public.order_items (order_id);
