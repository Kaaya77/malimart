// =====================================================================
// walletApi.ts — typed wrappers for the wallet / referral / returns RPCs
// added in supabase/migrations/20260703040000. Every money path is a
// SECURITY DEFINER RPC that re-checks role/ownership server-side and never
// trusts client-supplied amounts. Components/pages must call these — never
// supabase.from/rpc directly.
// =====================================================================
import { supabase } from "./supabaseClient";

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------- Referrals ----------

export interface ReferralStatus {
  code: string;
  reward_amount: number;
  invited: number;
  qualified: number;
  rewarded: number;
  total_earned: number;
}

/** Deterministic per-user code; generated + persisted on first call. */
export const getMyReferralCode = () =>
  rpc<string>("get_or_create_my_referral_code");

/** Referral counts + earnings for the WalletTab UI. */
export const getMyReferralStatus = () =>
  rpc<ReferralStatus>("get_my_referral_status");

/** Record that the current user was referred by someone's code (once). */
export const recordReferral = (code: string) =>
  rpc<{ ok: boolean }>("record_referral", { p_code: code });

// ---------- Checkout discount preview ----------

export interface DiscountPreview {
  discount: number;
  source: "auto" | "coupon" | "none";
  offer_id?: string | null;
  title?: string | null;
}

type CartItemLite = { product_id: string; variant_id?: string | null; quantity: number };

/** Best-of(coupon, auto-apply offer) for the cart — what the buyer will get. */
export const previewCartDiscount = (items: CartItemLite[], couponCode?: string | null) =>
  rpc<DiscountPreview>("preview_cart_discount", {
    p_items: items,
    p_coupon_code: couponCode ?? null,
  });

// ---------- Returns state machine (on the disputes table) ----------

/** Buyer files a return/dispute (replaces the old client-side insert). */
export const createReturn = (args: {
  orderId: string; reason: string; description: string; evidence?: string[];
}) =>
  rpc<string>("buyer_create_return", {
    p_order_id: args.orderId,
    p_reason: args.reason,
    p_description: args.description,
    p_evidence: args.evidence ?? null,
  });

/** Seller approves a return and sets the refund amount (bounded server-side). */
export const approveReturn = (disputeId: string, refundAmount: number) =>
  rpc<void>("seller_approve_return", {
    p_dispute_id: disputeId,
    p_refund_amount: refundAmount,
  });

/** Seller rejects a return with a reason. */
export const rejectReturn = (disputeId: string, reason: string) =>
  rpc<void>("seller_reject_return", { p_dispute_id: disputeId, p_reason: reason });

/** Move an approved return to refunded, crediting the buyer wallet atomically. */
export const processReturnRefund = (disputeId: string) =>
  rpc<{ ok: boolean; amount: number }>("process_return_refund", {
    p_dispute_id: disputeId,
  });
