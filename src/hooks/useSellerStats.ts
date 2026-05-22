import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';

/**
 * useSellerStats — powered by get_seller_orders RPC (SECURITY DEFINER).
 * Bypasses RLS complexity entirely. Fast, correct, real-time.
 */
export const useSellerStats = (sellerId: string | undefined) => {
    const [stats, setStats] = useState({
        revenue: 0,
        listings: 0,
        pending: 0,
        views: 0,
        topProducts: [] as { name: string; count: number }[],
        topCustomers: [] as { name: string; count: number }[],
        salesVelocity: 0,
        aov: 0,
        statusDistribution: {} as Record<string, number>,
        revenueTrend: [] as { date: string; revenue: number }[],
    });
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        if (!sellerId) return;
        setLoading(true);
        try {
            // Listings count
            const { count: productCount } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('seller_id', sellerId)
                .eq('status', 'active');

            // All order data via SECURITY DEFINER RPC
            const { data: rows, error } = await supabase
                .rpc('get_seller_orders', { p_seller_id: sellerId });

            if (error) throw error;

            const items = (rows || []) as any[];

            // De-duplicate by order_id for order-level stats
            const orderMap = new Map<string, any>();
            items.forEach(r => {
                if (!orderMap.has(r.order_id)) {
                    orderMap.set(r.order_id, {
                        order_id: r.order_id,
                        status: r.order_status,
                        total: Number(r.total) || 0,
                        created_at: r.order_created_at,
                        buyer_id: r.buyer_id,
                        buyer_name: r.buyer_name,
                    });
                }
            });

            const orders = Array.from(orderMap.values());

            // Revenue (exclude cancelled/refunded/failed)
            const excluded = new Set(['cancelled', 'refunded', 'failed']);
            let revenue = 0;
            let pending = 0;
            const productSales: Record<string, number> = {};
            const customerOrders: Record<string, number> = {};
            let totalOrders = 0;
            let firstOrderDate = new Date();
            const statusDistribution: Record<string, number> = {};
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const dailyRevenue: Record<string, number> = {};

            orders.forEach(o => {
                statusDistribution[o.status] = (statusDistribution[o.status] || 0) + 1;
                if (o.status === 'pending') pending++;
                if (!excluded.has(o.status)) {
                    revenue += o.total;
                    totalOrders++;
                    customerOrders[o.buyer_id] = (customerOrders[o.buyer_id] || 0) + 1;
                    const d = new Date(o.created_at);
                    if (d < firstOrderDate) firstOrderDate = d;
                    const dateStr = d.toISOString().split('T')[0];
                    if (d >= thirtyDaysAgo) {
                        dailyRevenue[dateStr] = (dailyRevenue[dateStr] || 0) + o.total;
                    }
                }
            });

            // Product sales from items
            items.forEach(r => {
                if (!excluded.has(r.order_status)) {
                    productSales[r.product_id] = (productSales[r.product_id] || 0) + Number(r.quantity);
                }
            });

            const daysActive = Math.max(1, (Date.now() - firstOrderDate.getTime()) / 86400000);
            const salesVelocity = totalOrders / daysActive;
            const aov = totalOrders > 0 ? revenue / totalOrders : 0;

            // Top products — names already in rows
            const productNames = new Map(items.map(r => [r.product_id, r.product_name]));
            const topProducts = Object.entries(productSales)
                .sort(([, a], [, b]) => b - a).slice(0, 5)
                .map(([id, count]) => ({ name: productNames.get(id) || 'Unknown', count }));

            // Top customers — names already in rows
            const customerNames = new Map(orders.map(o => [o.buyer_id, o.buyer_name]));
            const topCustomers = Object.entries(customerOrders)
                .sort(([, a], [, b]) => b - a).slice(0, 5)
                .map(([id, count]) => ({ name: customerNames.get(id) || 'Unknown', count }));

            const revenueTrend = Object.entries(dailyRevenue)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, rev]) => ({ date, revenue: rev }));

            setStats({
                revenue, listings: productCount || 0, views: 0,
                pending, topProducts, topCustomers,
                salesVelocity, aov, statusDistribution, revenueTrend,
            });
        } catch (err: any) {
            console.error('[useSellerStats]', err.message);
        } finally {
            setLoading(false);
        }
    }, [sellerId]);

    useEffect(() => {
        fetchStats();
        if (!sellerId) return;

        // Realtime: refresh when order_items or products change for this seller
        const channel = supabase.channel(`seller-stats-${sellerId}`)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'order_items',
                filter: `seller_id=eq.${sellerId}`,
            }, fetchStats)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'orders',
            }, fetchStats)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'products',
                filter: `seller_id=eq.${sellerId}`,
            }, fetchStats)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [sellerId, fetchStats]);

    return { stats, loading };
};
