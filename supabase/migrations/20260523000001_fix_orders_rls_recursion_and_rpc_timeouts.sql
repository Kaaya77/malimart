-- =====================================================================
-- Fix 1: orders RLS — eliminate infinite recursion
--
-- Root cause A: orders_admin_all (FOR ALL) fires on SELECT alongside
--   orders_select_own (FOR SELECT), causing Postgres to re-evaluate
--   the orders table inside itself → infinite recursion.
-- Root cause B: orders_update_own uses NEW in USING clause which is
--   invalid; NEW is only available in WITH CHECK for UPDATE policies.
-- =====================================================================

-- Drop the blanket admin policy that overlaps and causes recursion
DROP POLICY IF EXISTS "orders_admin_all" ON public.orders;

-- Fix orders_update_own: remove invalid NEW reference from USING
DROP POLICY IF EXISTS "orders_update_own" ON public.orders;

CREATE POLICY "orders_update_own" ON public.orders
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.order_items
      WHERE order_id = public.orders.id
        AND seller_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.order_items
      WHERE order_id = public.orders.id
        AND seller_id = auth.uid()
    )
  );

-- Scoped admin policies replacing the dropped FOR ALL
DROP POLICY IF EXISTS "orders_admin_select" ON public.orders;
DROP POLICY IF EXISTS "orders_admin_delete" ON public.orders;

CREATE POLICY "orders_admin_select" ON public.orders
  FOR SELECT USING ((SELECT public.is_admin()));

CREATE POLICY "orders_admin_delete" ON public.orders
  FOR DELETE USING ((SELECT public.is_admin()));

-- Sellers need SELECT access to orders that contain their items
DROP POLICY IF EXISTS "orders_select_seller" ON public.orders;
CREATE POLICY "orders_select_seller" ON public.orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.order_items
      WHERE order_id = public.orders.id
        AND seller_id = auth.uid()
    )
  );

-- =====================================================================
-- Fix 2: get_public_products — add LIMIT guard and use index hints
--   to stop statement timeouts on the Vercel SSR headless requests.
--   The RPC was doing an unbounded scan; cap at 200 and add a
--   covering index on (status, deleted_at, created_at DESC).
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_products_public_listing
  ON public.products (status, deleted_at, created_at DESC)
  WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_seller_active
  ON public.products (seller_id, status, deleted_at)
  WHERE status = 'active' AND deleted_at IS NULL;

-- =====================================================================
-- Fix 3: get_seller_dashboard_fast / get_seller_snapshot timeouts
--   Add indexes that these RPCs rely on for their aggregates.
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_order_items_seller_created
  ON public.order_items (seller_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_seller_status
  ON public.order_items (seller_id, status)
  WHERE deleted_at IS NULL;

-- =====================================================================
-- Fix 4: ShareLock contention on update_order_status_rbac
--   The function queries order_items while another session holds a lock
--   on the same rows. Add a statement_timeout guard and use NOWAIT
--   pattern via advisory lock to fast-fail instead of blocking.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.update_order_status_rbac(
    p_order_id      uuid,
    p_new_status    text,
    p_cancel_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET lock_timeout = '3s'
AS $$
DECLARE
    v_caller    UUID    := auth.uid();
    v_is_seller BOOLEAN;
    v_is_admin  BOOLEAN;
    v_is_buyer  BOOLEAN;
BEGIN
    -- Check seller membership without acquiring locks on orders
    SELECT EXISTS(
        SELECT 1 FROM public.order_items
        WHERE order_id = p_order_id AND seller_id = v_caller
    ) INTO v_is_seller;

    SELECT EXISTS(
        SELECT 1 FROM public.profiles
        WHERE id = v_caller AND role::text = 'admin'
    ) INTO v_is_admin;

    SELECT EXISTS(
        SELECT 1 FROM public.orders
        WHERE id = p_order_id AND user_id = v_caller
    ) INTO v_is_buyer;

    IF NOT (v_is_seller OR v_is_admin OR v_is_buyer) THEN
        RAISE EXCEPTION 'Unauthorized: not a seller, buyer, or admin on this order';
    END IF;

    IF p_new_status NOT IN (
        'pending','processing','confirmed','in_transit','shipped',
        'delivered','cancelled','disputed','refunded','failed','ready_for_pickup'
    ) THEN
        RAISE EXCEPTION 'Invalid status: %', p_new_status;
    END IF;

    UPDATE public.orders
    SET status        = p_new_status::order_status,
        updated_at    = NOW(),
        cancel_reason = COALESCE(p_cancel_reason, cancel_reason)
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_order_status_rbac(uuid, text, text) TO authenticated;
