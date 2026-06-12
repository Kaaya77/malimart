-- 20260613_ux_overhaul.sql
-- Status: ALREADY APPLIED to Supabase project ubpapxdmqlepynonhaeo on 2026-06-13
--         as migration "ux_overhaul_messaging_orders_settings".
-- This file is the repo record. Do NOT re-run via the SQL editor unless you
-- intend to redeploy (everything is idempotent: IF NOT EXISTS / CREATE OR REPLACE).
--
-- Contents applied:
--   1. messages: + sender_deleted_at, receiver_deleted_at, idx_messages_thread
--   2. get_my_conversations()           -- inbox in one query
--   3. get_thread(peer, before, limit)  -- paged thread + auto mark-read
--   4. send_direct_message(...)         -- validates blocks, length, self-send
--   5. delete_my_message(id, for_everyone) -- WhatsApp semantics, 1h window
--   6. delete_my_conversation(peer)
--   7. mark_all_notifications_read(), delete_my_notifications(ids[]),
--      clear_read_notifications()
--   8. cancel_my_order(id, reason)      -- state guard, stock restore,
--                                          inventory_logs, notification
--   9. hide_my_order(id)                -- soft-hide terminal orders
--  10. update_my_settings(jsonb)        -- strict column whitelist
--  11. revoke_my_session(id), revoke_my_other_sessions(keep)
--  12. get_account_overview()           -- navbar/dashboard counts, 1 trip
--  All functions: SECURITY DEFINER, search_path=public, REVOKE from
--  public/anon, GRANT EXECUTE to authenticated only.
--
-- To regenerate the full SQL into this file, run in the Supabase SQL editor:
--   select pg_get_functiondef(p.oid) || ';'
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname in (
--     'get_my_conversations','get_thread','send_direct_message',
--     'delete_my_message','delete_my_conversation',
--     'mark_all_notifications_read','delete_my_notifications',
--     'clear_read_notifications','cancel_my_order','hide_my_order',
--     'update_my_settings','revoke_my_session','revoke_my_other_sessions',
--     'get_account_overview');

alter table public.messages
  add column if not exists sender_deleted_at timestamptz,
  add column if not exists receiver_deleted_at timestamptz;

create index if not exists idx_messages_thread
  on public.messages (sender_id, receiver_id, created_at desc);
