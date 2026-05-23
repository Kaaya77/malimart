import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';

/**
 * useSellerStats v3 — single fast RPC, snapshot-backed.
 *
 * Replaces the two-phase (snapshot + paginated orders) pattern with a single
 * call to get_seller_dashboard_fast which:
 *   - Serves a pre-computed snapshot row if fresh (< 5 min old)
 *   - Triggers recompute only when the snapshot is stale (DB-side, async)
 *   - Returns the full dashboard payload in one round trip
 *
 * Realtime: an orders / order_items channel marks the snapshot stale so the
 * next call automatically gets fresh data without polling.
 */
export const useSellerStats = (sellerId: string | undefined) => {
    const [stats, setStats] = useState({
        revenue: 0, listings: 0, pending: 0, views: 0,
        topProducts: [] as { name: string; count: number; revenue?: number }[],
        topCustomers: [] as { name: string; count: number }[],
        salesVelocity: 0, aov: 0,
        statusDistribution: {} as Record<string, number>,
        revenueTrend: [] as { date: string; revenue: number; name?: string }[],
        // Fulfillment breakdown (new)
        grossRevenue: 0, netRevenue: 0, totalCommission: 0,
        deliveredOrders: 0, cancelledOrders: 0,
        openDisputes: 0, pendingReturns: 0,
        totalFollowers: 0, avgRating: null as number | null,
    });
    const [loading, setLoading] = useState(true);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    const applyPayload = useCallback((data: any) => {
        if (!data) return;

        const products   = data.products   ?? {};
        const fulfil     = data.fulfillments ?? {};
        const reviews    = data.reviews    ?? {};
        const followers  = data.followers  ?? {};
        const disputes   = data.disputes   ?? {};
        const returns_   = data.returns    ?? {};

        setStats({
            revenue:        Number(data.revenue)               ?? 0,
            listings:       Number(products.total_products)    ?? 0,
            pending:        Number(data.pending)               ?? 0,
            views:          0,
            aov:            Number(data.aov)                   ?? 0,
            salesVelocity:  Number(data.sales_velocity)        ?? 0,
            statusDistribution: data.status_distribution       ?? {},
            revenueTrend:   (data.revenue_series ?? []).map((d: any) => ({
                                date: d.day ?? d.date,
                                name: d.name,
                                revenue: Number(d.revenue) ?? 0,
                            })),
            topProducts:    (data.top_products ?? []).map((p: any) => ({
                                name: p.name, count: Number(p.units ?? p.count) ?? 0,
                                revenue: Number(p.revenue) ?? 0,
                            })),
            topCustomers:   (data.top_customers ?? []).map((c: any) => ({
                                name: c.name, count: Number(c.count) ?? 0,
                            })),
            grossRevenue:   Number(fulfil.gross_revenue)       ?? 0,
            netRevenue:     Number(fulfil.net_revenue)         ?? 0,
            totalCommission:Number(fulfil.total_commission)    ?? 0,
            deliveredOrders:Number(fulfil.delivered_fulfillments) ?? 0,
            cancelledOrders:Number(fulfil.cancelled_fulfillments) ?? 0,
            openDisputes:   Number(disputes.open_disputes)     ?? 0,
            pendingReturns: Number(returns_.pending_returns)   ?? 0,
            totalFollowers: Number(followers.total_followers)  ?? 0,
            avgRating:      reviews.avg_rating != null ? Number(reviews.avg_rating) : null,
        });
        setLoading(false);
    }, []);

    const load = useCallback(async (silent = false) => {
        if (!sellerId) return;
        if (!silent) setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_seller_dashboard_fast', {
                p_seller_id: sellerId,
            });
            if (error) throw error;
            applyPayload(data);
        } catch (err: any) {
            console.error('[useSellerStats] RPC failed:', err?.message);
            setLoading(false);
        }
    }, [sellerId, applyPayload]);

    useEffect(() => {
        load();

        // Realtime: re-fetch silently when orders / items change for this seller
        if (sellerId) {
            channelRef.current = supabase
                .channel(`seller-stats:${sellerId}`)
                .on('postgres_changes', {
                    event: '*', schema: 'public', table: 'order_items',
                    filter: `seller_id=eq.${sellerId}`,
                }, () => load(true))
                .on('postgres_changes', {
                    event: '*', schema: 'public', table: 'fulfillments',
                    filter: `seller_id=eq.${sellerId}`,
                }, () => load(true))
                .on('postgres_changes', {
                    event: '*', schema: 'public', table: 'products',
                    filter: `seller_id=eq.${sellerId}`,
                }, () => load(true))
                .subscribe();
        }

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [sellerId, load]);

    return { stats, loading, refresh: () => load() };
};
