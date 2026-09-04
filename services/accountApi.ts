// =====================================================================
// accountApi.ts — typed wrappers around the SECURITY DEFINER RPCs.
// Every call is ONE round trip. Never query notifications/orders tables
// directly from components — use these. Messaging has its own equivalent
// in services/messagesService.ts.
// =====================================================================
import { supabase } from "./supabaseClient"; // adjust if your client lives elsewhere

export interface AccountOverview {
  profile: Record<string, unknown>;
  unread_messages: number;
  unread_notifications: number;
  open_orders: number;
  wishlist_count: number;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------- Messaging ----------
// Lives in services/messagesService.ts, together with the conversation list,
// thread paging, reactions and attachments. This file used to carry a second
// set of messaging wrappers that nothing imported.

// ---------- Presence ----------
// Refreshes MY OWN profiles.last_seen_at — the input to the "online within
// the last 2 minutes" heuristic used across messaging and store pages. Call
// on a visibility-aware heartbeat, not on every render.
export const touchPresence = () => rpc<void>("touch_presence");

// ---------- Notifications ----------
export const markAllNotificationsRead = () => rpc<void>("mark_all_notifications_read");
export const deleteNotifications = (ids: string[]) =>
  rpc<number>("delete_my_notifications", { p_ids: ids });
export const clearReadNotifications = () => rpc<number>("clear_read_notifications");
export const deleteAllNotifications = () => rpc<number>("delete_all_my_notifications");

// ---------- Orders ----------
export const cancelOrder = (orderId: string, reason: string) =>
  rpc<Record<string, unknown>>("cancel_my_order", { p_order: orderId, p_reason: reason });
export const hideOrder = (orderId: string) =>
  rpc<void>("hide_my_order", { p_order: orderId });

// ---------- Settings (whitelisted server-side) ----------
export const updateMySettings = (patch: Record<string, unknown>) =>
  rpc<Record<string, unknown>>("update_my_settings", { p: patch });

// ---------- Sessions / security ----------
export const revokeSession = (sessionId: string) =>
  rpc<void>("revoke_my_session", { p_session: sessionId });
export const revokeOtherSessions = (keepId?: string) =>
  rpc<number>("revoke_my_other_sessions", { p_keep: keepId ?? null });

// ---------- Account overview (navbar / dashboards) ----------
export const getAccountOverview = () => rpc<AccountOverview>("get_account_overview");

// ---------- Self-scoped table reads/writes (RLS-guarded) ----------
// These are direct table queries moved out of pages (settings/account
// boundary refactor). Each is self-scoped by user id and protected by RLS.
// They return the raw PostgREST `{ data, error }` promise so callers keep
// their existing handling.

/** My orders (with items + product name/category) for the CSV data export. */
export const getMyOrdersForExport = (userId: string) =>
  supabase
    .from("orders")
    .select("id, created_at, status, total, subtotal, delivery_fee, payment_method, items:order_items(price_at_purchase, quantity, product:products(name, category))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

/** All of my saved payment methods. */
export const listMyPaymentMethods = (userId: string) =>
  supabase.from("payment_methods").select("*").eq("user_id", userId);

/** Save a new payment method for the current user. */
export const addMyPaymentMethod = (
  userId: string,
  method: Record<string, unknown>
) => supabase.from("payment_methods").insert({ user_id: userId, ...method });

/** Remove a payment method by id (RLS restricts to owner). */
export const deleteMyPaymentMethod = (id: string) =>
  supabase.from("payment_methods").delete().eq("id", id);

/** Disconnect a linked OAuth/social account for the current user. */
export const disconnectMyAccount = (userId: string, provider: string) =>
  supabase
    .from("connected_accounts")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);

/** Soft-flag my profile for deletion (sets deleted_at). */
export const requestMyAccountDeletion = (userId?: string) =>
  supabase
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", userId);

/** Ban-status check used right after password login (pre-session gate). */
export const getProfileBanStatus = (userId: string) =>
  Promise.resolve(
    supabase.from("profiles").select("is_banned").eq("id", userId).single()
  );

// ---------- Public marketplace reads (buyer dashboard) ----------

/** Active, unexpired offers with their vendor card info (newest first, max 30). */
/**
 * Active offers, each with its seller's public vendor card.
 *
 * Does NOT use a PostgREST embed. `offers.seller_id` has a foreign key to
 * `profiles(id)`, not to `vendor_profiles`, so
 *   vendor:vendor_profiles!seller_id(...)
 * failed with PGRST200 ("Could not find a relationship between 'offers' and
 * 'vendor_profiles'") on EVERY call — a deterministic 400, which is why the
 * Rewards tab always showed its error state and "Try again" never helped.
 *
 * Adding a second FK onto vendor_profiles would fix the embed but would then
 * reject any offer from a seller without a vendor profile, so the join is done
 * in two queries instead and stitched here.
 */
export const listActiveOffersWithVendors = async (nowIso: string) => {
  const { data, error } = await supabase
    .from("offers")
    .select("*")
    .eq("status", "active")
    .or(`end_date.is.null,end_date.gte.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data?.length) return { data: data ?? [], error };

  const sellerIds = Array.from(
    new Set(data.map((o: any) => o.seller_id).filter(Boolean))
  );
  if (!sellerIds.length) return { data, error: null };

  // A missing vendor card must not fail the whole tab — offers still render.
  const { data: vendors } = await getVendorCardsBySellerIds(sellerIds);
  const byId = new Map((vendors ?? []).map((v: any) => [v.seller_id, v]));

  return {
    data: data.map((o: any) => ({ ...o, vendor: byId.get(o.seller_id) ?? null })),
    error: null,
  };
};

/** Public vendor cards for a set of followed sellers. */
export const getVendorCardsBySellerIds = (sellerIds: string[]) =>
  supabase
    .from("vendor_profiles")
    .select("seller_id,store_name,logo_url,is_verified,rating,trust_score,description,region")
    .in("seller_id", sellerIds);
