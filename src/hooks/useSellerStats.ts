import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

export const useSellerStats = (sellerId: string | undefined) => {
    const [stats, setStats] = useState({ 
        revenue: 0, 
        listings: 0, 
        pending: 0, 
        views: 0,
        topProducts: [] as any[],
        topCustomers: [] as any[],
        salesVelocity: 0,
        aov: 0,
        statusDistribution: {} as Record<string, number>,
        revenueTrend: [] as any[]
    });
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        if (!sellerId) return;
        setLoading(true);

        // Fetch Listings
        const { count: productCount } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('seller_id', sellerId)
            .eq('status', 'active');

        // Fetch Revenue, Pending Orders, Top Products, Top Customers
        const { data: orderItems } = await supabase
            .from('order_items')
            .select('price_at_purchase, quantity, product_id, order:orders(status, user_id, created_at)')
            .eq('seller_id', sellerId);
        
        let revenue = 0;
        let pending = 0;
        const productSales: Record<string, number> = {};
        const customerOrders: Record<string, number> = {};
        let totalOrders = 0;
        let firstOrderDate = new Date();

        if (orderItems) {
            orderItems.forEach((item: any) => {
                if (item.order) {
                    if (item.order.status !== 'cancelled' && item.order.status !== 'refunded') {
                        revenue += item.price_at_purchase * item.quantity;
                        
                        // Track Product Sales
                        productSales[item.product_id] = (productSales[item.product_id] || 0) + item.quantity;
                        
                        // Track Customer Orders
                        customerOrders[item.order.user_id] = (customerOrders[item.order.user_id] || 0) + 1;
                        
                        totalOrders++;
                        const orderDate = new Date(item.order.created_at);
                        if (orderDate < firstOrderDate) firstOrderDate = orderDate;
                    }
                    if (item.order.status === 'pending') {
                        pending++;
                    }
                }
            });
        }

        // Calculate Sales Velocity (orders per day)
        const daysActive = Math.max(1, (new Date().getTime() - firstOrderDate.getTime()) / (1000 * 60 * 60 * 24));
        const salesVelocity = totalOrders / daysActive;

        // Sort Top Products
        const topProductsData = Object.entries(productSales)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);
        
        const { data: productNames } = await supabase
            .from('products')
            .select('id, name')
            .in('id', topProductsData.map(([id]) => id));
        
        const topProducts = topProductsData.map(([id, count]) => ({
            name: productNames?.find(p => p.id === id)?.name || 'Unknown',
            count
        }));

        // Sort Top Customers
        const topCustomersData = Object.entries(customerOrders)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        const { data: customerNames } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', topCustomersData.map(([id]) => id));

        const topCustomers = topCustomersData.map(([id, count]) => ({
            name: customerNames?.find(c => c.id === id)?.full_name || 'Unknown',
            count
        }));

        // Calculate AOV
        const aov = totalOrders > 0 ? revenue / totalOrders : 0;

        // Order Status Distribution
        const statusDistribution: Record<string, number> = {};
        
        // Count from orderItems' order status
        orderItems?.forEach((item: any) => {
            if (item.order) {
                statusDistribution[item.order.status] = (statusDistribution[item.order.status] || 0) + 1;
            }
        });

        // Revenue over time (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const dailyRevenue: Record<string, number> = {};
        
        orderItems?.forEach((item: any) => {
            if (item.order && item.order.status !== 'cancelled' && item.order.status !== 'refunded') {
                const date = new Date(item.order.created_at).toISOString().split('T')[0];
                if (new Date(date) >= thirtyDaysAgo) {
                    dailyRevenue[date] = (dailyRevenue[date] || 0) + (item.price_at_purchase * item.quantity);
                }
            }
        });

        const revenueTrend = Object.entries(dailyRevenue)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, revenue]) => ({ date, revenue }));

        setStats({
            revenue,
            listings: productCount || 0,
            views: 0, // Placeholder
            pending,
            topProducts,
            topCustomers,
            salesVelocity,
            aov,
            statusDistribution,
            revenueTrend
        });
        setLoading(false);
    };

    useEffect(() => {
        fetchStats();

        // Real-time subscription
        const channel = supabase
            .channel('seller-stats-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchStats)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchStats)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [sellerId]);

    return { stats, loading };
};
