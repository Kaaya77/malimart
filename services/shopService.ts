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
import type { Product } from '../types';

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

export async function shopProductsServer(f: ShopFilters): Promise<ShopResult | null> {
  if (!rpcAvailable) return null;
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
}
