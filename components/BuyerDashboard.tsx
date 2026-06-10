/**
 * BuyerDashboard — complete redesign
 * 
 * Uses data already in AppContext (orders, wishlist) — zero extra fetches.
 * All stats derived client-side from context data, rendering is instant.
 * 
 * Design: clean, personal, warm — focused on the buyer's journey
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { maliGreeting, KitengeStrip } from './MaliSoul';
import {
  ShoppingBag, DollarSign, Star, Wallet,
  TrendingUp, TrendingDown, Heart, ArrowRight,
  Package, Clock, CheckCircle2, XCircle, Truck,
  Tag, RefreshCw
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { formatTZS } from '../constants';
import { Order, Product } from '../types';

// ─── Skeleton ──────────────────────────────────────────────────────────────
const Sk = ({ w = 'w-full', h = 'h-4', r = 'rounded-lg' }: { w?: string; h?: string; r?: string }) => (
  <div className={`${w} ${h} ${r} bg-foreground/[0.06] animate-pulse`} />
);

// ─── KPI Card ──────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon: Icon, accent, trend, sub }: {
  label: string; value: string; icon: React.ElementType;
  accent: string; trend?: { value: number; positive: boolean }; sub?: string;
}) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="relative overflow-hidden rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5"
  >
    <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-15" style={{ background: accent }} />
    <div className="flex items-start justify-between mb-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}20` }}>
        <Icon className="w-4 h-4" style={{ color: accent }} strokeWidth={2} />
      </div>
      {trend && (
        <span className={`flex items-center gap-0.5 text-[10px] font-bold ${trend.positive ? 'text-emerald-500' : 'text-rose-500'}`}>
          {trend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend.value).toFixed(1)}%
        </span>
      )}
    </div>
    <p className="text-xl font-black text-foreground tracking-tight">{value}</p>
    <div className="flex items-center justify-between mt-0.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/40">{label}</p>
      {sub && <p className="text-[10px] text-foreground/30">{sub}</p>}
    </div>
  </motion.div>
);

// ─── Status distribution ────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:     { label: 'Pending',    color: '#f59e0b', icon: Clock },
  processing:  { label: 'Processing', color: '#3b82f6', icon: Package },
  confirmed:   { label: 'Confirmed',  color: '#3b82f6', icon: Package },
  in_transit:  { label: 'Shipped',    color: '#8b5cf6', icon: Truck },
  shipped:     { label: 'Shipped',    color: '#8b5cf6', icon: Truck },
  delivered:   { label: 'Delivered',  color: '#10b981', icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',  color: '#ef4444', icon: XCircle },
  refunded:    { label: 'Refunded',   color: '#f97316', icon: RefreshCw },
};

// ─── Main Component ───────────────────────────────────────────────────────
interface BuyerDashboardProps {
  orders: Order[];
  wishlist: Product[];
  user: any;
  onGoOrders: () => void;
  onGoWishlist: () => void;
  onGoOffers: () => void;
}

export const BuyerDashboard: React.FC<BuyerDashboardProps> = ({
  orders, wishlist, user, onGoOrders, onGoWishlist, onGoOffers,
}) => {
  // ── All stats derived from context data — zero fetches ──────────────────
  const stats = useMemo(() => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now = new Date();
    const excluded = new Set(['cancelled', 'refunded', 'failed']);
    const activeOrders = orders.filter(o => !(o as any).deleted_at);

    let totalSpent = 0, savings = 0;
    const statusDist: Record<string, number> = {};
    const monthlyMap = new Map<string, number>();

    // Init last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyMap.set(`${months[d.getMonth()]} ${d.getFullYear()}`, 0);
    }

    const categories = new Map<string, number>();
    const recentOrders = [...activeOrders].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, 3);

    activeOrders.forEach((o: any) => {
      statusDist[o.status] = (statusDist[o.status] || 0) + 1;
      if (!excluded.has(o.status)) {
        totalSpent += Number(o.total) || 0;
        savings += Number(o.discount_amount) || 0;
        const d = new Date(o.created_at);
        const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
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
      .sort(([,a],[,b]) => b - a).slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    // 30-day vs prev 30-day spending
    const thirtyAgo = new Date(Date.now() - 30 * 86400000);
    const sixtyAgo = new Date(Date.now() - 60 * 86400000);
    let spend30 = 0, spendPrev30 = 0;
    activeOrders.forEach((o: any) => {
      if (excluded.has(o.status)) return;
      const d = new Date(o.created_at);
      if (d >= thirtyAgo) spend30 += Number(o.total) || 0;
      else if (d >= sixtyAgo) spendPrev30 += Number(o.total) || 0;
    });
    const spendTrend = spendPrev30 > 0 ? ((spend30 - spendPrev30) / spendPrev30) * 100 : 0;

    const pending = activeOrders.filter(o => o.status === 'pending' || o.status === 'processing' || o.status === 'confirmed').length;
    const inTransit = activeOrders.filter(o => ['in_transit','shipped'].includes(o.status)).length;

    return {
      totalSpent, savings, spendTrend, spendHistory, categoryDist,
      statusDist, recentOrders, pending, inTransit,
      orderCount: activeOrders.length,
    };
  }, [orders]);

  const COLORS = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#06b6d4'];

  return (
    <div className="space-y-5">
      {/* Time-aware Swahili greeting */}
      <div>
        <h2 className="text-xl font-black tracking-tight text-foreground">
          {maliGreeting(user?.display_name || user?.full_name?.split(' ')[0] || user?.name?.split(' ')[0])}
        </h2>
        <KitengeStrip className="w-16 mt-2" />
      </div>
      {/* Active order alerts */}
      {(stats.pending > 0 || stats.inTransit > 0) && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-2">
          {stats.pending > 0 && (
            <button onClick={onGoOrders}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs font-bold hover:bg-amber-500/15 transition-colors">
              <Clock className="w-3.5 h-3.5" />
              {stats.pending} order{stats.pending > 1 ? 's' : ''} being processed
              <ArrowRight className="w-3 h-3 opacity-60" />
            </button>
          )}
          {stats.inTransit > 0 && (
            <button onClick={onGoOrders}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 text-xs font-bold hover:bg-purple-500/15 transition-colors">
              <Truck className="w-3.5 h-3.5" />
              {stats.inTransit} order{stats.inTransit > 1 ? 's' : ''} on the way
              <ArrowRight className="w-3 h-3 opacity-60" />
            </button>
          )}
        </motion.div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total Orders"
          value={stats.orderCount.toString()}
          icon={ShoppingBag}
          accent="#3b82f6"
          trend={stats.spendTrend ? { value: Math.abs(stats.spendTrend), positive: stats.spendTrend > 0 } : undefined}
        />
        <KpiCard
          label="Total Spent"
          value={formatTZS(stats.totalSpent)}
          icon={DollarSign}
          accent="#10b981"
          sub="all time"
        />
        <KpiCard
          label="Saved"
          value={formatTZS(stats.savings)}
          icon={Tag}
          accent="#f59e0b"
          sub="from discounts"
        />
        <KpiCard
          label="Wishlist"
          value={wishlist.length.toString()}
          icon={Heart}
          accent="#ef4444"
          sub={`${wishlist.length} item${wishlist.length !== 1 ? 's' : ''}`}
        />
      </div>

      {/* Secondary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Wallet Balance"
          value={formatTZS(user.wallet_balance || 0)}
          icon={Wallet}
          accent="#06b6d4"
        />
        <KpiCard
          label="Reward Points"
          value={(user.points || 0).toLocaleString()}
          icon={Star}
          accent="#f59e0b"
        />
        <KpiCard
          label="In Transit"
          value={stats.inTransit.toString()}
          icon={Truck}
          accent="#8b5cf6"
        />
        <KpiCard
          label="Pending"
          value={stats.pending.toString()}
          icon={Clock}
          accent={stats.pending > 0 ? '#f59e0b' : '#94a3b8'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Spending History */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-2 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Spending History</h3>
              <p className="text-[10px] text-foreground/40 uppercase tracking-wider mt-0.5">Last 6 months</p>
            </div>
            <button onClick={onGoOrders}
              className="text-[10px] font-bold text-foreground/40 hover:text-foreground flex items-center gap-1 transition-colors">
              All orders <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {stats.spendHistory.every(d => d.amount === 0) ? (
            <div className="h-44 flex flex-col items-center justify-center text-foreground/25">
              <ShoppingBag className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-xs font-semibold uppercase tracking-widest">No orders yet</p>
              <p className="text-[10px] mt-1 opacity-60">Start shopping to see your spending history</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <AreaChart data={stats.spendHistory} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.4 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v.split(' ')[0]} />
                <YAxis tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.4 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                <Tooltip
                  content={({ active, payload, label }) => active && payload?.length ? (
                    <div className="bg-background border border-foreground/15 rounded-xl px-3 py-2 shadow-xl text-xs">
                      <p className="text-foreground/50 mb-0.5">{label}</p>
                      <p className="font-bold text-foreground">{formatTZS(payload[0].value as number)}</p>
                    </div>
                  ) : null}
                />
                <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} fill="url(#spendGrad)" dot={false}
                  activeDot={{ r: 4, fill: '#3b82f6' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Category breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5"
        >
          <h3 className="text-sm font-bold text-foreground mb-1">Categories</h3>
          <p className="text-[10px] text-foreground/40 uppercase tracking-wider mb-4">Spending breakdown</p>

          {!stats.categoryDist.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-foreground/25">
              <Tag className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs font-semibold uppercase tracking-widest">No data</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {stats.categoryDist.map((c, i) => {
                const max = stats.categoryDist[0].value;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: COLORS[i] }} />
                        <span className="text-[10px] text-foreground/70 truncate max-w-[100px]">{c.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-foreground/50 tabular-nums">{formatTZS(c.value)}</span>
                    </div>
                    <div className="h-1 bg-foreground/[0.06] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: COLORS[i] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(c.value / max) * 100}%` }}
                        transition={{ duration: 0.7, delay: 0.2 + i * 0.08 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Recent Orders + Order Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Orders */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground">Recent Orders</h3>
            <button onClick={onGoOrders}
              className="text-[10px] font-bold text-foreground/40 hover:text-foreground flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {!stats.recentOrders.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-foreground/25">
              <ShoppingBag className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs font-semibold uppercase tracking-widest">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentOrders.map((order: any) => {
                const cfg = STATUS_CFG[order.status] || { label: order.status, color: '#94a3b8', icon: Package };
                const Icon = cfg.icon;
                const firstItem = order.items?.[0];
                const img = (firstItem?.products || firstItem?.product)?.images?.[0];
                return (
                  <div key={order.id} className="flex items-center gap-3 p-3 rounded-xl bg-foreground/[0.02] border border-foreground/[0.06] hover:border-foreground/15 transition-colors">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-foreground/[0.06] shrink-0">
                      {img
                        ? <img src={img} className="w-full h-full object-cover" alt="" loading="lazy" />
                        : <Package className="w-4 h-4 m-3 text-foreground/20" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        #{order.id.slice(0,8).toUpperCase()}
                      </p>
                      <p className="text-[10px] text-foreground/40">
                        {new Date(order.created_at).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-foreground">{formatTZS(Number(order.total))}</p>
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5"
                        style={{ background: `${cfg.color}15`, color: cfg.color }}>
                        <Icon className="w-2.5 h-2.5" />
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Order Status Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5"
        >
          <h3 className="text-sm font-bold text-foreground mb-1">Order Status</h3>
          <p className="text-[10px] text-foreground/40 uppercase tracking-wider mb-4">All time breakdown</p>

          {!Object.keys(stats.statusDist).length ? (
            <div className="flex flex-col items-center justify-center py-8 text-foreground/25">
              <Package className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs font-semibold uppercase tracking-widest">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(stats.statusDist)
                .sort(([,a],[,b]) => b - a)
                .map(([status, count], i) => {
                  const cfg = STATUS_CFG[status] || { label: status, color: '#94a3b8', icon: Package };
                  const Icon = cfg.icon;
                  const total = Object.values(stats.statusDist).reduce((s, v) => s + v, 0);
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${cfg.color}20` }}>
                        <Icon className="w-3 h-3" style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-semibold text-foreground/70">{cfg.label}</span>
                          <span className="text-[10px] font-bold text-foreground tabular-nums">{count}</span>
                        </div>
                        <div className="h-1 bg-foreground/[0.06] rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: cfg.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(count / total) * 100}%` }}
                            transition={{ duration: 0.7, delay: 0.3 + i * 0.06 }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-3 gap-3"
      >
        {[
          { label: 'My Orders', icon: ShoppingBag, color: 'text-blue-600 bg-blue-500/10', action: onGoOrders },
          { label: 'Wishlist', icon: Heart, color: 'text-rose-600 bg-rose-500/10', action: onGoWishlist },
          { label: 'Rewards', icon: Tag, color: 'text-amber-600 bg-amber-500/10', action: onGoOffers },
        ].map(({ label, icon: Icon, color, action }) => (
          <button key={label} onClick={action}
            className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-foreground/[0.02] border border-foreground/[0.08] hover:bg-foreground/[0.05] hover:border-foreground/15 transition-all active:scale-[0.97]">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-4 h-4 stroke-[2]" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">{label}</span>
          </button>
        ))}
      </motion.div>
    </div>
  );
};
