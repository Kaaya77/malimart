-- 20260723160000_fix_orders_direct_update_rls.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Security bug: orders_update_consolidated allowed a buyer (or the order's
-- seller) to UPDATE their own order row directly via the client SDK with no
-- restriction on which columns changed — only row ownership was checked.
-- Nothing in the app legitimately needs this: order status changes go
-- through update_order_status_rbac(), cancellation through its own RPC,
-- disputes through admin_resolve_dispute() — all SECURITY DEFINER, which
-- bypass RLS on their own internal UPDATE regardless of this policy.
--
-- The hole this opened: reviews require an order with status = 'delivered'
-- (reviews_insert policy). A buyer could place any order, then directly
-- run `supabase.from('orders').update({status:'delivered'})` from devtools
-- to self-mark it delivered — instantly unlocking review rights without
-- an actual purchase fulfillment, and more broadly letting a buyer rewrite
-- their own order's total/payment_status/wallet_amount/etc.
--
-- Fix: drop buyer/seller self-update entirely. Admin keeps full access for
-- support/moderation tooling; every other mutation path already goes
-- through a purpose-built RPC.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "orders_update_consolidated" ON public.orders;
CREATE POLICY "orders_update_consolidated" ON public.orders
  FOR UPDATE
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));
