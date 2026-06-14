-- 20260614000002_cancel_order_rpcs.sql
-- Adds the two RPCs that OrderActions.tsx calls via accountApi.ts.
-- The migration comment in 20260613_ux_overhaul.sql listed these as
-- "applied", but only the ALTER TABLE / index statements were included;
-- the function bodies were never committed. This file adds them properly.
-- All idempotent: CREATE OR REPLACE / IF NOT EXISTS.

-- ─── cancel_my_order ────────────────────────────────────────────────────────
-- Validates caller owns the order, checks it is in a cancellable state,
-- flips status → cancelled, restores product stock, writes inventory_logs
-- entries, and notifies every unique seller in the order.
CREATE OR REPLACE FUNCTION public.cancel_my_order(p_order uuid, p_reason text)
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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Lock the row so concurrent cancel attempts are serialised
  SELECT * INTO v_order
  FROM   orders
  WHERE  id = p_order AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;

  IF v_order.status NOT IN ('pending', 'processing', 'confirmed') THEN
    RAISE EXCEPTION 'Cannot cancel an order with status: %', v_order.status;
  END IF;

  -- Update order
  UPDATE orders
  SET    status        = 'cancelled',
         cancel_reason = p_reason,
         updated_at    = now()
  WHERE  id = p_order;

  -- Restore stock for every item and record it in inventory_logs
  FOR v_item IN
    SELECT oi.product_id, oi.quantity, oi.id AS item_id
    FROM   order_items oi
    WHERE  oi.order_id = p_order
  LOOP
    SELECT stock INTO v_stock_before
    FROM   products
    WHERE  id = v_item.product_id;

    UPDATE products
    SET    stock      = stock + v_item.quantity,
           updated_at = now()
    WHERE  id = v_item.product_id;

    INSERT INTO inventory_logs (
      product_id, order_id, order_item_id, performed_by,
      reason, delta, stock_before, stock_after, notes
    ) VALUES (
      v_item.product_id, p_order, v_item.item_id, v_uid,
      'return',
      v_item.quantity,
      coalesce(v_stock_before, 0),
      coalesce(v_stock_before, 0) + v_item.quantity,
      'Order cancelled: ' || coalesce(nullif(trim(p_reason), ''), 'No reason provided')
    );
  END LOOP;

  -- Notify each unique seller involved in this order
  INSERT INTO notifications (user_id, type, title, message, read, created_at)
  SELECT DISTINCT
    oi.seller_id,
    'order',
    'Order Cancelled',
    'Order #' || left(p_order::text, 8) || ' was cancelled by the buyer.' ||
      CASE
        WHEN p_reason IS NOT NULL AND trim(p_reason) <> ''
        THEN ' Reason: ' || trim(p_reason)
        ELSE ''
      END,
    false,
    now()
  FROM  order_items oi
  WHERE oi.order_id = p_order
    AND oi.seller_id IS NOT NULL;

  RETURN jsonb_build_object(
    'ok',       true,
    'order_id', p_order,
    'status',   'cancelled'
  );
END;
$$;

REVOKE ALL   ON FUNCTION public.cancel_my_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_order(uuid, text) TO authenticated;


-- ─── hide_my_order ──────────────────────────────────────────────────────────
-- Soft-deletes a terminal order from the buyer's history view.
-- Admin and seller views are unaffected (they query without deleted_at filter).
CREATE OR REPLACE FUNCTION public.hide_my_order(p_order uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE orders
  SET    deleted_at = now()
  WHERE  id         = p_order
    AND  user_id    = v_uid
    AND  status     IN ('delivered', 'cancelled', 'failed', 'refunded')
    AND  deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found, access denied, or not in a terminal state';
  END IF;
END;
$$;

REVOKE ALL   ON FUNCTION public.hide_my_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hide_my_order(uuid) TO authenticated;
