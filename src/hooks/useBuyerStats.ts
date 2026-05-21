
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAppState } from '../../context/AppContext';

export const useBuyerStats = () => {
    const { user } = useAppState();
    const [stats, setStats] = useState({
        totalSpent: 0,
        orderCount: 0,
        savings: 0,
        spendingHistory: [] as { month: string, amount: number }[],
        categoryDistribution: [] as { name: string, value: number }[],
        isLoading: true
    });

    useEffect(() => {
        if (!user) return;

        const fetchStats = async () => {
            try {
                // Fetch orders
                const { data: orders, error: ordersError } = await supabase
                    .from('orders')
                    .select('total, discount, created_at, status, items:order_items(price_at_purchase, quantity, product:products(category))')
                    .eq('user_id', user.id);

                if (ordersError) throw ordersError;

                let totalSpent = 0;
                let orderCount = orders?.length || 0;
                
                // Calculate spending history (last 6 months)
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const historyMap = new Map<string, number>();
                
                const now = new Date();
                for (let i = 5; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
                    historyMap.set(key, 0);
                }

                const categories = new Map<string, number>();

                orders?.forEach(order => {
                    if (order.status !== 'cancelled') {
                        const orderTotal = Number(order.total) || 0;
                        totalSpent += orderTotal;
                        
                        const date = new Date(order.created_at);
                        const key = `${months[date.getMonth()]} ${date.getFullYear()}`;
                        if (historyMap.has(key)) {
                            historyMap.set(key, (historyMap.get(key) || 0) + orderTotal);
                        }

                        order.items?.forEach((item: any) => {
                            const cat = item.product?.category || item.products?.category || 'Other';
                            const itemPrice = Number(item.price_at_purchase) || 0;
                            const itemQty = Number(item.quantity) || 0;
                            categories.set(cat, (categories.get(cat) || 0) + (itemPrice * itemQty));
                        });
                    }
                });

                const spendingHistory = Array.from(historyMap.entries()).map(([month, amount]) => ({ month, amount }));
                // Calculate real savings from discount field on orders
                let savings = 0;
                orders?.forEach((order: any) => {
                    if (order.status !== 'cancelled' && order.discount) {
                        savings += Number(order.discount) || 0;
                    }
                });
                const categoryDistribution = Array.from(categories.entries()).map(([name, value]) => ({ name, value }));

                setStats({
                    totalSpent,
                    orderCount,
                    savings,
                    spendingHistory,
                    categoryDistribution,
                    isLoading: false
                });
            } catch (error) {
                console.error("Error fetching buyer stats:", error);
                setStats(prev => ({ ...prev, isLoading: false }));
            }
        };

        fetchStats();
    }, [user]);

    return stats;
};
