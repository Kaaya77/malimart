// =====================================================================
// accountApi.ts — typed wrappers around the new SECURITY DEFINER RPCs.
// Every call is ONE round trip. Never query messages/notifications/
// orders tables directly from components anymore — use these.
// =====================================================================
import { supabase } from "./supabaseClient"; // adjust if your client lives elsewhere

export interface Conversation {
  peer_id: string;
  peer_name: string | null;
  peer_avatar: string | null;
  peer_role: "buyer" | "seller" | "admin";
  peer_last_seen: string | null;
  last_message_id: string;
  last_body: string;
  last_sender_id: string;
  last_created_at: string;
  last_attachment_type: string | null;
  unread_count: number;
  is_blocked: boolean;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  product_id: string | null;
  body: string;
  read: boolean;
  created_at: string;
  attachment_url: string | null;
  attachment_type: string | null;
  reply_to_id: string | null;
  deleted_at: string | null;
}

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
export const getConversations = () =>
  rpc<Conversation[]>("get_my_conversations");

export const getThread = (peerId: string, before?: string, limit = 40) =>
  rpc<Message[]>("get_thread", { p_peer: peerId, p_before: before ?? null, p_limit: limit });

export const sendMessage = (args: {
  receiverId: string; body: string; productId?: string;
  replyToId?: string; attachmentUrl?: string; attachmentType?: string;
}) =>
  rpc<Message>("send_direct_message", {
    p_receiver: args.receiverId, p_body: args.body,
    p_product: args.productId ?? null, p_reply_to: args.replyToId ?? null,
    p_attachment_url: args.attachmentUrl ?? null,
    p_attachment_type: args.attachmentType ?? null,
  });

export const deleteMessage = (messageId: string, forEveryone = false) =>
  rpc<void>("delete_my_message", { p_message: messageId, p_for_everyone: forEveryone });

export const deleteConversation = (peerId: string) =>
  rpc<void>("delete_my_conversation", { p_peer: peerId });

/** Mark everything a peer sent ME as read (self-scoped server-side). */
export const markThreadRead = (peerId: string) =>
  rpc<void>("mark_thread_read", { p_peer: peerId });

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
export const listActiveOffersWithVendors = (nowIso: string) =>
  supabase
    .from("offers")
    .select("*, vendor:vendor_profiles!seller_id(seller_id,store_name,logo_url,is_verified)")
    .eq("status", "active")
    .or(`end_date.is.null,end_date.gte.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(30);

/** Public vendor cards for a set of followed sellers. */
export const getVendorCardsBySellerIds = (sellerIds: string[]) =>
  supabase
    .from("vendor_profiles")
    .select("seller_id,store_name,logo_url,is_verified,rating,trust_score,description,region")
    .in("seller_id", sellerIds);
