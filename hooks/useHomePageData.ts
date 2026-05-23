import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { VendorProfile } from '../types';

export const useHomePageData = () => {
    const [data, setData] = useState({
        topShops: [] as VendorProfile[],
        userCount: 0,
        recentUserAvatars: [] as string[],
        trendingCategories: [] as {name: string, icon: string, count?: number}[],
        tickerItems: [] as string[],
        weeklyOrderCount: 0,
        heroSettings: {
            badgeText: 'Limited Time: 20% Off Artisan Collections',
            headline: 'Discover Authentic Local Craftsmanship',
            subheadline: 'Shop directly from verified artisans, farmers, and creators across Tanzania. Experience the pinnacle of local heritage and modern design.'
        },
        heroRecommendation: null as any,
        heroFeaturedProducts: [] as any[],
        loadingShops: true
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Shops
                let shopsData = null;
                let retryCount = 0;
                while (retryCount <= 2) {
                    try {
                        const { data: d, error } = await supabase
                            .from('vendor_profiles')
                            .select('*')
                            .eq('is_verified', true)
                            .limit(6);
                        if (error) throw error;
                        shopsData = d;
                        break;
                    } catch (e) {
                        retryCount++;
                        if (retryCount > 2) break;
                        await new Promise(r => setTimeout(r, 1000 * retryCount));
                    }
                }

                // User count + avatars
                const { count: uCount } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true });

                const { data: rUsers } = await supabase
                    .from('profiles')
                    .select('avatar_url')
                    .not('avatar_url', 'is', null)
                    .limit(3);

                // Categories with counts
                const { data: cats } = await supabase
                    .from('categories')
                    .select('name, icon_url')
                    .eq('is_active', true)
                    .limit(6);

                let catsWithCounts: any[] = [];
                if (cats && cats.length > 0) {
                    catsWithCounts = await Promise.all(cats.map(async (c) => {
                        const { count } = await supabase
                            .from('products')
                            .select('*', { count: 'exact', head: true })
                            .eq('category', c.name)
                            .eq('status', 'active');
                        return { name: c.name, icon: c.icon_url || '✨', count: count || 0 };
                    }));
                }

                // FIX 1: Ticker — fetch order_items without the broken nested profile join.
                // Instead, fetch product names directly and use a static region fallback.
                const { data: recentOrderItems } = await supabase
                    .from('order_items')
                    .select('product_id, products(name), orders(id)')
                    .order('created_at', { ascending: false })
                    .limit(3);

                const { data: recentVendors } = await supabase
                    .from('vendor_profiles')
                    .select('store_name, region')
                    .order('created_at', { ascending: false })
                    .limit(2);

                const newTickerItems: string[] = [];
                if (recentOrderItems && recentOrderItems.length > 0) {
                    recentOrderItems.forEach((item: any) => {
                        if (item.products) {
                            newTickerItems.push(`Someone in Tanzania just bought ${item.products.name}`);
                        }
                    });
                }
                if (recentVendors && recentVendors.length > 0) {
                    recentVendors.forEach((vendor: any) => {
                        newTickerItems.push(`New artisan '${vendor.store_name}' from ${vendor.region || 'Tanzania'} just joined`);
                    });
                }

                // FIX 2: Weekly order count — use orders table directly (no join issues)
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const { count: wCount } = await supabase
                    .from('orders')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', sevenDaysAgo.toISOString())
                    .not('status', 'in', '(cancelled,failed,refunded)');

                // Hero settings
                const { data: settings } = await supabase
                    .from('platform_settings')
                    .select('hero_badge_text, hero_headline, hero_subheadline')
                    .eq('id', 1)
                    .maybeSingle();

                // FIX 3: Hero recommendations — join products then vendor_profiles separately
                // PostgREST cannot traverse hero_recommendations → products → vendor_profiles
                // in a single query because vendor_profiles FK is on products.seller_id,
                // not on hero_recommendations. Fetch products first, then enrich.
                const { data: recommendations } = await supabase
                    .from('hero_recommendations')
                    .select(`
                        *,
                        products (
                            id, name, description, price, base_price, sale_price,
                            images, category, stock, rating, review_count,
                            is_boosted, status, seller_id
                        )
                    `)
                    .eq('status', 'approved')
                    .order('approved_at', { ascending: false })
                    .limit(4);

                // Enrich with vendor info in a second query (avoids the invalid nested join)
                let heroFeaturedProducts: any[] = [];
                if (recommendations && recommendations.length > 0) {
                    const sellerIds = [...new Set(
                        recommendations
                            .filter((r: any) => r.products?.seller_id)
                            .map((r: any) => r.products.seller_id)
                    )];

                    let vendorMap: Record<string, any> = {};
                    if (sellerIds.length > 0) {
                        const { data: vendors } = await supabase
                            .from('vendor_profiles')
                            .select('seller_id, store_name, is_verified, logo_url, region')
                            .in('seller_id', sellerIds);
                        (vendors || []).forEach((v: any) => { vendorMap[v.seller_id] = v; });
                    }

                    heroFeaturedProducts = recommendations
                        .filter((rec: any) => rec.products)
                        .map((rec: any) => {
                            const p = rec.products;
                            const vendor = vendorMap[p.seller_id] || {};
                            return {
                                ...p,
                                seller_name: vendor.store_name || null,
                                is_verified: vendor.is_verified || false,
                                seller_logo: vendor.logo_url || null,
                                seller_region: vendor.region || null,
                                price: p.price ?? p.sale_price ?? p.base_price ?? 0,
                                _hero: {
                                    id: rec.id,
                                    title: rec.title,
                                    description: rec.description,
                                    price_display: rec.price_display,
                                    offer_text: rec.offer_text,
                                    approved_at: rec.approved_at,
                                },
                            };
                        });
                }

                const firstRec = recommendations && recommendations.length > 0
                    ? { ...recommendations[0], products: heroFeaturedProducts[0] || null }
                    : null;

                setData({
                    topShops: shopsData || [],
                    userCount: uCount || 0,
                    recentUserAvatars: rUsers?.map(u => u.avatar_url).filter(Boolean) as string[] || [],
                    trendingCategories: catsWithCounts,
                    tickerItems: newTickerItems,
                    weeklyOrderCount: wCount || 0,
                    heroSettings: {
                        badgeText: settings?.hero_badge_text || 'Limited Time: 20% Off Artisan Collections',
                        headline: settings?.hero_headline || 'Discover Authentic Local Craftsmanship',
                        subheadline: settings?.hero_subheadline || 'Shop directly from verified artisans, farmers, and creators across Tanzania. Experience the pinnacle of local heritage and modern design.'
                    },
                    heroRecommendation: firstRec,
                    heroFeaturedProducts,
                    loadingShops: false
                });

            } catch (error) {
                console.error('Error fetching initial data:', error);
                setData(prev => ({ ...prev, loadingShops: false }));
            }
        };
        fetchInitialData();
    }, []);

    return data;
};
