-- 20260722110000_seller_delivery_details.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Lets a seller record how an order is actually being delivered before
-- marking it shipped: method (own driver / bus / boda boda / courier /
-- pickup), the real delivery cost if it differs from the checkout estimate,
-- and the driver's name/phone so the buyer can reach them. The buyer sees
-- this on their order and gets notified the moment it's set.
--
-- orders.driver_phone already existed (leftover from an earlier, never-
-- finished delivery-estimate feature — zero references anywhere in the app).
-- Reusing it rather than adding a duplicate column. actual_delivery_fee only
-- existed in a `backups` schema snapshot table, not the live public.orders —
-- added fresh here alongside the other new columns.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_method TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS actual_delivery_fee NUMERIC;

CREATE OR REPLACE FUNCTION public.set_order_delivery_details(
  p_order_id uuid,
  p_method text,
  p_cost numeric DEFAULT NULL,
  p_driver_name text DEFAULT NULL,
  p_driver_phone text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _buyer_id uuid;
  _order_status text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_method IS NULL OR btrim(p_method) = '' THEN
    RAISE EXCEPTION 'delivery method is required';
  END IF;

  SELECT user_id, status::text INTO _buyer_id, _order_status
  FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM order_items WHERE order_id = p_order_id AND seller_id = _uid
  ) THEN
    RAISE EXCEPTION 'access denied: not a seller on this order';
  END IF;

  IF _order_status IN ('delivered', 'cancelled', 'refunded', 'failed') THEN
    RAISE EXCEPTION 'cannot set delivery details on a % order', _order_status;
  END IF;

  UPDATE orders SET
    delivery_method     = btrim(p_method),
    actual_delivery_fee = p_cost,
    driver_name         = NULLIF(btrim(COALESCE(p_driver_name, '')), ''),
    driver_phone        = NULLIF(btrim(COALESCE(p_driver_phone, '')), ''),
    delivery_notes      = NULLIF(btrim(COALESCE(p_notes, '')), ''),
    updated_at          = now()
  WHERE id = p_order_id;

  INSERT INTO notifications (user_id, type, title, message, read, created_at)
  VALUES (
    _buyer_id, 'order', 'Delivery details added',
    'Order #' || left(p_order_id::text, 8) || ' is going out via ' || btrim(p_method) ||
    CASE WHEN p_driver_name IS NOT NULL AND btrim(p_driver_name) <> ''
         THEN ' with ' || btrim(p_driver_name) ELSE '' END ||
    '. Check your order for the full details.',
    false, now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_order_delivery_details(uuid, text, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_order_delivery_details(uuid, text, numeric, text, text, text) TO authenticated;
