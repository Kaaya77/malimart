-- 20260703020000_seller_offers_rpcs.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Security batch: campaign (offers) CRUD out of SellerOffers.tsx and into
-- SECURITY DEFINER RPCs. Every write verifies the caller owns the seller row:
-- seller_id is always auth.uid() — the client can no longer create or mutate
-- campaigns for another seller by passing a foreign seller_id.
-- ═══════════════════════════════════════════════════════════════════════════

-- Caller must be a seller (or admin) with a profile row.
CREATE OR REPLACE FUNCTION public._assert_is_seller()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role::text IN ('seller', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden: seller account required';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._assert_is_seller() FROM PUBLIC, anon, authenticated;

-- ─── Read: my campaigns ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seller_list_my_offers()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.created_at DESC), '[]'::jsonb)
  FROM offers o
  WHERE o.seller_id = auth.uid();
$$;

-- ─── Create / update ─────────────────────────────────────────────────────────
-- p_offer carries the campaign fields; seller_id is IGNORED and forced to the
-- caller. When p_offer_id is provided, the row must already belong to the caller.
CREATE OR REPLACE FUNCTION public.seller_save_offer(
  p_offer    jsonb,
  p_offer_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _id  UUID;
BEGIN
  PERFORM public._assert_is_seller();

  IF p_offer_id IS NOT NULL THEN
    -- Ownership check before mutating.
    SELECT id INTO _id FROM offers WHERE id = p_offer_id AND seller_id = _uid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'campaign not found or access denied'; END IF;

    UPDATE offers SET
      title           = COALESCE(p_offer->>'title', title),
      code            = COALESCE(p_offer->>'code', code),
      campaign_type   = COALESCE(p_offer->>'campaign_type', campaign_type),
      type            = COALESCE(p_offer->>'type', type),
      value           = COALESCE((p_offer->>'value')::numeric, value),
      min_order_value = COALESCE((p_offer->>'min_order_value')::numeric, min_order_value),
      buy_quantity    = COALESCE((p_offer->>'buy_quantity')::integer, buy_quantity),
      get_quantity    = COALESCE((p_offer->>'get_quantity')::integer, get_quantity),
      max_usage       = CASE WHEN p_offer ? 'max_usage' THEN (p_offer->>'max_usage')::integer ELSE max_usage END,
      start_date      = COALESCE((p_offer->>'start_date')::timestamptz, start_date),
      end_date        = CASE WHEN p_offer ? 'end_date' THEN (p_offer->>'end_date')::timestamptz ELSE end_date END,
      status          = COALESCE(p_offer->>'status', status),
      target_type     = COALESCE(p_offer->>'target_type', target_type),
      target_ids      = CASE WHEN p_offer ? 'target_ids'
                             THEN COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(p_offer->'target_ids') x), '{}')
                             ELSE target_ids END,
      is_auto_apply   = COALESCE((p_offer->>'is_auto_apply')::boolean, is_auto_apply),
      is_flash_sale   = COALESCE((p_offer->>'is_flash_sale')::boolean, is_flash_sale),
      updated_at      = NOW()
    WHERE id = p_offer_id AND seller_id = _uid;
    RETURN p_offer_id;
  END IF;

  INSERT INTO offers (
    seller_id, title, code, campaign_type, type, value, min_order_value,
    buy_quantity, get_quantity, max_usage, start_date, end_date, status,
    scope, target_type, target_ids, is_auto_apply, is_flash_sale
  ) VALUES (
    _uid,
    p_offer->>'title',
    p_offer->>'code',
    COALESCE(p_offer->>'campaign_type', 'discount'),
    p_offer->>'type',
    COALESCE((p_offer->>'value')::numeric, 0),
    COALESCE((p_offer->>'min_order_value')::numeric, 0),
    COALESCE((p_offer->>'buy_quantity')::integer, 0),
    COALESCE((p_offer->>'get_quantity')::integer, 0),
    (p_offer->>'max_usage')::integer,
    COALESCE((p_offer->>'start_date')::timestamptz, NOW()),
    (p_offer->>'end_date')::timestamptz,
    COALESCE(p_offer->>'status', 'active'),
    'seller', -- sellers can never create platform-scope offers
    p_offer->>'target_type',
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(p_offer->'target_ids') x), '{}'),
    COALESCE((p_offer->>'is_auto_apply')::boolean, FALSE),
    COALESCE((p_offer->>'is_flash_sale')::boolean, FALSE)
  )
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- ─── Enable / disable ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seller_set_offer_status(
  p_offer_id UUID,
  p_status   TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_is_seller();
  IF p_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'invalid status: %', p_status;
  END IF;
  UPDATE offers SET status = p_status, updated_at = NOW()
  WHERE id = p_offer_id AND seller_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign not found or access denied'; END IF;
END;
$$;

-- ─── Delete ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seller_delete_offer(p_offer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_is_seller();
  DELETE FROM offers WHERE id = p_offer_id AND seller_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign not found or access denied'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.seller_list_my_offers() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seller_save_offer(jsonb, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seller_set_offer_status(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seller_delete_offer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_list_my_offers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.seller_save_offer(jsonb, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seller_set_offer_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seller_delete_offer(UUID) TO authenticated;
