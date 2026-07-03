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
