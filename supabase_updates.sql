
-- Ensure columns exist in orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vat_amount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

-- Enable RLS on offers
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Policy: Sellers can manage their own offers
DROP POLICY IF EXISTS "Sellers manage own offers" ON public.offers;
CREATE POLICY "Sellers manage own offers" ON public.offers
    FOR ALL USING (auth.uid() = seller_id);

-- Policy: Public can view active offers (for auto-apply logic)
DROP POLICY IF EXISTS "Public view active offers" ON public.offers;
CREATE POLICY "Public view active offers" ON public.offers
    FOR SELECT USING (status = 'active');

-- Atomic Order Placement Function
CREATE OR REPLACE FUNCTION public.place_order_atomic(
    p_user_id UUID,
    p_shipping_address JSONB,
    p_payment_method TEXT,
    p_payment_ref TEXT,
    p_delivery_fee NUMERIC,
    p_discount_amount NUMERIC,
    p_vat_amount NUMERIC, 
    p_note TEXT,
    p_items JSONB,
    p_is_gift BOOLEAN DEFAULT FALSE,
    p_gift_message TEXT DEFAULT NULL,
    p_preferred_delivery_date TIMESTAMPTZ DEFAULT NULL,
    p_delivery_slot TEXT DEFAULT NULL,
    p_offer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    new_order_id UUID;
    item RECORD;
    item_price NUMERIC;
    item_seller_id UUID;
    item_sku TEXT;
    order_subtotal NUMERIC := 0;
    current_stock INTEGER;
    calc_total NUMERIC;
BEGIN
    -- 1. Validate Stock & Calc Subtotal
    FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, variant_id UUID, quantity INTEGER)
    LOOP
        IF item.variant_id IS NOT NULL THEN
            SELECT price, stock, sku, (SELECT seller_id FROM products WHERE id = item.product_id)
            INTO item_price, current_stock, item_sku, item_seller_id
            FROM product_variants WHERE id = item.variant_id;
        ELSE
            SELECT price, stock, sku, seller_id
            INTO item_price, current_stock, item_sku, item_seller_id
            FROM products WHERE id = item.product_id;
        END IF;

        IF current_stock < item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for product %', item.product_id;
        END IF;

        order_subtotal := order_subtotal + (item_price * item.quantity);
    END LOOP;

    -- Calculate Total
    calc_total := order_subtotal + p_delivery_fee + p_vat_amount - p_discount_amount;

    -- 2. Insert Order
    INSERT INTO public.orders (
        user_id, 
        subtotal, 
        delivery_fee, 
        discount_amount,
        vat_amount,
        total, 
        payment_method, 
        payment_ref,
        shipping_address, 
        note, 
        status,
        is_gift,
        gift_message,
        preferred_delivery_date,
        delivery_slot
    )
    VALUES (
        p_user_id,
        order_subtotal,
        p_delivery_fee,
        p_discount_amount,
        p_vat_amount,
        calc_total,
        p_payment_method,
        p_payment_ref,
        p_shipping_address,
        p_note,
        'pending',
        p_is_gift,
        p_gift_message,
        p_preferred_delivery_date,
        p_delivery_slot
    ) RETURNING id INTO new_order_id;

    -- 3. Insert Items & Deduct Stock
    FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, variant_id UUID, quantity INTEGER)
    LOOP
        IF item.variant_id IS NOT NULL THEN
            UPDATE product_variants SET stock = stock - item.quantity WHERE id = item.variant_id RETURNING price, sku INTO item_price, item_sku;
            UPDATE products SET stock = stock - item.quantity WHERE id = item.product_id RETURNING seller_id INTO item_seller_id;
        ELSE
            UPDATE products SET stock = stock - item.quantity WHERE id = item.product_id RETURNING price, sku, seller_id INTO item_price, item_sku, item_seller_id;
        END IF;

        INSERT INTO public.order_items (
            order_id,
            product_id,
            seller_id,
            variant_id,
            quantity,
            price_at_purchase,
            sku
        ) VALUES (
            new_order_id,
            item.product_id,
            item_seller_id,
            item.variant_id,
            item.quantity,
            item_price,
            item_sku
        );
    END LOOP;

    -- 4. Apply Offer Usage (if any)
    IF p_offer_id IS NOT NULL THEN
        INSERT INTO public.order_discounts (order_id, offer_id, amount)
        VALUES (new_order_id, p_offer_id, p_discount_amount);

        UPDATE public.offers 
        SET current_usage = COALESCE(current_usage, 0) + 1 
        WHERE id = p_offer_id;
    END IF;

    RETURN jsonb_build_object('id', new_order_id, 'status', 'success');
END;
$$;

-- 1. Add new columns to vendor_profiles (Seller Settings)
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS tin_number TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS business_reg_no TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS return_policy TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS shipping_policy TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS auto_reply_message TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS custom_domain TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS google_analytics_id TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS order_notifications BOOLEAN DEFAULT true;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS stock_alerts BOOLEAN DEFAULT true;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS message_alerts BOOLEAN DEFAULT true;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS vacation_mode BOOLEAN DEFAULT false;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- 2. Add new columns to profiles (Buyer Settings)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS newsletter BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_visibility BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS two_factor_auth BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- 3. Create platform_settings table (Admin Settings)
CREATE TABLE IF NOT EXISTS platform_settings (
    id INTEGER PRIMARY KEY,
    maintenance_mode BOOLEAN DEFAULT false,
    new_signups BOOLEAN DEFAULT true,
    global_commission INTEGER DEFAULT 5,
    auto_approve_vendors BOOLEAN DEFAULT false
);

-- 4. Insert default platform settings if not exists
INSERT INTO platform_settings (id, maintenance_mode, new_signups, global_commission, auto_approve_vendors)
VALUES (1, false, true, 5, false)
ON CONFLICT (id) DO NOTHING;
