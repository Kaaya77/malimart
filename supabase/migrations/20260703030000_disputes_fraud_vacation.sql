-- 20260703030000_disputes_fraud_vacation.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Business-logic batch:
--   1. Fraud-cancellation → dispute pipeline: a seller cancellation whose
--      reason mentions fraud atomically creates a dispute row and notifies
--      admins, all inside the existing _cancel_order_guarded transaction.
--   2. Seller dispute visibility: get_seller_disputes() +
--      seller_respond_to_dispute() + update_dispute_status().
--      NOTE: SellerReturns.tsx / BuyerReturns.tsx already CALLED
--      get_seller_disputes / update_dispute_status — those RPCs never
--      existed in any migration (phantom RPCs). This creates them.
--   3. Vacation-mode checkout enforcement: place_order_atomic rejects items
--      whose seller has vendor_profiles.vacation_mode = true.
--
-- (Appeal reinstatement — task 3 of the batch — was verified already correct
--  in 20260702160000: resolve_product_appeal flips 'suspended'→'active' on
--  approval, the suspension trigger allows it because the caller is an admin,
--  and the seller is notified on both approve and reject. No change needed.)
--
-- All statements idempotent. Never DROPs columns/tables.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0. disputes table guard (reproducible from a clean `supabase db reset`) ──
-- The full disputes table lives in the standalone schema bootstrap
-- (supabase_missing_tables.sql). On a fresh migrations-only reset it may not
-- exist yet, and the ALTERs below would hard-error. Create a faithful minimal
-- version IF NOT EXISTS (a no-op on the live DB where the full table exists).
CREATE TABLE IF NOT EXISTS public.disputes (
  id            uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id      uuid NOT NULL,
  order_item_id uuid,
  buyer_id      uuid NOT NULL,
  seller_id     uuid NOT NULL,
  assigned_to   uuid,
  reason        text NOT NULL,
  status        text NOT NULL DEFAULT 'open',
  description   text NOT NULL,
  evidence_urls text[] NOT NULL DEFAULT '{}'::text[],
  resolution_notes text,
  refund_amount numeric DEFAULT 0 CHECK (refund_amount >= 0::numeric),
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
-- Reads for either party; all writes go through the SECURITY DEFINER RPCs below.
DROP POLICY IF EXISTS disputes_select_own ON public.disputes;
CREATE POLICY disputes_select_own ON public.disputes
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.is_admin());

-- ─── 1. disputes: seller-response columns + widened status check ─────────────
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS seller_response TEXT;
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS seller_responded_at TIMESTAMPTZ;
-- resolved_at exists in the newer schema variant only — ensure it.
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- The UI (Seller/BuyerReturns) uses 'refunded' as a dispute status, but the
-- original CHECK only allowed open/resolved/closed. Widen (strict superset —
-- no existing row can violate it).
ALTER TABLE public.disputes DROP CONSTRAINT IF EXISTS disputes_status_check;
ALTER TABLE public.disputes ADD CONSTRAINT disputes_status_check
  CHECK (status IN ('open', 'under_review', 'resolved', 'refunded', 'closed'));

-- ─── 2. Internal helper: does the caller sell on this dispute's order? ───────
-- Ownership resolved via order_items.seller_id (orders has NO seller_id
-- column), with disputes.seller_id as a fast-path.
CREATE OR REPLACE FUNCTION public._is_dispute_seller(p_dispute_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM disputes d
    WHERE d.id = p_dispute_id
      AND (
        d.seller_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM order_items oi
          WHERE oi.order_id = d.order_id AND oi.seller_id = auth.uid()
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public._is_dispute_seller(UUID) FROM PUBLIC, anon, authenticated;

-- ─── 3. get_seller_disputes ──────────────────────────────────────────────────
-- Shape matches the Dispute interface in components/SellerReturns.tsx
-- (nested buyer profile + order summary). p_seller_id is accepted for
-- signature compatibility with the existing client call, but ownership is
-- ALWAYS auth.uid() — a caller cannot read another seller's disputes.
CREATE OR REPLACE FUNCTION public.get_seller_disputes(p_seller_id UUID DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _out jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_seller_id IS NOT NULL AND p_seller_id <> _uid THEN
    RAISE EXCEPTION 'access denied: you can only read your own disputes';
  END IF;

  SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'created_at') DESC), '[]'::jsonb) INTO _out
  FROM (
    SELECT jsonb_build_object(
      'id',                  d.id,
      'order_id',            d.order_id,
      'buyer_id',            d.buyer_id,
      'seller_id',           d.seller_id,
      'reason',              d.reason,
      'description',         d.description,
      'status',              d.status,
      'seller_response',     d.seller_response,
      'seller_responded_at', d.seller_responded_at,
      'resolution_notes',    d.resolution_notes,
      'created_at',          d.created_at,
      'updated_at',          d.updated_at,
      'buyer', (
        SELECT jsonb_build_object(
          'full_name',  pr.full_name,
          'avatar_url', pr.avatar_url,
          'email',      pr.email,
          'phone',      pr.phone
        ) FROM profiles pr WHERE pr.id = d.buyer_id
      ),
      'order', (
        SELECT jsonb_build_object('id', o.id, 'total', o.total, 'status', o.status)
        FROM orders o WHERE o.id = d.order_id
      )
    ) AS row
    FROM disputes d
    WHERE d.seller_id = _uid
       OR EXISTS (
         SELECT 1 FROM order_items oi
         WHERE oi.order_id = d.order_id AND oi.seller_id = _uid
       )
    LIMIT 200
  ) sub;

  RETURN _out;
END;
$$;

REVOKE ALL ON FUNCTION public.get_seller_disputes(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_seller_disputes(UUID) TO authenticated;

-- ─── 4. seller_respond_to_dispute ────────────────────────────────────────────
-- One response per dispute. Stored on the row; buyer and admins are notified.
CREATE OR REPLACE FUNCTION public.seller_respond_to_dispute(
  p_dispute_id UUID,
  p_response   TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid      UUID := auth.uid();
  _dispute  RECORD;
  _response TEXT := NULLIF(btrim(COALESCE(p_response, '')), '');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _response IS NULL OR length(_response) < 10 THEN
    RAISE EXCEPTION 'please write a response (min 10 characters)';
  END IF;
  IF NOT public._is_dispute_seller(p_dispute_id) THEN
    RAISE EXCEPTION 'dispute not found or access denied';
  END IF;

  SELECT * INTO _dispute FROM disputes WHERE id = p_dispute_id FOR UPDATE;
  IF _dispute.status IN ('resolved', 'refunded', 'closed') THEN
    RAISE EXCEPTION 'this dispute is already resolved';
  END IF;
  IF _dispute.seller_response IS NOT NULL THEN
    RAISE EXCEPTION 'you have already responded to this dispute';
  END IF;

  UPDATE disputes
  SET seller_response     = _response,
      seller_responded_at = NOW(),
      updated_at          = NOW()
  WHERE id = p_dispute_id;

  -- Buyer sees the seller's side.
  INSERT INTO notifications (user_id, type, title, message, read, created_at)
  VALUES (
    _dispute.buyer_id, 'return',
    'Seller responded to your dispute',
    'The seller responded to your dispute on order #' || left(_dispute.order_id::text, 8)
      || ': "' || left(_response, 200) || '"',
    FALSE, NOW()
  );

  -- Admins reviewing the dispute see it too.
  INSERT INTO notifications (user_id, type, title, message, read, created_at)
  SELECT pr.id, 'return',
         'Seller response on dispute',
         'The seller responded on the dispute for order #' || left(_dispute.order_id::text, 8)
           || '. Review it in Admin → Disputes.',
         FALSE, NOW()
  FROM profiles pr WHERE pr.role::text = 'admin';
END;
$$;

REVOKE ALL ON FUNCTION public.seller_respond_to_dispute(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.seller_respond_to_dispute(UUID, TEXT) TO authenticated;

-- ─── 5. update_dispute_status ────────────────────────────────────────────────
-- Called by SellerReturns (resolved/refunded/closed) and BuyerReturns
-- (buyer withdraws → closed). Role-checked; notifies the counterpart.
CREATE OR REPLACE FUNCTION public.update_dispute_status(
  p_dispute_id UUID,
  p_new_status TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid       UUID := auth.uid();
  _dispute   RECORD;
  _is_admin  BOOLEAN;
  _is_seller BOOLEAN;
  _is_buyer  BOOLEAN;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_new_status NOT IN ('under_review', 'resolved', 'refunded', 'closed') THEN
    RAISE EXCEPTION 'invalid dispute status: %', p_new_status;
  END IF;

  SELECT * INTO _dispute FROM disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dispute not found'; END IF;
  IF _dispute.status IN ('resolved', 'refunded', 'closed') THEN
    RAISE EXCEPTION 'dispute is already %', _dispute.status;
  END IF;

  _is_admin  := public.is_admin();
  _is_seller := public._is_dispute_seller(p_dispute_id);
  _is_buyer  := (_dispute.buyer_id = _uid);

  IF NOT (_is_admin OR _is_seller OR _is_buyer) THEN
    RAISE EXCEPTION 'access denied';
  END IF;
  -- A buyer may only withdraw (close) their own dispute.
  IF _is_buyer AND NOT (_is_admin OR _is_seller) AND p_new_status <> 'closed' THEN
    RAISE EXCEPTION 'buyers can only close their own dispute';
  END IF;

  UPDATE disputes
  SET status      = p_new_status,
      resolved_at = CASE WHEN p_new_status IN ('resolved', 'refunded', 'closed')
                         THEN NOW() ELSE resolved_at END,
      updated_at  = NOW()
  WHERE id = p_dispute_id;

  -- Tell the other side.
  IF _is_buyer AND NOT (_is_admin OR _is_seller) THEN
    INSERT INTO notifications (user_id, type, title, message, read, created_at)
    VALUES (_dispute.seller_id, 'return', 'Dispute closed by buyer',
      'The buyer closed the dispute on order #' || left(_dispute.order_id::text, 8) || '.',
      FALSE, NOW());
  ELSE
    INSERT INTO notifications (user_id, type, title, message, read, created_at)
    VALUES (_dispute.buyer_id, 'return',
      CASE p_new_status
        WHEN 'resolved' THEN 'Your dispute was resolved'
        WHEN 'refunded' THEN 'Refund approved for your dispute'
        ELSE 'Your dispute was closed'
      END,
      'Update on your dispute for order #' || left(_dispute.order_id::text, 8)
        || ': status is now ' || p_new_status || '.',
      FALSE, NOW());
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_dispute_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_dispute_status(UUID, TEXT) TO authenticated;

-- ─── 6. Fraud-cancellation → dispute pipeline ────────────────────────────────
-- Same body as 20260702140000, plus: when a SELLER cancels with a
-- fraud-category reason, the same transaction also files a dispute row
-- (flagging the order for admin review) and notifies every admin.
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
  v_is_fraud     boolean := false;
  v_dispute_id   uuid;
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

  -- Fraud-category seller cancellation? (CancelOrderModal offers
  -- "Suspected fraud"; free-text reasons mentioning fraud/scam count too.)
  v_is_fraud := (p_role = 'seller' AND v_reason ~* '(fraud|scam)');

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

  -- Fraud pipeline: file a dispute in the SAME transaction so the cancelled
  -- order is flagged for admin review instead of vanishing silently.
  IF v_is_fraud THEN
    -- One open fraud dispute per order is enough.
    IF NOT EXISTS (
      SELECT 1 FROM disputes
      WHERE order_id = p_order AND reason = 'seller_reported_fraud' AND status = 'open'
    ) THEN
      INSERT INTO disputes (order_id, buyer_id, seller_id, reason, description, status, created_at, updated_at)
      VALUES (
        p_order, v_order.user_id, v_uid,
        'seller_reported_fraud',
        'Seller cancelled order #' || left(p_order::text, 8) || ' citing suspected fraud. '
          || 'Seller''s stated reason: ' || v_reason
          || CASE WHEN v_refund_due THEN ' Payment was already in play — refund is flagged as due.' ELSE '' END,
        'open', now(), now()
      )
      RETURNING id INTO v_dispute_id;

      INSERT INTO notifications (user_id, type, title, message, read, created_at)
      SELECT pr.id, 'return', 'Fraud report: order cancelled by seller',
        'A seller cancelled order #' || left(p_order::text, 8)
          || ' for suspected fraud. Review the dispute in Admin → Disputes.',
        FALSE, now()
      FROM profiles pr WHERE pr.role::text = 'admin';
    END IF;
  END IF;

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
      CASE WHEN v_refund_due THEN ' Your payment will be refunded.' ELSE '' END ||
      CASE WHEN v_is_fraud THEN ' This order was flagged for MaliMart review.' ELSE '' END,
      false, now());
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'order_id', p_order, 'status', 'cancelled',
    'refund_due', v_refund_due, 'fraud_dispute_id', v_dispute_id
  );
END;
$$;

-- Internal only: wrappers call it; clients must not pick their own role.
REVOKE ALL ON FUNCTION public._cancel_order_guarded(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- ─── 7. Vacation-mode checkout enforcement ───────────────────────────────────
-- Same body as 20260702130000, plus a set-based rejection of any item whose
-- seller has vendor_profiles.vacation_mode = true.
CREATE OR REPLACE FUNCTION public.place_order_atomic(p_user_id uuid, p_shipping_address jsonb, p_payment_method text, p_payment_ref text, p_delivery_fee numeric, p_discount_amount numeric, p_note text, p_items jsonb, p_is_gift boolean DEFAULT false, p_gift_message text DEFAULT NULL::text, p_preferred_delivery_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_delivery_slot text DEFAULT NULL::text, p_coupon_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
    new_order_id uuid; item record; item_price numeric; item_seller_id uuid;
    item_sku text; current_stock integer; v_totals jsonb; v_discount numeric;
    v_vacation_store text;
begin
    if auth.uid() is null or auth.uid() != p_user_id then raise exception 'Unauthorized'; end if;
    if jsonb_array_length(p_items) = 0 then raise exception 'No items in order'; end if;

    -- Vacation-mode enforcement: no item may come from a store on vacation.
    select coalesce(vp.store_name, 'A store in your cart') into v_vacation_store
    from jsonb_to_recordset(p_items) as x(product_id uuid, variant_id uuid, quantity integer)
    join products p on p.id = x.product_id
    join vendor_profiles vp on vp.seller_id = p.seller_id
    where coalesce(vp.vacation_mode, false)
    limit 1;
    if v_vacation_store is not null then
        raise exception 'Seller on vacation: % is currently on vacation and not accepting orders. Please remove their items from your cart.', v_vacation_store;
    end if;

    for item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, variant_id uuid, quantity integer) loop
        if item.quantity <= 0 then raise exception 'Invalid quantity'; end if;
        if item.variant_id is not null then
            select coalesce(nullif(pv.sale_price, 0), nullif(pv.base_price, 0), pv.price), pv.stock, pv.sku, p.seller_id
              into item_price, current_stock, item_sku, item_seller_id
            from product_variants pv join products p on p.id = item.product_id where pv.id = item.variant_id and pv.product_id = item.product_id;
        else
            select price, stock, sku, seller_id into item_price, current_stock, item_sku, item_seller_id from products where id = item.product_id;
        end if;
        if item_price is null then raise exception 'Product not found: %', item.product_id; end if;
        if current_stock is not null and current_stock < item.quantity then raise exception 'Insufficient stock for product %', item.product_id; end if;
    end loop;

    v_discount := public.compute_order_discount(p_items, p_coupon_code);
    v_totals := public.compute_cart_totals(p_items, p_delivery_fee, v_discount);

    insert into public.orders (
        user_id, subtotal, delivery_fee, discount_amount, vat_amount, total,
        payment_method, payment_ref, shipping_address, note, status,
        is_gift, gift_message, preferred_delivery_date, delivery_slot, created_at, updated_at)
    values (
        p_user_id,
        (v_totals->>'subtotal')::numeric,
        (v_totals->>'delivery_fee')::numeric,
        (v_totals->>'discount')::numeric,
        (v_totals->>'vat_amount')::numeric,
        (v_totals->>'total')::numeric,
        p_payment_method, p_payment_ref, p_shipping_address, p_note, 'pending'::order_status,
        coalesce(p_is_gift,false), p_gift_message, p_preferred_delivery_date, p_delivery_slot, now(), now())
    returning id into new_order_id;

    for item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, variant_id uuid, quantity integer) loop
        if item.variant_id is not null then
            select coalesce(nullif(pv.sale_price, 0), nullif(pv.base_price, 0), pv.price), pv.sku, p.seller_id
              into item_price, item_sku, item_seller_id
            from product_variants pv join products p on p.id = item.product_id where pv.id = item.variant_id;
            update product_variants set stock = stock - item.quantity where id = item.variant_id;
        else
            select price, sku, seller_id into item_price, item_sku, item_seller_id from products where id = item.product_id;
            update products set stock = stock - item.quantity where id = item.product_id;
        end if;
        insert into public.order_items (order_id, product_id, variant_id, seller_id, quantity, price_at_purchase, sku)
        values (new_order_id, item.product_id, item.variant_id, item_seller_id, item.quantity, item_price, item_sku);
    end loop;

    insert into public.notifications (user_id, type, title, message, read, created_at)
    select distinct oi.seller_id, 'order', 'New Order — Action Required', 'Order #' || left(new_order_id::text, 8) || ' is waiting for your confirmation.', false, now()
    from order_items oi where oi.order_id = new_order_id;

    return jsonb_build_object('id', new_order_id);
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.place_order_atomic(uuid, jsonb, text, text, numeric, numeric, text, jsonb, boolean, text, timestamptz, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.place_order_atomic(uuid, jsonb, text, text, numeric, numeric, text, jsonb, boolean, text, timestamptz, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.place_order_atomic(uuid, jsonb, text, text, numeric, numeric, text, jsonb, boolean, text, timestamptz, text, text) TO authenticated;
