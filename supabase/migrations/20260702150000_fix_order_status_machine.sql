-- Un-deadlock the order status flow.
--
-- Sellers could NOT mark orders as shipped: orders_status_check was a stale
-- CHECK constraint listing (pending, processing, shipped, delivered, cancelled,
-- refunded, disputed) — it predates the 'in_transit' status that the UI, the
-- update_order_status_rbac RPC and the enforce_order_status_transition trigger
-- all use. Writing 'in_transit' violated the CHECK; writing 'shipped' instead
-- was rejected by the trigger (which has no 'shipped' branch). Net result: no
-- order could ever leave 'processing'.
--
-- Fixes:
--  1. Drop the CHECK — status is already an order_status ENUM, and transitions
--     are governed by the trigger. A second stale value list only drifts.
--  2. Normalize legacy alias rows onto the canonical flow
--     (shipped → in_transit, confirmed → processing) so stuck orders move again.
--  3. Make update_order_status_rbac accept the aliases and normalize them, so
--     any caller still sending 'shipped'/'confirmed' lands on the canonical
--     status instead of a trigger exception.
--
-- Canonical flow: pending → processing → in_transit → delivered
-- Terminal: cancelled / refunded / disputed / failed

-- 1. The enum is the value boundary; the trigger is the transition boundary.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- 2. One-time normalization of legacy alias rows. The transition trigger is
--    paused: this is a rename, not a real status change, so no transition
--    rules apply. (No notification trigger exists on orders in production.)
ALTER TABLE public.orders DISABLE TRIGGER trg_enforce_order_status_transition;

UPDATE public.orders SET status = 'in_transit', updated_at = now() WHERE status = 'shipped';
UPDATE public.orders SET status = 'processing', updated_at = now() WHERE status = 'confirmed';

ALTER TABLE public.orders ENABLE TRIGGER trg_enforce_order_status_transition;

-- 3. Alias normalization in the status RPC.
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
    -- Legacy aliases → canonical statuses (UI configs still emit both).
    IF p_new_status = 'shipped'   THEN p_new_status := 'in_transit'; END IF;
    IF p_new_status = 'confirmed' THEN p_new_status := 'processing'; END IF;

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
        'pending','processing','in_transit',
        'delivered','cancelled','disputed','refunded','failed','ready_for_pickup'
    ) THEN
        RAISE EXCEPTION 'Invalid status: %', p_new_status;
    END IF;

    -- Cancellations carry stock/refund/audit side effects — one guarded path.
    IF p_new_status = 'cancelled' THEN
        PERFORM public._cancel_order_guarded(
            p_order_id,
            CASE WHEN v_is_admin THEN 'admin' WHEN v_is_seller THEN 'seller' ELSE 'buyer' END,
            p_cancel_reason
        );
        RETURN;
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
