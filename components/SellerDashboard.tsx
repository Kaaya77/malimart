/**
 * SellerDashboard — ground-up redesign
 * 
 * Architecture:
 *  Phase 1 (0ms):    Skeleton screens render immediately
 *  Phase 2 (<50ms):  Snapshot RPC — pre-computed stats, instant KPIs
 *  Phase 3 (bg):     Full RPC — trend data, top products/customers, charts
 * 
 * Replaces: SellerAnalytics.tsx + AdvancedAnalytics.tsx + SellerPage overview section
 * Design:   Dark glass morphism, editorial grid, animated counters, sparklines
 */

import { maliGreeting, KitengeStrip } from './MaliSoul';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSellerSnapshot, useSellerFullStats, useSellerDashboardRealtime, useSellerPendingOrders } from '../hooks/useSellerDashboard';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Package, ShoppingBag, Clock,
  Wallet, BarChart3, Users, Zap, AlertTriangle, ArrowRight,
  RefreshCw, Star, Eye, Target, Activity, CheckCircle2, X,
  RotateCcw, Tag, MessageSquare
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { formatTZS } from '../constants';
import { Sk as _Sk } from './DashboardShell';

// ─── Animated Counter ──────────────────────────────────────────────────────
const AnimCounter = ({ value, prefix = '', suffix = '', decimals = 0, duration = 800 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number; duration?: number;
}) => {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);
  const startRef = useRef<number | undefined>(undefined);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    startRef.current = undefined;

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const p = Math.min((ts - startRef.current) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * ease);
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return (
    <span>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
};

// ─── Sparkline (tiny 40x20 inline chart) ──────────────────────────────────
const Sparkline = ({ data, color = '#10b981', positive = true }: {
  data: number[]; color?: string; positive?: boolean;
}) => {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * 60,
    y: 20 - (v / max) * 18,
  }));
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  const fill = `${d} L${pts[pts.length-1].x},22 L${pts[0].x},22 Z`;

  return (
    <svg width="60" height="22" viewBox="0 0 60 22" className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#sg-${color.replace('#','')})`} />
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </svg>
  );
};

const Sk = _Sk;

// ─── KPI Card ──────────────────────────────────────────────────────────────
interface KpiProps {
  label: string;
  value: number;
  format?: 'currency' | 'number' | 'percent';
  decimals?: number;
  trend?: number; // % change
  icon: React.ElementType;
  accent: string;
  sparkData?: number[];
  loading?: boolean;
  onClick?: () => void;
}

const KpiCard = ({ label, value, format = 'number', decimals, trend, icon: Icon, accent, sparkData, loading, onClick }: KpiProps) => {
  const formatted = format === 'currency'
    ? formatTZS(value)
    : format === 'percent'
    ? `${value.toFixed(1)}%`
    : decimals !== undefined ? value.toFixed(decimals) : value.toLocaleString();

  const trendPos = (trend ?? 0) >= 0;
  const sparkColor = trendPos ? '#10b981' : '#f43f5e';

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5 transition-all duration-300 hover:border-foreground/20 hover:bg-foreground/[0.04] ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* accent glow */}
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-20`} style={{ background: accent }} />

      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center`} style={{ background: `${accent}20` }}>
          <Icon className="w-4 h-4" style={{ color: accent }} strokeWidth={2} />
        </div>
        {sparkData && sparkData.length > 1 && (
          <Sparkline data={sparkData} color={sparkColor} positive={trendPos} />
        )}
      </div>

      {loading ? (
        <div className="space-y-2 mt-1">
          <Sk h="h-7" w="w-3/4" />
          <Sk h="h-3" w="w-1/2" />
        </div>
      ) : (
        <>
          <p className="text-2xl font-black text-foreground tracking-tight tabular-nums leading-none mb-1">
            {format === 'currency'
              ? formatted
              : <AnimCounter value={value} decimals={format === 'percent' ? 1 : 0} suffix={format === 'percent' ? '%' : ''} />
            }
          </p>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/40">{label}</p>
            {trend !== undefined && (
              <span className={`flex items-center gap-0.5 text-[10px] font-bold ${trendPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                {trendPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(trend).toFixed(1)}%
              </span>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
};

// Fill a sparse date series so the x-axis is always continuous (no jumped gaps)
function fillDateGaps(data: { date: string; revenue: number }[], days = 30): { date: string; revenue: number }[] {
  const byDate: Record<string, number> = {};
  for (const d of data) byDate[d.date.slice(0, 10)] = d.revenue;
  const result: { date: string; revenue: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(Date.now() - i * 86_400_000);
    const key = dt.toISOString().slice(0, 10);
    result.push({ date: key, revenue: byDate[key] ?? 0 });
  }
  return result;
}

// ─── Revenue Chart ────────────────────────────────────────────────────────
const RevenueChart = ({ data, loading }: { data: { date: string; revenue: number }[]; loading: boolean }) => {
  data = React.useMemo(() => fillDateGaps(data), [data]);
  const fmt = (v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v);

  if (loading) return (
    <div className="h-52 flex items-end gap-1 px-2">
      {Array.from({length: 14}).map((_,i) => (
        <div key={i} className="flex-1 bg-foreground/[0.06] animate-pulse rounded-t-sm" style={{ height: `${30 + Math.random()*60}%` }} />
      ))}
    </div>
  );

  if (!data.length) return (
    <div className="h-52 flex flex-col items-center justify-center text-foreground/25">
      <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
      <p className="text-xs font-semibold uppercase tracking-widest">No data yet</p>
      <p className="text-[10px] mt-1 opacity-60">Revenue will appear here once orders come in</p>
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height={208}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.4 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.4 }} axisLine={false} tickLine={false} />
        <Tooltip
          content={({ active, payload, label }) => active && payload?.length ? (
            <div className="bg-background border border-foreground/15 rounded-xl px-3 py-2 shadow-xl text-xs">
              <p className="text-foreground/50 mb-0.5">{label}</p>
              <p className="font-bold text-foreground">{formatTZS(payload[0].value as number)}</p>
            </div>
          ) : null}
        />
        <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

// ─── Top Products Table ───────────────────────────────────────────────────
const TopProducts = ({ data, loading }: { data: { name: string; count: number; revenue?: number }[]; loading: boolean }) => {
  const max = data.length ? Math.max(...data.map(d => d.count), 1) : 1;

  if (loading) return (
    <div className="space-y-3">
      {Array.from({length: 5}).map((_,i) => (
        <div key={i} className="flex items-center gap-3">
          <Sk w="w-6" h="h-6" r="rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Sk h="h-3" w="w-3/4" />
            <Sk h="h-1.5" w="w-full" r="rounded-full" />
          </div>
          <Sk w="w-12" h="h-3" />
        </div>
      ))}
    </div>
  );

  if (!data.length) return (
    <div className="flex flex-col items-center justify-center py-8 text-foreground/25">
      <Package className="w-8 h-8 mb-2 opacity-30" />
      <p className="text-xs font-semibold uppercase tracking-widest">No sales yet</p>
    </div>
  );

  const COLORS = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ef4444'];

  return (
    <div className="space-y-3">
      {data.slice(0, 5).map((p, i) => (
        <div key={i} className="group">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black shrink-0"
                style={{ background: `${COLORS[i]}25`, color: COLORS[i] }}>
                {i+1}
              </span>
              <span className="text-xs font-semibold text-foreground truncate">{p.name}</span>
            </div>
            <span className="text-[10px] font-bold text-foreground/50 shrink-0 ml-2">{p.count} sold</span>
          </div>
          <div className="h-1 bg-foreground/[0.06] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: COLORS[i] }}
              initial={{ width: 0 }}
              animate={{ width: `${(p.count / max) * 100}%` }}
              transition={{ duration: 0.8, delay: i * 0.1, ease: [0.32, 0, 0.67, 0] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Order Status Donut ───────────────────────────────────────────────────
const StatusDonut = ({ data, loading }: { data: Record<string, number>; loading: boolean }) => {
  const STATUS_COLORS: Record<string, string> = {
    pending: '#f59e0b',
    processing: '#3b82f6',
    confirmed: '#3b82f6',
    in_transit: '#8b5cf6',
    shipped: '#8b5cf6',
    delivered: '#10b981',
    cancelled: '#ef4444',
    refunded: '#f97316',
  };
  const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending', processing: 'Confirmed', confirmed: 'Confirmed',
    in_transit: 'Shipped', shipped: 'Shipped', delivered: 'Delivered',
    cancelled: 'Cancelled', refunded: 'Refunded',
  };

  const chartData = Object.entries(data)
    .filter(([_, v]) => v > 0)
    .map(([k, v]) => ({ name: STATUS_LABELS[k] ?? k, value: v, color: STATUS_COLORS[k] ?? '#94a3b8' }));

  const total = chartData.reduce((s, d) => s + d.value, 0);

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-28 h-28 rounded-full border-8 border-foreground/[0.06] animate-pulse" />
    </div>
  );

  if (!chartData.length) return (
    <div className="flex flex-col items-center justify-center py-8 text-foreground/25">
      <Activity className="w-8 h-8 mb-2 opacity-30" />
      <p className="text-xs font-semibold uppercase tracking-widest">No orders yet</p>
    </div>
  );

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <PieChart width={120} height={120}>
          <Pie data={chartData} cx={55} cy={55} innerRadius={36} outerRadius={55}
            dataKey="value" strokeWidth={0} paddingAngle={2}>
            {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-foreground tabular-nums">{total}</span>
          <span className="text-[9px] text-foreground/40 uppercase tracking-wider font-bold">orders</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {chartData.map((d, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="text-[10px] text-foreground/60 truncate">{d.name}</span>
            </div>
            <span className="text-[10px] font-bold text-foreground tabular-nums">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Alert Banner ────────────────────────────────────────────────────────
const AlertBanner = ({ lowStock, pending, onGoOrders, onGoInventory }: {
  lowStock: number; pending: number;
  onGoOrders: () => void; onGoInventory: () => void;
}) => {
  if (!lowStock && !pending) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap gap-2"
    >
      {pending > 0 && (
        <button onClick={onGoOrders}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 text-xs font-bold hover:bg-amber-500/15 transition-colors">
          <Clock className="w-3.5 h-3.5" />
          {pending} order{pending > 1 ? 's' : ''} need confirmation
          <ArrowRight className="w-3 h-3 opacity-60" />
        </button>
      )}
      {lowStock > 0 && (
        <button onClick={onGoInventory}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 text-xs font-bold hover:bg-rose-500/15 transition-colors">
          <AlertTriangle className="w-3.5 h-3.5" />
          {lowStock} product{lowStock > 1 ? 's' : ''} low on stock
          <ArrowRight className="w-3 h-3 opacity-60" />
        </button>
      )}
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────
interface SellerDashboardProps {
  sellerId: string;
  sellerName: string;
  vendorLogoUrl?: string;
  lowStockCount: number;
  onGoOrders: () => void;
  onGoInventory: () => void;
  onGoReturns?: () => void;
  onGoMessages?: () => void;
  onGoPromotions?: () => void;
  onConfirmOrder?: (orderId: string) => void;
  onCancelOrder?: (orderId: string, reason: string) => void;
}

export const SellerDashboard: React.FC<SellerDashboardProps> = ({
  sellerId, sellerName, vendorLogoUrl, lowStockCount, onGoOrders, onGoInventory,
  onGoReturns, onGoMessages, onGoPromotions, onConfirmOrder, onCancelOrder,
}) => {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  // ── TanStack Query hooks — fetch, cache, and deduplicate automatically ────
  const { data: snap, isLoading: snapLoading } = useSellerSnapshot(sellerId);
  const { data: full, isLoading: fullLoading, isFetching: refreshing, refetch: refetchFull } = useSellerFullStats(sellerId);
  const { data: pendingOrders = [], refetch: refetchPending } = useSellerPendingOrders(sellerId);
  useSellerDashboardRealtime(sellerId);  // invalidates cache on realtime events

  // ── Derive display values (snapshot first, full when ready) ──────────────
  // snap is a raw JSONB object from get_seller_snapshot; cast to any for nested access.
  const s = snap as any;
  const revenue = full?.revenue ?? s?.revenue ?? 0;
  const pending = full?.pending ?? s?.pending ?? 0;
  const listings = full?.listings ?? s?.products?.active_products ?? 0;
  const aov = full?.aov ?? s?.aov ?? 0;
  const revTrend = full?.revTrend7 ?? 0;
  const kpiLoading = snapLoading && fullLoading;

  // Revenue sparkline from trend data (last 7 days)
  const revSpark = useMemo(() => {
    if (!full?.revenueTrend?.length) return [];
    const sevenAgo = new Date(Date.now() - 7 * 86400000);
    return full.revenueTrend
      .filter((d: any) => new Date(d.date) >= sevenAgo)
      .map((d: any) => d.revenue);
  }, [full?.revenueTrend]);

  return (
    <div className="space-y-5">
      {/* Time-aware Swahili greeting */}
      <div>
        <h2 className="text-xl font-black tracking-tight text-foreground">
          {maliGreeting(sellerName?.split(' ')[0])}
        </h2>
        <KitengeStrip className="w-16 mt-2" />
      </div>
      {/* Alert banners — authoritative count from RPC, same source as donut */}
      <AlertBanner
        lowStock={full?.lowStockCount ?? lowStockCount}
        pending={pending}
        onGoOrders={onGoOrders}
        onGoInventory={onGoInventory}
      />

      {/* ── KPI Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total Revenue"
          value={revenue}
          format="currency"
          trend={revTrend}
          icon={Wallet}
          accent="#10b981"
          sparkData={revSpark}
          loading={kpiLoading}
        />
        <KpiCard
          label="Active Listings"
          value={listings}
          icon={Package}
          accent="#3b82f6"
          loading={kpiLoading}
        />
        <KpiCard
          label="Avg. Order Value"
          value={aov}
          format="currency"
          icon={TrendingUp}
          accent="#f59e0b"
          loading={kpiLoading}
        />
        <KpiCard
          label="Pending Orders"
          value={pending}
          icon={Clock}
          accent={pending > 0 ? '#f59e0b' : '#94a3b8'}
          loading={kpiLoading}
          onClick={pending > 0 ? onGoOrders : undefined}
        />
      </div>

      {/* ── Secondary KPIs ───────────────────────────────────────────── */}
      {!fullLoading && full && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <KpiCard
            label="Total Orders"
            value={full.totalOrders}
            icon={ShoppingBag}
            accent="#8b5cf6"
          />
          <KpiCard
            label="Unique Buyers"
            value={full.totalCustomers}
            icon={Users}
            accent="#06b6d4"
          />
          <KpiCard
            label="Retention Rate"
            value={full.retentionRate}
            format="percent"
            icon={RefreshCw}
            accent="#10b981"
          />
          {full.avgRating > 0 ? (
            <KpiCard
              label="Avg. Rating"
              value={full.avgRating}
              format="number"
              decimals={1}
              icon={Star}
              accent="#f59e0b"
            />
          ) : (
            <div className="relative overflow-hidden rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
              <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-20" style={{ background: '#f59e0b' }} />
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f59e0b20' }}>
                  <Star className="w-4 h-4" style={{ color: '#f59e0b' }} strokeWidth={2} />
                </div>
              </div>
              <p className="text-sm font-bold text-foreground/40 mt-1">No ratings yet</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/30 mt-1">Avg. Rating</p>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Charts Row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Trend — spans 2 cols */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Revenue Trend</h3>
              <p className="text-[10px] text-foreground/40 uppercase tracking-wider mt-0.5">Last 30 days</p>
            </div>
            <div className="flex items-center gap-2">
              {full?.rev7 !== undefined && (
                <span className="text-xs font-bold text-foreground/60">
                  7d: <span className="text-foreground">{formatTZS(full.rev7)}</span>
                </span>
              )}
              <button
                onClick={() => refetchFull()}
                disabled={refreshing}
                className="w-7 h-7 rounded-lg bg-foreground/[0.05] flex items-center justify-center hover:bg-foreground/10 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 text-foreground/50 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <RevenueChart data={full?.revenueTrend ?? []} loading={fullLoading} />
        </motion.div>

        {/* Order Status Donut */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5"
        >
          <h3 className="text-sm font-bold text-foreground mb-1">Order Status</h3>
          <p className="text-[10px] text-foreground/40 uppercase tracking-wider mb-4">All time</p>
          <StatusDonut data={full?.statusDist ?? {}} loading={fullLoading} />
        </motion.div>
      </div>

      {/* ── Bottom Row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground">Top Products</h3>
            <button onClick={onGoInventory}
              className="text-[10px] font-bold text-foreground/40 hover:text-foreground flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <TopProducts data={full?.topProducts ?? snap?.top_products ?? []} loading={fullLoading && !snap?.top_products} />
        </motion.div>

        {/* Top Customers */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5"
        >
          <h3 className="text-sm font-bold text-foreground mb-4">Top Buyers</h3>
          {fullLoading ? (
            <div className="space-y-3">
              {Array.from({length: 5}).map((_,i) => (
                <div key={i} className="flex items-center gap-3">
                  <Sk w="w-7" h="h-7" r="rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Sk h="h-3" w="w-2/3" />
                    <Sk h="h-2" w="w-1/3" />
                  </div>
                  <Sk w="w-8" h="h-3" />
                </div>
              ))}
            </div>
          ) : !full?.topCustomers?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-foreground/25">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs font-semibold uppercase tracking-widest">No buyers yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {full.topCustomers.map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-foreground/20 to-foreground/10 flex items-center justify-center text-[10px] font-black text-foreground/60 shrink-0">
                    {(c.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{c.name || 'Customer'}</p>
                    <p className="text-[10px] text-foreground/40">{c.count} order{c.count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      c.count >= 3 ? 'bg-emerald-500/15 text-emerald-600' :
                      c.count >= 2 ? 'bg-blue-500/15 text-blue-600' :
                      'bg-foreground/[0.06] text-foreground/40'
                    }`}>
                      {c.count >= 3 ? 'VIP' : c.count >= 2 ? 'Returning' : 'New'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Pending Orders Action Panel ──────────────────────────────── */}
      {pendingOrders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h3 className="text-sm font-bold text-foreground">Orders Awaiting Action</h3>
            </div>
            <button onClick={onGoOrders}
              className="text-[10px] font-bold text-foreground/40 hover:text-foreground flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {pendingOrders.slice(0, 3).map((order: any) => (
              <div key={order.id} className="flex items-center gap-3 p-3 rounded-xl bg-background/60 border border-foreground/[0.06]">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">#{order.id?.slice(0,8).toUpperCase()}</p>
                  <p className="text-[10px] text-foreground/40">
                    {order.buyer_name || 'Customer'} · {formatTZS(Number(order.total))}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onConfirmOrder && (
                    <button
                      onClick={async () => {
                        setConfirmingId(order.id);
                        await onConfirmOrder(order.id);
                        refetchPending();
                        setConfirmingId(null);
                      }}
                      disabled={confirmingId === order.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {confirmingId === order.id ? '…' : 'Confirm'}
                    </button>
                  )}
                  {onCancelOrder && (
                    <button
                      onClick={async () => {
                        setCancellingId(order.id);
                        await onCancelOrder(order.id, 'Seller cancelled');
                        refetchPending();
                        setCancellingId(null);
                      }}
                      disabled={cancellingId === order.id}
                      title="Cancel order"
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-[10px] font-bold hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Quick Actions ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-3 sm:grid-cols-5 gap-3"
      >
        {[
          { label: 'Add Product', icon: Package,      color: 'text-emerald-600 bg-emerald-500/10', action: onGoInventory },
          { label: 'Orders',      icon: ShoppingBag,  color: 'text-blue-600 bg-blue-500/10',       action: onGoOrders },
          { label: 'Messages',    icon: MessageSquare,color: 'text-violet-600 bg-violet-500/10',   action: onGoMessages || onGoOrders },
          { label: 'Returns',     icon: RotateCcw,    color: 'text-orange-600 bg-orange-500/10',   action: onGoReturns || onGoOrders },
          { label: 'Promotions',  icon: Tag,          color: 'text-pink-600 bg-pink-500/10',       action: onGoPromotions || onGoOrders },
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
