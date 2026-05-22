import React, { Suspense, lazy, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    Wallet, Package, ShoppingBag, Clock, AlertTriangle, Star, Users,
    TrendingUp, ChevronRight, Plus, MessageSquare, Zap, ArrowUpRight,
    ArrowDownRight, Activity, CircleDashed
} from 'lucide-react';
import { Card } from './UI';
import { formatTZS } from '../constants';

// ── Lazy-load recharts (407 KB chunk) so the dashboard shell paints first ──
const RevenueChart    = lazy(() => import('./charts/RevenueChart'));
const StatusDonut     = lazy(() => import('./charts/StatusDonut'));
const TopProductsBars = lazy(() => import('./charts/TopProductsBars'));

const ChartFallback = ({ h = 'h-48' }: { h?: string }) => (
    <div className={`${h} rounded-2xl bg-foreground/[0.03] animate-pulse`} />
);

// ── KPI card: compact, monochrome, supports trend + click ──
const Kpi = ({
    label, value, sub, icon: Icon, accent, onClick, loading,
}: {
    label: string;
    value: string | number;
    sub?: React.ReactNode;
    icon: any;
    accent?: 'rose' | 'amber' | 'emerald' | 'blue' | 'violet';
    onClick?: () => void;
    loading?: boolean;
}) => {
    const accentBg = {
        rose:    'bg-rose-500/10 text-rose-600',
        amber:   'bg-amber-500/10 text-amber-600',
        emerald: 'bg-emerald-500/10 text-emerald-600',
        blue:    'bg-blue-500/10 text-blue-600',
        violet:  'bg-violet-500/10 text-violet-600',
    }[accent ?? 'blue'];

    const interactive = !!onClick;
    return (
        <motion.div
            whileHover={interactive ? { y: -2 } : undefined}
            whileTap={interactive ? { scale: 0.98 } : undefined}
            onClick={onClick}
            className={`relative p-5 rounded-3xl border border-foreground/8 bg-foreground/[0.02] overflow-hidden ${interactive ? 'cursor-pointer hover:border-foreground/20 transition-colors' : ''}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accentBg}`}>
                    <Icon className="w-4 h-4 stroke-[2]" />
                </div>
                {interactive && <ChevronRight className="w-4 h-4 text-foreground/30" />}
            </div>
            <div className="mt-4">
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-foreground/40">{label}</p>
                {loading ? (
                    <div className="mt-1 h-7 w-24 rounded-lg bg-foreground/[0.06] animate-pulse" />
                ) : (
                    <p className="mt-1 text-2xl font-black tracking-tight tabular-nums">{value}</p>
                )}
                {sub && <div className="mt-1 text-[11px] text-foreground/50">{sub}</div>}
            </div>
        </motion.div>
    );
};

// ── Sparkline: tiny inline chart drawn from the revenue series ──
const Sparkline = ({ data, height = 36 }: { data: { revenue: number }[]; height?: number }) => {
    const points = useMemo(() => {
        if (!data?.length) return '';
        const max = Math.max(1, ...data.map(d => d.revenue));
        const w = 240, h = height, n = data.length;
        return data
            .map((d, i) => `${(i / Math.max(1, n - 1)) * w},${h - (d.revenue / max) * (h - 4) - 2}`)
            .join(' ');
    }, [data, height]);
    if (!data?.length) return null;
    return (
        <svg viewBox={`0 0 240 ${height}`} preserveAspectRatio="none"
             className="w-full text-foreground/60" style={{ height }}>
            <polyline fill="none" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" points={points} />
        </svg>
    );
};

// ── Tiny inline status pill ──
const statusColor = (s: string) => {
    if (['delivered', 'shipped'].includes(s))           return 'bg-emerald-500/10 text-emerald-700';
    if (['pending', 'processing', 'confirmed'].includes(s)) return 'bg-amber-500/10 text-amber-700';
    if (['cancelled', 'refunded', 'failed'].includes(s)) return 'bg-rose-500/10 text-rose-700';
    return 'bg-foreground/[0.06] text-foreground/60';
};

// ── Compact "alerts" row, conditional ──
const Alerts = ({
    pending, lowStock, openDisputes, pendingReturns, onTab,
}: {
    pending: number; lowStock: number; openDisputes: number; pendingReturns: number;
    onTab: (id: string) => void;
}) => {
    const items: Array<{ key: string; label: string; n: number; tab: string; color: string }> = [];
    if (pending)        items.push({ key: 'orders',   label: 'orders awaiting confirmation', n: pending,        tab: 'orders',   color: 'amber'   });
    if (lowStock)       items.push({ key: 'stock',    label: 'products low on stock',         n: lowStock,       tab: 'products', color: 'rose'    });
    if (openDisputes)   items.push({ key: 'disputes', label: 'open disputes',                 n: openDisputes,   tab: 'returns',  color: 'rose'    });
    if (pendingReturns) items.push({ key: 'returns',  label: 'return requests',               n: pendingReturns, tab: 'returns',  color: 'amber'   });

    if (!items.length) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {items.map(it => (
                <button key={it.key}
                    onClick={() => onTab(it.tab)}
                    className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                        it.color === 'rose'
                            ? 'bg-rose-500/8 border-rose-500/20 hover:bg-rose-500/12'
                            : 'bg-amber-500/8 border-amber-500/20 hover:bg-amber-500/12'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        it.color === 'rose' ? 'bg-rose-500/20 text-rose-600' : 'bg-amber-500/20 text-amber-600'}`}>
                        <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-lg font-black tabular-nums leading-none">{it.n}</p>
                        <p className={`text-[11px] mt-1 ${it.color === 'rose' ? 'text-rose-700/70' : 'text-amber-700/70'}`}>{it.label}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-foreground/30" />
                </button>
            ))}
        </div>
    );
};

// ── Compute revenue delta on the trend window (latest 7d vs prior 7d) ──
const computeDelta = (series: { revenue: number }[]) => {
    if (!series?.length) return { value: 0, positive: true };
    const last7 = series.slice(-7).reduce((a, b) => a + (b.revenue || 0), 0);
    const prev7 = series.slice(-14, -7).reduce((a, b) => a + (b.revenue || 0), 0);
    if (prev7 === 0) return { value: last7 > 0 ? 100 : 0, positive: last7 >= 0 };
    const pct = ((last7 - prev7) / prev7) * 100;
    return { value: Math.abs(Math.round(pct)), positive: pct >= 0 };
};

// ─────────────────────────────────────────────────────────────────────────
//                         SellerDashboard
// ─────────────────────────────────────────────────────────────────────────
export const SellerDashboard = ({
    stats, loading, onTab, onRefresh,
}: {
    stats: any;
    loading: boolean;
    onTab: (id: string) => void;
    onRefresh?: () => void;
}) => {
    const delta = useMemo(() => computeDelta(stats.revenueTrend), [stats.revenueTrend]);

    return (
        <div className="space-y-6">
            {/* Hero: revenue + sparkline + 30d delta */}
            <Card className="relative overflow-hidden p-6 md:p-8 rounded-3xl border border-foreground/8 bg-gradient-to-br from-foreground/[0.04] via-transparent to-foreground/[0.02]">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-foreground/40">
                            30-day revenue
                        </p>
                        <div className="mt-2 flex items-baseline gap-3 flex-wrap">
                            <p className="text-4xl md:text-5xl font-black tracking-tight tabular-nums">
                                {formatTZS(stats.revenue || 0)}
                            </p>
                            <div className={`flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full ${
                                delta.positive ? 'bg-emerald-500/10 text-emerald-700' : 'bg-rose-500/10 text-rose-700'}`}>
                                {delta.positive ? <ArrowUpRight className="w-3.5 h-3.5"/> : <ArrowDownRight className="w-3.5 h-3.5"/>}
                                {delta.value}%
                            </div>
                        </div>
                        <p className="mt-2 text-xs text-foreground/55">
                            {stats.salesVelocity?.toFixed(1) ?? '0.0'} orders/day · AOV {formatTZS(stats.aov || 0)} · {stats.activeProducts} active listings
                        </p>
                    </div>
                    <div className="w-full md:w-80 shrink-0">
                        <Sparkline data={stats.revenueTrend ?? []} height={48} />
                    </div>
                </div>

                {/* Quick actions strip */}
                <div className="mt-6 flex flex-wrap gap-2">
                    {[
                        { label: 'Add product',  icon: Plus,          tab: 'products' },
                        { label: 'View orders',  icon: ShoppingBag,   tab: 'orders'   },
                        { label: 'New campaign', icon: Zap,           tab: 'offers'   },
                        { label: 'Messages',     icon: MessageSquare, tab: 'messages' },
                    ].map(({ label, icon: Icon, tab }) => (
                        <button key={tab} onClick={() => onTab(tab)}
                            className="flex items-center gap-2 h-9 px-3.5 rounded-xl bg-foreground/[0.06] text-foreground/70 text-xs font-semibold hover:bg-foreground/10 hover:text-foreground transition-colors">
                            <Icon className="w-3.5 h-3.5 stroke-[2]" />{label}
                        </button>
                    ))}
                </div>
            </Card>

            {/* Alerts row (only renders when there's something) */}
            <Alerts
                pending={stats.pending}
                lowStock={stats.lowStock}
                openDisputes={stats.openDisputes}
                pendingReturns={stats.pendingReturns}
                onTab={onTab}
            />

            {/* KPI grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <Kpi label="Net payout"     value={formatTZS(stats.netRevenue || 0)}     icon={Wallet}     accent="emerald" loading={loading}
                     sub={`commission ${formatTZS(stats.totalCommission || 0)}`} />
                <Kpi label="Pending orders" value={stats.pending}                         icon={Clock}      accent="amber"   loading={loading}
                     onClick={() => onTab('orders')}
                     sub={stats.pending > 0 ? 'tap to review' : 'all clear'} />
                <Kpi label="Listings"       value={stats.activeProducts}                  icon={Package}    accent="blue"    loading={loading}
                     onClick={() => onTab('products')}
                     sub={stats.lowStock ? `${stats.lowStock} low stock` : 'no stock alerts'} />
                <Kpi label="Rating"         value={stats.avgRating ? stats.avgRating.toFixed(1) : '—'}
                     icon={Star} accent="violet" loading={loading}
                     sub={`${stats.totalReviews} reviews · ${stats.totalFollowers} followers`} />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2 p-6 rounded-3xl border border-foreground/8 bg-transparent">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-foreground/40">Revenue trend</p>
                            <p className="text-sm font-bold mt-0.5">Last 30 days</p>
                        </div>
                        <Activity className="w-4 h-4 text-foreground/30" />
                    </div>
                    <Suspense fallback={<ChartFallback h="h-56" />}>
                        <RevenueChart data={stats.revenueTrend ?? []} />
                    </Suspense>
                </Card>

                <Card className="p-6 rounded-3xl border border-foreground/8 bg-transparent">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-foreground/40">Order status</p>
                            <p className="text-sm font-bold mt-0.5">All-time mix</p>
                        </div>
                        <CircleDashed className="w-4 h-4 text-foreground/30" />
                    </div>
                    <Suspense fallback={<ChartFallback h="h-56" />}>
                        <StatusDonut data={stats.statusDistribution ?? {}} />
                    </Suspense>
                </Card>
            </div>

            {/* Top products + Recent + Top customers */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="p-6 rounded-3xl border border-foreground/8 bg-transparent">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-foreground/40">Top products</p>
                            <p className="text-sm font-bold mt-0.5">By units sold</p>
                        </div>
                        <TrendingUp className="w-4 h-4 text-foreground/30" />
                    </div>
                    {stats.topProducts?.length ? (
                        <Suspense fallback={<ChartFallback h="h-56" />}>
                            <TopProductsBars data={stats.topProducts.map((p: any) => ({ name: p.name, count: Number(p.count || p.units || 0) }))} />
                        </Suspense>
                    ) : (
                        <div className="h-56 flex items-center justify-center text-xs text-foreground/40">
                            No sales yet — share your store to get started.
                        </div>
                    )}
                </Card>

                <Card className="p-6 rounded-3xl border border-foreground/8 bg-transparent">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-foreground/40">Top customers</p>
                            <p className="text-sm font-bold mt-0.5">Repeat buyers</p>
                        </div>
                        <Users className="w-4 h-4 text-foreground/30" />
                    </div>
                    <div className="space-y-2.5">
                        {stats.topCustomers?.length ? stats.topCustomers.map((c: any, i: number) => (
                            <div key={c.id ?? i}
                                className="flex items-center gap-3 p-2 rounded-xl hover:bg-foreground/[0.04] transition-colors">
                                <div className="w-8 h-8 rounded-full bg-foreground/10 text-foreground/70 flex items-center justify-center text-[11px] font-bold">
                                    {(c.name || 'U').slice(0, 1).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">{c.name}</p>
                                    <p className="text-[11px] text-foreground/50">{c.count} {c.count === 1 ? 'order' : 'orders'}</p>
                                </div>
                                {c.spent ? <p className="text-xs font-bold tabular-nums">{formatTZS(c.spent)}</p> : null}
                            </div>
                        )) : (
                            <div className="h-48 flex items-center justify-center text-xs text-foreground/40">
                                No repeat customers yet.
                            </div>
                        )}
                    </div>
                </Card>

                <Card className="p-6 rounded-3xl border border-foreground/8 bg-transparent">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-foreground/40">Recent activity</p>
                            <p className="text-sm font-bold mt-0.5">Latest fulfillments</p>
                        </div>
                        <ShoppingBag className="w-4 h-4 text-foreground/30" />
                    </div>
                    <div className="space-y-2">
                        {stats.recentOrders?.length ? stats.recentOrders.slice(0, 8).map((o: any) => (
                            <button key={o.id}
                                onClick={() => onTab('orders')}
                                className="w-full flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-foreground/[0.04] transition-colors text-left">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold truncate">#{(o.order_id ?? o.id).slice(0, 8)}</p>
                                    <p className="text-[10px] text-foreground/45">
                                        {new Date(o.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </p>
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColor(o.status)}`}>
                                    {o.status}
                                </span>
                                <span className="text-xs font-bold tabular-nums shrink-0">{formatTZS(o.total || 0)}</span>
                            </button>
                        )) : (
                            <div className="h-48 flex items-center justify-center text-xs text-foreground/40">
                                No orders yet.
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Footer: data freshness */}
            {stats.refreshedAt && (
                <p className="text-[10px] text-foreground/35 text-center">
                    Dashboard data refreshed {new Date(stats.refreshedAt).toLocaleTimeString()} ·{' '}
                    <button onClick={onRefresh} className="underline hover:text-foreground/60">force refresh</button>
                </p>
            )}
        </div>
    );
};

export default SellerDashboard;
