-- Two checkout/order gaps found by the E2E pipeline audit:
--
-- 1. Buyers could never see where to send money. The public_vendor_profiles
--    view deliberately excludes payment fields (they sit next to real PII like
--    TIN/VRN on vendor_profiles, which is owner-only under RLS) — but MaliMart's
--    manual mobile-money flow REQUIRES showing the seller's Lipa Namba / bank
--    details at checkout. New narrow RPC exposes ONLY payment-RECEIVING
--    channels (numbers a seller hands out to get paid — the mobile-money
--    equivalent of an invoice), to authenticated users only.
--
-- 2. Sellers' status updates (confirmed / shipped / delivered) never notified
--    the buyer — only cancellations did. The client can't compensate because
--    sellers can't read the buyer's orders row under RLS. Notification now
--    happens inside update_order_status_rbac.

-- ── 1. Payment channels for checkout ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_seller_payment_channels(p_seller_ids uuid[])
RETURNS TABLE (
  seller_id         uuid,
  store_name        text,
  lipa_namba        text,
  lipa_vodacom      text,
  lipa_airtel       text,
  mobile_operator   text,
  mobile_number     text,
  mobile_name       text,
  bank_name         text,
  bank_account_name text,
  account_number    text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vp.seller_id, vp.store_name,
         vp.lipa_namba, vp.lipa_vodacom, vp.lipa_airtel,
         vp.mobile_operator, vp.mobile_number, vp.mobile_name,
         vp.bank_name, vp.bank_account_name, vp.account_number
  FROM public.vendor_profiles vp
  WHERE vp.seller_id = ANY(p_seller_ids)
    AND auth.uid() IS NOT NULL;   -- signed-in shoppers only, never anon scraping
$$;

REVOKE ALL   ON FUNCTION public.get_seller_payment_channels(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_payment_channels(uuid[]) TO authenticated;

-- ── 2. Buyer notifications on seller status updates ──────────────────────────
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
    v_caller     UUID    := auth.uid();
    v_is_seller  BOOLEAN;
    v_is_admin   BOOLEAN;
    v_is_buyer   BOOLEAN;
    v_old_status TEXT;
    v_buyer_id   UUID;
BEGIN
    -- Legacy aliases → canonical statuses.
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

    SELECT status::text, user_id INTO v_old_status, v_buyer_id
    FROM public.orders WHERE id = p_order_id;

    UPDATE public.orders
    SET status        = p_new_status::order_status,
        updated_at    = NOW(),
        cancel_reason = COALESCE(p_cancel_reason, cancel_reason)
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id;
    END IF;

    -- Tell the buyer when the seller moves their order forward (once per real change).
    IF v_old_status IS DISTINCT FROM p_new_status
       AND p_new_status IN ('processing', 'in_transit', 'delivered')
       AND v_buyer_id IS NOT NULL AND v_buyer_id <> v_caller THEN
        INSERT INTO public.notifications (user_id, type, title, message, read, created_at)
        VALUES (
            v_buyer_id, 'order',
            CASE p_new_status
                WHEN 'processing' THEN 'Order Confirmed'
                WHEN 'in_transit' THEN 'Order Shipped'
                ELSE 'Order Delivered'
            END,
            'Your order #' || left(p_order_id::text, 8) ||
            CASE p_new_status
                WHEN 'processing' THEN ' has been confirmed by the seller and is being prepared.'
                WHEN 'in_transit' THEN ' is on its way to you.'
                ELSE ' has been delivered. Karibu tena!'
            END,
            false, now()
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_order_status_rbac(uuid, text, text) TO authenticated;
