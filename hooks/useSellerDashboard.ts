import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

export const SELLER_SNAPSHOT_KEY = (sellerId: string) => ['seller', 'snapshot', sellerId];
export const SELLER_FULL_KEY     = (sellerId: string) => ['seller', 'full',     sellerId];

/** Phase 1 — pre-computed snapshot, instant KPIs */
export function useSellerSnapshot(sellerId: string | undefined) {
    return useQuery({
        queryKey:  SELLER_SNAPSHOT_KEY(sellerId ?? ''),
        queryFn:   async () => {
            const { data, error } = await supabase.rpc('get_seller_snapshot', { p_seller_id: sellerId });
            if (error) throw error;
            return data;
        },
        enabled:   !!sellerId,
        staleTime: 30_000,   // 30s — snapshot is cheap, keep it fresh
    });
}

/** Phase 2 — full aggregated stats from the DB RPC (no client-side reduce) */
export function useSellerFullStats(sellerId: string | undefined) {
    return useQuery({
        queryKey:  SELLER_FULL_KEY(sellerId ?? ''),
        queryFn:   async () => {
            const { data, error } = await supabase.rpc('get_seller_full_stats', {
                p_seller_id: sellerId,
                p_days: 30,
            });
            if (error) throw error;
            const d = data as any;
            return {
                revenue:        Number(d.revenue)        || 0,
                pending:        Number(d.pending)        || 0,
                aov:            Number(d.aov)            || 0,
                totalOrders:    Number(d.total_orders)   || 0,
                revTrend7:      Number(d.rev_trend7)     || 0,
                rev7:           Number(d.rev7)           || 0,
                topProducts:    d.top_products   ?? [],
                topCustomers:   d.top_customers  ?? [],
                revenueTrend:   d.revenue_trend  ?? [],
                statusDist:     d.status_dist    ?? {},
                retentionRate:  Number(d.retention_rate)  || 0,
                totalCustomers: Number(d.total_customers) || 0,
                lowStockCount:  Number(d.low_stock_count) || 0,
                avgRating:      Number(d.avg_rating)      || 0,
                listings:       Number(d.listings)        || 0,
            };
        },
        enabled:   !!sellerId,
        staleTime: 3 * 60_000,  // 3 min — aligns with snapshot TTL
    });
}

/** Lightweight fetch of pending orders for inline dashboard actions */
export function useSellerPendingOrders(sellerId: string | undefined) {
    return useQuery({
        queryKey:  ['seller', 'pending-orders', sellerId],
        queryFn:   async () => {
            const { data, error } = await supabase
                .from('orders')
                .select('id, total, created_at, status, profiles:user_id(display_name, full_name)')
                .eq('seller_id', sellerId!)
                .in('status', ['pending', 'processing', 'confirmed'])
                .order('created_at', { ascending: true })
                .limit(5);
            if (error) throw error;
            return (data ?? []).map((o: any) => ({
                id: o.id,
                total: o.total,
                status: o.status,
                created_at: o.created_at,
                buyer_name: o.profiles?.display_name || o.profiles?.full_name || 'Customer',
            }));
        },
        enabled:   !!sellerId,
        staleTime: 20_000,
    });
}

/** Today vs yesterday stats for the top-of-dashboard strip */
export function useSellerTodayStats(sellerId: string | undefined) {
    return useQuery({
        queryKey: ['seller', 'today', sellerId],
        queryFn: async () => {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const yesterdayStart = new Date(todayStart);
            yesterdayStart.setDate(yesterdayStart.getDate() - 1);

            const { data, error } = await supabase
                .from('orders')
                .select('total, created_at')
                .eq('seller_id', sellerId!)
                .gte('created_at', yesterdayStart.toISOString())
                .not('status', 'in', '(cancelled,refunded)');
            if (error) throw error;

            const today = (data ?? []).filter(o => new Date(o.created_at) >= todayStart);
            const yesterday = (data ?? []).filter(o => new Date(o.created_at) < todayStart);
            return {
                todayOrders:      today.length,
                todayRevenue:     today.reduce((s, o) => s + Number(o.total), 0),
                yesterdayOrders:  yesterday.length,
                yesterdayRevenue: yesterday.reduce((s, o) => s + Number(o.total), 0),
            };
        },
        enabled: !!sellerId,
        staleTime: 60_000,
        refetchInterval: 5 * 60_000,
    });
}

/**
 * Wires up Supabase Realtime to invalidate the TanStack Query cache
 * whenever this seller's order_items or products change.
 * Drop this hook in the same component that calls useSellerSnapshot/useSellerFullStats.
 */
export function useSellerDashboardRealtime(sellerId: string | undefined) {
    const qc = useQueryClient();
    useEffect(() => {
        if (!sellerId) return;
        const ch = supabase
            .channel(`seller-dash-rt-${sellerId}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'order_items', filter: `seller_id=eq.${sellerId}` },
                () => {
                    qc.invalidateQueries({ queryKey: SELLER_SNAPSHOT_KEY(sellerId) });
                    qc.invalidateQueries({ queryKey: SELLER_FULL_KEY(sellerId) });
                })
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'products', filter: `seller_id=eq.${sellerId}` },
                () => qc.invalidateQueries({ queryKey: SELLER_FULL_KEY(sellerId) }))
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [sellerId, qc]);
}
