/**
 * Order read helpers for receipt/confirmation surfaces.
 * Pages must not call supabase.from directly — RLS scopes these reads:
 * orders_select_own lets a buyer read only their own orders.
 */
import { supabase } from './supabaseClient';
import { fetchVendorProfiles } from './shopService';
import type { Order, VendorProfile } from '../types';

export interface OrderReceipt {
  order: Order;
  /** Public profiles for every distinct seller in the order, keyed by seller_id. */
  sellers: Record<string, VendorProfile>;
  /** Convenience: the first seller with a profile (single-seller orders). */
  primarySeller: VendorProfile | null;
}

/** Buyer's own order with items + all seller storefront profiles. Never throws. */
export async function fetchOrderReceipt(orderId: string): Promise<OrderReceipt | null> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*, products(*))')
      .eq('id', orderId)
      .single();
    if (error || !data) return null;

    const order = data as Order;
    const sellerIds: string[] = ((order as any).items || [])
      .map((i: any) => i.seller_id || i.products?.seller_id)
      .filter(Boolean);
    const sellers = await fetchVendorProfiles(sellerIds);
    const primarySeller = sellerIds.map(id => sellers[id]).find(Boolean) || null;
    return { order, sellers, primarySeller };
  } catch {
    return null;
  }
}
