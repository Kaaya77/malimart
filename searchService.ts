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
