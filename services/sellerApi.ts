// =====================================================================
// sellerApi.ts — typed wrappers around seller-side SECURITY DEFINER RPCs.
// Campaign CRUD (supabase/migrations/20260703020000_seller_offers_rpcs.sql)
// plus seller order reads/updates. NOTE: orders has NO seller_id column —
// seller order access must go through these RPCs (ownership resolved via
// order_items.seller_id), never table filters.
// =====================================================================
import { supabase } from "./supabaseClient";
import type { Offer } from "../types";

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------- Campaigns / offers ----------
// All RPCs force seller_id = auth.uid(); ownership is verified server-side.

export const listMyOffers = () => rpc<Offer[]>("seller_list_my_offers");

/** Create (offerId omitted) or update (offerId given) a campaign. */
export const saveOffer = (offer: Record<string, unknown>, offerId?: string) =>
  rpc<string>("seller_save_offer", { p_offer: offer, p_offer_id: offerId ?? null });

export const setOfferStatus = (offerId: string, status: "active" | "inactive") =>
  rpc<void>("seller_set_offer_status", { p_offer_id: offerId, p_status: status });

export const deleteOffer = (offerId: string) =>
  rpc<void>("seller_delete_offer", { p_offer_id: offerId });

// ---------- Orders ----------

/** Seller-side order rows (ownership resolved via order_items in the RPC). */
export const getSellerOrders = (sellerId: string, limit = 50, offset = 0) =>
  rpc<any[]>("get_seller_orders", {
    p_seller_id: sellerId,
    p_limit: limit,
    p_offset: offset,
  });

// ---------- Disputes ----------
// Ownership resolved server-side via disputes.seller_id / order_items.seller_id
// (orders has NO seller_id column). See 20260703030000_disputes_fraud_vacation.sql.

/** Disputes on my orders, with nested buyer profile + order summary. */
export const getSellerDisputes = () => rpc<any[]>("get_seller_disputes");

/** Role-checked dispute status transition; notifies the counterpart. */
export const updateDisputeStatus = (
  disputeId: string,
  newStatus: "under_review" | "resolved" | "refunded" | "closed"
) =>
  rpc<void>("update_dispute_status", {
    p_dispute_id: disputeId,
    p_new_status: newStatus,
  });

/** One seller response per dispute; buyer + admins are notified. */
export const respondToDispute = (disputeId: string, responseText: string) =>
  rpc<void>("seller_respond_to_dispute", {
    p_dispute_id: disputeId,
    p_response: responseText,
  });

// Returns state machine wrappers (seller_approve_return / seller_reject_return /
// process_return_refund) live in walletApi.ts alongside the other money paths.

/** Role-checked status transition (buyer/seller/admin resolved server-side). */
export const updateOrderStatus = (
  orderId: string,
  newStatus: string,
  cancelReason?: string
) =>
  rpc<void>("update_order_status_rbac", {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_cancel_reason: cancelReason ?? null,
  });

// ---------- Payout methods & shipping zones (self-scoped, RLS-guarded) ----------
// Direct table queries moved out of SellerSettingsPage (boundary refactor).
// They return the raw PostgREST `{ data, error }` promise so callers keep
// their existing handling.

/** All payout methods saved by this seller. */
export const listMyPayoutMethods = (sellerId: string) =>
  supabase.from("payout_methods").select("*").eq("seller_id", sellerId);

/** Save a payout method; returns the inserted row (single). */
export const addMyPayoutMethod = (
  sellerId: string,
  args: { methodType: string; details: Record<string, unknown>; isPrimary: boolean }
) =>
  supabase
    .from("payout_methods")
    .insert({
      seller_id: sellerId,
      method_type: args.methodType,
      details: args.details,
      is_primary: args.isPrimary,
    })
    .select()
    .single();

/** Remove a payout method by id (RLS restricts to owner). */
export const deleteMyPayoutMethod = (id: string) =>
  supabase.from("payout_methods").delete().eq("id", id);

/** All shipping zones configured by this seller. */
export const listMyShippingZones = (sellerId: string) =>
  supabase.from("shipping_zones").select("*").eq("seller_id", sellerId);

/** Save a shipping zone (name=region, description=district); returns the inserted row. */
export const addMyShippingZone = (
  sellerId: string,
  args: { name: string; description: string; fee: number }
) =>
  supabase
    .from("shipping_zones")
    .insert({
      seller_id: sellerId,
      name: args.name,
      description: args.description,
      fee: args.fee,
    })
    .select()
    .single();

/** Remove a shipping zone by id (RLS restricts to owner). */
export const deleteMyShippingZone = (id: string) =>
  supabase.from("shipping_zones").delete().eq("id", id);
