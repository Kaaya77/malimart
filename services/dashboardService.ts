// services/dashboardService.ts
//
// Thin typed wrappers around the server-side dashboard RPCs.
// These RPCs do all aggregation in Postgres and return a single JSON blob,
// so the frontend never ships thousands of order_item rows over the wire
// just to count them in JS.
//
// Server contracts (defined in Supabase migrations
// `perf_dashboard_rpcs_step4` and `perf_realtime_and_search_step5`):
//
//   public.get_seller_dashboard(p_seller_id uuid, p_days int)  -> jsonb
//   public.get_buyer_dashboard (p_days int)                    -> jsonb
//   public.get_admin_dashboard (p_days int)                    -> jsonb
//   public.get_badge_counts    ()                              -> jsonb
//
// Each RPC enforces its own authorization (seller-or-admin / authenticated /
// admin-only) so callers never need to gate by role here.

import { supabase } from './supabaseClient';

// ────────────────────────────────────────────────────────────────────────────
// Shared types
// ────────────────────────────────────────────────────────────────────────────

export interface RevenuePoint {
    day: string;       // 'YYYY-MM-DD'
    name: string;      // short weekday e.g. 'Mon'
    revenue: number;
    orders?: number;   // only on admin gmv_series
}

export interface TopProduct {
    id: string;
    name: string;
    image: string | null;
    units: number;
    revenue: number;
}

export interface RecentOrderRow {
    id: string;
    order_id?: string;
    status: string;
    total: number;
    created_at: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Seller dashboard
// ────────────────────────────────────────────────────────────────────────────

export interface SellerDashboard {
    seller_id: string;
    vendor: {
        store_name?: string;
        trust_score?: number;
        is_verified?: boolean;
        rating?: number;
        total_sales?: number;
    };
    products: {
        total_products: number;
        active_products: number;
        low_stock_products: number;
        out_of_stock_products: number;
    };
    fulfillments: {
        total_fulfillments: number;
        pending_fulfillments: number;
        active_fulfillments: number;
        delivered_fulfillments: number;
        cancelled_fulfillments: number;
        gross_revenue: number;
        net_revenue: number;
        total_commission: number;
    };
    window: { days: number; revenue: number; orders: number };
    // Order-level summary (added in get_seller_dashboard v2 — drop-in for the
    // legacy useSellerStats fields so analytics components keep working).
    revenue: number;
    pending: number;
    aov: number;
    sales_velocity: number;
    status_distribution: Record<string, number>;
    reviews:   { total_reviews: number; avg_rating: number | null };
    followers: { total_followers: number };
    disputes:  { open_disputes: number; under_review_disputes: number };
    returns:   { total_returns: number; pending_returns: number };
    revenue_series: Array<RevenuePoint & { date: string }>;
    top_products:   TopProduct[];
    top_customers:  Array<{ id: string; name: string; count: number }>;
    recent_orders:  RecentOrderRow[];
    generated_at: string;
}

export async function getSellerDashboard(
    sellerId?: string,
    _days = 30,
): Promise<SellerDashboard | null> {
    // get_seller_dashboard_fast: O(1) snapshot read with on-demand recompute.
    // We keep the `_days` param for API stability but the snapshot's revenue
    // series is fixed to a 30-day window (the only one any UI currently uses).
    const { data, error } = await supabase.rpc('get_seller_dashboard_fast', {
        p_seller_id: sellerId ?? null,
    });
    if (error) {
        console.error('[getSellerDashboard]', error.message);
        return null;
    }
    return data as SellerDashboard;
}

// ────────────────────────────────────────────────────────────────────────────
// Buyer dashboard
// ────────────────────────────────────────────────────────────────────────────

export interface BuyerDashboard {
    user_id: string;
    orders: {
        total_orders: number;
        pending_orders: number;
        active_orders: number;
        delivered_orders: number;
        cancelled_orders: number;
        total_spend: number;
    };
    window: { days: number; spend: number; orders: number };
    wallet:  { wallet_balance: number; points: number; tier: string };
    wishlist_count: number;
    cart_count: number;
    unread_notifications: number;
    unread_messages: number;
    recent_orders: RecentOrderRow[];
    recommendations: Array<{
        id: string;
        name: string;
        image: string | null;
        base_price: number;
        sale_price: number | null;
        rating: number;
    }>;
    generated_at: string;
}

export async function getBuyerDashboard(days = 90): Promise<BuyerDashboard | null> {
    const { data, error } = await supabase.rpc('get_buyer_dashboard', { p_days: days });
    if (error) {
        console.error('[getBuyerDashboard]', error.message);
        return null;
    }
    return data as BuyerDashboard;
}

// ────────────────────────────────────────────────────────────────────────────
// Admin dashboard
// ────────────────────────────────────────────────────────────────────────────

export interface AdminDashboard {
    users:    { total_users: number; buyers: number; sellers: number; admins: number; banned_users: number; new_signups: number };
    vendors:  { total_vendors: number; verified_vendors: number; inactive_vendors: number };
    products: { total_products: number; active_products: number; new_products: number };
    orders:   { total_orders: number; new_orders: number; pending_orders: number; cancelled_orders: number; gmv_total: number; gmv_window: number };
    disputes: { open_disputes: number; under_review_disputes: number; escalated_disputes: number };
    payouts:  { pending_payouts: number; pending_payout_amount: number };
    reports:  { pending_reports: number; investigating_reports: number };
    gmv_series:  RevenuePoint[];
    top_sellers: Array<{ seller_id: string; store_name: string; revenue: number; orders: number }>;
    generated_at: string;
}

export async function getAdminDashboard(days = 30): Promise<AdminDashboard | null> {
    const { data, error } = await supabase.rpc('get_admin_dashboard', { p_days: days });
    if (error) {
        console.error('[getAdminDashboard]', error.message);
        return null;
    }
    return data as AdminDashboard;
}

// ────────────────────────────────────────────────────────────────────────────
// Header badge counts (notifications / messages / cart) — single roundtrip
// ────────────────────────────────────────────────────────────────────────────

export interface BadgeCounts {
    notifications: number;
    messages: number;
    cart: number;
}

export async function getBadgeCounts(): Promise<BadgeCounts | null> {
    const { data, error } = await supabase.rpc('get_badge_counts');
    if (error) {
        console.error('[getBadgeCounts]', error.message);
        return null;
    }
    return data as BadgeCounts;
}
