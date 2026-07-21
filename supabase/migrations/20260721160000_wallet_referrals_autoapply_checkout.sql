-- 20260721160000_wallet_referrals_autoapply_checkout.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- CRITICAL FIX: checkout has been completely broken in production. The client
-- (context/AppContext.tsx) has unconditionally sent place_order_atomic a
-- p_wallet_amount argument since the "wallet functionality for checkout"
-- feature shipped, but three migrations that were supposed to deliver the
-- backing schema/RPCs were never actually applied to this database:
--   20260703030000_disputes_fraud_vacation.sql
--   20260703040000_wallet_referrals_autoapply_returns.sql
--   20260706120000_wallet_spend_at_checkout.sql
-- (confirmed via list_migrations + direct pg_proc lookups — none of
-- _credit_wallet / compute_auto_apply_discount / the wallet-aware
-- place_order_atomic exist live). Every order attempt has been failing with
-- "function place_order_atomic(...) does not exist".
--
-- This migration restores the wallet ledger, auto-apply discounts, and
-- wallet-spend-at-checkout — everything checkout actually needs.
--
-- INTENTIONALLY EXCLUDED:
--   • The referral program (section 2 of 20260703040000). That code assumes
--     a `referrals` table shaped (referred_id, status text, ...), but
--     production already has a DIFFERENT, more developed `referrals` table
--     (referee_id, enum status, qualifying_order_id, separate
--     referrer/referee reward types, expires_at) from an earlier migration.
--     Bolting the simpler shape on top would conflict with — not extend —
--     what's actually live. Needs its own migration written against the
--     real schema, not bundled into this checkout-outage fix.
--   • The returns/disputes state machine (section 4 of 20260703040000, all of
--     20260703030000). That code assumes disputes.status is free text with
--     values open/under_review/resolved/refunded/closed, but production's
--     disputes.status is a `dispute_status` ENUM with a different,
--     incompatible value set (awaiting_buyer/awaiting_seller/closed/
--     escalated/open/resolved_buyer/resolved_seller/resolved_split/
--     under_review). Real design mismatch requiring an explicit value-mapping
--     decision — tracked separately.
--
-- Also fixes a stock-oversell race condition present in every prior version
-- of place_order_atomic: stock was checked in one loop (SELECT, no lock) and
-- decremented in a later loop with a plain `UPDATE ... SET stock = stock -
-- qty` and no re-check, so two concurrent buyers on the last unit could both
-- succeed. The decrement is now a conditional `UPDATE ... WHERE stock >=
-- qty`, and a zero rowcount raises — rolling back the whole order atomically.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Column guards ────────────────────────────────────────────────────────
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS wallet_amount NUMERIC NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.orders.wallet_amount IS
  'Portion of the order paid from the buyer wallet at checkout. orders.total remains the full order value; amount due via the payment method = total - wallet_amount. Set only by place_order_atomic.';

-- ─── 1. Canonical wallet credit/debit helper (internal only) ────────────────
CREATE OR REPLACE FUNCTION public._credit_wallet(
  p_profile_id  UUID,
  p_amount      NUMERIC,
  p_type        TEXT,
  p_description TEXT,
  p_order_id    UUID DEFAULT NULL,
  p_reference   UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx_id UUID;
BEGIN
  IF p_profile_id IS NULL THEN RAISE EXCEPTION 'wallet: missing profile'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'wallet: amount must be positive';
  END IF;
  IF p_type NOT IN ('credit', 'debit') THEN
    RAISE EXCEPTION 'wallet: invalid type %', p_type;
  END IF;

  IF p_type = 'credit' THEN
    UPDATE profiles SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount, updated_at = NOW()
    WHERE id = p_profile_id;
  ELSE
    UPDATE profiles SET wallet_balance = GREATEST(COALESCE(wallet_balance, 0) - p_amount, 0), updated_at = NOW()
    WHERE id = p_profile_id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet: profile not found'; END IF;

  INSERT INTO wallet_transactions (profile_id, order_id, amount, type, status, reference_id, description, created_at)
  VALUES (p_profile_id, p_order_id, p_amount, p_type, 'completed', p_reference, p_description, NOW())
  RETURNING id INTO _tx_id;

  RETURN _tx_id;
END;
$$;
REVOKE ALL ON FUNCTION public._credit_wallet(UUID, NUMERIC, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ─── 2. Auto-apply discounts ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_auto_apply_discount(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it            RECORD;
  v_price       numeric;
  v_seller      uuid;
  v_seller_sub  jsonb := '{}'::jsonb;
  v_subtotal    numeric := 0;
  o             RECORD;
  v_scope_sub   numeric;
  v_disc        numeric;
  v_best        numeric := 0;
  v_best_offer  uuid;
  v_best_title  text;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN RETURN jsonb_build_object('discount', 0); END IF;

  FOR it IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id uuid, variant_id uuid, quantity integer) LOOP
    IF it.quantity IS NULL OR it.quantity <= 0 THEN CONTINUE; END IF;
    IF it.variant_id IS NOT NULL THEN
      SELECT COALESCE(NULLIF(pv.sale_price,0), NULLIF(pv.base_price,0), pv.price), p.seller_id
        INTO v_price, v_seller
      FROM product_variants pv JOIN products p ON p.id = pv.product_id
      WHERE pv.id = it.variant_id AND pv.product_id = it.product_id;
    ELSE
      SELECT price, seller_id INTO v_price, v_seller FROM products WHERE id = it.product_id;
    END IF;
    IF v_price IS NULL OR v_seller IS NULL THEN CONTINUE; END IF;
    v_subtotal := v_subtotal + (v_price * it.quantity);
    v_seller_sub := jsonb_set(v_seller_sub, ARRAY[v_seller::text],
      to_jsonb(COALESCE((v_seller_sub->>v_seller::text)::numeric, 0) + (v_price * it.quantity)));
  END LOOP;

  IF v_subtotal <= 0 THEN RETURN jsonb_build_object('discount', 0); END IF;

  FOR o IN
    SELECT id, title, seller_id, scope, type, value, min_order_value
    FROM offers
    WHERE is_auto_apply = TRUE
      AND status = 'active'
      AND COALESCE(campaign_type, 'discount') = 'discount'
      AND type IN ('percentage', 'fixed')
      AND (start_date IS NULL OR start_date <= NOW())
      AND (end_date   IS NULL OR end_date   >= NOW())
      AND (max_usage IS NULL OR COALESCE(current_usage, 0) < max_usage)
  LOOP
    IF o.scope = 'platform' THEN
      v_scope_sub := v_subtotal;
    ELSE
      v_scope_sub := COALESCE((v_seller_sub->>o.seller_id::text)::numeric, 0);
    END IF;

    IF v_scope_sub <= 0 THEN CONTINUE; END IF;
    IF v_scope_sub < COALESCE(o.min_order_value, 0) THEN CONTINUE; END IF;

    IF o.type = 'percentage' THEN
      v_disc := ROUND(v_scope_sub * (LEAST(o.value, 100) / 100.0));
    ELSE
      v_disc := LEAST(o.value, v_scope_sub);
    END IF;

    IF v_disc > v_best THEN
      v_best := v_disc; v_best_offer := o.id; v_best_title := o.title;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'discount', GREATEST(v_best, 0),
    'offer_id', v_best_offer,
    'title',    v_best_title
  );
END;
$$;
REVOKE ALL ON FUNCTION public.compute_auto_apply_discount(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.compute_auto_apply_discount(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.preview_cart_discount(p_items jsonb, p_coupon_code TEXT DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon numeric := 0;
  v_auto   jsonb;
  v_auto_d numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF p_coupon_code IS NOT NULL AND btrim(p_coupon_code) <> '' THEN
    v_coupon := COALESCE(public.compute_order_discount(p_items, p_coupon_code), 0);
  END IF;

  v_auto   := public.compute_auto_apply_discount(p_items);
  v_auto_d := COALESCE((v_auto->>'discount')::numeric, 0);

  IF v_auto_d > v_coupon THEN
    RETURN jsonb_build_object('discount', v_auto_d, 'source', 'auto',
      'offer_id', v_auto->>'offer_id', 'title', v_auto->>'title');
  ELSE
    RETURN jsonb_build_object('discount', v_coupon, 'source',
      CASE WHEN v_coupon > 0 THEN 'coupon' ELSE 'none' END,
      'title', CASE WHEN v_coupon > 0 THEN p_coupon_code ELSE NULL END);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.preview_cart_discount(jsonb, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.preview_cart_discount(jsonb, TEXT) TO authenticated;

-- ─── 3. place_order_atomic: vacation + best-of(coupon,auto) discount +
--        wallet spend + ATOMIC stock decrement (oversell-race fix) ──────────
DROP FUNCTION IF EXISTS public.place_order_atomic(uuid, jsonb, text, text, numeric, numeric, text, jsonb, boolean, text, timestamptz, text, text);
DROP FUNCTION IF EXISTS public.place_order_atomic(uuid, jsonb, text, text, numeric, numeric, text, jsonb, boolean, text, timestamptz, text, text, numeric);

CREATE FUNCTION public.place_order_atomic(p_user_id uuid, p_shipping_address jsonb, p_payment_method text, p_payment_ref text, p_delivery_fee numeric, p_discount_amount numeric, p_note text, p_items jsonb, p_is_gift boolean DEFAULT false, p_gift_message text DEFAULT NULL::text, p_preferred_delivery_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_delivery_slot text DEFAULT NULL::text, p_coupon_code text DEFAULT NULL::text, p_wallet_amount numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
    new_order_id uuid; item record; item_price numeric; item_seller_id uuid;
    item_sku text; current_stock integer; v_totals jsonb; v_discount numeric;
    v_vacation_store text; v_updated int;
    v_coupon_disc numeric; v_auto jsonb; v_auto_disc numeric; v_auto_offer uuid;
    v_wallet numeric := 0; v_wallet_balance numeric := 0;
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

    -- Fast-fail pre-check (nicer error message). The REAL guard against
    -- overselling is the conditional UPDATE further down.
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

    -- Discount: best-of(manual coupon, auto-apply offer). Never stacked.
    v_coupon_disc := COALESCE(public.compute_order_discount(p_items, p_coupon_code), 0);
    v_auto        := public.compute_auto_apply_discount(p_items);
    v_auto_disc   := COALESCE((v_auto->>'discount')::numeric, 0);
    if v_auto_disc > v_coupon_disc then
        v_discount := v_auto_disc;
        v_auto_offer := NULLIF(v_auto->>'offer_id','')::uuid;
    else
        v_discount := v_coupon_disc;
        v_auto_offer := NULL;
    end if;

    v_totals := public.compute_cart_totals(p_items, p_delivery_fee, v_discount);

    -- Wallet spend: the client value is a REQUEST. Lock the caller's profile
    -- row and clamp to [0, actual balance] and to the post-discount total.
    if COALESCE(p_wallet_amount, 0) > 0 then
        select COALESCE(wallet_balance, 0) into v_wallet_balance
        from profiles where id = p_user_id for update;
        if not found then raise exception 'Unauthorized'; end if;
        v_wallet := LEAST(GREATEST(p_wallet_amount, 0), v_wallet_balance, GREATEST((v_totals->>'total')::numeric, 0));
        v_wallet := GREATEST(v_wallet, 0);
    end if;

    insert into public.orders (
        user_id, subtotal, delivery_fee, discount_amount, vat_amount, total, wallet_amount,
        payment_method, payment_ref, shipping_address, note, status,
        is_gift, gift_message, preferred_delivery_date, delivery_slot, created_at, updated_at)
    values (
        p_user_id,
        (v_totals->>'subtotal')::numeric,
        (v_totals->>'delivery_fee')::numeric,
        (v_totals->>'discount')::numeric,
        (v_totals->>'vat_amount')::numeric,
        (v_totals->>'total')::numeric,
        v_wallet,
        p_payment_method, p_payment_ref, p_shipping_address, p_note, 'pending'::order_status,
        coalesce(p_is_gift,false), p_gift_message, p_preferred_delivery_date, p_delivery_slot, now(), now())
    returning id into new_order_id;

    if v_wallet > 0 then
        perform public._credit_wallet(
            p_user_id, v_wallet, 'debit',
            'Wallet payment for order #' || left(new_order_id::text, 8),
            new_order_id, NULL
        );
        select COALESCE(wallet_balance, 0) into v_wallet_balance from profiles where id = p_user_id;
    end if;

    for item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, variant_id uuid, quantity integer) loop
        if item.variant_id is not null then
            select coalesce(nullif(pv.sale_price, 0), nullif(pv.base_price, 0), pv.price), pv.sku, p.seller_id
              into item_price, item_sku, item_seller_id
            from product_variants pv join products p on p.id = item.product_id where pv.id = item.variant_id;
            -- Atomic, race-safe decrement: only succeeds if stock still covers
            -- the quantity at the moment of the UPDATE, not at the earlier
            -- check. A zero rowcount rolls back the whole order (incl. the
            -- wallet debit above).
            update product_variants set stock = stock - item.quantity
              where id = item.variant_id and stock >= item.quantity;
            get diagnostics v_updated = row_count;
            if v_updated = 0 then
                raise exception 'Insufficient stock for product %', item.product_id;
            end if;
        else
            select price, sku, seller_id into item_price, item_sku, item_seller_id from products where id = item.product_id;
            update products set stock = stock - item.quantity, updated_at = now()
              where id = item.product_id and (stock is null or stock >= item.quantity);
            get diagnostics v_updated = row_count;
            if v_updated = 0 then
                raise exception 'Insufficient stock for product %', item.product_id;
            end if;
        end if;
        insert into public.order_items (order_id, product_id, variant_id, seller_id, quantity, price_at_purchase, sku)
        values (new_order_id, item.product_id, item.variant_id, item_seller_id, item.quantity, item_price, item_sku);
    end loop;

    if v_auto_offer is not null and v_discount > 0 then
        insert into public.order_discounts (order_id, offer_id, amount, created_at)
        values (new_order_id, v_auto_offer, v_discount, now());
        update public.offers set current_usage = coalesce(current_usage,0) + 1, updated_at = now()
        where id = v_auto_offer;
    end if;

    insert into public.notifications (user_id, type, title, message, read, created_at)
    select distinct oi.seller_id, 'order', 'New Order — Action Required', 'Order #' || left(new_order_id::text, 8) || ' is waiting for your confirmation.', false, now()
    from order_items oi where oi.order_id = new_order_id;

    return jsonb_build_object(
        'id', new_order_id,
        'wallet_amount', v_wallet,
        'wallet_balance', case when v_wallet > 0 then v_wallet_balance else null end
    );
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.place_order_atomic(uuid, jsonb, text, text, numeric, numeric, text, jsonb, boolean, text, timestamptz, text, text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.place_order_atomic(uuid, jsonb, text, text, numeric, numeric, text, jsonb, boolean, text, timestamptz, text, text, numeric) FROM anon;
GRANT  EXECUTE ON FUNCTION public.place_order_atomic(uuid, jsonb, text, text, numeric, numeric, text, jsonb, boolean, text, timestamptz, text, text, numeric) TO authenticated;
