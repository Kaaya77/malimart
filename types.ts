


export interface Category {
    id: string;
    name: string;
    slug?: string;
    parent_id?: string;
    is_active?: boolean;
    icon_url?: string;
    image_url?: string;
}

export interface ProductVariant {
    id: string;
    product_id: string;
    attributes: Record<string, string>;
    base_price: number;
    sale_price?: number;
    cost_price: number;
    vat_rate: number;
    stock: number;
    sku: string;
    image_url?: string;
    is_active?: boolean;
    weight?: number;
    created_at?: string;
    updated_at?: string;
}

export interface Product {
    id: string;
    seller_id: string;
    seller_name?: string;
    name: string;
    description: string;
    category: string;
    subcategory?: string;
    price: number;
    base_price?: number;
    sale_price?: number;
    cost_price?: number;
    stock: number;
    low_stock_threshold?: number;
    images: string[];
    tags?: string[];
    rating: number;
    review_count: number;
    is_boosted?: boolean;
    is_verified?: boolean;
    brand?: string;
    badges?: string[];
    sku?: string;
    vat_rate?: number;
    condition?: string;
    warranty_period?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    status?: string;
    weight?: number;
    dimensions?: { length: number; width: number; height: number };
    variants?: ProductVariant[];
    profiles?: VendorProfile;
    created_at?: string;
    updated_at?: string;
    slug?: string;
    sort_order?: number; // Added via audit fix
}

export interface CartItem extends Product {
    quantity: number;
    selectedVariant?: ProductVariant;
    variant_id?: string;
    price_at_add?: number;
    price_at_purchase?: number;
}

export interface User {
    id: string;
    email: string;
    name: string;
    role: 'buyer' | 'seller' | 'admin';
    avatar_url?: string;
    phone?: string;
    wallet_balance?: number;
    points?: number;
    referral_code?: string; // Added via audit fix
    tier?: string; // Added via audit fix
    region?: string;
    full_name?: string;
    email_notifications?: boolean;
    sms_notifications?: boolean;
    push_notifications?: boolean;
    newsletter?: boolean;
    profile_visibility?: boolean;
    two_factor_auth?: boolean;
    language?: string;
    is_banned?: boolean;
    default_currency?: string;
    high_contrast_mode?: boolean;
    export_format?: 'csv' | 'json' | 'pdf';
    opt_out_analytics?: boolean;
    user_metadata?: any;
    // Extended profile fields (DB-backed)
    display_name?: string;
    bio?: string;
    timezone?: string;
    pronouns?: string;
    signature_emoji?: string;
    greeting_style?: string;
    cover_image_url?: string;
    theme_accent?: 'sahara' | 'ocean' | 'forest' | 'sunset' | 'royal' | 'mono';
    theme_mode?: 'light' | 'dark' | 'system';
    reduced_motion?: boolean;
    sound_effects?: boolean;
    dashboard_layout?: 'compact' | 'comfortable' | 'spacious';
    last_seen_at?: string;
}

export interface ChatMessage {
    id: string;
    sender_id: string;
    receiver_id: string;
    product_id?: string;
    text: string; // alias for body
    body?: string;
    read: boolean;
    attachment_url?: string;
    attachment_type?: string;
    deleted_at?: string;
    reply_to_id?: string;
    reply_to?: Partial<ChatMessage>;
    created_at?: string;
    sender?: { full_name: string; avatar_url: string };
    receiver?: { full_name: string; avatar_url: string };
    product?: Partial<Product>;
    order?: Partial<Order>;
    reactions?: { emoji: string; user_id: string }[];
}

export interface Notification {
    id: string;
    user_id: string;
    type: string;
    title?: string;
    message: string;
    read: boolean;
    link?: string;
    payload?: { action_link?: string, action_label?: string, image?: string };
    created_at: string;
    order_id?: string;
}

export interface Offer {
    id: string;
    seller_id?: string;
    title?: string;
    code: string;
    campaign_type?: 'discount' | 'bogo' | 'shipping';
    type: 'percentage' | 'fixed';
    value: number;
    min_order_value?: number;
    start_date?: string;
    end_date?: string;
    status: 'active' | 'inactive' | 'expired';
    scope?: 'seller' | 'platform';
    target_type?: 'store' | 'product' | 'category';
    target_ids?: string[];
    // Advanced fields
    buy_quantity?: number;
    get_quantity?: number;
    max_usage?: number;
    current_usage?: number;
    is_flash_sale?: boolean;
    is_auto_apply?: boolean;
}

export interface Address {
    id: string;
    user_id?: string;
    label: string;
    street: string;
    city: string;
    district?: string;
    postal_code: string;
    phone: string;
    landmark?: string;
    is_default: boolean;
    latitude?: number;
    longitude?: number;
    geo?: { lat: number, lng: number };
}

export type OrderStatus = 'pending' | 'placed' | 'processing' | 'confirmed' | 'paid' | 'ready_for_pickup' | 'shipped' | 'in_transit' | 'delivered' | 'cancelled' | 'refunded' | 'failed';

export interface OrderItem {
    id: string;
    product_id: string;
    quantity: number;
    price_at_purchase: number;
    variant_id?: string;
    products?: Product;
    product?: Product;
    seller_id?: string;
    sku?: string;
}

export interface Order {
    id: string;
    user_id: string;
    total: number;
    subtotal?: number;
    vat_amount?: number; // Maps to DB
    vat?: number; // Legacy alias
    delivery_fee?: number;
    discount_amount?: number; // Maps to DB
    discount?: number; // Legacy alias
    status: OrderStatus;
    created_at: string;
    items?: OrderItem[];
    shipping_address?: Address;
    payment_method?: string;
    payment_ref?: string;
    note?: string;
    is_gift?: boolean;
    gift_message?: string;
    delivery_slot?: string;
    preferred_delivery_date?: string;
    cancel_reason?: string;
    reject_reason?: string;
    /** DB check: unpaid | processing | paid | failed | refund_due | refunded */
    payment_status?: 'unpaid' | 'processing' | 'paid' | 'failed' | 'refund_due' | 'refunded';
    cancelled_by?: 'buyer' | 'seller' | 'admin' | string;
    cancelled_at?: string;
    address?: string;
    buyer?: { full_name: string; avatar_url: string; phone: string; email: string };
    seller_total?: number; // Computed
    deleted_at?: string;
}

export interface VendorProfile {
    seller_id: string;
    store_name: string;
    description?: string;
    logo_url?: string;
    banner_url?: string;
    region?: string;
    is_verified: boolean;
    trust_score?: number;
    avg_response_minutes?: number; // Added via audit fix
    delivery_fee?: number;
    mobile_number?: string;
    mobile_operator?: string;
    mobile_name?: string;
    lipa_namba?: string;
    lipa_vodacom?: string;
    lipa_airtel?: string;
    lipa_yas?: string;
    lipa_selcom?: string;
    bank_account_name?: string;
    account_number?: string;
    bank_name?: string;
    tin_number?: string;
    business_reg_no?: string;
    vrn?: string;
    payout_schedule?: string;
    return_policy?: string;
    shipping_policy?: string;
    processing_time?: string;
    warranty?: string;
    auto_reply_message?: string;
    instagram_url?: string;
    facebook_url?: string;
    custom_domain?: string;
    district?: string;
    address?: string;
    contact_phone?: string;
    contact_email?: string;
    social_links?: {platform: string, url: string}[];
    shipping_zones?: {region: string, district: string, fee: number}[];
    payment_methods?: {id: string, type: string, provider: string, accountName: string, accountNumber: string}[];
    google_analytics_id?: string;
    meta_pixel_id?: string;
    order_notifications?: boolean;
    stock_alerts?: boolean;
    message_alerts?: boolean;
    vacation_mode?: boolean;
    website_url?: string;
    opening_hours?: string;
    currency?: string;
    language?: string;
    low_stock_threshold?: number;
    verification_level?: 'basic' | 'pro' | 'elite';
    store_policy?: string;
    tags?: string[];
    total_sales?: number;
    rating?: number;
}

export interface Review {
    id: string;
    product_id: string;
    user_id: string;
    rating: number;
    comment: string;
    images?: string[];
    helpful_count?: number;
    created_at: string;
    updated_at?: string;
    user?: { id?: string; full_name: string; avatar_url?: string };
    is_verified_purchase?: boolean;
    likes?: number;
    replies?: { user_id: string; text: string; created_at: string }[];
}

export interface SocialPost {
    id: string;
    user_id?: string;
    image_url: string;
    caption?: string;
    region: string;
    likes: number;
    shares: number;
    comments_count: number;
    created_at: string;
    product_id?: string;
    is_shop_post: boolean;
    user?: { full_name: string; avatar_url: string };
}

export interface SocialInteraction {
    id: string;
    post_id: string;
    user_id: string;
    type: 'like' | 'share' | 'comment' | 'save' | 'click_product';
    comment_text?: string;
    created_at: string;
}

export interface Payment {
    id: string;
    order_id: string;
    amount: number;
    currency: string;
    method: string;
    status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded';
    transaction_id?: string;
    payment_gateway?: string;
    paid_at?: string;
    phone_used?: string;
    created_at: string;
}

export interface Dispute {
    id: string;
    order_id: string;
    buyer_id: string;
    seller_id: string;
    reason: string;
    description: string;
    status: 'open' | 'resolved' | 'closed' | 'refunded';
    created_at: string;
    updated_at?: string;
    order?: Order;
    buyer?: { full_name: string; avatar_url: string; email: string; phone: string };
}

export interface ReturnRequest {
    id: string;
    order_id: string;
    order_item_id?: string;
    seller_id: string;
    reason: string;
    status: 'requested' | 'approved' | 'rejected' | 'refunded';
    requested_at: string;
    processed_at?: string;
    refund_amount?: number;
    created_at: string;
    order?: Order;
    item?: OrderItem;
}

export interface Shipment {
    id: string;
    order_id: string;
    seller_id: string;
    tracking_number?: string;
    carrier?: string;
    status: 'pending' | 'in_transit' | 'delivered' | 'returned' | 'cancelled';
    estimated_delivery?: string;
    actual_delivery?: string;
    shipped_at?: string;
    created_at: string;
}

export interface TrustBadge {
    id: string;
    entity_type: 'seller' | 'buyer' | 'product' | 'platform';
    entity_id: string;
    badge_type: string;
    badge_name: string;
    badge_url?: string;
    issued_at: string;
    expires_at?: string;
}

export interface OrderNote {
    id: string;
    order_id: string;
    order_item_id?: string;
    seller_id?: string;
    visibility: 'seller' | 'admin' | 'internal';
    note: string;
    created_by: string;
    created_at: string;
}

export interface ActivityLog {
    id: string;
    user_id?: string;
    action_type: string;
    entity_id?: string;
    details?: string;
    metadata?: any;
    ip_address?: string;
    created_at: string;
}

export interface WalletTransaction {
    id: string;
    profile_id: string;
    amount: number;
    type: string;
    order_id?: string;
    description?: string;
    status?: string;
    created_at: string;
}

export interface Bargain {
    id: string;
    product_id: string;
    buyer_id: string;
    seller_id: string;
    initial_price: number;
    proposed_price: number;
    status: 'pending' | 'accepted' | 'rejected' | 'countered';
    messages: { sender_id: string; text: string; created_at: string }[];
    created_at: string;
    updated_at: string;
}

export interface Follower {
    id: string;
    user_id: string;
    seller_id: string;
    created_at: string;
}
