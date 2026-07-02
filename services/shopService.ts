/**
 * Shop catalog service
 *
 * Primary path: `shop_products` RPC (applied 2026-06-13) — filtering,
 * sorting and pagination run in Postgres over the ENTIRE catalog, so the
 * Shop page is no longer limited to products already loaded in memory,
 * and each request returns one page of rows (minimal egress).
 *
 * Fallback: returns null on any failure so ShopPage silently keeps its
 * existing client-side filtering. This module NEVER throws.
 */
import { supabase } from './supabaseClient';
import { withCache } from './queryCache';
import type { Product, VendorProfile } from '../types';

export interface ShopFilters {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number | null;
  verified?: boolean;
  inStock?: boolean;
  region?: string;
  sort?: string;       // relevance|newest|price_asc|price_desc|rating|popular
  limit?: number;
  offset?: number;
}

export interface ShopResult {
  products: Product[];
  totalCount: number;
}

let rpcAvailable = true;

/** Single public product with variants, for the product detail page. Never throws. */
export async function fetchProductById(id: string): Promise<Product | null> {
  try {
    const { data } = await supabase
      .from('products')
      .select('*, variants:product_variants(*)')
      .eq('id', id)
      // No status filter: RLS (products_select_active) hides inactive products from
      // buyers while still letting sellers preview their own drafts on this page.
      .single();
    return (data as Product) ?? null;
  } catch {
    return null;
  }
}

/** Public storefront profile for a seller. Never throws. */
export async function fetchVendorProfile(sellerId: string): Promise<VendorProfile | null> {
  try {
    const { data } = await supabase
      .from('public_vendor_profiles')
      .select('seller_id, store_name, description, logo_url, banner_url, region, district, is_verified, trust_score, total_sales, verification_level, rating, delivery_fee, return_policy, shipping_policy, processing_time, warranty, vacation_mode, opening_hours, instagram_url, facebook_url, website_url, social_links')
      .eq('seller_id', sellerId)
      .single();
    return (data as VendorProfile) ?? null;
  } catch {
    return null;
  }
}

/**
 * Public storefront profiles for several sellers at once (cart grouping,
 * order confirmation). Reads the RLS-safe `public_vendor_profiles` view —
 * the base `vendor_profiles` table is owner/admin-only. Never throws.
 */
export async function fetchVendorProfiles(sellerIds: string[]): Promise<Record<string, VendorProfile>> {
  const ids = Array.from(new Set(sellerIds.filter(Boolean)));
  if (ids.length === 0) return {};
  try {
    const { data } = await supabase
      .from('public_vendor_profiles')
      .select('seller_id, store_name, logo_url, region, is_verified, delivery_fee, rating, trust_score')
      .in('seller_id', ids);
    const map: Record<string, VendorProfile> = {};
    (data || []).forEach((v: any) => { map[v.seller_id] = v as VendorProfile; });
    return map;
  } catch {
    return {};
  }
}

const SHOP_CACHE_TTL = 60_000; // 1 min — shop results can be slightly stale

export async function shopProductsServer(f: ShopFilters): Promise<ShopResult | null> {
  if (!rpcAvailable) return null;
  const cacheKey = `shop:${JSON.stringify(f)}`;
  return withCache(cacheKey, SHOP_CACHE_TTL, async () => {
  try {
    const { data, error } = await supabase.rpc('shop_products', {
      p_query: f.query && f.query.trim().length >= 2 ? f.query.trim() : null,
      p_category: f.category || null,
      p_min_price: f.minPrice && f.minPrice > 0 ? f.minPrice : null,
      p_max_price: f.maxPrice && f.maxPrice < 5_000_000 ? f.maxPrice : null,
      p_min_rating: f.minRating ?? null,
      p_verified: !!f.verified,
      p_in_stock: !!f.inStock,
      p_region: f.region?.trim() || null,
      p_sort: f.sort || 'relevance',
      p_limit: f.limit ?? 24,
      p_offset: f.offset ?? 0,
    });
    if (error) {
      if (error.code === '42883' || /does not exist/i.test(error.message || '')) {
        rpcAvailable = false;
      }
      return null;
    }
    const rows = (data as any[]) ?? [];
    return {
      products: rows as Product[],
      totalCount: rows.length ? Number(rows[0].total_count) : 0,
    };
  } catch {
    return null;
  }
  });
}
