import { useMemo } from 'react';
import { Order } from '../../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EXCLUDED = new Set(['cancelled', 'refunded', 'failed']);

export function useDashboardStats(orders: Order[]) {
  return useMemo(() => {
    const now = new Date();
    const activeOrders = orders.filter(o => !(o as any).deleted_at);
    let totalSpent = 0, savings = 0;
    const statusDist: Record<string, number> = {};
    const monthlyMap = new Map<string, number>();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyMap.set(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`, 0);
    }

    const categories = new Map<string, number>();
    const recentOrders = [...activeOrders]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 4);

    activeOrders.forEach((o: any) => {
      statusDist[o.status] = (statusDist[o.status] || 0) + 1;
      if (!EXCLUDED.has(o.status)) {
        totalSpent += Number(o.total) || 0;
        savings += Number(o.discount_amount) || 0;
        const d = new Date(o.created_at);
        const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
        if (monthlyMap.has(key)) monthlyMap.set(key, (monthlyMap.get(key) || 0) + Number(o.total));
        (o.items || []).forEach((item: any) => {
          const prod = item.products || item.product || {};
          const cat = prod.category || 'Other';
          const amt = Number(item.price_at_purchase || item.price || 0) * Number(item.quantity || 1);
          if (amt > 0) categories.set(cat, (categories.get(cat) || 0) + amt);
        });
      }
    });

    const spendHistory = Array.from(monthlyMap.entries()).map(([month, amount]) => ({ month, amount }));
    const categoryDist = Array.from(categories.entries())
      .sort(([, a], [, b]) => b - a).slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    const thirtyAgo = new Date(Date.now() - 30 * 86400000);
    const sixtyAgo = new Date(Date.now() - 60 * 86400000);
    let spend30 = 0, spendPrev30 = 0;
    activeOrders.forEach((o: any) => {
      if (EXCLUDED.has(o.status)) return;
      const d = new Date(o.created_at);
      if (d >= thirtyAgo) spend30 += Number(o.total) || 0;
      else if (d >= sixtyAgo) spendPrev30 += Number(o.total) || 0;
    });
    const spendTrend = spendPrev30 > 0 ? ((spend30 - spendPrev30) / spendPrev30) * 100 : 0;

    const pending = activeOrders.filter(o => ['pending', 'processing', 'confirmed'].includes(o.status)).length;
    const inTransit = activeOrders.filter(o => ['in_transit', 'shipped'].includes(o.status)).length;
    const inTransitOrders = activeOrders
      .filter(o => ['in_transit', 'shipped'].includes(o.status))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      totalSpent, savings, spendTrend, spendHistory, categoryDist,
      statusDist, recentOrders, pending, inTransit, inTransitOrders,
      orderCount: activeOrders.length,
    };
  }, [orders]);
}
