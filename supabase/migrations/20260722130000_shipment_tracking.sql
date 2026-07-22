-- 20260722130000_shipment_tracking.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- fetchOrderShipment() (services/orderApi.ts) has always read from
-- public.shipments / public.shipment_events for the buyer's tracking-number
-- card, but nothing ever wrote to those tables — the tracking card and the
-- shipment timeline it powers were permanently empty. This migration:
--   1. Creates the two tables (IF NOT EXISTS — in case they exist untracked
--      in a live environment) with RLS so buyers can read their own order's
--      shipment and sellers can read/write shipments on orders they sold into.
--   2. Extends set_order_delivery_details to optionally accept a carrier +
--      tracking number and upsert them into shipments, logging a
--      shipment_events row so the buyer's "Live Updates" timeline populates.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  carrier text,
  tracking_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);

CREATE TABLE IF NOT EXISTS public.shipment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  status text NOT NULL,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buyer reads own order shipment" ON public.shipments;
CREATE POLICY "buyer reads own order shipment" ON public.shipments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = shipments.order_id AND o.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "seller reads own shipments" ON public.shipments;
CREATE POLICY "seller reads own shipments" ON public.shipments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = shipments.order_id AND oi.seller_id = auth.uid())
  );

DROP POLICY IF EXISTS "buyer reads own shipment events" ON public.shipment_events;
CREATE POLICY "buyer reads own shipment events" ON public.shipment_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shipments s JOIN public.orders o ON o.id = s.order_id
      WHERE s.id = shipment_events.shipment_id AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "seller reads own shipment events" ON public.shipment_events;
CREATE POLICY "seller reads own shipment events" ON public.shipment_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shipments s JOIN public.order_items oi ON oi.order_id = s.order_id
      WHERE s.id = shipment_events.shipment_id AND oi.seller_id = auth.uid()
    )
  );

-- No direct INSERT/UPDATE policies — all writes go through the SECURITY
-- DEFINER RPC below, same pattern as the rest of the order-status machine.

CREATE OR REPLACE FUNCTION public.set_order_delivery_details(
  p_order_id uuid,
  p_method text,
  p_cost numeric DEFAULT NULL,
  p_driver_name text DEFAULT NULL,
  p_driver_phone text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_carrier text DEFAULT NULL,
  p_tracking_number text DEFAULT NULL
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
  _shipment_id uuid;
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

  IF (p_carrier IS NOT NULL AND btrim(p_carrier) <> '') OR (p_tracking_number IS NOT NULL AND btrim(p_tracking_number) <> '') THEN
    INSERT INTO shipments (order_id, carrier, tracking_number)
    VALUES (p_order_id, NULLIF(btrim(COALESCE(p_carrier, '')), ''), NULLIF(btrim(COALESCE(p_tracking_number, '')), ''))
    ON CONFLICT (order_id) DO UPDATE SET
      carrier         = EXCLUDED.carrier,
      tracking_number = EXCLUDED.tracking_number,
      updated_at      = now()
    RETURNING id INTO _shipment_id;

    INSERT INTO shipment_events (shipment_id, status, notes)
    VALUES (_shipment_id, 'shipped', btrim(p_method) ||
      CASE WHEN p_carrier IS NOT NULL AND btrim(p_carrier) <> '' THEN ' via ' || btrim(p_carrier) ELSE '' END);
  END IF;

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

REVOKE ALL ON FUNCTION public.set_order_delivery_details(uuid, text, numeric, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_order_delivery_details(uuid, text, numeric, text, text, text, text, text) TO authenticated;

-- Drop the old 6-arg overload now that callers pass the 8-arg signature —
-- PostgREST would otherwise see two candidates and error on ambiguous calls.
DROP FUNCTION IF EXISTS public.set_order_delivery_details(uuid, text, numeric, text, text, text);
