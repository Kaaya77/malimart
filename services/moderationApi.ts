// =====================================================================
// moderationApi.ts — product suspension + appeal flow.
// Typed wrappers around the SECURITY DEFINER RPCs added in
// supabase/migrations/20260702160000_product_appeals.sql.
// Components/pages must call these — never supabase.from/rpc directly.
// =====================================================================
import { supabase } from "./supabaseClient";

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export interface ProductAppeal {
  id: string;
  product_id: string;
  seller_id: string;
  reason: string;
  takedown_reason: string | null;
  status: "pending" | "approved" | "rejected";
  admin_response: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  product?: { id: string; name: string; images: string[] | null; status: string } | null;
  seller?: { full_name: string | null; email: string | null } | null;
}

export interface SellerModerationEntry {
  product_id: string;
  product_status: string;
  takedown_reason: string | null;
  appeal: {
    id: string;
    status: "pending" | "approved" | "rejected";
    reason: string;
    admin_response: string | null;
    created_at: string;
    resolved_at: string | null;
  } | null;
}

// ---------- Admin ----------

/** Suspend a product with a mandatory reason; the seller is notified by the RPC. */
export const adminTakedownProduct = (productId: string, reason: string) =>
  rpc<void>("admin_takedown_product", { p_product_id: productId, p_reason: reason });

/** Approve (reinstates the product) or reject (response required) an appeal. */
export const resolveProductAppeal = (appealId: string, approve: boolean, response?: string) =>
  rpc<void>("resolve_product_appeal", {
    p_appeal_id: appealId,
    p_approve: approve,
    p_response: response ?? null,
  });

/** Admin list of appeals (RLS: admins see all). Optionally filter by status. */
export const fetchProductAppeals = async (
  status?: "pending" | "approved" | "rejected"
): Promise<ProductAppeal[]> => {
  let query = supabase
    .from("product_appeals")
    .select(
      "*, product:products(id, name, images, status), seller:profiles!seller_id(full_name, email)"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ProductAppeal[];
};

// ---------- Seller ----------

/** File an appeal against a suspension. Admins are notified by the RPC. */
export const submitProductAppeal = (productId: string, reason: string) =>
  rpc<string>("submit_product_appeal", { p_product_id: productId, p_reason: reason });

/** Suspension + latest-appeal info for the calling seller's products. */
export const getMyProductModeration = () =>
  rpc<SellerModerationEntry[]>("get_my_product_moderation");
