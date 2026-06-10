/**
 * AdminDashboard — performance rewrite
 *
 * Uses get_admin_dashboard_fast (snapshot-backed) instead of:
 *   - get_admin_stats RPC  (aggregate scan)
 *   - raw orders query     (180-day full table scan for revenue series)
 *
 * Cold path: recomputes snapshot (~200ms). Warm path: single index lookup (<15ms).
 * Snapshot auto-invalidates via DB triggers on orders/products/profiles/disputes.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Store, Package, ShoppingBag, DollarSign,
  AlertTriangle, TrendingUp, TrendingDown, RefreshCw,
  CheckCircle2, UserPlus, ArrowRight, BarChart3,
  Shield, Zap, Activity
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../services/supabaseClient';
import { formatTZS } from '../constants';

const Sk = ({ w = 'w-full', h = 'h-4', r = 'rounded-lg' }: { w?: string; h?: string; r?: string }) => (
  <div className={`${w} ${h} ${r} bg-foreground/[0.06] animate-pulse`} />
);

const StatCard = ({ label, value, icon: Icon, accent, trend, sub, loading, onClick }: {
  label: string; value: string | number; icon: React.ElementType; accent: string;
  trend?: number; sub?: string; loading?: boolean; onClick?: () => void;
}) => (
  <motion.div
    whileHover={{ y: -2 }}
    onClick={onClick}
    className={`relative overflow-hidden rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5 ${onClick ? 'cursor-pointer hover:border-foreground/20' : ''} transition-all`}
  >
    <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-10" style={{ background: accent }} />
    <div className="flex items-start justify-between mb-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}20` }}>
        <Icon className="w-4 h-4" style={{ color: accent }} strokeWidth={2} />
      </div>
      {trend !== undefined && !loading && (
        <span className={`flex items-center gap-0.5 text-[10px] font-bold ${trend >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend).toFixed(1)}%
        </span>
      )}
    </div>
    {loading ? (
      <div className="space-y-2"><Sk h="h-7" w="w-2/3" /><Sk h="h-3" w="w-1/2" /></div>
    ) : (
      <>
        <p className="text-2xl font-black text-foreground tabular-nums">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/40">{label}</p>
          {sub && <p className="text-[10px] text-foreground/30">{sub}</p>}
        </div>
      </>
    )}
  </motion.div>
);

const RevenueChart = ({ data, loading }: { data: { name: string; revenue: number }[]; loading: boolean }) => {
  if (loading) return (
    <div className="h-44 flex items-end gap-1">
      {Array.from({length: 30}).map((_,i) => (
        <div key={i} className="flex-1 bg-foreground/[0.06] animate-pulse rounded-t" style={{ height: `${30 + Math.random()*60}%` }} />
      ))}
    </div>
  );
  if (!data.some(d => d.revenue > 0)) return (
    <div className="h-44 flex flex-col items-center justify-center text-foreground/25">
      <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
      <p className="text-xs font-semibold uppercase tracking-widest">No revenue data yet</p>
    </div>
  );
  return (
    <ResponsiveContainer width="100%" height={176}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.4 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.4 }} axisLine={false} tickLine={false}
          tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
        <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
          <div className="bg-background border border-foreground/15 rounded-xl px-3 py-2 shadow-xl text-xs">
            <p className="text-foreground/50 mb-0.5">{label}</p>
            <p className="font-bold text-foreground">{formatTZS(payload[0].value as number)}</p>
          </div>
        ) : null} />
        <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#adminRevGrad)" dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

interface AdminDashboardProps {
  initialStats: {
    totalUsers: number; totalRevenue: number; activeDisputes: number;
    pendingPayouts: number; totalProducts: number;
  };
  onGoUsers: () => void;
  onGoVendors: () => void;
  onGoProducts: () => void;
  onGoDisputes: () => void;
  onGoPayouts: () => void;
  onGoGrowth: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  initialStats, onGoUsers, onGoVendors, onGoProducts, onGoDisputes, onGoPayouts, onGoGrowth,
}) => {
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      // Single snapshot RPC — replaces get_admin_stats + raw orders scan
      const { data, error } = await supabase.rpc('get_admin_dashboard_fast', { p_days: 30 });
      if (error) throw error;
      setPayload(data);
    } catch (e) {
      console.error('[AdminDashboard]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    timerRef.current = setInterval(() => fetchStats(true), 60_000); // 60s — snapshot TTL is 2min
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchStats]);

  // Merge live payload with initial fallback props
  const s = payload ? {
    total_users:           payload.users?.total_users         ?? 0,
    total_sellers:         payload.vendors?.total_sellers      ?? payload.users?.sellers ?? 0,
    total_buyers:          payload.users?.buyers              ?? 0,
    total_products:        payload.products?.total_products   ?? 0,
    active_products:       payload.products?.active_products  ?? 0,
    total_orders:          payload.orders?.total_orders       ?? 0,
    pending_orders:        payload.orders?.pending_orders     ?? 0,
    total_revenue:         payload.orders?.gmv_total          ?? 0,
    new_users_7d:          payload.users?.new_signups         ?? 0,
    open_disputes:         payload.disputes?.open_disputes    ?? initialStats.activeDisputes,
    pending_verifications: payload.vendors?.pending_verifications ?? 0,
    pendingPayouts:        payload.payouts?.pending_payouts   ?? initialStats.pendingPayouts,
    banned_users:          payload.users?.banned_users        ?? 0,
  } : {
    total_users: initialStats.totalUsers, total_sellers: 0, total_buyers: 0,
    total_products: initialStats.totalProducts, active_products: 0,
    total_orders: 0, pending_orders: 0, total_revenue: initialStats.totalRevenue,
    new_users_7d: 0, open_disputes: initialStats.activeDisputes,
    pending_verifications: 0, pendingPayouts: initialStats.pendingPayouts, banned_users: 0,
  };

  // Revenue series comes pre-built from the snapshot (30 daily points)
  const revenueData = (payload?.gmv_series ?? []).map((d: any) => ({
    name: d.name ?? d.day?.slice(5), // "Mon", "Tue" or "MM-DD"
    revenue: Number(d.revenue) ?? 0,
  }));

  // Trend: last day vs day before
  const last = revenueData.at(-1)?.revenue ?? 0;
  const prev = revenueData.at(-2)?.revenue ?? 0;
  const revTrend = prev > 0 ? ((last - prev) / prev) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Alerts */}
      {!loading && ((s.open_disputes > 0) || (s.pendingPayouts > 0) || (s.pending_verifications > 0)) && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-2">
          {s.pending_verifications > 0 && (
            <button onClick={onGoVendors}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs font-bold hover:bg-amber-500/15 transition-colors">
              <Store className="w-3.5 h-3.5" />
              {s.pending_verifications} seller{s.pending_verifications > 1 ? 's' : ''} awaiting verification
              <ArrowRight className="w-3 h-3 opacity-60" />
            </button>
          )}
          {s.open_disputes > 0 && (
            <button onClick={onGoDisputes}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold hover:bg-rose-500/15 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" />
              {s.open_disputes} open dispute{s.open_disputes > 1 ? 's' : ''}
              <ArrowRight className="w-3 h-3 opacity-60" />
            </button>
          )}
          {s.pendingPayouts > 0 && (
            <button onClick={onGoPayouts}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 text-xs font-bold hover:bg-purple-500/15 transition-colors">
              <DollarSign className="w-3.5 h-3.5" />
              {s.pendingPayouts} payout{s.pendingPayouts > 1 ? 's' : ''} pending
              <ArrowRight className="w-3 h-3 opacity-60" />
            </button>
          )}
        </motion.div>
      )}

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Revenue" value={formatTZS(s.total_revenue)}
          icon={DollarSign} accent="#10b981" trend={revTrend} loading={loading} />
        <StatCard label="Total Users" value={s.total_users}
          icon={Users} accent="#3b82f6" sub={`+${s.new_users_7d} this month`} loading={loading} onClick={onGoUsers} />
        <StatCard label="Total Products" value={s.total_products}
          icon={Package} accent="#f59e0b" sub={`${s.active_products} active`} loading={loading} onClick={onGoProducts} />
        <StatCard label="Total Orders" value={s.total_orders}
          icon={ShoppingBag} accent="#8b5cf6" sub={`${s.pending_orders} pending`} loading={loading} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Sellers" value={s.total_sellers}
          icon={Store} accent="#06b6d4" sub={`${s.pending_verifications} unverified`} loading={loading} onClick={onGoVendors} />
        <StatCard label="Buyers" value={s.total_buyers}
          icon={Users} accent="#10b981" loading={loading} onClick={onGoUsers} />
        <StatCard label="Open Disputes" value={s.open_disputes}
          icon={AlertTriangle} accent={s.open_disputes > 0 ? '#ef4444' : '#94a3b8'} loading={loading} onClick={onGoDisputes} />
        <StatCard label="New Signups (30d)" value={s.new_users_7d}
          icon={UserPlus} accent="#8b5cf6" loading={loading} />
      </div>

      {/* Revenue + Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="lg:col-span-2 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Platform Revenue (30d)</h3>
              <p className="text-[10px] text-foreground/40 uppercase tracking-wider mt-0.5">Daily GMV — all confirmed orders</p>
            </div>
            <button onClick={() => fetchStats(true)} disabled={refreshing}
              className="w-7 h-7 rounded-lg bg-foreground/[0.05] flex items-center justify-center hover:bg-foreground/10 transition-colors">
              <RefreshCw className={`w-3 h-3 text-foreground/50 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <RevenueChart data={revenueData} loading={loading} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-5">
          <h3 className="text-sm font-bold text-foreground mb-1">Platform Health</h3>
          <p className="text-[10px] text-foreground/40 uppercase tracking-wider mb-4">Key metrics</p>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="flex gap-3"><Sk w="w-8" h="h-8" r="rounded-xl" /><div className="flex-1 space-y-1.5"><Sk h="h-3" w="w-2/3" /><Sk h="h-2" w="w-1/3" /></div></div>)}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Active Products', value: `${s.active_products} / ${s.total_products}`, pct: s.total_products > 0 ? (s.active_products / s.total_products) * 100 : 0, color: '#10b981', icon: Package },
                { label: 'Verified Sellers', value: `${Math.max(0, s.total_sellers - s.pending_verifications)} / ${s.total_sellers}`, pct: s.total_sellers > 0 ? ((s.total_sellers - s.pending_verifications) / s.total_sellers) * 100 : 0, color: '#3b82f6', icon: Shield },
                { label: 'Orders Fulfilled', value: `${s.total_orders - s.pending_orders} / ${s.total_orders}`, pct: s.total_orders > 0 ? ((s.total_orders - s.pending_orders) / s.total_orders) * 100 : 0, color: '#8b5cf6', icon: CheckCircle2 },
              ].map(({ label, value, pct, color, icon: Icon }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${color}20` }}>
                        <Icon className="w-2.5 h-2.5" style={{ color }} />
                      </div>
                      <span className="text-[10px] text-foreground/60">{label}</span>
                    </div>
                    <span className="text-[10px] font-bold text-foreground">{value}</span>
                  </div>
                  <div className="h-1.5 bg-foreground/[0.06] rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ background: color }}
                      initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct)}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: 'Users',    icon: Users,         color: 'text-blue-600 bg-blue-500/10',    action: onGoUsers },
          { label: 'Vendors',  icon: Store,          color: 'text-cyan-600 bg-cyan-500/10',    action: onGoVendors },
          { label: 'Products', icon: Package,        color: 'text-amber-600 bg-amber-500/10',  action: onGoProducts },
          { label: 'Disputes', icon: AlertTriangle,  color: 'text-rose-600 bg-rose-500/10',    action: onGoDisputes },
          { label: 'Payouts',  icon: DollarSign,     color: 'text-emerald-600 bg-emerald-500/10', action: onGoPayouts },
          { label: 'Growth',   icon: TrendingUp,     color: 'text-purple-600 bg-purple-500/10', action: onGoGrowth },
        ].map(({ label, icon: Icon, color, action }) => (
          <button key={label} onClick={action}
            className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-foreground/[0.02] border border-foreground/[0.08] hover:bg-foreground/[0.05] hover:border-foreground/15 transition-all active:scale-[0.97]">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-3.5 h-3.5 stroke-[2]" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/50">{label}</span>
          </button>
        ))}
      </motion.div>
    </div>
  );
};
