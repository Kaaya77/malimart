/**
 * Category counts for the Shop page's category chip rail — accurate across
 * the FULL catalog, independent of whatever products happen to be loaded in
 * memory already.
 *
 * Backed by the category_product_counts() RPC (see explore_rpcs.sql). If it
 * isn't deployed yet, returns null and ShopPage falls back to counting the
 * in-memory product list instead. NEVER throws.
 *
 * trending_products() also exists in explore_rpcs.sql but has no caller —
 * the Explore/Shop merge folded "trending" into the Shop grid's own
 * Top Rated / Most Popular sort options rather than keeping a second,
 * independently-maintained trending computation around.
 */
import { supabase } from './supabaseClient';

let countsRpc = true;

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
