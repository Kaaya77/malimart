-- Fix: notifications_insert policy allowed any authenticated user to insert a
-- notification with an arbitrary user_id, title, message, and link — a
-- cross-user write usable to spoof "order shipped" / "refund credited"
-- notifications to any other user (phishing vector).
--
-- Every legitimate cross-user notification already runs through a
-- SECURITY DEFINER function (see product_appeals, disputes_fraud_vacation,
-- wallet_referrals_autoapply_returns, admin_ops_rpcs, checkout_payment_channels
-- migrations), which bypasses RLS entirely. The only client-side inserts were:
--   1. AppContext.tsx toast-notification insert — always user_id = auth.uid().
--   2. AppContext.tsx sendMessage — inserted a notification for the *other*
--      user directly from the client. Replaced below with notify_message_recipient(),
--      which validates a matching message was actually just sent before inserting.
--   3. AppContext.tsx updateOrderStatus — dead code duplicating a notification
--      that update_order_status_rbac() already inserts server-side; removed
--      from the client in this same change (no DB change needed for that).

drop policy if exists "notifications_insert" on public.notifications;

create policy "notifications_insert" on public.notifications
  for insert
  with check (
    (select is_admin())
    or user_id = (select auth.uid())
  );

create or replace function public.notify_message_recipient(
  p_receiver_id uuid,
  p_title text,
  p_message text,
  p_link text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_caller uuid := auth.uid();
  v_has_message boolean;
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  select exists(
    select 1 from public.messages
    where sender_id = v_caller
      and receiver_id = p_receiver_id
      and created_at > now() - interval '30 seconds'
  ) into v_has_message;

  if not v_has_message then
    raise exception 'No matching recent message from caller to recipient';
  end if;

  insert into public.notifications (user_id, type, title, message, read, link, created_at)
  values (p_receiver_id, 'message', p_title, p_message, false, p_link, now());
end;
$$;

revoke all on function public.notify_message_recipient(uuid, text, text, text) from public;
grant execute on function public.notify_message_recipient(uuid, text, text, text) to authenticated;
