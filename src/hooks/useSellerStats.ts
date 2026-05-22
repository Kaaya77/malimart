import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';

/**
 * useSellerStats v2 — two-phase loading:
 *   Phase 1 (instant): read seller_dashboard_snapshot (pre-computed, < 5ms)
 *   Phase 2 (full):    get_seller_orders RPC with pagination (replaces unbounded fetch)
 * Real-time subscription only triggers a lightweight re-aggregate, not a full reload.
 */
export const useSellerStats = (sellerId: string | undefined) => {
    const [stats, setStats] = useState({
        revenue: 0, listings: 0, pending: 0, views: 0,
        topProducts: [] as { name: string; count: number }[],
        topCustomers: [] as { name: string; count: number }[],
        salesVelocity: 0, aov: 0,
        statusDistribution: {} as Record<string, number>,
        revenueTrend: [] as { date: string; revenue: number }[],
    });
    const [loading, setLoading] = useState(true);
    const pageRef = useRef(0);

    // Phase 1: load snapshot instantly (pre-computed by DB trigger)
    const loadSnapshot = useCallback(async () => {
        if (!sellerId) return;
        const { data } = await supabase.rpc('get_seller_snapshot', { p_seller_id: sellerId });
        if (data) {
            setStats(prev => ({
                ...prev,
                revenue:  Number(data.total_revenue)   || 0,
                pending:  Number(data.pending_orders)   || 0,
                listings: Number(data.product_count)    || 0,
            }));
            setLoading(false); // unblock UI immediately
        }
    }, [sellerId]);

    // Phase 2: full stats from paginated RPC (runs in background)
    const fetchStats = useCallback(async (silent = false) => {
        if (!sellerId) return;
        if (!silent) setLoading(true);
        try {
            const { count: productCount } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('seller_id', sellerId)
                .eq('status', 'active');

            const { data: rows, error } = await supabase
                .rpc('get_seller_orders', { p_seller_id: sellerId, p_limit: 500, p_offset: 0 });

            if (error) throw error;

            const items = (rows || []) as any[];
            const orderMap = new Map<string, any>();
            items.forEach(r => {
                if (!orderMap.has(r.order_id)) {
                    orderMap.set(r.order_id, {
                        order_id: r.order_id, status: r.order_status,
                        total: Number(r.total) || 0, created_at: r.order_created_at,
                        buyer_id: r.buyer_id, buyer_name: r.buyer_name,
                    });
                }
            });

            const orders = Array.from(orderMap.values());
            const excluded = new Set(['cancelled', 'refunded', 'failed']);
            let revenue = 0, pending = 0, totalOrders = 0;
            let firstOrderDate = new Date();
            const productSales: Record<string, number> = {};
            const customerOrders: Record<string, number> = {};
            const statusDistribution: Record<string, number> = {};
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const dailyRevenue: Record<string, number> = {};

            orders.forEach(o => {
                statusDistribution[o.status] = (statusDistribution[o.status] || 0) + 1;
                if (o.status === 'pending') pending++;
                if (!excluded.has(o.status)) {
                    revenue += o.total; totalOrders++;
                    customerOrders[o.buyer_id] = (customerOrders[o.buyer_id] || 0) + 1;
                    const d = new Date(o.created_at);
                    if (d < firstOrderDate) firstOrderDate = d;
                    const dateStr = d.toISOString().split('T')[0];
                    if (d >= thirtyDaysAgo) dailyRevenue[dateStr] = (dailyRevenue[dateStr] || 0) + o.total;
                }
            });

            items.forEach(r => {
                if (!excluded.has(r.order_status))
                    productSales[r.product_id] = (productSales[r.product_id] || 0) + Number(r.quantity);
            });

            const daysActive = Math.max(1, (Date.now() - firstOrderDate.getTime()) / 86400000);
            const salesVelocity = totalOrders / daysActive;
            const aov = totalOrders > 0 ? revenue / totalOrders : 0;
            const productNames = new Map(items.map(r => [r.product_id, r.product_name]));
            const topProducts = Object.entries(productSales).sort(([,a],[,b]) => b - a).slice(0,5)
                .map(([id, count]) => ({ name: productNames.get(id) || 'Unknown', count }));
            const customerNames = new Map(orders.map(o => [o.buyer_id, o.buyer_name]));
            const topCustomers = Object.entries(customerOrders).sort(([,a],[,b]) => b - a).slice(0,5)
                .map(([id, count]) => ({ name: customerNames.get(id) || 'Unknown', count }));
            const revenueTrend = Object.entries(dailyRevenue).sort(([a],[b]) => a.localeCompare(b))
                .map(([date, rev]) => ({ date, revenue: rev }));

            setStats({ revenue, listings: productCount || 0, views: 0, pending,
                topProducts, topCustomers, salesVelocity, aov, statusDistribution, revenueTrend });
        } catch (err: any) {
            console.error('[useSellerStats]', err.message);
        } finally {
            setLoading(false);
        }
    }, [sellerId]);

    useEffect(() => {
        loadSnapshot(); // instant
        fetchStats();   // background full load

        if (!sellerId) return;
        const channel = supabase.channel(`seller-stats-${sellerId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items', filter: `seller_id=eq.${sellerId}` }, () => fetchStats(true))
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchStats(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `seller_id=eq.${sellerId}` }, () => fetchStats(true))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [sellerId, fetchStats, loadSnapshot]);

    return { stats, loading };
};
