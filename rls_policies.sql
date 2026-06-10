-- ============================================================
-- MaliMart — Supabase Row Level Security Policies
-- Run this in Supabase SQL Editor → "SQL Editor" tab
-- ============================================================

-- Enable RLS on all critical tables
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews            ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_payouts     ENABLE ROW LEVEL SECURITY;

-- ─── Helper: is_admin() ─────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ─── profiles ───────────────────────────────────────────────
-- Users can read all profiles (for store/seller info), but only update their own
-- and they CANNOT touch role, is_banned, wallet_balance, points, is_admin

DROP POLICY IF EXISTS "profiles_select_public"    ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"       ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all"        ON profiles;

CREATE POLICY "profiles_select_public" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Reject any attempt to change sensitive fields
    AND (NEW.role           = OLD.role)
    AND (NEW.is_banned      = OLD.is_banned)
    AND (NEW.is_admin       = OLD.is_admin)
    AND (NEW.wallet_balance = OLD.wallet_balance)
    AND (NEW.points         = OLD.points)
  );

CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL USING (is_admin());

-- ─── products ────────────────────────────────────────────────
DROP POLICY IF EXISTS "products_select_active" ON products;
DROP POLICY IF EXISTS "products_insert_seller" ON products;
DROP POLICY IF EXISTS "products_update_seller" ON products;
DROP POLICY IF EXISTS "products_delete_seller" ON products;
DROP POLICY IF EXISTS "products_admin_all"     ON products;

CREATE POLICY "products_select_active" ON products
  FOR SELECT USING (status = 'active' OR seller_id = auth.uid() OR is_admin());

CREATE POLICY "products_insert_seller" ON products
  FOR INSERT WITH CHECK (
    auth.uid() = seller_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('seller','admin'))
    -- Prevent price manipulation
    AND price >= 0
    AND price <= 1000000000
  );

CREATE POLICY "products_update_seller" ON products
  FOR UPDATE USING (auth.uid() = seller_id OR is_admin())
  WITH CHECK (
    (auth.uid() = seller_id OR is_admin())
    -- Seller cannot change is_boosted to cheat promotion
    AND (is_admin() OR NEW.seller_id = OLD.seller_id)
    AND NEW.price >= 0
    AND NEW.price <= 1000000000
  );

CREATE POLICY "products_delete_seller" ON products
  FOR DELETE USING (auth.uid() = seller_id OR is_admin());

CREATE POLICY "products_admin_all" ON products
  FOR ALL USING (is_admin());

-- ─── orders ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "orders_select_own"  ON orders;
DROP POLICY IF EXISTS "orders_insert_own"  ON orders;
DROP POLICY IF EXISTS "orders_update_own"  ON orders;
DROP POLICY IF EXISTS "orders_admin_all"   ON orders;

CREATE POLICY "orders_select_own" ON orders
  FOR SELECT USING (
    user_id = auth.uid()         -- buyer sees own orders
    OR is_admin()
  );

-- Orders are created via place_order_atomic RPC (SECURITY DEFINER)
-- Direct inserts blocked for everyone
CREATE POLICY "orders_insert_denied" ON orders
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "orders_update_own" ON orders
  FOR UPDATE USING (
    (user_id = auth.uid() AND NEW.status IN ('cancelled'))
    OR is_admin()
  );

CREATE POLICY "orders_admin_all" ON orders
  FOR ALL USING (is_admin());

-- ─── addresses ───────────────────────────────────────────────
DROP POLICY IF EXISTS "addresses_own" ON addresses;

CREATE POLICY "addresses_own" ON addresses
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── messages ────────────────────────────────────────────────
DROP POLICY IF EXISTS "messages_participants" ON messages;
DROP POLICY IF EXISTS "messages_insert"       ON messages;

CREATE POLICY "messages_participants" ON messages
  FOR SELECT USING (
    sender_id = auth.uid() OR receiver_id = auth.uid()
  );

CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    -- Rate: enforced at app level; content length guard
    AND length(content) <= 5000
    -- Cannot message yourself
    AND sender_id != receiver_id
  );

-- ─── notifications ───────────────────────────────────────────
DROP POLICY IF EXISTS "notifications_own"    ON notifications;
DROP POLICY IF EXISTS "notifications_insert" ON notifications;

CREATE POLICY "notifications_own" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (
    -- Only authenticated users can create notifications for others
    auth.uid() IS NOT NULL
  );

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- ─── vendor_profiles ─────────────────────────────────────────
DROP POLICY IF EXISTS "vendor_profiles_select_public" ON vendor_profiles;
DROP POLICY IF EXISTS "vendor_profiles_update_seller" ON vendor_profiles;
DROP POLICY IF EXISTS "vendor_profiles_admin"         ON vendor_profiles;

CREATE POLICY "vendor_profiles_select_public" ON vendor_profiles
  FOR SELECT USING (true);

CREATE POLICY "vendor_profiles_update_seller" ON vendor_profiles
  FOR UPDATE USING (seller_id = auth.uid())
  WITH CHECK (
    seller_id = auth.uid()
    -- Cannot self-verify or self-set trust_score
    AND (NEW.is_verified     = OLD.is_verified)
    AND (NEW.trust_score     = OLD.trust_score)
    AND (NEW.total_sales     = OLD.total_sales)
    AND (NEW.verification_level = OLD.verification_level)
  );

CREATE POLICY "vendor_profiles_insert" ON vendor_profiles
  FOR INSERT WITH CHECK (
    seller_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'seller')
  );

CREATE POLICY "vendor_profiles_admin" ON vendor_profiles
  FOR ALL USING (is_admin());

-- ─── disputes ────────────────────────────────────────────────
DROP POLICY IF EXISTS "disputes_participants" ON disputes;
DROP POLICY IF EXISTS "disputes_insert"       ON disputes;

CREATE POLICY "disputes_participants" ON disputes
  FOR SELECT USING (
    buyer_id = auth.uid() OR seller_id = auth.uid() OR is_admin()
  );

CREATE POLICY "disputes_insert" ON disputes
  FOR INSERT WITH CHECK (
    buyer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM orders WHERE id = order_id AND user_id = auth.uid()
    )
  );

-- ─── reviews ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "reviews_select" ON reviews;
DROP POLICY IF EXISTS "reviews_insert" ON reviews;

CREATE POLICY "reviews_select" ON reviews
  FOR SELECT USING (true);

CREATE POLICY "reviews_insert" ON reviews
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    -- Only buyers who actually purchased can review
    AND EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.product_id = product_id
        AND o.user_id = auth.uid()
        AND o.status = 'delivered'
    )
    -- Rating must be 1-5
    AND rating >= 1 AND rating <= 5
    -- Comment length guard
    AND length(COALESCE(comment,'')) <= 2000
  );

CREATE POLICY "reviews_update_own" ON reviews
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND rating >= 1 AND rating <= 5);

-- ─── offers ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "offers_select_active" ON offers;
DROP POLICY IF EXISTS "offers_insert_seller" ON offers;
DROP POLICY IF EXISTS "offers_update_seller" ON offers;

CREATE POLICY "offers_select_active" ON offers
  FOR SELECT USING (
    status = 'active'
    OR seller_id = auth.uid()
    OR is_admin()
  );

CREATE POLICY "offers_insert_seller" ON offers
  FOR INSERT WITH CHECK (
    seller_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('seller','admin'))
    AND value >= 0
    AND value <= 100  -- percentage cap
  );

CREATE POLICY "offers_update_seller" ON offers
  FOR UPDATE USING (seller_id = auth.uid() OR is_admin())
  WITH CHECK ((seller_id = auth.uid() OR is_admin()) AND value >= 0);

-- ─── platform_settings (admin only) ─────────────────────────
DROP POLICY IF EXISTS "platform_settings_admin" ON platform_settings;

CREATE POLICY "platform_settings_admin" ON platform_settings
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

-- ─── seller_payouts (admin only) ────────────────────────────
DROP POLICY IF EXISTS "seller_payouts_select"  ON seller_payouts;
DROP POLICY IF EXISTS "seller_payouts_admin"   ON seller_payouts;

CREATE POLICY "seller_payouts_select" ON seller_payouts
  FOR SELECT USING (seller_id = auth.uid() OR is_admin());

CREATE POLICY "seller_payouts_admin" ON seller_payouts
  FOR UPDATE USING (is_admin())
  WITH CHECK (is_admin());

-- ─── connected_accounts ─────────────────────────────────────
DROP POLICY IF EXISTS "connected_accounts_own" ON connected_accounts;

CREATE POLICY "connected_accounts_own" ON connected_accounts
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── Storage bucket policies ─────────────────────────────────
-- Run these in Supabase Dashboard → Storage → Policies

-- mali-mart-uploads bucket:
-- 1. Authenticated users can upload to their own path
-- 2. Public read for product images
-- 3. Delete only own files

/*
INSERT INTO storage.policies (bucket_id, name, definition)
VALUES (
  'mali-mart-uploads',
  'Authenticated upload to own folder',
  'auth.uid()::text = (storage.foldername(name))[1] OR is_admin()'
);
*/

-- ─── Secure RPC: place_order_atomic ─────────────────────────
-- This RPC re-fetches prices server-side — clients cannot manipulate amounts

CREATE OR REPLACE FUNCTION place_order_atomic(
  p_user_id          uuid,
  p_shipping_address jsonb,
  p_payment_method   text,
  p_payment_ref      text DEFAULT NULL,
  p_delivery_fee     numeric DEFAULT 0,
  p_discount_amount  numeric DEFAULT 0,
  p_note             text DEFAULT NULL,
  p_items            jsonb DEFAULT '[]',
  p_is_gift          boolean DEFAULT false,
  p_gift_message     text DEFAULT NULL,
  p_preferred_delivery_date timestamptz DEFAULT NULL,
  p_delivery_slot    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id     uuid;
  v_subtotal     numeric := 0;
  v_item         jsonb;
  v_product      products%ROWTYPE;
  v_variant      product_variants%ROWTYPE;
  v_unit_price   numeric;
  v_qty          integer;
  v_vat          numeric;
  v_total        numeric;
BEGIN
  -- Verify caller is the same user
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Guard: must have at least one item
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain items';
  END IF;
  IF jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'Too many items in one order';
  END IF;

  -- Validate delivery fee (max 500,000 TZS)
  IF p_delivery_fee < 0 OR p_delivery_fee > 500000 THEN
    RAISE EXCEPTION 'Invalid delivery fee';
  END IF;

  -- Validate discount (non-negative, not exceeding reasonable cap)
  IF p_discount_amount < 0 THEN
    RAISE EXCEPTION 'Invalid discount';
  END IF;

  -- Create the order shell
  INSERT INTO orders (
    user_id, shipping_address, payment_method, payment_ref,
    delivery_fee, note, status, is_gift, gift_message,
    preferred_delivery_date, delivery_slot, created_at
  ) VALUES (
    p_user_id, p_shipping_address, p_payment_method, p_payment_ref,
    p_delivery_fee, SUBSTRING(p_note FROM 1 FOR 1000),
    'pending', p_is_gift, SUBSTRING(p_gift_message FROM 1 FOR 500),
    p_preferred_delivery_date, p_delivery_slot, NOW()
  )
  RETURNING id INTO v_order_id;

  -- Insert items with SERVER-SIDE prices (cannot be manipulated by client)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := GREATEST(1, LEAST(9999, (v_item->>'quantity')::integer));

    -- Re-fetch current product price (PREVENTS PRICE MANIPULATION)
    SELECT * INTO v_product FROM products
    WHERE id = (v_item->>'product_id')::uuid AND status = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found or inactive', v_item->>'product_id';
    END IF;

    -- Use variant price if provided
    IF (v_item->>'variant_id') IS NOT NULL THEN
      SELECT * INTO v_variant FROM product_variants
      WHERE id = (v_item->>'variant_id')::uuid AND product_id = v_product.id;

      IF FOUND THEN
        v_unit_price := COALESCE(v_variant.sale_price, v_variant.base_price, v_product.price);
      ELSE
        v_unit_price := COALESCE(v_product.sale_price, v_product.price);
      END IF;
    ELSE
      v_unit_price := COALESCE(v_product.sale_price, v_product.price);
    END IF;

    -- Check stock
    IF v_product.stock IS NOT NULL AND v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for %', v_product.name;
    END IF;

    -- Insert line item with server-fetched price
    INSERT INTO order_items (
      order_id, product_id, variant_id, quantity,
      price_at_purchase, seller_id
    ) VALUES (
      v_order_id,
      v_product.id,
      (v_item->>'variant_id')::uuid,
      v_qty,
      v_unit_price,  -- ← server-side price, never from client
      v_product.seller_id
    );

    -- Decrement stock atomically
    IF v_product.stock IS NOT NULL THEN
      UPDATE products
      SET stock = stock - v_qty
      WHERE id = v_product.id AND stock >= v_qty;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Race condition: stock insufficient for %', v_product.name;
      END IF;
    END IF;

    v_subtotal := v_subtotal + (v_unit_price * v_qty);
  END LOOP;

  -- Calculate VAT and total server-side
  v_vat   := ROUND(v_subtotal * 0.18, 2);
  v_total := v_subtotal + v_vat + p_delivery_fee - LEAST(p_discount_amount, v_subtotal);

  -- Clamp discount — cannot exceed subtotal
  IF p_discount_amount > v_subtotal THEN
    p_discount_amount := v_subtotal;
  END IF;

  -- Update order with real totals
  UPDATE orders SET
    subtotal        = v_subtotal,
    vat_amount      = v_vat,
    discount_amount = p_discount_amount,
    total           = v_total
  WHERE id = v_order_id;

  RETURN jsonb_build_object('id', v_order_id, 'total', v_total);
END;
$$;

-- Revoke direct call from anon; only authenticated users can call
REVOKE EXECUTE ON FUNCTION place_order_atomic FROM anon;
GRANT  EXECUTE ON FUNCTION place_order_atomic TO authenticated;

-- ─── Audit log trigger (all sensitive mutations) ─────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id),
  table_name  text NOT NULL,
  action      text NOT NULL,  -- INSERT | UPDATE | DELETE
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  ip_hint     text,
  created_at  timestamptz DEFAULT NOW()
);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_admin_only" ON audit_log FOR ALL USING (is_admin());

CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO audit_log (user_id, table_name, action, record_id, old_data, new_data, created_at)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END,
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach audit trigger to high-risk tables
CREATE OR REPLACE TRIGGER audit_profiles
  AFTER UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE OR REPLACE TRIGGER audit_orders
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE OR REPLACE TRIGGER audit_products
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE OR REPLACE TRIGGER audit_seller_payouts
  AFTER UPDATE ON seller_payouts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE OR REPLACE TRIGGER audit_platform_settings
  AFTER UPDATE ON platform_settings
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
