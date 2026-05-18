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
                        const { data, error } = await supabase.from('vendor_profiles').select('*').eq('is_verified', true).limit(6);
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
                const { count: uCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
                
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
                const { data: settings } = await supabase.from('platform_settings').select('hero_badge_text, hero_headline, hero_subheadline').eq('id', 1).maybeSingle();
                
                // Fetch Approved Hero Recommendation
                const { data: recommendations } = await supabase
                    .from('hero_recommendations')
                    .select('*, products(*, profiles!seller_id(*))')
                    .eq('status', 'approved')
                    .order('approved_at', { ascending: false })
                    .limit(1);
                
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
                    heroRecommendation: recommendations && recommendations.length > 0 ? recommendations[0] : null,
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
