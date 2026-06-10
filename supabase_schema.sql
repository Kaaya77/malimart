
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Syncs with Auth)
CREATE TABLE public.profiles (
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
CREATE TABLE public.addresses (
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
CREATE TABLE public.vendor_profiles (
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
CREATE TABLE public.categories (
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
CREATE TABLE public.products (
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
CREATE TABLE public.product_variants (
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
CREATE TABLE public.offers (
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
CREATE TABLE public.carts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE TABLE public.cart_items (
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
CREATE TABLE public.orders (
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
CREATE TABLE public.order_items (
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
CREATE TABLE public.reviews (
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
CREATE TABLE public.messages (
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
CREATE TABLE public.message_reactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- 12.2 BLOCKED USERS
CREATE TABLE public.blocked_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

-- 13. NOTIFICATIONS
CREATE TABLE public.notifications (
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
CREATE TABLE public.social_posts (
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
CREATE TABLE public.social_interactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_id UUID REFERENCES public.social_posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('like', 'share', 'comment')),
    comment_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. REPORTS
CREATE TABLE public.reports (
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
CREATE TABLE public.moderation_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES public.profiles(id),
    content_id UUID,
    action TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. MODERATION APPEALS
CREATE TABLE public.moderation_appeals (
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
CREATE TABLE public.vendor_documents (
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
CREATE TABLE public.wishlist_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(user_id, product_id)
);

-- 16. WALLET TRANSACTIONS
CREATE TABLE public.wallet_transactions (
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
CREATE TABLE public.activity_logs (
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
