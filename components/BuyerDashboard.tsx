/**
 * BuyerDashboard — complete redesign v2
 * Zero extra fetches — all derived from AppContext props.
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { maliGreeting, KitengeStrip } from './MaliSoul';
import {
  ShoppingBag, DollarSign, Star, Wallet,
  TrendingUp, TrendingDown, Heart, ArrowRight,
  Package, Clock, CheckCircle2, XCircle, Truck,
  Tag, RefreshCw, AlertTriangle, X, ShoppingCart,
  Award, ChevronRight, RotateCcw, MapPin
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatTZS } from '../constants';
import { Order, Product } from '../types';
import { Sk } from './DashboardShell';
import { CancelOrderModal } from './CancelOrderModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const timeAgo = (d?: string) => {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short' });
};

// ─── Loyalty Tier ─────────────────────────────────────────────────────────────
const TIERS = [
  { name: 'Starter', color: '#94a3b8', bg: 'bg-slate-100 dark:bg-slate-800', threshold: 0, next: 500 },
  { name: 'Bronze',  color: '#cd7f32', bg: 'bg-amber-50 dark:bg-amber-900/20', threshold: 500, next: 3000 },
  { name: 'Silver',  color: '#94a3b8', bg: 'bg-slate-50 dark:bg-slate-800/60', threshold: 3000, next: 10000 },
  { name: 'Gold',    color: '#f59e0b', bg: 'bg-yellow-50 dark:bg-yellow-900/20', threshold: 10000, next: null },
];

const getLoyaltyTier = (points: number) => {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (points >= TIERS[i].threshold) return TIERS[i];
  }
  return TIERS[0];
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon: Icon, accent, trend, sub }: {
  label: string; value: string; icon: React.ElementType;
  accent: string; trend?: { value: number; positive: boolean }; sub?: string;
}) => (
  <motion.div
    whileHover={{ y: -2 }}
    transition={{ duration: 0.2 }}
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

// ─── Status config ─────────────────────────────────────────────────────────────
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

// ─── Main Component ─────────────────────────────────────────────────────────────
interface BuyerDashboardProps {
  orders: Order[];
  wishlist: Product[];
  user: any;
  onGoOrders: () => void;
  onGoWishlist: () => void;
  onGoOffers: () => void;
  onCancelOrder?: (id: string, reason: string) => void;
  onRemoveWishlist?: (productId: string) => void;
  onAddToCart?: (product: Product) => void;
  onReorder?: (order: Order) => void;
}

export const BuyerDashboard: React.FC<BuyerDashboardProps> = ({
  orders, wishlist, user, onGoOrders, onGoWishlist, onGoOffers,
  onCancelOrder, onRemoveWishlist, onAddToCart, onReorder,
}) => {
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);

  const stats = useMemo(() => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now = new Date();
    const excluded = new Set(['cancelled', 'refunded', 'failed']);
    const activeOrders = orders.filter(o => !(o as any).deleted_at);

    let totalSpent = 0, savings = 0;
    const statusDist: Record<string, number> = {};
    const monthlyMap = new Map<string, number>();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyMap.set(`${months[d.getMonth()]} ${d.getFullYear()}`, 0);
    }

    const categories = new Map<string, number>();
    const recentOrders = [...activeOrders].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, 4);

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

    const pending = activeOrders.filter(o => ['pending','processing','confirmed'].includes(o.status)).length;
    const inTransit = activeOrders.filter(o => ['in_transit','shipped'].includes(o.status)).length;
    const inTransitOrders = activeOrders
      .filter(o => ['in_transit','shipped'].includes(o.status))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      totalSpent, savings, spendTrend, spendHistory, categoryDist,
      statusDist, recentOrders, pending, inTransit, inTransitOrders,
      orderCount: activeOrders.length,
    };
  }, [orders]);

  const tier = getLoyaltyTier(user?.points || 0);
  const points = user?.points || 0;
  const COLORS = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#06b6d4'];

  return (
    <div className="space-y-5">

      {/* Greeting */}
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
              {stats.inTransit} shipment{stats.inTransit > 1 ? 's' : ''} on the way
              <ArrowRight className="w-3 h-3 opacity-60" />
            </button>
          )}
        </motion.div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Orders" value={stats.orderCount.toString()} icon={ShoppingBag} accent="#3b82f6"
          trend={stats.spendTrend ? { value: Math.abs(stats.spendTrend), positive: stats.spendTrend > 0 } : undefined} />
        <KpiCard label="Total Spent" value={formatTZS(stats.totalSpent)} icon={DollarSign} accent="#10b981" sub="all time" />
        <KpiCard label="Saved" value={formatTZS(stats.savings)} icon={Tag} accent="#f59e0b" sub="from discounts" />
        <KpiCard label="Wishlist" value={wishlist.length.toString()} icon={Heart} accent="#ef4444" sub={`${wishlist.length} item${wishlist.length !== 1 ? 's' : ''}`} />
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Wallet Balance" value={formatTZS(user.wallet_balance || 0)} icon={Wallet} accent="#06b6d4" />
        <KpiCard label="Reward Points" value={(points).toLocaleString()} icon={Star} accent="#f59e0b" />
        <KpiCard label="In Transit" value={stats.inTransit.toString()} icon={Truck} accent="#8b5cf6" />
        <KpiCard label="Pending" value={stats.pending.toString()} icon={Clock} accent={stats.pending > 0 ? '#f59e0b' : '#94a3b8'} />
      </div>

      {/* Loyalty Tier Widget */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5"
      >
        <div className="flex items-center gap-4">
          {/* Tier badge */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${tier.color}15`, border: `2px solid ${tier.color}40` }}>
              <Award className="w-8 h-8" style={{ color: tier.color }} />
            </div>
            <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-black text-white"
              style={{ background: tier.color }}>
              {tier.name}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-bold text-foreground">{tier.name} Member</p>
              <span className="text-xs font-black tabular-nums" style={{ color: tier.color }}>
                {points.toLocaleString()} pts
              </span>
            </div>

            {tier.next ? (
              <>
                <div className="h-2 bg-foreground/[0.06] rounded-full overflow-hidden mb-1.5">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: tier.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, ((points - tier.threshold) / (tier.next - tier.threshold)) * 100)}%` }}
                    transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-[10px] text-foreground/40">
                  <span className="font-bold text-foreground/60">{(tier.next - points).toLocaleString()}</span> points to {TIERS[TIERS.findIndex(t => t.name === tier.name) + 1]?.name}
                </p>
              </>
            ) : (
              <p className="text-[10px] text-foreground/40 mt-1">🎉 You've reached the highest tier!</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Delivery Tracker */}
      {stats.inTransitOrders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.03] p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <h3 className="text-sm font-bold text-foreground">Shipments on the Way</h3>
            </div>
            <button onClick={onGoOrders}
              className="text-[10px] font-bold text-foreground/40 hover:text-foreground flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {stats.inTransitOrders.slice(0, 3).map((order: any) => {
              const firstItem = order.items?.[0];
              const img = (firstItem?.products || firstItem?.product)?.images?.[0];
              return (
                <div key={order.id} className="flex items-center gap-3 p-3 rounded-xl bg-background/60 border border-foreground/[0.06]">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-purple-100 dark:bg-purple-900/20 flex-shrink-0 flex items-center justify-center">
                    {img
                      ? <img src={img} className="w-full h-full object-cover" alt="" loading="lazy" />
                      : <Truck className="w-5 h-5 text-purple-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground">#{order.id.slice(0,8).toUpperCase()}</p>
                    <p className="text-[10px] text-foreground/40">Dispatched {timeAgo(order.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold text-foreground">{formatTZS(Number(order.total))}</p>
                    <p className="text-[9px] text-purple-500 font-bold mt-0.5 flex items-center gap-0.5 justify-end">
                      <MapPin className="w-2.5 h-2.5" />Est. 2–5 days
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Spending History */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
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
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.4 }} axisLine={false} tickLine={false} tickFormatter={v => v.split(' ')[0]} />
                <YAxis tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.4 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                  <div className="bg-background border border-foreground/15 rounded-xl px-3 py-2 shadow-xl text-xs">
                    <p className="text-foreground/50 mb-0.5">{label}</p>
                    <p className="font-bold text-foreground">{formatTZS(payload[0].value as number)}</p>
                  </div>
                ) : null} />
                <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} fill="url(#spendGrad)" dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Category breakdown */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
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
                      <motion.div className="h-full rounded-full" style={{ background: COLORS[i] }}
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

      {/* Recent Orders + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Orders */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
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
              <button onClick={onGoOrders} className="mt-3 text-[10px] font-bold text-blue-500 hover:underline">Browse products</button>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentOrders.map((order: any) => {
                const cfg = STATUS_CFG[order.status] || { label: order.status, color: '#94a3b8', icon: Package };
                const Icon = cfg.icon;
                const firstItem = order.items?.[0];
                const img = (firstItem?.products || firstItem?.product)?.images?.[0];
                const cancellable = ['pending', 'processing', 'confirmed'].includes(order.status);
                const reorderable = order.status === 'delivered';
                return (
                  <div key={order.id} className="flex items-center gap-3 p-3 rounded-xl bg-foreground/[0.02] border border-foreground/[0.06] hover:border-foreground/15 transition-colors group">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-foreground/[0.06] shrink-0">
                      {img
                        ? <img src={img} className="w-full h-full object-cover" alt="" loading="lazy" />
                        : <Package className="w-4 h-4 m-3 text-foreground/20" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">#{order.id.slice(0,8).toUpperCase()}</p>
                      <p className="text-[10px] text-foreground/40">
                        {new Date(order.created_at).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-bold text-foreground">{formatTZS(Number(order.total))}</p>
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5"
                          style={{ background: `${cfg.color}15`, color: cfg.color }}>
                          <Icon className="w-2.5 h-2.5" />{cfg.label}
                        </span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {reorderable && onReorder && (
                          <button onClick={() => onReorder(order)} title="Reorder"
                            className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 hover:bg-emerald-500/20 transition-colors">
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                        {cancellable && onCancelOrder && (
                          <button onClick={() => setCancelTarget(order)} title="Cancel order"
                            className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Order Status Distribution */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
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
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${cfg.color}20` }}>
                        <Icon className="w-3 h-3" style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-semibold text-foreground/70">{cfg.label}</span>
                          <span className="text-[10px] font-bold text-foreground tabular-nums">{count}</span>
                        </div>
                        <div className="h-1 bg-foreground/[0.06] rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full" style={{ background: cfg.color }}
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

      {/* Wishlist Preview */}
      {wishlist.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Wishlist</h3>
              <p className="text-[10px] text-foreground/40 uppercase tracking-wider mt-0.5">{wishlist.length} saved item{wishlist.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={onGoWishlist}
              className="text-[10px] font-bold text-foreground/40 hover:text-foreground flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {wishlist.slice(0, 4).map((product: any) => {
              const img = product.images?.[0];
              return (
                <div key={product.id} className="relative group rounded-xl overflow-hidden border border-foreground/[0.06] bg-foreground/[0.02]">
                  <div className="aspect-square bg-foreground/[0.04]">
                    {img
                      ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center"><Heart className="w-6 h-6 text-foreground/10" /></div>
                    }
                    {/* Add to cart overlay */}
                    {onAddToCart && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onAddToCart(product)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black text-[11px] font-black hover:bg-emerald-400 hover:text-white transition-colors shadow-lg"
                        >
                          <ShoppingCart className="w-3 h-3" />Add
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-[10px] font-semibold text-foreground truncate">{product.name}</p>
                    <p className="text-[10px] font-bold text-emerald-600">{formatTZS(Number(product.price))}</p>
                  </div>
                  {onRemoveWishlist && (
                    <button onClick={() => onRemoveWishlist(product.id)} title="Remove from wishlist"
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
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

      {/* Cancel Order Modal */}
      {cancelTarget && onCancelOrder && (
        <CancelOrderModal
          isOpen={!!cancelTarget}
          role="buyer"
          onClose={() => setCancelTarget(null)}
          onConfirm={(reason) => { onCancelOrder(cancelTarget.id, reason); setCancelTarget(null); }}
        />
      )}
    </div>
  );
};
