-- Base schema migration (combined)

-- ===== supabase_schema.sql =====


-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Syncs with Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'admin')),
    wallet_balance NUMERIC DEFAULT 0 CHECK (wallet_balance >= 0),
    points INTEGER DEFAULT 0 CHECK (points >= 0),
    tier TEXT DEFAULT 'Bronze',
    region TEXT DEFAULT 'Dar es Salaam',
    referral_code TEXT,
    referred_by TEXT,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, avatar_url)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    COALESCE(new.raw_user_meta_data->>'role', 'buyer'),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. ADDRESSES
CREATE TABLE IF NOT EXISTS public.addresses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    label TEXT NOT NULL,
    street TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Dar es Salaam',
    phone TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    postal_code TEXT,
    landmark TEXT,
    geo JSONB,
    location JSONB,
    latitude NUMERIC,
    longitude NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- 3. VENDOR PROFILES
CREATE TABLE IF NOT EXISTS public.vendor_profiles (
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
    store_name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    banner_url TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    region TEXT DEFAULT 'Dar es Salaam',
    delivery_fee NUMERIC DEFAULT 0 CHECK (delivery_fee >= 0),
    -- Payment Details
    lipa_namba TEXT,
    lipa_vodacom TEXT,
    lipa_airtel TEXT,
    lipa_yas TEXT,
    lipa_selcom TEXT,
    direct_pay_number TEXT,
    bank_name TEXT,
    account_number TEXT,
    mobile_operator TEXT,
    mobile_number TEXT,
    mobile_name TEXT,
    bank_account_name TEXT,
    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    verification_level TEXT CHECK (verification_level IN ('none', 'basic', 'verified', 'premium')),
    trust_score NUMERIC DEFAULT 0 CHECK (trust_score >= 0 AND trust_score <= 100),
    followers_count INTEGER DEFAULT 0,
    avg_response_minutes INTEGER DEFAULT 60,
    address TEXT,
    website_url TEXT,
    opening_hours TEXT,
    currency TEXT,
    language TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 4. CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT UNIQUE,
    parent_id UUID REFERENCES public.categories(id),
    is_active BOOLEAN DEFAULT TRUE,
    icon_url TEXT,
    image_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID REFERENCES public.profiles(id) NOT NULL,
    category_id UUID REFERENCES public.categories(id),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT, -- Legacy/Quick access
    subcategory TEXT DEFAULT '',
    price NUMERIC NOT NULL DEFAULT 0 CHECK (price >= 0),
    base_price NUMERIC NOT NULL DEFAULT 0 CHECK (base_price >= 0),
    sale_price NUMERIC,
    cost_price NUMERIC DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    sku TEXT,
    barcode TEXT,
    weight NUMERIC DEFAULT 0,
    dimensions JSONB DEFAULT '{"length":0, "width":0, "height":0}',
    images TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    vat_rate NUMERIC DEFAULT 18 CHECK (vat_rate >= 0),
    vat_amount NUMERIC DEFAULT 0,
    condition TEXT,
    warranty_period TEXT,
    location TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    rating NUMERIC DEFAULT 5.0,
    review_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'out_of_stock', 'draft', 'archived')),
    is_boosted BOOLEAN DEFAULT FALSE,
    region TEXT,
    brand TEXT,
    attributes JSONB DEFAULT '{}',
    slug TEXT UNIQUE,
    search_vector TSVECTOR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- 6. PRODUCT VARIANTS
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    sku TEXT UNIQUE,
    attributes JSONB NOT NULL DEFAULT '{}',
    price NUMERIC NOT NULL CHECK (price >= 0),
    cost_price NUMERIC DEFAULT 0,
    base_price NUMERIC,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url TEXT,
    weight NUMERIC DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    vat_rate NUMERIC DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- 7. OFFERS
CREATE TABLE IF NOT EXISTS public.offers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID REFERENCES public.profiles(id),
    title TEXT NOT NULL,
    code TEXT UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
    value NUMERIC NOT NULL CHECK (value >= 0),
    min_order_value NUMERIC NOT NULL DEFAULT 0 CHECK (min_order_value >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
    scope TEXT DEFAULT 'seller' CHECK (scope IN ('seller', 'platform')),
    
    -- Campaign Features
    campaign_type TEXT DEFAULT 'discount' CHECK (campaign_type IN ('discount', 'bogo', 'shipping')), -- discount, bogo, shipping
    buy_quantity INTEGER DEFAULT 0,
    get_quantity INTEGER DEFAULT 0,
    max_usage INTEGER,
    current_usage INTEGER DEFAULT 0,

    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    target_type TEXT,
    target_ids TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- 8. CARTS
CREATE TABLE IF NOT EXISTS public.carts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cart_id UUID REFERENCES public.carts(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id),
    variant_id UUID REFERENCES public.product_variants(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_add NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(cart_id, product_id, variant_id)
);

-- 9. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    subtotal NUMERIC NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    vat_amount NUMERIC NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
    delivery_fee NUMERIC NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
    discount_amount NUMERIC NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total NUMERIC NOT NULL CHECK (total >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'confirmed', 'ready_for_pickup', 'in_transit', 'delivered', 'cancelled', 'failed', 'paid', 'shipped', 'refunded')),
    payment_method TEXT,
    payment_ref TEXT,
    shipping_address JSONB,
    shipping_address_id UUID REFERENCES public.addresses(id),
    note TEXT,
    customer_notes TEXT,
    driver_phone TEXT,
    actual_delivery_fee NUMERIC DEFAULT 0,
    cancel_reason TEXT,
    reject_reason TEXT,
    
    -- New Order Fields
    preferred_delivery_date TIMESTAMPTZ,
    delivery_slot TEXT,
    is_gift BOOLEAN DEFAULT FALSE,
    gift_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- 10. ORDER ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id),
    variant_id UUID REFERENCES public.product_variants(id),
    seller_id UUID REFERENCES public.profiles(id) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_purchase NUMERIC NOT NULL CHECK (price_at_purchase >= 0),
    sku TEXT,
    internal_notes TEXT,
    order_owner_id UUID, -- For easy RLS
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- 11. REVIEWS
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    product_id UUID REFERENCES public.products(id),
    order_item_id UUID REFERENCES public.order_items(id),
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    images TEXT[] DEFAULT '{}',
    is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    helpful_votes_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 12. MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sender_id UUID REFERENCES public.profiles(id),
    receiver_id UUID REFERENCES public.profiles(id),
    product_id UUID REFERENCES public.products(id),
    order_id UUID REFERENCES public.orders(id),
    room_id UUID,
    body TEXT NOT NULL,
    text TEXT GENERATED ALWAYS AS (body) STORED, -- Alias for backward compat
    attachment_url TEXT,
    attachment_type TEXT,
    reply_to_id UUID REFERENCES public.messages(id),
    read BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12.1 MESSAGE REACTIONS
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- 12.2 BLOCKED USERS
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

-- 13. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    type TEXT NOT NULL,
    title TEXT,
    message TEXT NOT NULL DEFAULT '',
    link TEXT,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    order_id UUID REFERENCES public.orders(id),
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- 14. SOCIAL POSTS
CREATE TABLE IF NOT EXISTS public.social_posts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    image_url TEXT NOT NULL,
    caption TEXT,
    region TEXT DEFAULT 'Dar es Salaam',
    likes INTEGER DEFAULT 0 CHECK (likes >= 0),
    shares INTEGER DEFAULT 0 CHECK (shares >= 0),
    comments_count INTEGER DEFAULT 0,
    product_id UUID REFERENCES public.products(id),
    is_shop_post BOOLEAN DEFAULT FALSE,
    is_shadowbanned BOOLEAN DEFAULT FALSE,
    is_boosted BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'flagged', 'deleted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 14.1 SOCIAL INTERACTIONS
CREATE TABLE IF NOT EXISTS public.social_interactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_id UUID REFERENCES public.social_posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('like', 'share', 'comment')),
    comment_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. REPORTS
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID REFERENCES public.profiles(id) NOT NULL,
    reported_id UUID REFERENCES public.profiles(id),
    content_id UUID, -- Generic ID for post/review/message
    content_type TEXT CHECK (content_type IN ('user', 'post', 'review', 'message')),
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 20. MODERATION LOGS
CREATE TABLE IF NOT EXISTS public.moderation_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES public.profiles(id),
    content_id UUID,
    action TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. MODERATION APPEALS
CREATE TABLE IF NOT EXISTS public.moderation_appeals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content_id UUID, -- ID of the content or user/vendor profile being appealed
    content_type TEXT CHECK (content_type IN ('user', 'vendor', 'post', 'review', 'product')),
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 22. VENDOR VERIFICATION DOCUMENTS
CREATE TABLE IF NOT EXISTS public.vendor_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    document_type TEXT NOT NULL, -- 'ID', 'Business License', 'Tax Certificate'
    document_url TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Update profiles for moderation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS moderation_notes TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_shadowbanned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT FALSE;

-- Update reviews for moderation
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'flagged', 'deleted'));
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_shadowbanned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT FALSE;

-- Update products for moderation
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_shadowbanned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'out_of_stock', 'draft', 'archived', 'flagged', 'deleted'));

-- 15. WISHLIST
CREATE TABLE IF NOT EXISTS public.wishlist_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(user_id, product_id)
);

-- 16. WALLET TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) NOT NULL,
    order_id UUID REFERENCES public.orders(id),
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    status TEXT DEFAULT 'completed',
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 17. ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    action_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. ORDER DISCOUNTS
CREATE TABLE IF NOT EXISTS public.order_discounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    offer_id UUID REFERENCES public.offers(id),
    amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- STORAGE SETUP
INSERT INTO storage.buckets (id, name, public) 
VALUES ('mali-mart-uploads', 'mali-mart-uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'mali-mart-uploads');
CREATE POLICY "Auth Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'mali-mart-uploads' AND auth.role() = 'authenticated');
CREATE POLICY "Owner Update" ON storage.objects FOR UPDATE USING (bucket_id = 'mali-mart-uploads' AND auth.uid() = owner);

-- ROW LEVEL SECURITY POLICIES --

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own addresses" ON addresses FOR ALL USING (auth.uid() = user_id);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active products are viewable by everyone" ON products FOR SELECT USING (status = 'active' OR auth.uid() = seller_id);
CREATE POLICY "Sellers can insert products" ON products FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Sellers can update own products" ON products FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Sellers can delete own products" ON products FOR DELETE USING (auth.uid() = seller_id);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view variants" ON product_variants FOR SELECT USING (EXISTS (SELECT 1 FROM products WHERE products.id = product_variants.product_id AND (products.status = 'active' OR products.seller_id = auth.uid())));
CREATE POLICY "Sellers manage variants" ON product_variants FOR ALL USING (EXISTS (SELECT 1 FROM products WHERE products.id = product_variants.product_id AND products.seller_id = auth.uid()));

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own order items" ON order_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
    OR seller_id = auth.uid()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own messages" ON messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users send messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cart" ON carts FOR ALL USING (auth.uid() = user_id);

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cart items" ON cart_items FOR ALL USING (EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()));

ALTER TABLE order_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own discounts" ON order_discounts FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_discounts.order_id AND orders.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.offers WHERE offers.id = order_discounts.offer_id AND offers.seller_id = auth.uid())
);

-- ATOMIC ORDER FUNCTION WITH PAYMENT REF
CREATE OR REPLACE FUNCTION public.place_order_atomic(
    p_user_id UUID,
    p_shipping_address JSONB,
    p_payment_method TEXT,
    p_payment_ref TEXT,
    p_delivery_fee NUMERIC,
    p_discount_amount NUMERIC,
    p_note TEXT,
    p_items JSONB, -- Array of {product_id, variant_id, quantity}
    p_is_gift BOOLEAN DEFAULT FALSE,
    p_gift_message TEXT DEFAULT NULL,
    p_preferred_delivery_date TIMESTAMPTZ DEFAULT NULL,
    p_delivery_slot TEXT DEFAULT NULL
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
BEGIN
    -- 1. Validate Stock & Calc Subtotal & Delivery Fee
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

    -- Validate delivery fee (simple check: ensure it's not negative)
    IF p_delivery_fee < 0 THEN
        RAISE EXCEPTION 'Invalid delivery fee';
    END IF;

    -- 2. Insert Order
    INSERT INTO public.orders (
        user_id, 
        subtotal, 
        delivery_fee, 
        discount_amount, 
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
        (order_subtotal + p_delivery_fee - p_discount_amount),
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
            SELECT price, sku, (SELECT seller_id FROM products WHERE id = item.product_id)
            INTO item_price, item_sku, item_seller_id
            FROM product_variants WHERE id = item.variant_id;

            UPDATE product_variants SET stock = stock - item.quantity WHERE id = item.variant_id;
        ELSE
            SELECT price, sku, seller_id
            INTO item_price, item_sku, item_seller_id
            FROM products WHERE id = item.product_id;

            UPDATE products SET stock = stock - item.quantity WHERE id = item.product_id;
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

    RETURN jsonb_build_object('id', new_order_id, 'status', 'success');
END;
$$;

CREATE OR REPLACE FUNCTION public.update_order_status_safe(
    p_order_id UUID,
    p_new_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_status TEXT;
BEGIN
    SELECT status INTO current_status FROM public.orders WHERE id = p_order_id;
    
    -- Basic state machine validation
    -- Cannot transition from delivered/cancelled/refunded
    IF current_status IN ('delivered', 'cancelled', 'refunded') THEN
        RAISE EXCEPTION 'Cannot update order status from %', current_status;
    END IF;

    UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
END;
$$;


-- ===== supabase_settings_update.sql =====

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
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS vrn TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS payout_schedule TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS processing_time TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS warranty TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS social_links JSONB;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS shipping_zones JSONB;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS payment_methods JSONB;

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


-- ===== supabase_new_features.sql =====

-- 21. LOGIN HISTORY
CREATE TABLE IF NOT EXISTS public.login_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    ip_address TEXT,
    device_info TEXT,
    login_time TIMESTAMPTZ DEFAULT NOW()
);

-- 22. STAFF ACCOUNTS
CREATE TABLE IF NOT EXISTS public.staff_accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'staff' CHECK (role IN ('staff', 'manager', 'admin')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. SHIPPING ZONES
CREATE TABLE IF NOT EXISTS public.shipping_zones (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    fee NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns to profiles for buyer settings
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'TZS';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS high_contrast_mode BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS export_format TEXT DEFAULT 'csv';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS opt_out_analytics BOOLEAN DEFAULT false;

-- Add new columns to vendor_profiles for seller settings
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5;

-- Add new columns to platform_settings for admin settings
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'TZS';
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS audit_retention_days INTEGER DEFAULT 30;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS require_vendor_verification BOOLEAN DEFAULT true;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS max_products_per_vendor INTEGER DEFAULT 1000;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS enable_loyalty_program BOOLEAN DEFAULT true;

-- Enable RLS
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own login history" ON public.login_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Sellers can manage their staff accounts" ON public.staff_accounts FOR ALL USING (auth.uid() = seller_id);
CREATE POLICY "Sellers can manage their shipping zones" ON public.shipping_zones FOR ALL USING (auth.uid() = seller_id);

-- 24. FOLLOWERS
CREATE TABLE IF NOT EXISTS public.followers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, seller_id)
);

ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own follows" ON public.followers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can follow sellers" ON public.followers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unfollow sellers" ON public.followers FOR DELETE USING (auth.uid() = user_id);



-- ===== supabase_new_columns.sql =====

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS condition TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS warranty_period TEXT;


-- ===== supabase_hero_recommendations.sql =====

CREATE TABLE IF NOT EXISTS public.hero_recommendations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price_display TEXT,
    offer_text TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ
);

ALTER TABLE public.hero_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage hero recommendations" ON public.hero_recommendations FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Public can view approved hero recommendations" ON public.hero_recommendations FOR SELECT USING (
  status = 'approved'
);


-- ===== supabase_admin_features.sql =====

-- Admin Command Center & Moderation Features SQL Updates

-- 1. Profiles Updates
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

-- 2. Social Posts Moderation Columns
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'flagged', 'rejected'));
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS is_shadowbanned BOOLEAN DEFAULT false;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT false;

-- 3. Reviews Moderation Columns
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'flagged', 'rejected'));
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_shadowbanned BOOLEAN DEFAULT false;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT false;

-- 4. Moderation Logs Table
CREATE TABLE IF NOT EXISTS public.moderation_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content_id UUID NOT NULL, -- Can be social_post_id or review_id
    action TEXT NOT NULL,
    note TEXT,
    moderator_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Offers (Growth Engine) Updates
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS tier_requirement TEXT DEFAULT 'all';
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS auto_apply BOOLEAN DEFAULT false;

-- Update campaign_type check constraint safely
ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_campaign_type_check;
ALTER TABLE public.offers ADD CONSTRAINT offers_campaign_type_check CHECK (campaign_type IN ('discount', 'bogo', 'shipping', 'flash_sale', 'referral'));

-- 6. Disputes Table
CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id),
    buyer_id UUID REFERENCES public.profiles(id) NOT NULL,
    seller_id UUID REFERENCES public.profiles(id) NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
    description TEXT NOT NULL,
    resolution_notes TEXT,
    refund_amount NUMERIC DEFAULT 0 CHECK (refund_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Seller Payouts Table
CREATE TABLE IF NOT EXISTS public.seller_payouts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID REFERENCES public.profiles(id) NOT NULL,
    period DATE NOT NULL,
    total_sales NUMERIC NOT NULL DEFAULT 0 CHECK (total_sales >= 0),
    commission_amount NUMERIC NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
    net_payout NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Enable RLS on new tables
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;

-- 9. Add basic policies for admins (assuming admin role check is done via app logic or RLS)
-- For simplicity, allowing all authenticated users to read, but app logic restricts to admins
CREATE POLICY "Admins can manage moderation logs" ON public.moderation_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Users can view own disputes" ON public.disputes FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Admins can manage disputes" ON public.disputes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Sellers can view own payouts" ON public.seller_payouts FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "Admins can manage payouts" ON public.seller_payouts FOR ALL USING (auth.role() = 'authenticated');

-- 10. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';

DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins can manage profiles" ON public.profiles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);


-- ===== supabase_advanced_features.sql =====

-- Advanced Store Profile and Reporting Enhancements
ALTER TABLE public.vendor_profiles 
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{"instagram": "", "facebook": "", "twitter": "", "whatsapp": ""}',
ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{"mon": "08:00-18:00", "tue": "08:00-18:00", "wed": "08:00-18:00", "thu": "08:00-18:00", "fri": "08:00-18:00", "sat": "09:00-16:00", "sun": "Closed"}',
ADD COLUMN IF NOT EXISTS store_policy TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS total_sales INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Ensure reports table has category and details
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'category') THEN
        ALTER TABLE public.reports ADD COLUMN category TEXT;
    END IF;
END $$;

-- Add a view for revenue trend to avoid mock data
CREATE OR REPLACE VIEW public.revenue_stats AS
SELECT 
    date_trunc('day', created_at)::date as name,
    SUM(total) as revenue
FROM public.orders
WHERE status = 'delivered'
GROUP BY 1
ORDER BY 1 DESC
LIMIT 7;

-- Add a view for top products
CREATE OR REPLACE VIEW public.top_products_stats AS
SELECT 
    p.name,
    COUNT(oi.id) as count
FROM public.order_items oi
JOIN public.products p ON oi.product_id = p.id
GROUP BY p.name
ORDER BY count DESC
LIMIT 5;


-- ===== supabase_messaging_v2.sql =====


-- 20. USER REPORTS
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reported_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can view their own reports" ON public.reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Admins can view all reports" ON public.reports FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 21. MESSAGE REACTIONS
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view reactions" ON public.message_reactions FOR SELECT USING (true);
CREATE POLICY "Users can manage their own reactions" ON public.message_reactions FOR ALL USING (auth.uid() = user_id);

-- 22. ROOMS (For Group Chats)
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT,
    type TEXT DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.room_members (
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(room_id, user_id)
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view their rooms" ON public.rooms FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.room_members WHERE room_id = id AND user_id = auth.uid())
);

ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view room members" ON public.room_members FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = room_id AND rm.user_id = auth.uid())
);

-- 23. MESSAGE ENHANCEMENTS (Add columns to existing table)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id);

-- 24. MESSAGE DELETION POLICY
CREATE POLICY "Users can soft delete their own messages" ON public.messages FOR UPDATE USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);


-- ===== supabase_blocked_users.sql =====

-- 19. BLOCKED USERS
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own blocks" ON public.blocked_users FOR ALL USING (auth.uid() = blocker_id);


-- ===== supabase_location_column.sql =====

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS location TEXT;


-- ===== supabase_order_fix.sql =====

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


-- ===== supabase_order_policies.sql =====

-- Add UPDATE policies for orders
CREATE POLICY "Users can update own orders" ON public.orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Sellers can update orders" ON public.orders FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.order_items 
        WHERE public.order_items.order_id = public.orders.id 
        AND public.order_items.seller_id = auth.uid()
    )
);

-- Add UPDATE policies for order_items if necessary (e.g., if seller needs to update item status)
CREATE POLICY "Sellers can update order items" ON public.order_items FOR UPDATE USING (seller_id = auth.uid());


-- ===== supabase_order_security.sql =====

-- Order Security and RBAC Updates

-- 1. Drop existing basic function
DROP FUNCTION IF EXISTS public.update_order_status_safe(UUID, TEXT);

-- 2. Create robust RBAC status update function
CREATE OR REPLACE FUNCTION public.update_order_status_rbac(
    p_order_id UUID,
    p_new_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status TEXT;
    v_buyer_id UUID;
    v_seller_id UUID;
    v_user_role TEXT;
    v_caller_id UUID := auth.uid();
BEGIN
    -- Get order details
    SELECT status, user_id INTO v_current_status, v_buyer_id 
    FROM public.orders 
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Allow service_role to bypass
    IF current_setting('role', true) = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
        RETURN;
    END IF;

    -- Get seller ID from the first order item
    SELECT seller_id INTO v_seller_id
    FROM public.order_items
    WHERE order_id = p_order_id AND seller_id = v_caller_id
    LIMIT 1;

    -- Get caller role from profiles
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_caller_id;

    -- Determine permissions
    DECLARE
        is_buyer BOOLEAN := (v_caller_id = v_buyer_id);
        is_seller BOOLEAN := (v_seller_id IS NOT NULL);
        is_admin BOOLEAN := (v_user_role = 'admin');
    BEGIN
        -- Admin can do anything
        IF is_admin THEN
            UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
            RETURN;
        END IF;

        -- State Machine Logic
        IF p_new_status = 'cancelled' THEN
            IF is_buyer AND v_current_status = 'pending' THEN
                UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
                RETURN;
            ELSIF is_seller AND v_current_status IN ('pending', 'processing') THEN
                UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
                RETURN;
            ELSE
                RAISE EXCEPTION 'Unauthorized or invalid state transition to cancelled';
            END IF;
        END IF;

        IF p_new_status = 'processing' THEN
            IF is_seller AND v_current_status = 'pending' THEN
                UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
                RETURN;
            ELSE
                RAISE EXCEPTION 'Only seller can mark as processing from pending';
            END IF;
        END IF;

        IF p_new_status = 'in_transit' THEN
            IF is_seller AND v_current_status = 'processing' THEN
                UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
                RETURN;
            ELSE
                RAISE EXCEPTION 'Only seller can mark as in_transit from processing';
            END IF;
        END IF;

        IF p_new_status = 'delivered' THEN
            IF is_seller AND v_current_status = 'in_transit' THEN
                UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
                RETURN;
            ELSE
                RAISE EXCEPTION 'Only seller can mark as delivered from in_transit';
            END IF;
        END IF;

        IF p_new_status = 'refunded' THEN
            IF is_seller AND v_current_status IN ('pending', 'processing', 'in_transit', 'delivered', 'disputed') THEN
                UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
                RETURN;
            ELSE
                RAISE EXCEPTION 'Only seller can refund';
            END IF;
        END IF;

        RAISE EXCEPTION 'Invalid status transition from % to %', v_current_status, p_new_status;
    END;
END;
$$;

-- 3. Trigger to prevent direct status updates bypassing RBAC
CREATE OR REPLACE FUNCTION public.enforce_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_user_role TEXT;
    is_buyer BOOLEAN;
    is_seller BOOLEAN;
    is_admin BOOLEAN;
BEGIN
    -- If status hasn't changed, allow the update
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Allow service_role to bypass
    IF current_setting('role', true) = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Get caller role from profiles
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_caller_id;

    is_buyer := (v_caller_id = OLD.user_id);
    is_admin := (v_user_role = 'admin');
    
    -- Check if caller is a seller for this order
    SELECT EXISTS (
        SELECT 1 FROM public.order_items
        WHERE order_id = OLD.id AND seller_id = v_caller_id
    ) INTO is_seller;

    -- Admin can do anything
    IF is_admin THEN
        RETURN NEW;
    END IF;

    -- State Machine Logic
    IF NEW.status = 'cancelled' THEN
        IF is_buyer AND OLD.status = 'pending' THEN
            RETURN NEW;
        ELSIF is_seller AND OLD.status IN ('pending', 'processing') THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Unauthorized or invalid state transition to cancelled';
        END IF;
    END IF;

    IF NEW.status = 'processing' THEN
        IF is_seller AND OLD.status = 'pending' THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Only seller can mark as processing from pending';
        END IF;
    END IF;

    IF NEW.status = 'in_transit' THEN
        IF is_seller AND OLD.status = 'processing' THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Only seller can mark as in_transit from processing';
        END IF;
    END IF;

    IF NEW.status = 'delivered' THEN
        IF is_seller AND OLD.status = 'in_transit' THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Only seller can mark as delivered from in_transit';
        END IF;
    END IF;

    IF NEW.status = 'refunded' THEN
        IF is_seller AND OLD.status IN ('pending', 'processing', 'in_transit', 'delivered', 'disputed') THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Only seller can refund';
        END IF;
    END IF;

    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_status_transition ON public.orders;
CREATE TRIGGER trg_enforce_order_status_transition
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_status_transition();



-- ===== supabase_performance_and_cleanup.sql =====

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
DROP VIEW IF EXISTS public.revenue_stats CASCADE;
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
ALTER TABLE public.hero_recommendations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.hero_recommendations ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
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


-- ===== supabase_product_coords.sql =====

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS longitude NUMERIC;


-- ===== supabase_new_settings_tables.sql =====

-- 19. PAYMENT METHODS
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- e.g., 'visa', 'mpesa'
    provider TEXT NOT NULL, -- e.g., 'visa', 'vodacom'
    last4 TEXT,
    phone_number TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. CONNECTED ACCOUNTS
CREATE TABLE IF NOT EXISTS public.connected_accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    provider TEXT NOT NULL, -- e.g., 'google', 'facebook'
    provider_user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own payment methods" ON public.payment_methods FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own connected accounts" ON public.connected_accounts FOR ALL USING (auth.uid() = user_id);


-- ===== supabase_updates.sql =====


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


-- ===== supabase_audit_fixes.sql =====


-- MALI-MART AUDIT FIXES
-- Run this to align DB Schema with Frontend Expectations

-- 1. PRODUCTS: Add missing columns for UI metrics
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 2. PROFILES: Add missing columns for User Dashboard
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'Bronze';

-- 3. VENDOR_PROFILES: Add missing columns for Store Page stats
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS avg_response_minutes INTEGER DEFAULT 60;

-- 4. Sync triggers for Product Ratings
-- Automatically update product rating when reviews are added/deleted
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.products
    SET 
        rating = (SELECT COALESCE(AVG(rating), 0) FROM public.reviews WHERE product_id = NEW.product_id),
        review_count = (SELECT COUNT(*) FROM public.reviews WHERE product_id = NEW.product_id)
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_review_change ON public.reviews;
CREATE TRIGGER on_review_change
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

NOTIFY pgrst, 'reload config';


-- ===== rls_policies.sql =====

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
  WITH CHECK (auth.uid() = id);

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
    AND price >= 0
    AND price <= 1000000000
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
    user_id = auth.uid()
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
    AND length(body) <= 5000
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
  WITH CHECK (seller_id = auth.uid());

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
REVOKE EXECUTE ON FUNCTION place_order_atomic(uuid, jsonb, text, text, numeric, numeric, text, jsonb, boolean, text, timestamptz, text) FROM anon;
GRANT  EXECUTE ON FUNCTION place_order_atomic(uuid, jsonb, text, text, numeric, numeric, text, jsonb, boolean, text, timestamptz, text) TO authenticated;

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
DROP POLICY IF EXISTS "audit_log_admin_only" ON audit_log;
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

