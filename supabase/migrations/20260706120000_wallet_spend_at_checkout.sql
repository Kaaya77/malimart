-- 20260706120000_wallet_spend_at_checkout.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Wallet spend at checkout.
--
-- WalletTab has promised "You can spend your balance at checkout" since the
-- wallet ledger shipped (20260703040000) — this delivers it. One additive
-- column and one extended RPC:
--
--   1. orders.wallet_amount (additive) — the portion of the order prepaid from
--      the buyer's wallet. orders.total stays the FULL order value (so refunds,
--      seller payouts and reports are unchanged); the amount still owed via the
--      chosen payment method is total - wallet_amount.
--
--   2. place_order_atomic gains p_wallet_amount numeric DEFAULT 0. Server-side
--      rules (client value is a request, never trusted):
--        • clamped to [0, caller's profiles.wallet_balance] (row locked
--          FOR UPDATE) and to the order total after discounts;
--        • debited atomically through the canonical _credit_wallet() helper,
--          which moves profiles.wallet_balance and inserts the matching
--          wallet_transactions 'debit' ledger row in the same transaction;
--        • any failure in order placement rolls the debit back too.
--      Adding a defaulted parameter changes the function signature, so the old
--      13-arg function is dropped and recreated with the extra DEFAULT 0 param
--      (leaving both would make named-arg RPC calls ambiguous). Existing
--      callers that omit p_wallet_amount keep working unchanged.
--
-- No new tables → no new RLS. SECURITY DEFINER + NULL-safe auth.uid() guard
-- kept from 20260702101626; EXECUTE revoked from PUBLIC/anon.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. orders.wallet_amount (additive only) ─────────────────────────────────
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS wallet_amount NUMERIC NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.orders.wallet_amount IS
  'Portion of the order paid from the buyer wallet at checkout. orders.total remains the full order value; amount due via the payment method = total - wallet_amount. Set only by place_order_atomic.';

-- ─── 2. place_order_atomic + p_wallet_amount ─────────────────────────────────
-- Same body as 20260703040000 (vacation enforcement + best-of(coupon, auto)
-- discount kept verbatim) with the wallet clamp/debit added.
DROP FUNCTION IF EXISTS public.place_order_atomic(uuid, jsonb, text, text, numeric, numeric, text, jsonb, boolean, text, timestamptz, text, text);

CREATE OR REPLACE FUNCTION public.place_order_atomic(p_user_id uuid, p_shipping_address jsonb, p_payment_method text, p_payment_ref text, p_delivery_fee numeric, p_discount_amount numeric, p_note text, p_items jsonb, p_is_gift boolean DEFAULT false, p_gift_message text DEFAULT NULL::text, p_preferred_delivery_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_delivery_slot text DEFAULT NULL::text, p_coupon_code text DEFAULT NULL::text, p_wallet_amount numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
    new_order_id uuid; item record; item_price numeric; item_seller_id uuid;
    item_sku text; current_stock integer; v_totals jsonb; v_discount numeric;
    v_vacation_store text;
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

    -- Debit the wallet through the canonical helper: balance move + the
    -- wallet_transactions 'debit' ledger row happen together, and both roll
    -- back with the order if anything below fails.
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
            update product_variants set stock = stock - item.quantity where id = item.variant_id;
        else
            select price, sku, seller_id into item_price, item_sku, item_seller_id from products where id = item.product_id;
            update products set stock = stock - item.quantity where id = item.product_id;
        end if;
        insert into public.order_items (order_id, product_id, variant_id, seller_id, quantity, price_at_purchase, sku)
        values (new_order_id, item.product_id, item.variant_id, item_seller_id, item.quantity, item_price, item_sku);
    end loop;

    -- Record the auto-applied offer against the order and bump its usage.
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
