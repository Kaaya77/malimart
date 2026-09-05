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
                // All independent queries fire in parallel — was sequential, ~8-12 round trips
                const [
                    shopsResult,
                    uCountResult,
                    rUsersResult,
                    catsResult,
                    catCountsResult,
                    tickerResult,
                    settingsResult,
                    recommendationsResult,
                ] = await Promise.allSettled([
                    // 1. Top shops (with retry)
                    (async () => {
                        for (let attempt = 0; attempt <= 2; attempt++) {
                            const { data: d, error } = await supabase
                                .from('public_vendor_profiles')
                                .select('seller_id, store_name, description, logo_url, banner_url, region, is_verified, trust_score, total_sales, verification_level, rating, delivery_fee')
                                .eq('is_verified', true)
                                .limit(6);
                            if (!error) return d;
                            if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                        }
                        return null;
                    })(),
                    // 2. User count
                    supabase.from('profiles').select('*', { count: 'exact', head: true }),
                    // 3. Recent avatars
                    supabase.from('profiles').select('avatar_url').not('avatar_url', 'is', null).limit(3),
                    // 4. Active categories
                    supabase.from('categories').select('name, icon_url').eq('is_active', true).order('sort_order', { ascending: true }).limit(6),
                    // 5. Product counts per category — single RPC replaces N per-category queries
                    supabase.rpc('category_product_counts'),
                    // 6. Ticker data
                    supabase.rpc('get_ticker_data'),
                    // 7. Hero settings
                    supabase.from('platform_settings')
                        .select('hero_badge_text, hero_headline, hero_subheadline')
                        .eq('id', 1)
                        .maybeSingle(),
                    // 8. Hero recommendations + products (vendor enrichment is a second parallel query below)
                    supabase.from('hero_recommendations')
                        .select(`*, products(id, name, description, price, base_price, sale_price, images, category, stock, rating, review_count, is_boosted, status, seller_id)`)
                        .eq('status', 'approved')
                        .order('approved_at', { ascending: false })
                        .limit(4),
                ]);

                const shopsData = shopsResult.status === 'fulfilled' ? shopsResult.value : null;
                const uCount = uCountResult.status === 'fulfilled' ? (uCountResult.value as any).count : 0;
                const rUsers = rUsersResult.status === 'fulfilled' ? (rUsersResult.value as any).data : [];
                const cats: any[] = catsResult.status === 'fulfilled' ? (catsResult.value as any).data ?? [] : [];
                const catCounts: any[] = catCountsResult.status === 'fulfilled' ? (catCountsResult.value as any).data ?? [] : [];
                const tickerData = tickerResult.status === 'fulfilled' ? (tickerResult.value as any).data : null;
                const settings = settingsResult.status === 'fulfilled' ? (settingsResult.value as any).data : null;
                const recommendations: any[] = recommendationsResult.status === 'fulfilled' ? (recommendationsResult.value as any).data ?? [] : [];

                // Merge category counts from RPC (one query, not N)
                const countMap: Record<string, number> = {};
                catCounts.forEach((r: any) => { countMap[r.category] = Number(r.product_count); });
                const catsWithCounts = cats.map((c: any) => ({
                    name: c.name,
                    icon: c.icon_url || '✨',
                    count: countMap[c.name] ?? 0,
                }));

                // Ticker items
                const newTickerItems: string[] = [];
                tickerData?.recent_sales?.forEach((item: any) => {
                    if (item.product_name) newTickerItems.push(`Someone in ${item.region || 'Tanzania'} just bought ${item.product_name}`);
                });
                tickerData?.recent_vendors?.forEach((vendor: any) => {
                    newTickerItems.push(`New artisan '${vendor.store_name}' from ${vendor.region || 'Tanzania'} just joined`);
                });

                // Hero vendor enrichment — fetch all needed vendors in one batched query
                let heroFeaturedProducts: any[] = [];
                if (recommendations.length > 0) {
                    const sellerIds = [...new Set(
                        recommendations.filter((r: any) => r.products?.seller_id).map((r: any) => r.products.seller_id)
                    )];

                    let vendorMap: Record<string, any> = {};
                    if (sellerIds.length > 0) {
                        const { data: vendors } = await supabase
                            .from('public_vendor_profiles')
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

                const firstRec = recommendations.length > 0
                    ? { ...recommendations[0], products: heroFeaturedProducts[0] || null }
                    : null;

                setData({
                    topShops: shopsData || [],
                    userCount: uCount || 0,
                    recentUserAvatars: rUsers?.map((u: any) => u.avatar_url).filter(Boolean) as string[] || [],
                    trendingCategories: catsWithCounts,
                    tickerItems: newTickerItems,
                    weeklyOrderCount: tickerData?.weekly_order_count || 0,
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
