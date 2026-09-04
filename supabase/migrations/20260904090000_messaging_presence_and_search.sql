-- ═══════════════════════════════════════════════════════════════════════════
-- MESSAGING — live presence + in-thread search
--
-- 1. touch_presence() — profiles.last_seen_at was only ever written once, at
--    login (AppContext's hydrateSession). A user active for hours still read
--    as offline two minutes after signing in, because nothing refreshed the
--    column. isOnline()'s 2-minute window was correct; the input feeding it
--    was not. The client now calls this RPC on a heartbeat (visibility-aware)
--    so "online" reflects the session, not the login instant.
--
--    SECURITY DEFINER, but narrower than the table's own UPDATE policy: it
--    writes exactly one column, on exactly the caller's own row, and takes no
--    argument that could target anyone else.
--
-- 2. search_thread_messages() — the conversation list could already be
--    filtered by name/last-message preview, but nothing could search the
--    body of a long thread's history for one line said three weeks ago. This
--    RPC searches the two-party conversation's message bodies server-side
--    (nothing crosses the RLS boundary get_thread_page already enforces) and
--    returns just enough to render a result row and jump to it.
-- ═══════════════════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------------------
-- 1. touch_presence
-- ---------------------------------------------------------------------------
create or replace function public.touch_presence()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid();
$$;

revoke all on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. search_thread_messages
--
-- Same two-party scoping as get_thread_page: a message counts only if it is
-- between me and p_peer, and only on the side that has not hidden it. Belt
-- and braces on tombstones, matching get_thread_page: delete_my_message
-- already blanks a tombstoned message's body, and deleted_at is checked
-- explicitly here too, so a recalled message can never surface in a result.
--
-- No new index: the pair-scoped OR this shares with get_thread_page is
-- already served by idx_messages_conversation / idx_messages_sender_created /
-- idx_messages_receiver_created (20260903100000_messaging_surgery.sql). The
-- body match itself is an unindexable leading-wildcard ILIKE, bounded by that
-- pair scope; if in-thread search gets hot, revisit with pg_trgm.
-- ---------------------------------------------------------------------------
create or replace function public.search_thread_messages(
  p_peer  uuid,
  p_query text,
  p_limit integer default 25
)
returns table (
  id         uuid,
  sender_id  uuid,
  body       text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (select auth.uid() as uid)
  select m.id, m.sender_id, m.body, m.created_at
    from public.messages m, me
   where me.uid is not null
     and trim(coalesce(p_query, '')) <> ''
     and m.deleted_at is null
     and m.body is not null
     -- Escape the user's own % and _ so they search as literals, not
     -- wildcards — a search for "100_000" should not match "100X000".
     and m.body ilike '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
     and ((m.sender_id = me.uid and m.receiver_id = p_peer and m.sender_deleted_at is null)
       or (m.sender_id = p_peer and m.receiver_id = me.uid and m.receiver_deleted_at is null))
   order by m.created_at desc
   limit least(greatest(coalesce(p_limit, 25), 1), 50);
$$;

revoke all on function public.search_thread_messages(uuid, text, integer) from public, anon;
grant execute on function public.search_thread_messages(uuid, text, integer) to authenticated;
