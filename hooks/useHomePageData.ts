import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { VendorProfile } from '../types';

// FIX: Hero recommendation query now:
//   1. Fetches up to 4 approved hero_recommendations (not just 1) so the
//      hero carousel can display multiple admin-curated products.
//   2. Joins vendor_profiles!seller_id to resolve seller store_name and
//      is_verified — these live on vendor_profiles, not on products or profiles.
//   3. Normalises each recommendation into a flat `heroProduct` shape that
//      HeroSection can consume directly without further processing.

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
        // NEW: array of all approved featured products for multi-slide hero
        heroFeaturedProducts: [] as any[],
        loadingShops: true
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Fetch Shops with retry logic
                let shopsData = null;
                let retryCount = 0;
                const maxRetries = 2;

                while (retryCount <= maxRetries) {
                    try {
                        const { data, error } = await supabase
                            .from('vendor_profiles')
                            .select('*')
                            .eq('is_verified', true)
                            .limit(6);
                        if (error) throw error;
                        shopsData = data;
                        break;
                    } catch (e) {
                        retryCount++;
                        if (retryCount > maxRetries) throw e;
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                    }
                }

                // Fetch User Count
                const { count: uCount } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true });

                // Fetch Recent User Avatars
                const { data: rUsers } = await supabase
                    .from('profiles')
                    .select('avatar_url')
                    .not('avatar_url', 'is', null)
                    .limit(3);

                // Fetch Real Categories for Pills with Counts
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
                        return {
                            name: c.name,
                            icon: c.icon_url || '✨',
                            count: count || 0
                        };
                    }));
                }

                // Fetch Recent Orders for Ticker
                const { data: recentOrders } = await supabase
                    .from('order_items')
                    .select('product_id, products(name), orders(profiles:user_id(region))')
                    .order('created_at', { ascending: false })
                    .limit(3);

                // Fetch Recent Vendors for Ticker
                const { data: recentVendors } = await supabase
                    .from('vendor_profiles')
                    .select('store_name, region')
                    .order('created_at', { ascending: false })
                    .limit(2);

                const newTickerItems: string[] = [];
                if (recentOrders && recentOrders.length > 0) {
                    recentOrders.forEach((item: any) => {
                        if (item.products && item.orders?.profiles) {
                            newTickerItems.push(`Someone in ${item.orders.profiles.region || 'Tanzania'} just bought ${item.products.name}`);
                        }
                    });
                }
                if (recentVendors && recentVendors.length > 0) {
                    recentVendors.forEach((vendor: any) => {
                        newTickerItems.push(`New artisan '${vendor.store_name}' from ${vendor.region || 'Tanzania'} just joined`);
                    });
                }

                // Fetch Weekly Order Count
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const { count: wCount } = await supabase
                    .from('order_items')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', sevenDaysAgo.toISOString());

                // Fetch Hero Settings
                const { data: settings } = await supabase
                    .from('platform_settings')
                    .select('hero_badge_text, hero_headline, hero_subheadline')
                    .eq('id', 1)
                    .maybeSingle();

                // FIX: Fetch up to 4 approved hero recommendations, joining
                // vendor_profiles to get store_name + is_verified on the product.
                const { data: recommendations } = await supabase
                    .from('hero_recommendations')
                    .select(`
                        *,
                        products (
                            id, name, description, price, base_price, sale_price,
                            images, category, stock, rating, review_count,
                            is_boosted, status, variants, seller_id,
                            vendor_profiles!seller_id (
                                store_name, is_verified, logo_url, region
                            )
                        )
                    `)
                    .eq('status', 'approved')
                    .order('approved_at', { ascending: false })
                    .limit(4);

                // Normalise into hero product shape HeroSection expects
                const heroFeaturedProducts = (recommendations || [])
                    .filter((rec: any) => rec.products)
                    .map((rec: any) => {
                        const p = rec.products;
                        const vendor = p.vendor_profiles;
                        return {
                            // Product fields
                            ...p,
                            // Flatten vendor fields onto product (what HeroSection reads)
                            seller_name: vendor?.store_name || null,
                            is_verified: vendor?.is_verified || false,
                            seller_logo: vendor?.logo_url || null,
                            seller_region: vendor?.region || null,
                            // price fallback chain
                            price: p.price ?? p.sale_price ?? p.base_price ?? 0,
                            // Hero recommendation metadata
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

                // Keep backward-compat heroRecommendation (first rec, raw shape)
                const firstRec = recommendations && recommendations.length > 0
                    ? {
                        ...recommendations[0],
                        // Attach products array shape that HeroSection's old path expects
                        products: heroFeaturedProducts[0] || null,
                    }
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
