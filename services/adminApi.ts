// =====================================================================
// adminApi.ts — typed wrappers around the admin SECURITY DEFINER RPCs
// added in supabase/migrations/20260703010000_admin_ops_rpcs.sql.
// Every RPC re-checks is_admin() server-side; components/pages must call
// these — never supabase.from/rpc directly.
// =====================================================================
import { supabase } from "./supabaseClient";

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------- Moderation Hub ----------

export type ModerationTab =
  | "content" | "reports" | "users" | "vendors" | "logs" | "appeals" | "products";

export type ModerationContentType =
  | "social_post" | "review" | "product" | "report" | "user" | "vendor" | "appeal";

export interface BulkModerationResult {
  id: string;
  ok: boolean;
  error: string | null;
}

/** One read RPC per tab; returns the rows the old per-table selects returned. */
export const getModerationData = (tab: ModerationTab) =>
  rpc<any[]>("admin_get_moderation_data", { p_tab: tab });

/** Single moderation action; logs to moderation_logs server-side. */
export const moderateItem = (
  action: string,
  id: string,
  contentType?: ModerationContentType,
  note?: string
) =>
  rpc<void>("admin_moderate_item", {
    p_action: action,
    p_id: id,
    p_content_type: contentType ?? null,
    p_note: note ?? null,
  });

/** ONE atomic call for bulk actions; returns per-item results. */
export const bulkModerate = (
  action: string,
  items: { id: string; content_type?: ModerationContentType }[],
  note?: string
) =>
  rpc<BulkModerationResult[]>("admin_bulk_moderate", {
    p_action: action,
    p_items: items,
    p_note: note ?? null,
  });

// ---------- Hero section (AdminAIHero) ----------

export const listHeroRecommendations = () =>
  rpc<any[]>("admin_list_hero_recommendations");

export const updateHeroRecommendation = (
  id: string,
  patch: { title: string; description: string; offerText: string }
) =>
  rpc<void>("admin_update_hero_recommendation", {
    p_id: id,
    p_title: patch.title,
    p_description: patch.description,
    p_offer_text: patch.offerText,
  });

/** Approve also notifies the product's seller server-side. */
export const setHeroRecommendationStatus = (
  id: string,
  status: "approved" | "rejected" | "pending"
) =>
  rpc<void>("admin_set_hero_recommendation_status", { p_id: id, p_status: status });

export const deleteHeroRecommendation = (id: string) =>
  rpc<void>("admin_delete_hero_recommendation", { p_id: id });

/** Deletes every non-approved recommendation. */
export const clearHeroRecommendations = () =>
  rpc<void>("admin_clear_hero_recommendations");

export const createHeroRecommendation = (args: {
  productId: string; title: string; description: string;
  priceDisplay: string; offerText: string;
}) =>
  rpc<string>("admin_create_hero_recommendation", {
    p_product_id: args.productId,
    p_title: args.title,
    p_description: args.description,
    p_price_display: args.priceDisplay,
    p_offer_text: args.offerText,
  });

export const setProductBoost = (productId: string, boosted: boolean) =>
  rpc<void>("admin_set_product_boost", { p_product_id: productId, p_boosted: boosted });

export const listHeroProducts = () => rpc<any[]>("admin_list_hero_products");

export interface HeroSettings {
  hero_badge_text: string | null;
  hero_headline: string | null;
  hero_subheadline: string | null;
}

export const getHeroSettings = () => rpc<HeroSettings>("admin_get_hero_settings");

export const updateHeroSettings = (s: {
  badgeText: string; headline: string; subheadline: string;
}) =>
  rpc<void>("admin_update_hero_settings", {
    p_badge_text: s.badgeText,
    p_headline: s.headline,
    p_subheadline: s.subheadline,
  });

// ---------- AdminMessages lookups ----------

export const getUserProfileAsAdmin = (userId: string) =>
  rpc<Record<string, any> | null>("admin_get_user_profile", { p_user_id: userId });

export const getOrderAsAdmin = (orderId: string) =>
  rpc<Record<string, any> | null>("admin_get_order", { p_order_id: orderId });

// ---------- Disputes ----------

/**
 * Atomic dispute resolution: validates dispute/order status and updates both
 * rows in a single transaction (was two sequential client-side updates).
 */
export const resolveDispute = (
  disputeId: string,
  resolution: "refund_buyer" | "release_funds",
  notes?: string
) =>
  rpc<void>("admin_resolve_dispute", {
    p_dispute_id: disputeId,
    p_resolution: resolution,
    p_notes: notes ?? null,
  });

// =====================================================================
// Direct-table admin queries migrated out of components/pages
// (boundary refactor — behavior preserved exactly).
// These return the raw PostgREST response ({ data, error, count })
// because callers inspect it rather than expecting a throw.
// =====================================================================

/** Minimal PostgREST response shape used by the wrappers below. */
export interface DbResult<T = any> {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
}

// ---------- AdminPage dashboard reads ----------

/** get_dashboard_data RPC (raw response) — admin_stats counts in one round-trip. */
export const getDashboardData = (): Promise<DbResult<any>> =>
  supabase.rpc('get_dashboard_data') as any;

/** All vendor profiles with owner name/email, newest first. */
export const fetchAdminVendorProfiles = (): Promise<DbResult<any[]>> =>
  supabase.from('vendor_profiles')
    .select('*, profiles!seller_id(full_name, email)')
    .order('created_at', { ascending: false }) as any;

/** Open disputes with order + buyer info, newest first (max 30). */
export const fetchOpenDisputes = (): Promise<DbResult<any[]>> =>
  supabase.from('disputes')
    .select('*, order:orders!order_id(id, total, status), buyer:profiles!buyer_id(full_name, email)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(30) as any;

/** Pending seller payouts with seller name/email, newest first (max 30). */
export const fetchPendingPayouts = (): Promise<DbResult<any[]>> =>
  supabase.from('seller_payouts')
    .select('*, profiles!seller_id(full_name, email)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(30) as any;

/** Most recent 50 user profiles. */
export const fetchRecentProfiles = (): Promise<DbResult<any[]>> =>
  supabase.from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50) as any;

/** Most recent 50 products (admin columns) with seller name. */
export const fetchRecentProducts = (): Promise<DbResult<any[]>> =>
  supabase.from('products')
    .select('id, name, price, stock, status, created_at, seller_id, images, category, is_boosted, profiles!seller_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(50) as any;

/** The singleton platform_settings row (id = 1). */
export const fetchPlatformSettings = (): Promise<DbResult<any>> =>
  supabase.from('platform_settings').select('*').eq('id', 1).single() as any;

/** Paid/shipped/delivered order totals for the last 180 days, oldest first (revenue trend). */
export const fetchRevenueOrders = (): Promise<DbResult<any[]>> =>
  supabase.from('orders')
    .select('total, created_at')
    .in('status', ['paid', 'shipped', 'delivered'])
    .gte('created_at', new Date(Date.now() - 180 * 86400000).toISOString())
    .order('created_at', { ascending: true }) as any;

/** Count of unread messages addressed to the given user (head-only query). */
export const countUnreadMessages = (userId: string): Promise<DbResult<any>> =>
  supabase.from('messages').select('*', { count: 'exact', head: true })
    .eq('receiver_id', userId).eq('read', false) as any;

// ---------- AdminPage mutations ----------

/** Sets vendor_profiles.is_verified for a seller (verify / revoke / reject). */
export const setVendorVerification = (sellerId: string, isVerified: boolean): Promise<DbResult> =>
  supabase.from('vendor_profiles').update({ is_verified: isVerified }).eq('seller_id', sellerId) as any;

/** Deactivates a vendor profile (application rejection path). */
export const deactivateVendor = (sellerId: string): Promise<DbResult> =>
  supabase.from('vendor_profiles').update({ is_active: false }).eq('seller_id', sellerId) as any;

/** Marks a seller payout as paid with the current timestamp. */
export const markPayoutPaid = (payoutId: string): Promise<DbResult> =>
  supabase.from('seller_payouts').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', payoutId) as any;

/** Sets profiles.is_banned for a user. */
export const setUserBanned = (userId: string, banned: boolean): Promise<DbResult> =>
  supabase.from('profiles').update({ is_banned: banned }).eq('id', userId) as any;

/** Inserts the "Account Banned" system notification for a user. */
export const notifyUserBanned = (userId: string): Promise<DbResult> =>
  supabase.from('notifications').insert({
    user_id: userId,
    type: 'system',
    title: 'Account Banned',
    message: 'Your account has been banned due to a violation of our terms of service.'
  }) as any;

/** Soft-deletes a user: stamps deleted_at and bans the account. */
export const softDeleteUser = (userId: string): Promise<DbResult> =>
  supabase.from('profiles').update({
    deleted_at: new Date().toISOString(),
    is_banned: true
  }).eq('id', userId) as any;

/** Restores a suspended product to active and clears its takedown reason. */
export const restoreProduct = (productId: string): Promise<DbResult> =>
  supabase.from('products').update({ status: 'active', takedown_reason: null }).eq('id', productId) as any;

/** Upserts the singleton platform_settings row (id = 1). */
export const upsertPlatformSettings = (settings: Record<string, any>): Promise<DbResult> =>
  supabase.from('platform_settings').upsert({ id: 1, ...settings }) as any;

/** Changes a user's role on profiles (promote/demote seller). */
export const setUserRole = (userId: string, role: string): Promise<DbResult> =>
  supabase.from('profiles').update({ role }).eq('id', userId) as any;

// ---------- Offers / campaigns (AdminGrowth, AutoDiscountModal) ----------

/** All offers with creator name, newest first. */
export const listOffers = (): Promise<DbResult<any[]>> =>
  supabase.from('offers')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false }) as any;

/** Updates an offer row by id with the given fields. */
export const updateOffer = (id: string, patch: Record<string, any>): Promise<DbResult> =>
  supabase.from('offers').update(patch).eq('id', id) as any;

/** Inserts a new offer row. */
export const createOffer = (record: Record<string, any>): Promise<DbResult> =>
  supabase.from('offers').insert(record) as any;

/** Permanently deletes an offer by id. */
export const deleteOffer = (id: string): Promise<DbResult> =>
  supabase.from('offers').delete().eq('id', id) as any;

// ---------- Security monitor ----------

/** Latest 100 audit_log entries with actor profile, newest first. */
export const fetchAuditLog = (): Promise<DbResult<any[]>> =>
  supabase.from('audit_log')
    .select('*, user:profiles!user_id(full_name, email, role)')
    .order('created_at', { ascending: false })
    .limit(100) as any;
