-- Ethical, consistent order-cancellation policy.
--
-- Problems fixed:
--  1. cancel_my_order claimed buyers could cancel pending/processing/confirmed, but the
--     enforce_order_status_transition trigger only allows buyers to cancel PENDING orders
--     — buyers cancelling a processing order got an opaque exception.
--  2. Stock restoration went to products.stock even for variant items, though
--     place_order_atomic decrements product_variants.stock for those — variant stock
--     was never restored and product stock inflated.
--  3. Seller cancellations (via update_order_status_rbac) restored NO stock at all,
--     wrote no inventory log, and required no reason.
--  4. Paid orders could be cancelled with no refund trail: payment_status stayed 'paid'.
--  5. No record of WHO cancelled or when.
--
-- Policy now enforced in one guarded function:
--  • buyer  → may cancel only while 'pending' (before the seller commits work);
--             later they must request cancellation from the seller via the order chat.
--  • seller → may cancel 'pending' / 'processing' / 'confirmed', reason REQUIRED
--             (recorded on the order and sent to the buyer).
--  • admin  → may cancel any non-terminal order, reason required.
--  • Stock is restored to the same place it was taken from (variant vs product),
--    with an inventory_logs entry either way.
--  • If the buyer had already paid (payment_status='paid', or a non-cash payment_ref),
--    payment_status flips to 'refund_due' so the refund is tracked, and both
--    notifications mention it.
--  • cancelled_by / cancelled_at are recorded.

-- ── Audit columns + refund states ────────────────────────────────────────────
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_by text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unpaid', 'processing', 'paid', 'failed', 'refund_due', 'refunded'));

-- ── Trigger: allow seller cancel from 'confirmed' too (UI already offers it) ─
CREATE OR REPLACE FUNCTION public.enforce_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_user_role TEXT;
    is_buyer BOOLEAN;
    is_seller BOOLEAN;
    is_admin BOOLEAN;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    IF current_setting('role', true) = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        RETURN NEW;
    END IF;

    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_caller_id;

    is_buyer := (v_caller_id = OLD.user_id);
    is_admin := (v_user_role = 'admin');

    SELECT EXISTS (
        SELECT 1 FROM public.order_items
        WHERE order_id = OLD.id AND seller_id = v_caller_id
    ) INTO is_seller;

    IF is_admin THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'cancelled' THEN
        IF is_buyer AND OLD.status = 'pending' THEN
            RETURN NEW;
        ELSIF is_seller AND OLD.status IN ('pending', 'processing', 'confirmed') THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Unauthorized or invalid state transition to cancelled';
        END IF;
    END IF;

    IF NEW.status = 'processing' THEN
        IF is_seller AND OLD.status = 'pending' THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Only seller can mark as processing from pending';
        END IF;
    END IF;

    IF NEW.status = 'in_transit' THEN
        IF is_seller AND OLD.status = 'processing' THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Only seller can mark as in_transit from processing';
        END IF;
    END IF;

    IF NEW.status = 'delivered' THEN
        IF is_seller AND OLD.status = 'in_transit' THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Only seller can mark as delivered from in_transit';
        END IF;
    END IF;

    IF NEW.status = 'refunded' THEN
        IF is_seller AND OLD.status IN ('pending', 'processing', 'in_transit', 'delivered', 'disputed') THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Only seller can refund';
        END IF;
    END IF;

    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
END;
$$;

-- ── The one guarded cancellation path ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._cancel_order_guarded(p_order uuid, p_role text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_order        orders%ROWTYPE;
  v_item         record;
  v_stock_before integer;
  v_refund_due   boolean;
  v_reason       text := NULLIF(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_role NOT IN ('buyer', 'seller', 'admin') THEN RAISE EXCEPTION 'invalid role'; END IF;

  -- Lock so concurrent cancels / status updates serialise.
  SELECT * INTO v_order FROM orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  -- Verify the caller actually IS the role they claim (defense in depth —
  -- wrappers check too, and EXECUTE is revoked from clients).
  IF p_role = 'buyer' AND v_order.user_id <> v_uid THEN
    RAISE EXCEPTION 'Access denied';
  ELSIF p_role = 'seller' AND NOT EXISTS (
    SELECT 1 FROM order_items WHERE order_id = p_order AND seller_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Access denied';
  ELSIF p_role = 'admin' AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = v_uid AND role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_order.status::text IN ('cancelled', 'refunded', 'failed') THEN
    RAISE EXCEPTION 'Order is already %', v_order.status;
  END IF;

  -- Policy gates
  IF p_role = 'buyer' THEN
    IF v_order.status::text <> 'pending' THEN
      RAISE EXCEPTION 'The seller is already preparing this order. Please request cancellation from the seller via the order chat.';
    END IF;
  ELSIF p_role = 'seller' THEN
    IF v_order.status::text NOT IN ('pending', 'processing', 'confirmed') THEN
      RAISE EXCEPTION 'Shipped orders cannot be cancelled — use the returns flow instead.';
    END IF;
    IF v_reason IS NULL THEN
      RAISE EXCEPTION 'A cancellation reason is required so the buyer knows why.';
    END IF;
  ELSE -- admin
    IF v_order.status::text = 'delivered' THEN
      RAISE EXCEPTION 'Delivered orders cannot be cancelled — use the returns/refund flow.';
    END IF;
    IF v_reason IS NULL THEN
      RAISE EXCEPTION 'A cancellation reason is required.';
    END IF;
  END IF;

  -- Was the buyer's money already in play? 'processing' counts: an in-flight
  -- charge may settle after cancellation and must not fall off the refund trail.
  v_refund_due := (v_order.payment_status IN ('paid', 'processing'))
    OR (COALESCE(btrim(v_order.payment_ref), '') <> '' AND COALESCE(v_order.payment_method, '') <> 'cash');

  UPDATE orders SET
    status         = 'cancelled',
    cancel_reason  = COALESCE(v_reason, cancel_reason),
    cancelled_by   = p_role,
    cancelled_at   = now(),
    payment_status = CASE WHEN v_refund_due THEN 'refund_due' ELSE payment_status END,
    updated_at     = now()
  WHERE id = p_order;

  -- Restore stock to where place_order_atomic took it from.
  FOR v_item IN
    SELECT oi.id AS item_id, oi.product_id, oi.variant_id, oi.quantity
    FROM order_items oi WHERE oi.order_id = p_order
  LOOP
    IF v_item.variant_id IS NOT NULL THEN
      SELECT stock INTO v_stock_before FROM product_variants WHERE id = v_item.variant_id;
      UPDATE product_variants SET stock = stock + v_item.quantity WHERE id = v_item.variant_id;
      INSERT INTO inventory_logs (product_id, variant_id, order_id, order_item_id, performed_by, reason, delta, stock_before, stock_after, notes)
      VALUES (v_item.product_id, v_item.variant_id, p_order, v_item.item_id, v_uid, 'return', v_item.quantity,
              coalesce(v_stock_before, 0), coalesce(v_stock_before, 0) + v_item.quantity,
              'Variant stock restored — order cancelled by ' || p_role || ': ' || coalesce(v_reason, 'no reason given'));
    ELSE
      SELECT stock INTO v_stock_before FROM products WHERE id = v_item.product_id;
      UPDATE products SET stock = stock + v_item.quantity, updated_at = now() WHERE id = v_item.product_id;
      INSERT INTO inventory_logs (product_id, order_id, order_item_id, performed_by, reason, delta, stock_before, stock_after, notes)
      VALUES (v_item.product_id, p_order, v_item.item_id, v_uid, 'return', v_item.quantity,
              coalesce(v_stock_before, 0), coalesce(v_stock_before, 0) + v_item.quantity,
              'Order cancelled by ' || p_role || ': ' || coalesce(v_reason, 'no reason given'));
    END IF;
  END LOOP;

  -- Tell the other side, including the refund situation.
  IF p_role = 'buyer' THEN
    INSERT INTO notifications (user_id, type, title, message, read, created_at)
    SELECT DISTINCT oi.seller_id, 'order', 'Order Cancelled by Buyer',
      'Order #' || left(p_order::text, 8) || ' was cancelled by the buyer' ||
      CASE WHEN v_reason IS NOT NULL THEN '. Reason: ' || v_reason ELSE '.' END ||
      CASE WHEN v_refund_due THEN ' A refund is due to the buyer.' ELSE '' END,
      false, now()
    FROM order_items oi
    WHERE oi.order_id = p_order AND oi.seller_id IS NOT NULL;
  ELSE
    INSERT INTO notifications (user_id, type, title, message, read, created_at)
    VALUES (v_order.user_id, 'order', 'Order Cancelled',
      'Your order #' || left(p_order::text, 8) || ' was cancelled by the ' || p_role ||
      '. Reason: ' || coalesce(v_reason, 'not given') ||
      CASE WHEN v_refund_due THEN ' Your payment will be refunded.' ELSE '' END,
      false, now());
  END IF;

  RETURN jsonb_build_object('ok', true, 'order_id', p_order, 'status', 'cancelled', 'refund_due', v_refund_due);
END;
$$;

-- Internal only: wrappers below call it; clients must not pick their own role.
REVOKE ALL ON FUNCTION public._cancel_order_guarded(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- ── Buyer wrapper ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_my_order(p_order uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_order AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;
  RETURN public._cancel_order_guarded(p_order, 'buyer', p_reason);
END;
$$;

REVOKE ALL   ON FUNCTION public.cancel_my_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_order(uuid, text) TO authenticated;

-- ── Route seller/admin cancellations through the same guarded path ───────────
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
