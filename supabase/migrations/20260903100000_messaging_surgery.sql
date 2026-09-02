-- ═══════════════════════════════════════════════════════════════════════════
-- MESSAGING SURGERY — server side
--
-- The app had a well-designed messaging RPC layer (get_my_conversations,
-- get_thread, send_direct_message, delete_my_message, delete_my_conversation)
-- that NOTHING called. Every inbox instead ran, from the component:
--
--     select *, sender(...), receiver(...), product(...), reply_to(...)
--       from messages
--      where sender_id = me or receiver_id = me
--
-- — the user's ENTIRE message history, on every open and on every realtime
-- event. This migration completes the RPC layer so the client can stop.
--
-- Four live defects are fixed here, not just performance:
--
--  1. READ RECEIPTS NEVER PERSISTED. markMessagesAsRead() issued
--     `update messages set read = true where receiver_id = me`, but the only
--     UPDATE policy on messages is `auth.uid() = sender_id`. RLS silently
--     filtered every row: 0 updated, no error. Unread badges could only ever
--     be cleared optimistically in local state, and came back on reload.
--     accountApi.markThreadRead() called mark_thread_read — which did not
--     exist. Created below.
--
--  2. REACTIONS WERE WORLD-READABLE. message_reactions_select was `using
--     (true)`: any authenticated user could read every reaction row in the
--     table, which leaks who reacted to which private message. Re-scoped to
--     the two participants of the underlying message.
--
--  3. REACTIONS COULD NOT BE REMOVED. The UI only ever called an insert that
--     swallowed 23505, so tapping your own reaction chip did nothing.
--     toggle_message_reaction() gives it the toggle semantics the UI implies.
--
--  4. "DELETE CHAT" DELETED FOR BOTH SIDES. BuyerMessages looped
--     softDeleteMessage() over its own messages, which sets `deleted_at` —
--     the GLOBAL tombstone, the same column delete-for-everyone uses. The
--     dialog promised "the other person keeps their copy"; they did not.
--     delete_my_conversation() (already present, per-side via
--     sender_deleted_at/receiver_deleted_at) is now what the UI calls.
--
-- Nothing is dropped. The original functions stay callable.
-- ═══════════════════════════════════════════════════════════════════════════


-- ---------------------------------------------------------------------------
-- 1. conversation_prefs — pin/archive, per user, per peer.
--
-- Both lived in localStorage under three different key schemes
-- (malimart_pinned_chats, malimart_archived_chats_<uid>,
-- malimart_archived_seller_chats_<uid>), so they did not survive a new device
-- or a cleared cache, and seller pins did not survive a reload at all
-- (SellerMessages/AdminMessages held pinnedUsers in useState only).
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_prefs (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  peer_id     uuid not null references public.profiles(id) on delete cascade,
  pinned_at   timestamptz,
  archived_at timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (user_id, peer_id)
);

comment on table public.conversation_prefs is
  'Per-user view preferences for a conversation (pin, archive). View state only — never affects message visibility or delivery. Per-side conversation deletion is messages.sender_deleted_at / receiver_deleted_at.';

alter table public.conversation_prefs enable row level security;

drop policy if exists conversation_prefs_select_own on public.conversation_prefs;
create policy conversation_prefs_select_own on public.conversation_prefs
  for select using ((select auth.uid()) = user_id);

drop policy if exists conversation_prefs_insert_own on public.conversation_prefs;
create policy conversation_prefs_insert_own on public.conversation_prefs
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists conversation_prefs_update_own on public.conversation_prefs;
create policy conversation_prefs_update_own on public.conversation_prefs
  for update using ((select auth.uid()) = user_id)
              with check ((select auth.uid()) = user_id);

drop policy if exists conversation_prefs_delete_own on public.conversation_prefs;
create policy conversation_prefs_delete_own on public.conversation_prefs
  for delete using ((select auth.uid()) = user_id);


-- ---------------------------------------------------------------------------
-- 2. message_reactions: close the world-readable SELECT.
--
-- `using (true)` let any authenticated user enumerate every reaction in the
-- table. Scope to the participants of the message being reacted to. The
-- hydrated thread read below is SECURITY DEFINER and so is unaffected.
-- ---------------------------------------------------------------------------
drop policy if exists message_reactions_select on public.message_reactions;
create policy message_reactions_select on public.message_reactions
  for select using (
    exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and (select auth.uid()) in (m.sender_id, m.receiver_id)
    )
  );

-- Supports both the new policy's lookup and the per-thread reaction rollup.
create index if not exists idx_message_reactions_message
  on public.message_reactions (message_id);


-- ---------------------------------------------------------------------------
-- 3. mark_thread_read — the RPC accountApi already called but that never
--    existed. Self-scoped: only marks what the PEER sent to the CALLER.
-- ---------------------------------------------------------------------------
create or replace function public.mark_thread_read(p_peer uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_n  integer;
begin
  if v_me is null then raise exception 'Not authenticated'; end if;

  update public.messages
     set read = true, updated_at = now()
   where receiver_id = v_me
     and sender_id = p_peer
     and read = false;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.mark_thread_read(uuid) from public, anon;
grant execute on function public.mark_thread_read(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 4. get_my_conversations_v2 — the sidebar in ONE round trip.
--
-- Same shape as get_my_conversations plus the pin/archive prefs, so the list
-- can be ordered and filtered server-side instead of the client grouping the
-- full history in a useMemo. get_my_conversations is left in place.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_conversations_v2()
returns table (
  peer_id             uuid,
  peer_name           text,
  peer_avatar         text,
  peer_role           text,
  peer_last_seen      timestamptz,
  last_message_id     uuid,
  last_body           text,
  last_sender_id      uuid,
  last_created_at     timestamptz,
  last_attachment_type text,
  last_deleted_at     timestamptz,
  unread_count        bigint,
  is_blocked          boolean,
  pinned_at           timestamptz,
  archived_at         timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (select auth.uid() as uid),
  my_msgs as (
    select m.*,
           case when m.sender_id = (select uid from me) then m.receiver_id else m.sender_id end as peer
      from public.messages m, me
     where ((m.sender_id = me.uid and m.sender_deleted_at is null)
         or (m.receiver_id = me.uid and m.receiver_deleted_at is null))
  ),
  latest as (
    select distinct on (peer)
           peer, id, body, sender_id, created_at, attachment_type, deleted_at
      from my_msgs
     order by peer, created_at desc
  ),
  unread as (
    select peer, count(*) as cnt
      from my_msgs, me
     where receiver_id = me.uid and read = false and deleted_at is null
     group by peer
  )
  select l.peer,
         p.full_name,
         p.avatar_url,
         p.role::text,
         p.last_seen_at,
         l.id,
         -- A tombstoned last message must not leak its body into the sidebar.
         case when l.deleted_at is not null then null else l.body end,
         l.sender_id,
         l.created_at,
         l.attachment_type,
         l.deleted_at,
         coalesce(u.cnt, 0),
         exists (select 1 from public.blocked_users b, me
                  where b.blocker_id = me.uid and b.blocked_id = l.peer),
         cp.pinned_at,
         cp.archived_at
    from latest l
    join public.profiles p on p.id = l.peer
    left join unread u on u.peer = l.peer
    left join public.conversation_prefs cp
           on cp.user_id = (select uid from me) and cp.peer_id = l.peer
   order by cp.pinned_at desc nulls last, l.created_at desc;
$$;

revoke all on function public.get_my_conversations_v2() from public, anon;
grant execute on function public.get_my_conversations_v2() to authenticated;


-- ---------------------------------------------------------------------------
-- 5. get_thread_page — ONE page of ONE conversation, fully hydrated.
--
-- Replaces: the whole-history select, the second query for every reaction in
-- the account, the `reply_to:messages!reply_to_id(*)` self-join, and the
-- client-side `chats.find(m => m.id === c.reply_to_id)` fallback.
--
-- Deliberately has NO read side-effect. get_thread() marked the thread read
-- as part of the query, which means paging backwards through history would
-- re-mark on every page. Marking read is mark_thread_read(), called when the
-- conversation is actually opened.
--
-- Returns newest-first so `p_before` paginates backwards; the client reverses
-- for display.
-- ---------------------------------------------------------------------------
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
         -- delete_my_message(for_everyone) already blanks the body; belt and
         -- braces so a tombstone can never ship text to the client.
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


-- ---------------------------------------------------------------------------
-- 6. send_message_v2 — send + notify in one round trip.
--
-- send_direct_message() had no order-context parameter, so the client wrote
-- metadata.order_id itself via a raw insert. It also left the recipient
-- notification to a second call that first tried to read the receiver's role
-- from profiles — a read RLS denies to non-admins, so the notification link
-- was always the generic /messages fallback. Both are resolved server-side.
-- ---------------------------------------------------------------------------
create or replace function public.send_message_v2(
  p_receiver        uuid,
  p_body            text,
  p_product         uuid default null,
  p_order           uuid default null,
  p_reply_to        uuid default null,
  p_attachment_url  text default null,
  p_attachment_type text default null
)
returns public.messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me       uuid := auth.uid();
  v_msg      public.messages;
  v_sender   text;
  v_role     text;
  v_link     text;
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  if p_receiver = v_me then raise exception 'Cannot message yourself'; end if;
  if coalesce(btrim(p_body), '') = '' and p_attachment_url is null then
    raise exception 'Message is empty';
  end if;
  if length(coalesce(p_body, '')) > 4000 then raise exception 'Message too long'; end if;

  -- Blocking cuts both directions: a blocked user cannot reach you, and you
  -- cannot reach someone you have blocked without unblocking first.
  if exists (select 1 from public.blocked_users
              where (blocker_id = p_receiver and blocked_id = v_me)
                 or (blocker_id = v_me and blocked_id = p_receiver)) then
    raise exception 'Messaging unavailable for this user';
  end if;

  -- A reply must point at a message in THIS conversation, or the quoted
  -- preview would render text from a thread the peer cannot see.
  if p_reply_to is not null and not exists (
       select 1 from public.messages m
        where m.id = p_reply_to
          and v_me in (m.sender_id, m.receiver_id)
          and p_receiver in (m.sender_id, m.receiver_id)
     ) then
    raise exception 'Reply target is not part of this conversation';
  end if;

  insert into public.messages (
    sender_id, receiver_id, body, product_id, reply_to_id,
    attachment_url, attachment_type, read, metadata
  ) values (
    v_me, p_receiver, btrim(coalesce(p_body, '')), p_product, p_reply_to,
    p_attachment_url, p_attachment_type, false,
    case when p_order is null then '{}'::jsonb
         else jsonb_build_object('order_id', p_order::text) end
  )
  returning * into v_msg;

  select full_name, role::text into v_sender, v_role
    from public.profiles where id = v_me;

  select case p.role::text
           when 'buyer'  then '/buyer?tab=inbox&sellerId=' || v_me::text
           when 'seller' then '/seller?tab=messages&chat=' || v_me::text
           when 'admin'  then '/admin?tab=messages&chat=' || v_me::text
           else '/messages/' || v_me::text
         end
    into v_link
    from public.profiles p where p.id = p_receiver;

  insert into public.notifications (user_id, type, title, message, read, link, created_at)
  values (
    p_receiver, 'message',
    'New message from ' || coalesce(v_sender, 'a MaliMart user'),
    left(case when v_msg.body = '' then 'Sent an attachment' else v_msg.body end, 140),
    false, coalesce(v_link, '/messages'), now()
  );

  return v_msg;
end;
$$;

revoke all on function public.send_message_v2(uuid, text, uuid, uuid, uuid, text, text) from public, anon;
grant execute on function public.send_message_v2(uuid, text, uuid, uuid, uuid, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 7. toggle_message_reaction — add if absent, remove if present.
--
-- The UI's reaction chips imply a toggle, but the client only ever inserted
-- and swallowed the 23505 unique violation, so a reaction could never be
-- taken back. Also enforces that you can only react to a message you are a
-- participant in — the table's INSERT policy checked only that user_id was
-- your own, so any message id would have been accepted.
-- ---------------------------------------------------------------------------
create or replace function public.toggle_message_reaction(p_message uuid, p_emoji text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me      uuid := auth.uid();
  v_deleted integer;
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  if coalesce(btrim(p_emoji), '') = '' or length(p_emoji) > 16 then
    raise exception 'Invalid reaction';
  end if;

  if not exists (
    select 1 from public.messages m
     where m.id = p_message
       and v_me in (m.sender_id, m.receiver_id)
       and m.deleted_at is null
  ) then
    raise exception 'Not your message';
  end if;

  delete from public.message_reactions
   where message_id = p_message and user_id = v_me and emoji = p_emoji;
  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    return false;  -- removed
  end if;

  insert into public.message_reactions (message_id, user_id, emoji)
  values (p_message, v_me, p_emoji)
  on conflict (message_id, user_id, emoji) do nothing;

  return true;      -- added
end;
$$;

revoke all on function public.toggle_message_reaction(uuid, text) from public, anon;
grant execute on function public.toggle_message_reaction(uuid, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 8. set_conversation_pref — pin/archive, server-side.
-- Passing null for a flag leaves it unchanged; false clears it.
-- ---------------------------------------------------------------------------
create or replace function public.set_conversation_pref(
  p_peer     uuid,
  p_pinned   boolean default null,
  p_archived boolean default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  if p_peer = v_me then raise exception 'Not a conversation'; end if;

  insert into public.conversation_prefs (user_id, peer_id, pinned_at, archived_at, updated_at)
  values (
    v_me, p_peer,
    case when p_pinned   then now() else null end,
    case when p_archived then now() else null end,
    now()
  )
  on conflict (user_id, peer_id) do update
    set pinned_at   = case when p_pinned   is null then conversation_prefs.pinned_at
                           when p_pinned   then coalesce(conversation_prefs.pinned_at, now())
                           else null end,
        archived_at = case when p_archived is null then conversation_prefs.archived_at
                           when p_archived then coalesce(conversation_prefs.archived_at, now())
                           else null end,
        updated_at  = now();
end;
$$;

revoke all on function public.set_conversation_pref(uuid, boolean, boolean) from public, anon;
grant execute on function public.set_conversation_pref(uuid, boolean, boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- 9. Index for the conversation rollup.
-- idx_messages_conversation is (sender_id, receiver_id, created_at desc),
-- which does not serve the "everything addressed to me, newest first" half of
-- the sidebar rollup. idx_messages_inbox is partial on read = false.
-- ---------------------------------------------------------------------------
create index if not exists idx_messages_receiver_created
  on public.messages (receiver_id, created_at desc);

create index if not exists idx_messages_sender_created
  on public.messages (sender_id, created_at desc);


-- ---------------------------------------------------------------------------
-- 10. get_messaging_peer — the public-safe profile of someone you can chat to.
--
-- messagesService.fetchProfile()/fetchProfileRole() did
-- `select * from profiles where id = <peer>` straight from the component.
-- profiles only has profiles_select_own and profiles_select_admin, so for a
-- non-admin that read returns NOTHING — silently, because .single() on an
-- empty set just yields null data. Consequences, all of them live:
--
--   * Tapping a chat partner's header opened an EMPTY UserProfileModal.
--   * The "cannot report/block an administrator" guard read role === null,
--     never 'admin', so it never actually guarded anything.
--   * A seller deep-linked to a buyer with no thread yet got the literal
--     placeholder "Buyer" as the conversation title, forever.
--
-- Same field discipline as search_messaging_contacts: identity only, never
-- wallet/contact/address fields.
-- ---------------------------------------------------------------------------
create or replace function public.get_messaging_peer(p_peer uuid)
returns table (
  id           uuid,
  full_name    text,
  avatar_url   text,
  role         text,
  region       text,
  last_seen_at timestamptz,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.full_name, p.avatar_url, p.role::text, p.region,
         p.last_seen_at, p.created_at
    from public.profiles p
   where auth.uid() is not null
     and p.id = p_peer
     and coalesce(p.is_banned, false) = false
     and p.deleted_at is null;
$$;

revoke all on function public.get_messaging_peer(uuid) from public, anon;
grant execute on function public.get_messaging_peer(uuid) to authenticated;
