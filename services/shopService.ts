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
import type { Product, ProductVariant, VendorProfile, Review, Offer } from '../types';

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

/**
 * Active storefronts for the Explore → Stores tab, most sales first, paginated.
 * Reads the RLS-safe `public_vendor_profiles` view (the base vendor_profiles
 * table is owner/admin-only, so a buyer/guest querying it directly gets nothing).
 * Fetches one extra row as a "has more" probe. Never throws.
 */
export async function fetchActiveStores(
  page: number,
  pageSize = 24,
): Promise<{ stores: VendorProfile[]; hasMore: boolean }> {
  try {
    const upper = page * pageSize; // inclusive range end; one past the page = probe
    const { data } = await supabase
      .from('public_vendor_profiles')
      .select('seller_id, store_name, description, logo_url, banner_url, region, district, is_verified, verification_level, trust_score, total_sales, rating, tags')
      .eq('is_active', true)
      .order('total_sales', { ascending: false })
      .range(0, upper);
    const rows = (data as VendorProfile[]) || [];
    return { stores: rows.slice(0, upper), hasMore: rows.length > upper };
  } catch {
    return { stores: [], hasMore: false };
  }
}

/**
 * Payment-RECEIVING channels for the sellers in a cart (Lipa Namba, mobile
 * money, bank details) — the numbers a buyer needs to actually pay. These live
 * on the owner-only vendor_profiles table (next to real PII), so they come via
 * the get_seller_payment_channels SECURITY DEFINER RPC, which returns ONLY the
 * receiving fields and only to signed-in users. Never throws.
 */
export async function fetchSellerPaymentChannels(sellerIds: string[]): Promise<Record<string, Partial<VendorProfile>>> {
  const ids = Array.from(new Set(sellerIds.filter(Boolean)));
  if (ids.length === 0) return {};
  try {
    const { data } = await supabase.rpc('get_seller_payment_channels', { p_seller_ids: ids });
    const map: Record<string, Partial<VendorProfile>> = {};
    (data || []).forEach((v: any) => { map[v.seller_id] = v as Partial<VendorProfile>; });
    return map;
  } catch {
    return {};
  }
}

/**
 * Which of these sellers are currently in vacation mode? Returns
 * seller_id → store_name for vacationing stores only. Used by the checkout
 * flow to block orders client-side (place_order_atomic also enforces this
 * server-side). Never throws — on error, returns {} and lets the server
 * check be the backstop.
 */
export async function fetchVacationSellers(sellerIds: string[]): Promise<Record<string, string>> {
  const ids = Array.from(new Set(sellerIds.filter(Boolean)));
  if (ids.length === 0) return {};
  try {
    const { data } = await supabase
      .from('public_vendor_profiles')
      .select('seller_id, store_name, vacation_mode')
      .in('seller_id', ids)
      .eq('vacation_mode', true);
    const map: Record<string, string> = {};
    (data || []).forEach((v: any) => { map[v.seller_id] = v.store_name || 'This store'; });
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

// ─── Reviews & reports (ReviewSection) ───────────────────────────────────────

/**
 * All reviews for a product with the reviewer's public profile joined,
 * newest first. Returns null on error (caller keeps existing state).
 */
export async function fetchProductReviews(productId: string): Promise<Review[] | null> {
  const { data } = await supabase
    .from('reviews')
    .select('*, user:profiles!user_id(id, full_name, avatar_url)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });
  return (data as Review[]) ?? null;
}

/**
 * Whether the signed-in user may review this product — i.e. they have a
 * DELIVERED order containing it. Mirrors the reviews_insert RLS rule with a
 * direct query, so it's correct regardless of the caller's role (a seller who
 * bought from another store qualifies; the client `orders` array would not
 * include that purchase). Returns false on any error.
 */
export async function hasDeliveredPurchase(productId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('order_items')
    .select('id, orders!inner(user_id, status)')
    .eq('product_id', productId)
    .eq('orders.user_id', userId)
    .eq('orders.status', 'delivered')
    .limit(1);
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

/**
 * Publish a verified-buyer review. RLS only accepts reviews from buyers with
 * a delivered order containing this product. Throws on insert error so the
 * caller can surface a toast.
 */
export async function insertReview(review: {
  product_id: string;
  user_id: string;
  rating: number;
  comment: string;
  images: string[];
}): Promise<void> {
  const { error } = await supabase.from('reviews').insert(review);
  if (error) throw error;
}

/**
 * Update the caller's own review (RLS + the user_id filter both scope this
 * to the owner). Mirrors the original fire-and-forget behavior: does not
 * throw on a Postgrest error.
 */
export async function updateOwnReview(
  reviewId: string,
  userId: string | undefined,
  changes: { rating: number; comment: string },
): Promise<void> {
  await supabase.from('reviews')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', reviewId).eq('user_id', userId);
}

/** Delete the caller's own review (owner-scoped by RLS + user_id filter). */
export async function deleteOwnReview(reviewId: string, userId: string | undefined): Promise<void> {
  await supabase.from('reviews').delete().eq('id', reviewId).eq('user_id', userId);
}

/**
 * File a moderation report against a piece of content (e.g. a review).
 * Returns the Postgrest error (or null) so the caller decides the toast.
 */
export async function reportContent(report: {
  reporter_id: string;
  reported_id: string;
  category: string;
  reason: string;
}): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('reports').insert(report);
  return { error };
}

// ─── Social proof (SocialProofToast) ─────────────────────────────────────────

/**
 * Recent anonymised purchase activity from the RLS-safe
 * `public_recent_activity` view (no buyer identity exposed). Never throws.
 */
export async function fetchRecentPublicActivity(limit = 50): Promise<Array<{
  product_id: string;
  product_name: string;
  product_images: string[] | null;
  price_at_purchase: number | null;
  city: string | null;
}> | null> {
  try {
    const { data } = await supabase
      .from('public_recent_activity')
      .select('product_id, product_name, product_images, price_at_purchase, city')
      .limit(limit);
    return data ?? null;
  } catch {
    return null;
  }
}

// ─── Offers (CartPage coupons) ───────────────────────────────────────────────

/**
 * Look up a currently-active coupon/offer by its code (case-normalised by
 * the caller). Returns null when the code is invalid, expired or not yet
 * started — usage limits and min-order checks stay with the caller.
 */
export async function fetchActiveOfferByCode(code: string): Promise<Offer | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('code', code)
    .eq('status', 'active')
    .lte('start_date', now)
    .or(`end_date.is.null,end_date.gte.${now}`)
    .single();
  if (error || !data) return null;
  return data as Offer;
}

// ─── Storefront & seller product editing ─────────────────────────────────────

/**
 * All active products for one seller's public storefront, newest first.
 * Full-catalog read (the global product cache may not include this seller).
 * Never throws — returns [] so the storefront renders empty instead of crashing.
 */
export async function fetchStoreProducts(sellerId: string): Promise<Product[]> {
  try {
    const { data } = await supabase
      .from('products')
      .select('id,seller_id,name,description,price,sale_price,images,category,tags,rating,review_count,stock,status,is_verified,is_boosted,created_at,updated_at,region')
      .eq('seller_id', sellerId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    return (data ?? []) as Product[];
  } catch {
    return [];
  }
}

/**
 * A seller's OWN product (any status) with variants, for the edit page.
 * The seller_id filter + RLS keep this owner-scoped. Returns the raw
 * { data, error } pair so the caller can redirect on failure.
 */
export async function fetchOwnProductForEdit(
  productId: string,
  sellerId: string,
): Promise<{ data: any | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from('products')
    .select('*, variants:product_variants(*)')
    .eq('id', productId)
    .eq('seller_id', sellerId)
    .single();
  return { data, error };
}

/**
 * Variants for a product (ProductForm edit mode). Public read — variants of
 * visible products are RLS-readable. Returns null when the query errors.
 */
export async function fetchProductVariants(productId: string): Promise<ProductVariant[] | null> {
  const { data } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId);
  return (data as ProductVariant[]) ?? null;
}
