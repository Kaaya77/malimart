-- ============================================================
-- MaliMart Order System Fix
-- Fixes: placeOrder flow, seller order visibility, status RPC,
--        RLS policies, realtime notifications, and data shapes
-- ============================================================

-- 1. Ensure update_order_status_rbac exists (sellers & admins only)
CREATE OR REPLACE FUNCTION public.update_order_status_rbac(
    p_order_id UUID,
    p_new_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_seller BOOLEAN;
    v_is_admin BOOLEAN;
    v_order_exists BOOLEAN;
BEGIN
    -- Check caller role
    SELECT role = 'admin' INTO v_is_admin FROM profiles WHERE id = v_caller_id;
    
    -- Check if caller is a seller on this order
    SELECT EXISTS(
        SELECT 1 FROM order_items 
        WHERE order_id = p_order_id AND seller_id = v_caller_id
    ) INTO v_is_seller;

    -- Validate order exists
    SELECT EXISTS(SELECT 1 FROM orders WHERE id = p_order_id) INTO v_order_exists;
    IF NOT v_order_exists THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Only sellers on this order or admins can update status
    IF NOT (v_is_seller OR v_is_admin) THEN
        RAISE EXCEPTION 'Unauthorized: only seller or admin can update order status';
    END IF;

    -- Validate allowed status transitions
    IF p_new_status NOT IN ('pending', 'processing', 'in_transit', 'shipped', 'delivered', 'cancelled', 'disputed', 'refunded') THEN
        RAISE EXCEPTION 'Invalid status: %', p_new_status;
    END IF;

    UPDATE orders 
    SET status = p_new_status, updated_at = NOW()
    WHERE id = p_order_id;
END;
$$;

-- 2. Fix place_order_atomic to return full order data including address
CREATE OR REPLACE FUNCTION public.place_order_atomic(
    p_user_id UUID,
    p_shipping_address JSONB,
    p_payment_method TEXT,
    p_payment_ref TEXT,
    p_delivery_fee NUMERIC,
    p_discount_amount NUMERIC,
    p_note TEXT,
    p_items JSONB,
    p_is_gift BOOLEAN DEFAULT FALSE,
    p_gift_message TEXT DEFAULT NULL,
    p_preferred_delivery_date TIMESTAMPTZ DEFAULT NULL,
    p_delivery_slot TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_order_id UUID;
    item RECORD;
    item_price NUMERIC;
    item_seller_id UUID;
    item_sku TEXT;
    order_subtotal NUMERIC := 0;
    current_stock INTEGER;
BEGIN
    -- Validate caller is the buyer
    IF auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Validate items not empty
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must have at least one item';
    END IF;

    -- 1. Validate stock & calculate subtotal
    FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, variant_id UUID, quantity INTEGER)
    LOOP
        IF item.quantity <= 0 OR item.quantity > 9999 THEN
            RAISE EXCEPTION 'Invalid quantity for product %', item.product_id;
        END IF;

        IF item.variant_id IS NOT NULL THEN
            SELECT pv.price, pv.stock, pv.sku, p.seller_id
            INTO item_price, current_stock, item_sku, item_seller_id
            FROM product_variants pv
            JOIN products p ON p.id = item.product_id
            WHERE pv.id = item.variant_id AND pv.product_id = item.product_id;
        ELSE
            SELECT price, stock, sku, seller_id
            INTO item_price, current_stock, item_sku, item_seller_id
            FROM products WHERE id = item.product_id;
        END IF;

        IF item_price IS NULL THEN
            RAISE EXCEPTION 'Product not found: %', item.product_id;
        END IF;

        IF current_stock < item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for product %', item.product_id;
        END IF;

        order_subtotal := order_subtotal + (item_price * item.quantity);
    END LOOP;

    IF p_delivery_fee < 0 THEN
        RAISE EXCEPTION 'Invalid delivery fee';
    END IF;

    -- 2. Insert order
    INSERT INTO public.orders (
        user_id, subtotal, delivery_fee, discount_amount, total,
        payment_method, payment_ref, shipping_address, note, status,
        is_gift, gift_message, preferred_delivery_date, delivery_slot,
        created_at, updated_at
    )
    VALUES (
        p_user_id,
        order_subtotal,
        p_delivery_fee,
        COALESCE(p_discount_amount, 0),
        (order_subtotal + p_delivery_fee - COALESCE(p_discount_amount, 0)),
        p_payment_method,
        p_payment_ref,
        p_shipping_address,
        p_note,
        'pending',
        p_is_gift,
        p_gift_message,
        p_preferred_delivery_date,
        p_delivery_slot,
        NOW(),
        NOW()
    )
    RETURNING id INTO new_order_id;

    -- 3. Insert order items & decrement stock atomically
    FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, variant_id UUID, quantity INTEGER)
    LOOP
        IF item.variant_id IS NOT NULL THEN
            SELECT pv.price, pv.sku, p.seller_id
            INTO item_price, item_sku, item_seller_id
            FROM product_variants pv
            JOIN products p ON p.id = item.product_id
            WHERE pv.id = item.variant_id;

            UPDATE product_variants SET stock = stock - item.quantity WHERE id = item.variant_id;
        ELSE
            SELECT price, sku, seller_id
            INTO item_price, item_sku, item_seller_id
            FROM products WHERE id = item.product_id;

            UPDATE products SET stock = stock - item.quantity WHERE id = item.product_id;
        END IF;

        INSERT INTO public.order_items (
            order_id, product_id, variant_id, seller_id,
            quantity, price_at_purchase, sku
        )
        VALUES (
            new_order_id, item.product_id, item.variant_id, item_seller_id,
            item.quantity, item_price, item_sku
        );
    END LOOP;

    -- 4. Notify sellers (one per unique seller)
    INSERT INTO public.notifications (user_id, type, title, message, read, created_at)
    SELECT DISTINCT
        oi.seller_id,
        'order',
        'New Order Received',
        'You have a new order #' || left(new_order_id::text, 8) || '. Review and confirm it.',
        false,
        NOW()
    FROM order_items oi
    WHERE oi.order_id = new_order_id;

    RETURN jsonb_build_object('id', new_order_id);
END;
$$;

-- 3. RLS: Allow sellers to read order_items where they are seller
DROP POLICY IF EXISTS "sellers_read_their_order_items" ON order_items;
CREATE POLICY "sellers_read_their_order_items" ON order_items
    FOR SELECT USING (seller_id = auth.uid());

-- 4. RLS: Allow sellers to read the parent order for their items
DROP POLICY IF EXISTS "sellers_read_orders_for_their_items" ON orders;
CREATE POLICY "sellers_read_orders_for_their_items" ON orders
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM order_items oi
            WHERE oi.order_id = orders.id AND oi.seller_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
        )
    );

-- 5. RLS: Allow sellers to update orders for their items
DROP POLICY IF EXISTS "sellers_update_their_orders" ON orders;
CREATE POLICY "sellers_update_their_orders" ON orders
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM order_items oi
            WHERE oi.order_id = orders.id AND oi.seller_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
        )
    );

-- 6. Make sure orders has updated_at column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 7. Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 8. Index for fast seller order queries
CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON order_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.place_order_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status_rbac TO authenticated;
