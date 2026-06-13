/**
 * Explore page data — accurate full-catalog category counts + trending,
 * independent of whatever products are currently loaded in memory.
 *
 * Backed by category_product_counts() and trending_products() RPCs.
 * If those aren't deployed yet (see explore_rpcs.sql), every function
 * returns null and CategoriesPage keeps using its in-memory fallback.
 * NEVER throws.
 */
import { supabase } from './supabaseClient';
import type { Product } from '../types';

let countsRpc = true;
let trendingRpc = true;

export async function categoryCountsServer(): Promise<Record<string, number> | null> {
  if (!countsRpc) return null;
  try {
    const { data, error } = await supabase.rpc('category_product_counts');
    if (error) {
      if (error.code === '42883' || /does not exist/i.test(error.message || '')) countsRpc = false;
      return null;
    }
    const map: Record<string, number> = {};
    for (const row of (data as any[]) ?? []) map[row.category] = Number(row.product_count);
    return map;
  } catch {
    return null;
  }
}

export async function trendingProductsServer(limit = 12): Promise<Product[] | null> {
  if (!trendingRpc) return null;
  try {
    const { data, error } = await supabase.rpc('trending_products', { p_limit: limit });
    if (error) {
      if (error.code === '42883' || /does not exist/i.test(error.message || '')) trendingRpc = false;
      return null;
    }
    return (data as Product[]) ?? null;
  } catch {
    return null;
  }
}
