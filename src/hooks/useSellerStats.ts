import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import { getSellerDashboard } from '../../services/dashboardService';

/**
 * useSellerStats — server-aggregated via get_seller_dashboard RPC.
 *
 * Previously this hook called get_seller_orders (which returns ONE ROW per
 * order_item) and aggregated revenue / pending / AOV / top-products / top-
 * customers / status-distribution / revenue-trend in JS. With 1000 orders a
 * seller would ship ~3-5k rows over the wire on every dashboard load AND on
 * every realtime tick (because the channel filter was missing).
 *
 * Now every aggregate is computed in Postgres in a single CTE pipeline. The
 * payload is a single JSON object of fixed size regardless of order volume.
 * The shape of `stats` returned by this hook is byte-compatible with the
 * legacy version, so SellerAnalytics and AdvancedAnalytics need no changes.
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

    // Debounce realtime-triggered refetches. Bulk operations (e.g. confirming
    // many orders) would otherwise fire the RPC once per row update.
    const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchStats = useCallback(async () => {
        if (!sellerId) return;
        setLoading(true);
        try {
            const d = await getSellerDashboard(sellerId, 30);
            if (!d) return;

            setStats({
                revenue:  Number(d.revenue ?? d.fulfillments?.gross_revenue ?? 0),
                listings: Number(d.products?.active_products ?? 0),
                pending:  Number(d.pending ?? d.fulfillments?.pending_fulfillments ?? 0),
                views:    0,
                topProducts:        (d.top_products as any[]) ?? [],
                topCustomers:       (d.top_customers as any[]) ?? [],
                salesVelocity:      Number(d.sales_velocity ?? 0),
                aov:                Number(d.aov ?? 0),
                statusDistribution: (d.status_distribution as Record<string, number>) ?? {},
                revenueTrend:       (d.revenue_series as any[]) ?? [],
            });
        } catch (err: any) {
            console.error('[useSellerStats]', err.message);
        } finally {
            setLoading(false);
        }
    }, [sellerId]);

    const scheduleRefetch = useCallback(() => {
        if (refetchTimer.current) clearTimeout(refetchTimer.current);
        refetchTimer.current = setTimeout(fetchStats, 500);
    }, [fetchStats]);

    useEffect(() => {
        fetchStats();
        if (!sellerId) return;

        // Realtime: refresh on changes that actually affect this seller.
        // Previously the orders subscription had NO filter — meaning every
        // order on the platform triggered a full re-aggregate. Now scoped.
        const channel = supabase.channel(`seller-stats:${sellerId}`)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'order_items',
                filter: `seller_id=eq.${sellerId}`,
            }, scheduleRefetch)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'fulfillments',
                filter: `seller_id=eq.${sellerId}`,
            }, scheduleRefetch)
            .subscribe();

        return () => {
            if (refetchTimer.current) clearTimeout(refetchTimer.current);
            supabase.removeChannel(channel);
        };
    }, [sellerId, fetchStats, scheduleRefetch]);

    return { stats, loading, refetch: fetchStats };
};
