-- Orders containing product VARIANTS were stored with zero amounts.
--
-- Root cause: the app writes variant prices to product_variants.base_price /
-- sale_price (the UI charges `sale_price || base_price`), while the legacy
-- product_variants.price column stays 0. Both place_order_atomic and
-- compute_cart_totals read pv.price, so variant line items were inserted with
-- price_at_purchase = 0 and order subtotal/total = 0.
--
-- Fix: price variants as COALESCE(NULLIF(sale_price,0), NULLIF(base_price,0), price)
-- in both functions, matching the storefront. Then repair existing zero rows from
-- the same source of truth.

CREATE OR REPLACE FUNCTION public.compute_cart_totals(p_items jsonb, p_delivery_fee numeric DEFAULT 0, p_discount numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    it          RECORD;
    v_price     numeric;
    v_seller    uuid;
    v_rate      numeric;
    v_registered boolean;
    v_subtotal  numeric := 0;
    v_raw_vat   numeric := 0;
    v_discount  numeric := GREATEST(COALESCE(p_discount, 0), 0);
    v_delivery  numeric := GREATEST(COALESCE(p_delivery_fee, 0), 0);
    v_net_after numeric;
    v_vat       numeric;
    v_total     numeric;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        p_items := '[]'::jsonb;
    END IF;

    FOR it IN SELECT * FROM jsonb_to_recordset(p_items)
              AS x(product_id uuid, variant_id uuid, quantity integer)
    LOOP
        IF it.quantity IS NULL OR it.quantity <= 0 THEN CONTINUE; END IF;

        IF it.variant_id IS NOT NULL THEN
            -- Variant price lives in sale_price/base_price; pv.price is legacy (often 0).
            SELECT COALESCE(NULLIF(pv.sale_price, 0), NULLIF(pv.base_price, 0), pv.price),
                   p.seller_id, p.vat_rate
              INTO v_price, v_seller, v_rate
            FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            WHERE pv.id = it.variant_id AND pv.product_id = it.product_id;
        ELSE
            SELECT price, seller_id, vat_rate
              INTO v_price, v_seller, v_rate
            FROM products WHERE id = it.product_id;
        END IF;

        IF v_price IS NULL THEN CONTINUE; END IF;

        v_rate := COALESCE(v_rate, 0);
        IF v_rate > 1 THEN v_rate := v_rate / 100; END IF;

        SELECT EXISTS (
            SELECT 1 FROM vendor_profiles
            WHERE seller_id = v_seller
              AND vrn IS NOT NULL AND btrim(vrn) <> ''
        ) INTO v_registered;

        v_subtotal := v_subtotal + (v_price * it.quantity);
        IF v_registered AND v_rate > 0 THEN
            v_raw_vat := v_raw_vat + (v_price * it.quantity * v_rate);
        END IF;
    END LOOP;

    v_discount  := LEAST(v_discount, v_subtotal);
    v_net_after := v_subtotal - v_discount;

    IF v_subtotal > 0 THEN
        v_vat := ROUND(v_raw_vat * (v_net_after / v_subtotal));
    ELSE
        v_vat := 0;
    END IF;

    v_total := v_net_after + v_vat + v_delivery;

    RETURN jsonb_build_object(
        'subtotal',     ROUND(v_subtotal),
        'discount',     ROUND(v_discount),
        'vat_amount',   v_vat,
        'delivery_fee', ROUND(v_delivery),
        'total',        ROUND(v_total)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.place_order_atomic(p_user_id uuid, p_shipping_address jsonb, p_payment_method text, p_payment_ref text, p_delivery_fee numeric, p_discount_amount numeric, p_note text, p_items jsonb, p_is_gift boolean DEFAULT false, p_gift_message text DEFAULT NULL::text, p_preferred_delivery_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_delivery_slot text DEFAULT NULL::text, p_coupon_code text DEFAULT NULL::text)
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

-- Repair existing zero-priced variant line items from the variant's real price,
-- then recompute the affected orders' subtotal/total.
UPDATE public.order_items oi
SET price_at_purchase = COALESCE(NULLIF(pv.sale_price, 0), NULLIF(pv.base_price, 0), pv.price)
FROM public.product_variants pv
WHERE pv.id = oi.variant_id
  AND COALESCE(oi.price_at_purchase, 0) = 0
  AND COALESCE(NULLIF(pv.sale_price, 0), NULLIF(pv.base_price, 0), pv.price) > 0;

UPDATE public.orders o
SET subtotal   = s.sub,
    total      = s.sub - COALESCE(o.discount_amount, 0) + COALESCE(o.vat_amount, 0) + COALESCE(o.delivery_fee, 0),
    updated_at = now()
FROM (
    SELECT order_id, SUM(price_at_purchase * quantity) AS sub
    FROM public.order_items GROUP BY order_id
) s
WHERE s.order_id = o.id
  AND COALESCE(o.subtotal, 0) = 0
  AND s.sub > 0;
