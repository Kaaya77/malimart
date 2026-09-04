-- ═══════════════════════════════════════════════════════════════════════════
-- MESSAGE EDITING
--
-- The bubble menu already offers reply / react / delete / report, but a typo
-- has always forced a delete-and-resend, which loses the message's position
-- in the thread and its reply/reaction history. edit_message() gives the
-- SENDER a real in-place edit, gated the same way delete-for-everyone is
-- (Conversations.tsx's `withinRecall`): one hour from send, sender only.
--
-- get_thread_page is extended (not replaced by a second function — the
-- client reads one page shape) to carry `edited_at`, so the bubble can show
-- "(edited)" without a second round trip.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.messages
  add column if not exists edited_at timestamptz;

-- ---------------------------------------------------------------------------
-- 1. edit_message
-- ---------------------------------------------------------------------------
create or replace function public.edit_message(p_message uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me  uuid := auth.uid();
  v_msg public.messages;
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  if coalesce(btrim(p_body), '') = '' then raise exception 'Message is empty'; end if;
  if length(p_body) > 4000 then raise exception 'Message too long'; end if;

  select * into v_msg from public.messages where id = p_message for update;
  if v_msg.id is null then raise exception 'Message not found'; end if;
  if v_msg.sender_id <> v_me then raise exception 'You can only edit your own messages'; end if;
  if v_msg.deleted_at is not null then raise exception 'That message was deleted'; end if;
  -- A message the sender removed from their OWN side (sender_deleted_at) is
  -- still live for the receiver; editing it would silently rewrite text the
  -- sender can no longer even see, on a copy they believe they hid.
  if v_msg.sender_deleted_at is not null then raise exception 'That message was deleted'; end if;
  if now() - v_msg.created_at > interval '1 hour' then
    raise exception 'This message can no longer be edited';
  end if;

  update public.messages
     set body = btrim(p_body),
         edited_at = now()
   where id = p_message
  returning * into v_msg;

  return v_msg;
end;
$$;

revoke all on function public.edit_message(uuid, text) from public, anon;
grant execute on function public.edit_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 1b. Enforce the edit window at the table, not just in edit_message.
--
-- The existing UPDATE policy on messages is `auth.uid() = sender_id`, with
-- no column or time restriction (20260903100000_messaging_surgery.sql). That
-- makes edit_message's window and "edited" marker advisory, not a guarantee:
-- a sender could call supabase.from('messages').update({ body }) directly
-- and rewrite a message of any age with no edited_at stamp at all, since RLS
-- alone can't express "only through this RPC". A trigger can, and runs
-- regardless of which path reached the table.
--
-- Scoped narrowly to a plain edit: it only engages when body actually
-- changes AND deleted_at stays null before and after — delete_my_message
-- blanks body and sets deleted_at together in the same statement, which
-- this must not block.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_message_body_edit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.body is distinct from old.body and new.deleted_at is null and old.deleted_at is null then
    if old.sender_deleted_at is not null then
      raise exception 'That message was deleted';
    end if;
    if now() - old.created_at > interval '1 hour' then
      raise exception 'This message can no longer be edited';
    end if;
    new.edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists messages_enforce_body_edit on public.messages;
create trigger messages_enforce_body_edit
  before update on public.messages
  for each row execute function public.enforce_message_body_edit();

-- ---------------------------------------------------------------------------
-- 2. get_thread_page — add edited_at to the page shape.
-- ---------------------------------------------------------------------------
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
  edited_at          timestamptz,
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
         pg.edited_at,
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
