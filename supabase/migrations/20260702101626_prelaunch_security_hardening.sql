-- Pre-launch security hardening (2026-07-02 audit)
--
-- 1. place_order_atomic — BLOCKING: was anon-executable with a NULL-bypass guard
--    (`auth.uid() != p_user_id` is NULL, not TRUE, when auth.uid() is NULL), so an
--    unauthenticated caller with the public anon key could place orders as any user,
--    drain stock catalog-wide, and spam sellers. Fix: NULL-safe guard + drop anon grant.
-- 2. upsert_cart_item — same NULL-bypass class; unused by the client (guest carts are
--    localStorage-only). Add NULL guard + drop anon grant.
-- 3. wallet_transactions INSERT — was self-insertable by any user (arbitrary amount/type).
--    Restrict to admin (service_role bypasses RLS, so edge functions still insert).
-- 4. apply_wallet_transaction — dead code (references non-existent tx.status / tx.user_id
--    columns) for an unlaunched wallet feature. Lock down execution until it is redesigned.
--
-- NOTE on the revoke idiom: REVOKE ... FROM anon alone does nothing while the default
-- PUBLIC grant remains, so we REVOKE FROM PUBLIC first and re-GRANT to authenticated.

-- ── 1. place_order_atomic ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.place_order_atomic(
    p_user_id uuid, p_shipping_address jsonb, p_payment_method text, p_payment_ref text,
    p_delivery_fee numeric, p_discount_amount numeric, p_note text, p_items jsonb,
    p_is_gift boolean DEFAULT false, p_gift_message text DEFAULT NULL::text,
    p_preferred_delivery_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_delivery_slot text DEFAULT NULL::text, p_coupon_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
    new_order_id uuid; item record; item_price numeric; item_seller_id uuid;
    item_sku text; current_stock integer; v_totals jsonb; v_discount numeric;
begin
    if auth.uid() is null or auth.uid() != p_user_id then raise exception 'Unauthorized'; end if;
    if jsonb_array_length(p_items) = 0 then raise exception 'No items in order'; end if;

    for item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, variant_id uuid, quantity integer) loop
        if item.quantity <= 0 then raise exception 'Invalid quantity'; end if;
        if item.variant_id is not null then
            select pv.price, pv.stock, pv.sku, p.seller_id into item_price, current_stock, item_sku, item_seller_id
            from product_variants pv join products p on p.id = item.product_id where pv.id = item.variant_id and pv.product_id = item.product_id;
        else
            select price, stock, sku, seller_id into item_price, current_stock, item_sku, item_seller_id from products where id = item.product_id;
        end if;
        if item_price is null then raise exception 'Product not found: %', item.product_id; end if;
        if current_stock is not null and current_stock < item.quantity then raise exception 'Insufficient stock for product %', item.product_id; end if;
    end loop;

    -- Server-validated discount (ignores any client-supplied p_discount_amount).
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
            select pv.price, pv.sku, p.seller_id into item_price, item_sku, item_seller_id from product_variants pv join products p on p.id = item.product_id where pv.id = item.variant_id;
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

-- ── 2. upsert_cart_item ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_cart_item(p_product_id uuid, p_variant_id uuid, p_quantity integer, p_price numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_cart_id uuid;
    v_item_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- Get or create the caller's cart in one upsert (carts.user_id is UNIQUE)
    INSERT INTO carts (user_id)
    VALUES (auth.uid())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT id INTO v_cart_id FROM carts WHERE user_id = auth.uid();

    -- Find existing item, handling NULL variant_id correctly
    SELECT id INTO v_item_id
    FROM cart_items
    WHERE cart_id   = v_cart_id
      AND product_id = p_product_id
      AND (
            (p_variant_id IS NULL     AND variant_id IS NULL)
         OR (p_variant_id IS NOT NULL AND variant_id = p_variant_id)
          );

    IF v_item_id IS NOT NULL THEN
        UPDATE cart_items
        SET quantity = quantity + p_quantity
        WHERE id = v_item_id;
    ELSE
        INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, price_at_add)
        VALUES (v_cart_id, p_product_id, p_variant_id, p_quantity, p_price);
    END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.upsert_cart_item(uuid, uuid, integer, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_cart_item(uuid, uuid, integer, numeric) FROM anon;
GRANT  EXECUTE ON FUNCTION public.upsert_cart_item(uuid, uuid, integer, numeric) TO authenticated;

-- ── 3. wallet_transactions INSERT — admin only (service_role bypasses RLS) ────
DROP POLICY IF EXISTS wallet_transactions_insert ON public.wallet_transactions;
CREATE POLICY wallet_transactions_insert ON public.wallet_transactions
    FOR INSERT
    WITH CHECK ((SELECT public.is_admin()));

-- ── 4. apply_wallet_transaction — lock down dead/broken function ──────────────
-- References non-existent columns (tx.status, tx.user_id) so it errors on every call.
-- Revoke all client execution until the wallet subsystem is redesigned and the
-- wallet_transactions schema (status? user_id vs profile_id?) is reconciled.
REVOKE EXECUTE ON FUNCTION public.apply_wallet_transaction(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_wallet_transaction(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_wallet_transaction(uuid) FROM authenticated;
