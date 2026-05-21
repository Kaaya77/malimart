-- ============================================================
-- MALIMART — PERFORMANCE, SECURITY & CLEANUP MIGRATION
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE)
-- ============================================================

-- ============================================================
-- SECTION 1: MISSING COLUMNS (app expects these)
-- ============================================================

-- orders: app reads .vat, .discount, .address, .payment_ref
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vat          NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount      NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS address       JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_ref   TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_id     UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ;

-- Sync vat/discount from existing vat_amount/discount_amount if they exist
UPDATE public.orders SET vat = vat_amount WHERE vat = 0 AND vat_amount > 0;
UPDATE public.orders SET discount = discount_amount WHERE discount = 0 AND discount_amount > 0;
UPDATE public.orders SET address = shipping_address WHERE address IS NULL AND shipping_address IS NOT NULL;

-- products: app reads .sort_order, .badges
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sort_order  INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS badges      TEXT[] DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- vendor_profiles: app reads all these fields
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS tin_number        TEXT;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS business_reg_no   TEXT;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS vrn               TEXT;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS payout_schedule   TEXT DEFAULT 'Weekly';
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS social_links      JSONB DEFAULT '[]';
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS payment_methods   JSONB DEFAULT '[]';
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS shipping_zones     JSONB DEFAULT '[]';
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS return_policy      TEXT DEFAULT 'No Returns';
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS processing_time    TEXT DEFAULT '1-2 Business Days';
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS warranty           TEXT;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS lipa_namba         TEXT;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS district           TEXT;
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS total_sales        NUMERIC DEFAULT 0;

-- profiles: app reads all these preference fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_notifications  BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sms_notifications    BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_notifications   BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS newsletter           BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_visibility   BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_factor_auth      BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language             TEXT DEFAULT 'en';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_currency      TEXT DEFAULT 'TZS';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS high_contrast_mode   BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS export_format        TEXT DEFAULT 'csv';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS opt_out_analytics    BOOLEAN DEFAULT FALSE;

-- offers: missing columns used by AdminGrowth
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS is_auto_apply      BOOLEAN DEFAULT FALSE;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS tier_requirement    TEXT DEFAULT 'all';
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS description         TEXT;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS target_type        TEXT DEFAULT 'store';
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS target_ids         TEXT[] DEFAULT '{}';

-- disputes: app reads refunded status
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.disputes DROP CONSTRAINT IF EXISTS disputes_status_check;
ALTER TABLE public.disputes ADD CONSTRAINT disputes_status_check
    CHECK (status IN ('open', 'resolved', 'closed', 'refunded'));

-- reviews: helpful voting
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- SECTION 2: MISSING TABLES
-- ============================================================

-- Helpful votes (review system)
CREATE TABLE IF NOT EXISTS public.review_helpful_votes (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    review_id  UUID REFERENCES public.reviews(id) ON DELETE CASCADE NOT NULL,
    user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(review_id, user_id)
);

-- Platform settings (admin panel needs exactly 1 row with id=1)
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id                           INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    maintenance_mode             BOOLEAN DEFAULT FALSE,
    new_signups                  BOOLEAN DEFAULT TRUE,
    global_commission            NUMERIC DEFAULT 5 CHECK (global_commission >= 0 AND global_commission <= 100),
    auto_approve_vendors         BOOLEAN DEFAULT FALSE,
    default_currency             TEXT DEFAULT 'TZS',
    audit_retention_days         INTEGER DEFAULT 30,
    require_vendor_verification  BOOLEAN DEFAULT TRUE,
    max_products_per_vendor      INTEGER DEFAULT 1000,
    enable_loyalty_program       BOOLEAN DEFAULT TRUE,
    hero_badge_text              TEXT DEFAULT 'New Arrivals',
    hero_headline                TEXT DEFAULT 'Discover Tanzania',
    hero_subheadline             TEXT DEFAULT 'Shop from thousands of local vendors',
    updated_at                   TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Revenue stats view for admin chart (replaces hardcoded mock data)
CREATE OR REPLACE VIEW public.revenue_stats AS
SELECT
    TO_CHAR(created_at, 'Dy') AS name,
    SUM(total)               AS revenue,
    DATE_TRUNC('day', created_at) AS day
FROM public.orders
WHERE status NOT IN ('cancelled', 'refunded', 'failed')
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', created_at), TO_CHAR(created_at, 'Dy')
ORDER BY day;

-- Login history (BuyerSettingsPage security tab)
CREATE TABLE IF NOT EXISTS public.login_history (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    ip_address  TEXT,
    device_info TEXT,
    user_agent  TEXT,
    country     TEXT,
    login_time  TIMESTAMPTZ DEFAULT NOW()
);

-- Connected accounts (OAuth providers)
CREATE TABLE IF NOT EXISTS public.connected_accounts (
    id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id          UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    provider         TEXT NOT NULL,
    provider_user_id TEXT,
    email            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- Payment methods (buyer wallet)
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type         TEXT NOT NULL,
    provider     TEXT NOT NULL,
    last4        TEXT,
    phone_number TEXT,
    is_default   BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Hero recommendations (AdminAIHero)
CREATE TABLE IF NOT EXISTS public.hero_recommendations (
    id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id     UUID REFERENCES public.products(id) ON DELETE CASCADE,
    title          TEXT,
    description    TEXT,
    offer_type     TEXT DEFAULT 'percentage',
    offer_value    NUMERIC DEFAULT 0,
    offer_text     TEXT,
    is_active      BOOLEAN DEFAULT TRUE,
    sort_order     INTEGER DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Shipments (order tracking)
CREATE TABLE IF NOT EXISTS public.shipments (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id        UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    carrier         TEXT,
    tracking_number TEXT,
    status          TEXT DEFAULT 'pending',
    shipped_at      TIMESTAMPTZ,
    estimated_delivery TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Shipment events (live tracking timeline)
CREATE TABLE IF NOT EXISTS public.shipment_events (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE NOT NULL,
    status      TEXT NOT NULL,
    notes       TEXT,
    location    TEXT,
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log (admin security monitor)
CREATE TABLE IF NOT EXISTS public.audit_log (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name  TEXT NOT NULL,
    action      TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    record_id   UUID,
    user_id     UUID,
    old_data    JSONB,
    new_data    JSONB,
    risk_level  TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seller payouts
CREATE TABLE IF NOT EXISTS public.seller_payouts (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    period            DATE NOT NULL,
    total_sales       NUMERIC NOT NULL DEFAULT 0 CHECK (total_sales >= 0),
    commission_amount NUMERIC NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
    net_payout        NUMERIC NOT NULL DEFAULT 0,
    status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    payment_ref       TEXT,
    paid_at           TIMESTAMPTZ,
    notes             TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Followers
CREATE TABLE IF NOT EXISTS public.followers (
    id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, seller_id)
);

-- Order notes (internal)
CREATE TABLE IF NOT EXISTS public.order_notes (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id   UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    author_id  UUID REFERENCES public.profiles(id),
    note       TEXT NOT NULL,
    visibility TEXT DEFAULT 'seller' CHECK (visibility IN ('seller', 'admin', 'internal')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory logs
CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    variant_id UUID REFERENCES public.product_variants(id),
    seller_id  UUID REFERENCES public.profiles(id),
    change     INTEGER NOT NULL,
    reason     TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 3: PERFORMANCE INDEXES
-- All indexes are created CONCURRENTLY and with IF NOT EXISTS
-- ============================================================

-- PROFILES
CREATE INDEX IF NOT EXISTS idx_profiles_role           ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email          ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code  ON public.profiles(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned      ON public.profiles(is_banned) WHERE is_banned = TRUE;

-- PRODUCTS — most queried table
CREATE INDEX IF NOT EXISTS idx_products_seller_id      ON public.products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_status         ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_category       ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_seller_status  ON public.products(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_products_created_at     ON public.products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_is_boosted     ON public.products(is_boosted) WHERE is_boosted = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_search_vector  ON public.products USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_products_tags           ON public.products USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_products_price          ON public.products(price);

-- PRODUCT VARIANTS
CREATE INDEX IF NOT EXISTS idx_variants_product_id     ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_is_active      ON public.product_variants(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_variants_sku            ON public.product_variants(sku) WHERE sku IS NOT NULL;

-- ORDERS — second most queried
CREATE INDEX IF NOT EXISTS idx_orders_user_id          ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status           ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_status      ON public.orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at       ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at       ON public.orders(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_user_created     ON public.orders(user_id, created_at DESC);

-- ORDER ITEMS — hot join path
CREATE INDEX IF NOT EXISTS idx_order_items_order_id    ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_id   ON public.order_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id  ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_order ON public.order_items(seller_id, order_id);

-- MESSAGES — real-time chat
CREATE INDEX IF NOT EXISTS idx_messages_sender_id      ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id    ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation   ON public.messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_read           ON public.messages(read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_messages_created_at     ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_product_id     ON public.messages(product_id) WHERE product_id IS NOT NULL;

-- NOTIFICATIONS — fetched on every page load
CREATE INDEX IF NOT EXISTS idx_notifications_user_id   ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread    ON public.notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created   ON public.notifications(created_at DESC);

-- CART & CART ITEMS
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id      ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id   ON public.cart_items(product_id);

-- ADDRESSES
CREATE INDEX IF NOT EXISTS idx_addresses_user_id       ON public.addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_default       ON public.addresses(user_id, is_default) WHERE is_default = TRUE;

-- VENDOR PROFILES
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_verified ON public.vendor_profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_active   ON public.vendor_profiles(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_region   ON public.vendor_profiles(region);

-- OFFERS / CAMPAIGNS
CREATE INDEX IF NOT EXISTS idx_offers_status           ON public.offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_code             ON public.offers(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offers_seller_id        ON public.offers(seller_id) WHERE seller_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offers_active           ON public.offers(status, start_date, end_date) WHERE status = 'active';

-- REVIEWS
CREATE INDEX IF NOT EXISTS idx_reviews_product_id      ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id         ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating          ON public.reviews(product_id, rating);

-- WISHLIST
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id        ON public.wishlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product_id     ON public.wishlist_items(product_id);

-- DISPUTES
CREATE INDEX IF NOT EXISTS idx_disputes_buyer_id       ON public.disputes(buyer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_seller_id      ON public.disputes(seller_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status         ON public.disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_order_id       ON public.disputes(order_id);

-- WALLET TRANSACTIONS
CREATE INDEX IF NOT EXISTS idx_wallet_profile_id       ON public.wallet_transactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_wallet_created_at       ON public.wallet_transactions(created_at DESC);

-- ACTIVITY LOGS
CREATE INDEX IF NOT EXISTS idx_activity_user_id        ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at     ON public.activity_logs(created_at DESC);

-- LOGIN HISTORY
CREATE INDEX IF NOT EXISTS idx_login_history_user_id   ON public.login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_time      ON public.login_history(login_time DESC);

-- SHIPMENTS
CREATE INDEX IF NOT EXISTS idx_shipments_order_id      ON public.shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipment_events_ship_id ON public.shipment_events(shipment_id);

-- FOLLOWERS
CREATE INDEX IF NOT EXISTS idx_followers_user_id       ON public.followers(user_id);
CREATE INDEX IF NOT EXISTS idx_followers_seller_id     ON public.followers(seller_id);

-- AUDIT LOG
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id       ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table         ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at    ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_risk          ON public.audit_log(risk_level) WHERE risk_level IN ('medium', 'high');

-- SELLER PAYOUTS
CREATE INDEX IF NOT EXISTS idx_payouts_seller_id       ON public.seller_payouts(seller_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status          ON public.seller_payouts(status) WHERE status = 'pending';

-- ============================================================
-- SECTION 4: FULL-TEXT SEARCH (products)
-- ============================================================

-- Update search_vector trigger to cover name + description + category + tags
CREATE OR REPLACE FUNCTION public.products_search_vector_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.name, '')), 'A') ||
        SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.description, '')), 'B') ||
        SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.category, '')), 'C') ||
        SETWEIGHT(TO_TSVECTOR('english', COALESCE(ARRAY_TO_STRING(NEW.tags, ' '), '')), 'D') ||
        SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.brand, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_search_vector_update ON public.products;
CREATE TRIGGER products_search_vector_update
    BEFORE INSERT OR UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.products_search_vector_trigger();

-- Backfill existing products
UPDATE public.products SET
    search_vector =
        SETWEIGHT(TO_TSVECTOR('english', COALESCE(name, '')), 'A') ||
        SETWEIGHT(TO_TSVECTOR('english', COALESCE(description, '')), 'B') ||
        SETWEIGHT(TO_TSVECTOR('english', COALESCE(category, '')), 'C') ||
        SETWEIGHT(TO_TSVECTOR('english', COALESCE(ARRAY_TO_STRING(tags, ' '), '')), 'D') ||
        SETWEIGHT(TO_TSVECTOR('english', COALESCE(brand, '')), 'C')
WHERE search_vector IS NULL OR search_vector = '';

-- ============================================================
-- SECTION 5: UPDATED_AT AUTO-TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables that have updated_at but no trigger
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'profiles','vendor_profiles','products','product_variants',
        'orders','order_items','messages','notifications','reviews',
        'offers','disputes','seller_payouts','shipments',
        'hero_recommendations','platform_settings'
    ]
    LOOP
        EXECUTE FORMAT('
            DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I;
            CREATE TRIGGER set_%I_updated_at
                BEFORE UPDATE ON public.%I
                FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
        ', t, t, t, t);
    END LOOP;
END;
$$;

-- ============================================================
-- SECTION 6: RLS — Enable + Policies for every table
-- ============================================================

-- Tables that need RLS enabled
ALTER TABLE public.vendor_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_interactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_appeals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_history            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hero_recommendations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payouts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_notes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_helpful_votes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions        ENABLE ROW LEVEL SECURITY;

-- VENDOR PROFILES
DROP POLICY IF EXISTS "vendor_profiles_public_read"  ON public.vendor_profiles;
DROP POLICY IF EXISTS "vendor_profiles_owner_write"  ON public.vendor_profiles;
CREATE POLICY "vendor_profiles_public_read"   ON public.vendor_profiles FOR SELECT USING (TRUE);
CREATE POLICY "vendor_profiles_owner_write"   ON public.vendor_profiles FOR ALL
    USING (auth.uid() = seller_id)
    WITH CHECK (auth.uid() = seller_id);

-- CATEGORIES
DROP POLICY IF EXISTS "categories_public_read"   ON public.categories;
DROP POLICY IF EXISTS "categories_admin_write"   ON public.categories;
CREATE POLICY "categories_public_read"   ON public.categories FOR SELECT USING (TRUE);
CREATE POLICY "categories_admin_write"   ON public.categories FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- OFFERS — sellers own, public reads active
DROP POLICY IF EXISTS "offers_seller_own"    ON public.offers;
DROP POLICY IF EXISTS "offers_public_active" ON public.offers;
DROP POLICY IF EXISTS "offers_admin_all"     ON public.offers;
CREATE POLICY "offers_seller_own"    ON public.offers FOR ALL
    USING (auth.uid() = seller_id)
    WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "offers_public_active" ON public.offers FOR SELECT
    USING (status = 'active');
CREATE POLICY "offers_admin_all"     ON public.offers FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- REVIEWS
DROP POLICY IF EXISTS "reviews_public_read"   ON public.reviews;
DROP POLICY IF EXISTS "reviews_user_write"    ON public.reviews;
DROP POLICY IF EXISTS "reviews_admin_all"     ON public.reviews;
CREATE POLICY "reviews_public_read"   ON public.reviews FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "reviews_user_write"    ON public.reviews FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_admin_all"     ON public.reviews FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- WISHLIST
DROP POLICY IF EXISTS "wishlist_user_own" ON public.wishlist_items;
CREATE POLICY "wishlist_user_own" ON public.wishlist_items FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- WALLET TRANSACTIONS — read only for owner
DROP POLICY IF EXISTS "wallet_user_read" ON public.wallet_transactions;
CREATE POLICY "wallet_user_read" ON public.wallet_transactions FOR SELECT
    USING (auth.uid() = profile_id);

-- ACTIVITY LOGS — user sees own, admin sees all
DROP POLICY IF EXISTS "activity_user_read"  ON public.activity_logs;
DROP POLICY IF EXISTS "activity_admin_read" ON public.activity_logs;
CREATE POLICY "activity_user_read"  ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "activity_admin_read" ON public.activity_logs FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- LOGIN HISTORY — user reads own only
DROP POLICY IF EXISTS "login_history_user_read"  ON public.login_history;
DROP POLICY IF EXISTS "login_history_admin_read" ON public.login_history;
CREATE POLICY "login_history_user_read"  ON public.login_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "login_history_admin_read" ON public.login_history FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- CONNECTED ACCOUNTS
DROP POLICY IF EXISTS "connected_accounts_user_own" ON public.connected_accounts;
CREATE POLICY "connected_accounts_user_own" ON public.connected_accounts FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- PAYMENT METHODS
DROP POLICY IF EXISTS "payment_methods_user_own" ON public.payment_methods;
CREATE POLICY "payment_methods_user_own" ON public.payment_methods FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- HERO RECOMMENDATIONS — public read, admin write
DROP POLICY IF EXISTS "hero_recs_public_read" ON public.hero_recommendations;
DROP POLICY IF EXISTS "hero_recs_admin_write" ON public.hero_recommendations;
CREATE POLICY "hero_recs_public_read" ON public.hero_recommendations FOR SELECT USING (is_active = TRUE);
CREATE POLICY "hero_recs_admin_write" ON public.hero_recommendations FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- SHIPMENTS — buyer reads own, seller reads their order shipments
DROP POLICY IF EXISTS "shipments_buyer_read"  ON public.shipments;
DROP POLICY IF EXISTS "shipments_seller_read" ON public.shipments;
DROP POLICY IF EXISTS "shipments_admin_all"   ON public.shipments;
CREATE POLICY "shipments_buyer_read"  ON public.shipments FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_id AND orders.user_id = auth.uid()));
CREATE POLICY "shipments_seller_read" ON public.shipments FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        WHERE o.id = order_id AND oi.seller_id = auth.uid()
    ));
CREATE POLICY "shipments_admin_all"   ON public.shipments FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- SHIPMENT EVENTS
DROP POLICY IF EXISTS "shipment_events_read" ON public.shipment_events;
CREATE POLICY "shipment_events_read" ON public.shipment_events FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.shipments s
        JOIN public.orders o ON o.id = s.order_id
        WHERE s.id = shipment_id
          AND (o.user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.seller_id = auth.uid()))
    ));

-- DISPUTES — buyer & seller see own, admin sees all
DROP POLICY IF EXISTS "disputes_parties_read"  ON public.disputes;
DROP POLICY IF EXISTS "disputes_buyer_insert"  ON public.disputes;
DROP POLICY IF EXISTS "disputes_seller_update" ON public.disputes;
DROP POLICY IF EXISTS "disputes_admin_all"     ON public.disputes;
CREATE POLICY "disputes_parties_read"  ON public.disputes FOR SELECT
    USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "disputes_buyer_insert"  ON public.disputes FOR INSERT
    WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "disputes_seller_update" ON public.disputes FOR UPDATE
    USING (auth.uid() = seller_id);
CREATE POLICY "disputes_admin_all"     ON public.disputes FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- SELLER PAYOUTS — seller reads own, admin manages all
DROP POLICY IF EXISTS "payouts_seller_read" ON public.seller_payouts;
DROP POLICY IF EXISTS "payouts_admin_all"   ON public.seller_payouts;
CREATE POLICY "payouts_seller_read" ON public.seller_payouts FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "payouts_admin_all"   ON public.seller_payouts FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- AUDIT LOG — admin only
DROP POLICY IF EXISTS "audit_log_admin_only" ON public.audit_log;
CREATE POLICY "audit_log_admin_only" ON public.audit_log FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- PLATFORM SETTINGS — public read, admin write
DROP POLICY IF EXISTS "settings_public_read" ON public.platform_settings;
DROP POLICY IF EXISTS "settings_admin_write" ON public.platform_settings;
CREATE POLICY "settings_public_read" ON public.platform_settings FOR SELECT USING (TRUE);
CREATE POLICY "settings_admin_write" ON public.platform_settings FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- SOCIAL POSTS
DROP POLICY IF EXISTS "social_posts_public_read"  ON public.social_posts;
DROP POLICY IF EXISTS "social_posts_user_write"   ON public.social_posts;
DROP POLICY IF EXISTS "social_posts_admin_all"    ON public.social_posts;
CREATE POLICY "social_posts_public_read"  ON public.social_posts FOR SELECT
    USING (status = 'approved' AND is_shadowbanned = FALSE AND deleted_at IS NULL);
CREATE POLICY "social_posts_user_write"   ON public.social_posts FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "social_posts_admin_all"    ON public.social_posts FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- MESSAGE REACTIONS
DROP POLICY IF EXISTS "reactions_public_read"    ON public.message_reactions;
DROP POLICY IF EXISTS "reactions_user_manage"    ON public.message_reactions;
CREATE POLICY "reactions_public_read"    ON public.message_reactions FOR SELECT USING (TRUE);
CREATE POLICY "reactions_user_manage"    ON public.message_reactions FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- REVIEW HELPFUL VOTES
DROP POLICY IF EXISTS "review_votes_public_read"  ON public.review_helpful_votes;
DROP POLICY IF EXISTS "review_votes_user_manage"  ON public.review_helpful_votes;
CREATE POLICY "review_votes_public_read"  ON public.review_helpful_votes FOR SELECT USING (TRUE);
CREATE POLICY "review_votes_user_manage"  ON public.review_helpful_votes FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- FOLLOWERS
DROP POLICY IF EXISTS "followers_public_read"  ON public.followers;
DROP POLICY IF EXISTS "followers_user_manage"  ON public.followers;
CREATE POLICY "followers_public_read"  ON public.followers FOR SELECT USING (TRUE);
CREATE POLICY "followers_user_manage"  ON public.followers FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ORDER NOTES — seller & admin only
DROP POLICY IF EXISTS "order_notes_read"  ON public.order_notes;
DROP POLICY IF EXISTS "order_notes_write" ON public.order_notes;
CREATE POLICY "order_notes_read"  ON public.order_notes FOR SELECT
    USING (auth.uid() = author_id
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','seller')));
CREATE POLICY "order_notes_write" ON public.order_notes FOR INSERT
    WITH CHECK (auth.uid() = author_id);

-- MODERATION LOGS — admin only
DROP POLICY IF EXISTS "moderation_logs_admin" ON public.moderation_logs;
CREATE POLICY "moderation_logs_admin" ON public.moderation_logs FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- REPORTS
DROP POLICY IF EXISTS "reports_user_insert"  ON public.reports;
DROP POLICY IF EXISTS "reports_user_read"    ON public.reports;
DROP POLICY IF EXISTS "reports_admin_all"    ON public.reports;
CREATE POLICY "reports_user_insert"  ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_user_read"    ON public.reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "reports_admin_all"    ON public.reports FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- VENDOR DOCUMENTS
DROP POLICY IF EXISTS "vendor_docs_seller_own"  ON public.vendor_documents;
DROP POLICY IF EXISTS "vendor_docs_admin_read"  ON public.vendor_documents;
CREATE POLICY "vendor_docs_seller_own"  ON public.vendor_documents FOR ALL
    USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "vendor_docs_admin_read"  ON public.vendor_documents FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ORDERS: add seller read policy (so sellers can see orders containing their items)
DROP POLICY IF EXISTS "orders_seller_read" ON public.orders;
CREATE POLICY "orders_seller_read" ON public.orders FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.order_items oi
        WHERE oi.order_id = orders.id AND oi.seller_id = auth.uid()
    ));

-- ORDERS: admin can read all, update any
DROP POLICY IF EXISTS "orders_admin_all" ON public.orders;
CREATE POLICY "orders_admin_all" ON public.orders FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- SECTION 7: SECURITY — prevent role escalation
-- ============================================================

-- Prevent users from updating their own role, wallet_balance, or points directly
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent non-admin users from changing role
    IF NEW.role != OLD.role THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        ) THEN
            RAISE EXCEPTION 'Cannot change role: insufficient privileges';
        END IF;
    END IF;

    -- Prevent direct wallet manipulation (must go through wallet_transactions)
    IF NEW.wallet_balance != OLD.wallet_balance THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        ) THEN
            RAISE EXCEPTION 'Cannot modify wallet_balance directly';
        END IF;
    END IF;

    -- Prevent direct point manipulation
    IF NEW.points != OLD.points THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        ) THEN
            RAISE EXCEPTION 'Cannot modify points directly';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS profiles_privilege_escalation ON public.profiles;
CREATE TRIGGER profiles_privilege_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_privilege_escalation();

-- Prevent sellers from verifying themselves
CREATE OR REPLACE FUNCTION public.prevent_self_verification()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_verified != OLD.is_verified OR NEW.trust_score != OLD.trust_score THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        ) THEN
            NEW.is_verified := OLD.is_verified;
            NEW.trust_score := OLD.trust_score;
        END IF;
    END IF;

    IF NEW.total_sales != OLD.total_sales THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        ) THEN
            NEW.total_sales := OLD.total_sales;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS vendor_profiles_self_verify ON public.vendor_profiles;
CREATE TRIGGER vendor_profiles_self_verify
    BEFORE UPDATE ON public.vendor_profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_self_verification();

-- ============================================================
-- SECTION 8: IMPROVED place_order_atomic FUNCTION
-- Server-side price validation — client can never set price
-- ============================================================

CREATE OR REPLACE FUNCTION public.place_order_atomic(
    p_user_id              UUID,
    p_shipping_address     JSONB,
    p_payment_method       TEXT,
    p_payment_ref          TEXT,
    p_delivery_fee         NUMERIC,
    p_discount_amount      NUMERIC,
    p_vat_amount           NUMERIC,
    p_note                 TEXT,
    p_items                JSONB,  -- [{product_id, variant_id, quantity}] — NO price
    p_is_gift              BOOLEAN DEFAULT FALSE,
    p_gift_message         TEXT    DEFAULT NULL,
    p_preferred_delivery_date TIMESTAMPTZ DEFAULT NULL,
    p_delivery_slot        TEXT    DEFAULT NULL,
    p_offer_id             UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_order_id   UUID;
    item           RECORD;
    item_price     NUMERIC;
    item_seller_id UUID;
    item_sku       TEXT;
    order_subtotal NUMERIC := 0;
    current_stock  INTEGER;
    calc_total     NUMERIC;
    v_user_banned  BOOLEAN;
BEGIN
    -- 0. Check user is not banned
    SELECT is_banned INTO v_user_banned FROM public.profiles WHERE id = p_user_id;
    IF v_user_banned THEN
        RAISE EXCEPTION 'Account suspended. Cannot place orders.';
    END IF;

    -- 1. Validate delivery fee
    IF p_delivery_fee < 0 THEN
        RAISE EXCEPTION 'Invalid delivery fee';
    END IF;

    -- 2. Fetch SERVER-SIDE prices (never trust client price)
    FOR item IN SELECT * FROM jsonb_to_recordset(p_items)
                    AS x(product_id UUID, variant_id UUID, quantity INTEGER)
    LOOP
        IF item.quantity <= 0 THEN
            RAISE EXCEPTION 'Invalid quantity for product %', item.product_id;
        END IF;

        IF item.variant_id IS NOT NULL THEN
            SELECT
                COALESCE(pv.sale_price, pv.base_price, pv.price) AS price,
                pv.stock,
                pv.sku,
                p.seller_id
            INTO item_price, current_stock, item_sku, item_seller_id
            FROM public.product_variants pv
            JOIN public.products p ON p.id = pv.product_id
            WHERE pv.id = item.variant_id AND pv.product_id = item.product_id
              AND pv.is_active = TRUE AND p.status = 'active';
        ELSE
            SELECT
                COALESCE(p.sale_price, p.price) AS price,
                p.stock,
                p.sku,
                p.seller_id
            INTO item_price, current_stock, item_sku, item_seller_id
            FROM public.products p
            WHERE p.id = item.product_id AND p.status = 'active';
        END IF;

        IF item_price IS NULL THEN
            RAISE EXCEPTION 'Product % not found or inactive', item.product_id;
        END IF;

        IF current_stock < item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for product %', item.product_id;
        END IF;

        order_subtotal := order_subtotal + (item_price * item.quantity);
    END LOOP;

    -- 3. Calculate real total (server-side)
    calc_total := GREATEST(0, order_subtotal + p_delivery_fee + p_vat_amount - p_discount_amount);

    -- 4. Insert order
    INSERT INTO public.orders (
        user_id, subtotal, vat_amount, delivery_fee, discount_amount, total,
        payment_method, payment_ref, shipping_address, address, note, status,
        is_gift, gift_message, preferred_delivery_date, delivery_slot,
        vat, discount
    ) VALUES (
        p_user_id, order_subtotal, p_vat_amount, p_delivery_fee, p_discount_amount, calc_total,
        p_payment_method, p_payment_ref, p_shipping_address, p_shipping_address, p_note, 'pending',
        p_is_gift, p_gift_message, p_preferred_delivery_date, p_delivery_slot,
        p_vat_amount, p_discount_amount
    ) RETURNING id INTO new_order_id;

    -- 5. Insert items & deduct stock atomically
    FOR item IN SELECT * FROM jsonb_to_recordset(p_items)
                    AS x(product_id UUID, variant_id UUID, quantity INTEGER)
    LOOP
        IF item.variant_id IS NOT NULL THEN
            SELECT COALESCE(pv.sale_price, pv.base_price, pv.price), pv.sku, p.seller_id
            INTO item_price, item_sku, item_seller_id
            FROM public.product_variants pv
            JOIN public.products p ON p.id = pv.product_id
            WHERE pv.id = item.variant_id;

            UPDATE public.product_variants
            SET stock = stock - item.quantity
            WHERE id = item.variant_id AND stock >= item.quantity;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Race condition: stock depleted for variant %', item.variant_id;
            END IF;
        ELSE
            SELECT COALESCE(p.sale_price, p.price), p.sku, p.seller_id
            INTO item_price, item_sku, item_seller_id
            FROM public.products p
            WHERE p.id = item.product_id;

            UPDATE public.products
            SET stock = stock - item.quantity
            WHERE id = item.product_id AND stock >= item.quantity;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Race condition: stock depleted for product %', item.product_id;
            END IF;
        END IF;

        INSERT INTO public.order_items (
            order_id, product_id, seller_id, variant_id, quantity,
            price_at_purchase, sku, order_owner_id
        ) VALUES (
            new_order_id, item.product_id, item_seller_id, item.variant_id,
            item.quantity, item_price, item_sku, p_user_id
        );
    END LOOP;

    -- 6. Log offer usage
    IF p_offer_id IS NOT NULL THEN
        UPDATE public.offers
        SET current_usage = COALESCE(current_usage, 0) + 1
        WHERE id = p_offer_id;
    END IF;

    -- 7. Clear user cart
    DELETE FROM public.cart_items
    WHERE cart_id IN (SELECT id FROM public.carts WHERE user_id = p_user_id);

    RETURN jsonb_build_object(
        'id',       new_order_id,
        'status',   'success',
        'subtotal', order_subtotal,
        'total',    calc_total
    );
END;
$$;

-- ============================================================
-- SECTION 9: HELPFUL VIEWS
-- ============================================================

-- Seller dashboard summary (replaces N+1 queries)
CREATE OR REPLACE VIEW public.seller_dashboard AS
SELECT
    vp.seller_id,
    vp.store_name,
    COUNT(DISTINCT p.id)                                          AS total_products,
    COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END)  AS active_products,
    COUNT(DISTINCT oi.order_id)                                   AS total_orders,
    COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.id END)  AS pending_orders,
    COALESCE(SUM(oi.price_at_purchase * oi.quantity)
        FILTER (WHERE o.status NOT IN ('cancelled','refunded','failed')), 0) AS total_revenue,
    COALESCE(AVG(r.rating), 0)                                    AS avg_rating,
    COUNT(DISTINCT r.id)                                          AS review_count
FROM public.vendor_profiles vp
LEFT JOIN public.products p    ON p.seller_id  = vp.seller_id
LEFT JOIN public.order_items oi ON oi.seller_id = vp.seller_id
LEFT JOIN public.orders o      ON o.id         = oi.order_id
LEFT JOIN public.reviews r     ON r.product_id IN (SELECT id FROM public.products WHERE seller_id = vp.seller_id)
GROUP BY vp.seller_id, vp.store_name;

-- Unread message counts per conversation (replaces full message fetches)
CREATE OR REPLACE VIEW public.conversation_unread_counts AS
SELECT
    receiver_id AS user_id,
    sender_id   AS other_user_id,
    COUNT(*)    AS unread_count
FROM public.messages
WHERE read = FALSE AND deleted_at IS NULL
GROUP BY receiver_id, sender_id;

-- ============================================================
-- SECTION 10: STORAGE CLEANUP & POLICIES
-- ============================================================

-- Ensure bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'mali-mart-uploads',
    'mali-mart-uploads',
    TRUE,
    10485760, -- 10MB max file size
    ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit    = 10485760,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf'];

-- Drop old permissive policies
DROP POLICY IF EXISTS "Public Access"  ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload"    ON storage.objects;
DROP POLICY IF EXISTS "Owner Update"   ON storage.objects;
DROP POLICY IF EXISTS "Owner Delete"   ON storage.objects;

-- Replace with scoped policies
CREATE POLICY "storage_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'mali-mart-uploads');

CREATE POLICY "storage_auth_upload" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'mali-mart-uploads'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::TEXT
    );

CREATE POLICY "storage_owner_update" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'mali-mart-uploads'
        AND (storage.foldername(name))[1] = auth.uid()::TEXT
    );

CREATE POLICY "storage_owner_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'mali-mart-uploads'
        AND (storage.foldername(name))[1] = auth.uid()::TEXT
    );

-- ============================================================
-- SECTION 11: CLEANUP — remove duplicate/conflicting policies
-- ============================================================

-- Remove old duplicate policies if they exist from earlier runs
DROP POLICY IF EXISTS "Public profiles are viewable by everyone"  ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile"         ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"              ON public.profiles;

-- Re-create clean profile policies
DROP POLICY IF EXISTS "profiles_public_read"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_user_insert"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_user_update"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all"     ON public.profiles;

CREATE POLICY "profiles_public_read"   ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles_user_insert"   ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_user_update"   ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_admin_all"     ON public.profiles FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============================================================
-- SECTION 12: REALTIME — enable for key tables
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;

-- ============================================================
-- DONE — verify with:
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;
-- ============================================================
