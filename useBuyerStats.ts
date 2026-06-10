import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAppState } from '../../context/AppContext';

/**
 * useBuyerStats — uses get_buyer_orders RPC. Same pattern as useSellerStats.
 * No PostgREST nested joins. No ambiguous column names. Works.
 */
export const useBuyerStats = () => {
    const { user, orders } = useAppState();
    const [stats, setStats] = useState({
        totalSpent: 0,
        orderCount: 0,
        savings: 0,
        spendingHistory: [] as { month: string; amount: number }[],
        categoryDistribution: [] as { name: string; value: number }[],
        isLoading: true,
    });

    // Derive stats from orders already in context (fetched via RPC)
    useEffect(() => {
        if (!user) return;

        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const now = new Date();
        const historyMap = new Map<string, number>();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            historyMap.set(`${months[d.getMonth()]} ${d.getFullYear()}`, 0);
        }

        let totalSpent = 0;
        let savings = 0;
        const categories = new Map<string, number>();

        (orders as any[]).forEach((order: any) => {
            if (['cancelled','refunded','failed'].includes(order.status)) return;
            const orderTotal = Number(order.total) || 0;
            totalSpent += orderTotal;
            savings += Number(order.discount_amount) || 0;

            const date = new Date(order.created_at);
            const key = `${months[date.getMonth()]} ${date.getFullYear()}`;
            if (historyMap.has(key)) historyMap.set(key, (historyMap.get(key) || 0) + orderTotal);

            (order.items || []).forEach((item: any) => {
                const prod = item.products || item.product || {};
                const cat = prod.category || 'Other';
                const amount = Number(item.price_at_purchase) * Number(item.quantity);
                if (amount > 0) categories.set(cat, (categories.get(cat) || 0) + amount);
            });
        });

        setStats({
            totalSpent,
            orderCount: orders.length,
            savings,
            spendingHistory: Array.from(historyMap.entries()).map(([month, amount]) => ({ month, amount })),
            categoryDistribution: Array.from(categories.entries()).map(([name, value]) => ({ name, value })),
            isLoading: false,
        });
    }, [user, orders]);

    return stats;
};
