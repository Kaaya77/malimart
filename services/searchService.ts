/**
 * Product search service
 *
 * Primary path: `search_products` RPC (Postgres full-text search, GIN-indexed,
 * ranked, searches the ENTIRE catalog — not just products loaded in memory).
 * See supabase/migrations/20260610000000_full_text_search.sql
 *
 * Fallback: if the RPC doesn't exist yet (migration not applied) or the
 * request fails, callers keep their existing client-side filtering.
 * This module NEVER throws — it returns null on any failure so the UI
 * can fall back without a try/catch at every call site.
 */
import { supabase } from './supabaseClient';
import type { Product } from '../types';

let rpcAvailable = true; // flips false on first 404 so we stop retrying a missing RPC

export async function searchProductsServer(
  query: string,
  limit = 24,
  offset = 0,
): Promise<Product[] | null> {
  const q = query.trim();
  if (q.length < 2 || !rpcAvailable) return null;

  try {
    const { data, error } = await supabase.rpc('search_products', {
      p_query: q,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) {
      // 42883 = function does not exist → migration not applied yet
      if (error.code === '42883' || /does not exist/i.test(error.message || '')) {
        rpcAvailable = false;
      }
      return null;
    }
    return (data as Product[]) ?? null;
  } catch {
    return null;
  }
}

/**
 * Lightweight ilike search used by the SearchModal for as-you-type results
 * (and its AI-intent refinement, which adds a max price). Matches name,
 * category or seller name on active, non-deleted products; up to 12 rows.
 * Not wrapped in try/catch — Postgrest errors resolve to null data and the
 * caller keeps its own error handling.
 */
export async function quickSearchProducts(
  q: string,
  maxPrice?: number | null,
): Promise<Pick<Product, 'id' | 'name' | 'price' | 'images' | 'category' | 'seller_name' | 'seller_id' | 'status'>[] | null> {
  let query = supabase
    .from('products')
    .select('id,name,price,images,category,seller_name,seller_id,status')
    .eq('status', 'active')
    .is('deleted_at', null)
    .or(`name.ilike.%${q}%,category.ilike.%${q}%,seller_name.ilike.%${q}%`);
  if (maxPrice) query = query.lte('price', maxPrice);
  const { data } = await query.limit(12);
  return data as any;
}
