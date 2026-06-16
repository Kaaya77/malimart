import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, TrendingUp, TrendingDown, AlertTriangle, Package, Zap, RefreshCw, ChevronRight, Clock } from 'lucide-react';
import { getAI } from '../../services/aiClient';
import { MODELS } from '../../services/aiModels';
import { formatTZS } from '../../constants';

interface InventoryProduct {
  id: string;
  name: string;
  stock: number;
  price: number;
  category?: string;
  units_sold_30d?: number;
  revenue_30d?: number;
  is_low_stock?: boolean;
  low_stock_threshold?: number;
  status: string;
}

interface Props {
  products: InventoryProduct[];
  onClose: () => void;
}

// Velocity = units sold per day over last 30 days
const velocity = (p: InventoryProduct) => (p.units_sold_30d ?? 0) / 30;

// Days until stock hits zero at current sell rate
const daysToZero = (p: InventoryProduct) => {
  const v = velocity(p);
  if (v <= 0) return null;
  return Math.floor(p.stock / v);
};

const urgencyColor = (days: number | null) => {
  if (days === null) return null;
  if (days <= 3) return { ring: 'ring-red-500/30', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', label: 'Critical' };
  if (days <= 7) return { ring: 'ring-amber-500/30', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', label: 'Low' };
  if (days <= 14) return { ring: 'ring-yellow-500/30', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400', label: 'Watch' };
  return null;
};

export const AIInventoryInsights = ({ products, onClose }: Props) => {
  const [aiInsight, setAiInsight] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiRequested, setAiRequested] = useState(false);

  // Computed signals from real data
  const signals = useMemo(() => {
    const active = products.filter(p => p.status === 'active');

    const criticalStock = active
      .map(p => ({ ...p, days: daysToZero(p) }))
      .filter(p => p.days !== null && p.days <= 7)
      .sort((a, b) => (a.days ?? 99) - (b.days ?? 99));

    const deadStock = active.filter(p => (p.units_sold_30d ?? 0) === 0 && p.stock > 10);

    const topPerformers = active
      .filter(p => (p.units_sold_30d ?? 0) > 0)
      .sort((a, b) => (b.revenue_30d ?? 0) - (a.revenue_30d ?? 0))
      .slice(0, 3);

    const totalRevenue30d = active.reduce((s, p) => s + (p.revenue_30d ?? 0), 0);
    const avgVelocity = active.reduce((s, p) => s + velocity(p), 0) / (active.length || 1);

    return { criticalStock, deadStock, topPerformers, totalRevenue30d, avgVelocity, active };
  }, [products]);

  const fetchAIInsight = async () => {
    if (loadingAI) return;
    setLoadingAI(true);
    setAiRequested(true);
    try {
      const ai = getAI();
      const summary = signals.active.slice(0, 20).map(p =>
        `${p.name} | stock: ${p.stock} | sold 30d: ${p.units_sold_30d ?? 0} | revenue: ${formatTZS(p.revenue_30d ?? 0)} | category: ${p.category || 'N/A'}`
      ).join('\n');

      const prompt = `You are an expert e-commerce inventory analyst for a Tanzanian marketplace called MaliMart.

Analyze this seller's inventory (top 20 products):
${summary}

Dead stock count: ${signals.deadStock.length} products with 0 sales and stock > 10
Critical restock needed: ${signals.criticalStock.length} products running out in â‰¤7 days
30-day total revenue: ${formatTZS(signals.totalRevenue30d)}

Give a sharp, actionable analysis in 4-5 sentences max. Include:
1. One specific restock recommendation with quantities
2. One dead stock strategy (discount, bundle, or remove)
3. One growth opportunity based on top performers
4. One pricing insight if relevant

Be specific, use numbers, and keep it practical for a Tanzanian seller. No fluff.`;

      const res = await ai.models.generateContent({
        model: MODELS.TEXT,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      setAiInsight(res.text ?? 'Could not generate insight.');
    } catch {
      setAiInsight('AI analysis unavailable. Check your connection and try again.');
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-y-0 right-0 z-[200] w-full max-w-[420px] bg-background border-l border-foreground/8 shadow-2xl flex flex-col overflow-hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/8 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">AI Inventory Insights</p>
            <p className="text-[10px] text-foreground/40 uppercase tracking-wider">{signals.active.length} active products analyzed</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-xl bg-foreground/[0.05] flex items-center justify-center hover:bg-foreground/[0.09] transition-colors">
          <X className="w-4 h-4 text-foreground/60" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5">

        {/* Critical restock */}
        {signals.criticalStock.length > 0 && (
          <section>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35 mb-3">ðŸš¨ Restock Now</p>
            <div className="space-y-2">
              {signals.criticalStock.slice(0, 5).map(p => {
                const colors = urgencyColor(p.days)!;
                const v = velocity(p);
                const suggested = Math.ceil(v * 30); // 30-day supply
                return (
                  <div key={p.id} className={`p-3 rounded-xl ring-1 ${colors.ring} ${colors.bg}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-foreground truncate">{p.name}</p>
                        <p className="text-[10px] text-foreground/50 mt-0.5">{p.stock} left Â· {v.toFixed(1)}/day</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-[11px] font-black ${colors.text}`}>{p.days}d left</p>
                        <p className="text-[9px] text-foreground/40">Order ~{suggested} units</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Velocity leaderboard */}
        {signals.topPerformers.length > 0 && (
          <section>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35 mb-3">ðŸ”¥ Top Performers (30d)</p>
            <div className="space-y-2">
              {signals.topPerformers.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-foreground/[0.03] ring-1 ring-foreground/8">
                  <span className="text-[10px] font-black text-foreground/25 w-4 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-foreground truncate">{p.name}</p>
                    <p className="text-[10px] text-foreground/45">{p.units_sold_30d ?? 0} units sold</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-bold text-emerald-600">{formatTZS(p.revenue_30d ?? 0)}</p>
                    <p className="text-[9px] text-foreground/35">{velocity(p).toFixed(1)}/day</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Dead stock */}
        {signals.deadStock.length > 0 && (
          <section>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35 mb-3">ðŸ’¤ Dead Stock ({signals.deadStock.length})</p>
            <div className="p-3 rounded-xl bg-foreground/[0.03] ring-1 ring-foreground/8 space-y-1.5">
              {signals.deadStock.slice(0, 4).map(p => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-foreground/70 truncate flex-1">{p.name}</p>
                  <p className="text-[10px] text-foreground/35 shrink-0">{p.stock} units</p>
                </div>
              ))}
              {signals.deadStock.length > 4 && (
                <p className="text-[10px] text-foreground/35">+{signals.deadStock.length - 4} more</p>
              )}
            </div>
            <p className="text-[10px] text-foreground/45 mt-2 px-1">Consider a 20-30% clearance discount or bundle with top sellers to move this stock.</p>
          </section>
        )}

        {/* Revenue summary */}
        <section className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/8 ring-1 ring-emerald-500/15">
            <p className="text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">30d Revenue</p>
            <p className="text-[15px] font-bold text-foreground">{formatTZS(signals.totalRevenue30d)}</p>
          </div>
          <div className="p-3 rounded-xl bg-foreground/[0.03] ring-1 ring-foreground/8">
            <p className="text-[9px] font-black uppercase tracking-wider text-foreground/40 mb-1">Avg Velocity</p>
            <p className="text-[15px] font-bold text-foreground">{signals.avgVelocity.toFixed(2)}<span className="text-[10px] font-normal text-foreground/40">/day</span></p>
          </div>
        </section>

        {/* AI Analysis */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35">âœ¨ AI Analysis</p>
            {aiRequested && !loadingAI && (
              <button onClick={fetchAIInsight} className="text-[9px] font-black uppercase tracking-wider text-foreground/35 hover:text-foreground flex items-center gap-1 transition-colors">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            )}
          </div>

          {!aiRequested ? (
            <button
              onClick={fetchAIInsight}
              className="w-full p-4 rounded-xl border-2 border-dashed border-foreground/12 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all group flex flex-col items-center gap-2"
            >
              <Sparkles className="w-5 h-5 text-foreground/30 group-hover:text-emerald-500 transition-colors" />
              <p className="text-[12px] font-semibold text-foreground/50 group-hover:text-foreground transition-colors">Generate AI analysis</p>
              <p className="text-[10px] text-foreground/30">Restock suggestions, pricing insights & growth opportunities</p>
            </button>
          ) : loadingAI ? (
            <div className="p-4 rounded-xl bg-foreground/[0.03] ring-1 ring-foreground/8 flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin shrink-0" />
              <div className="space-y-1.5">
                {[60, 80, 45].map((w, i) => (
                  <div key={i} className="h-2 rounded-full bg-foreground/8 animate-pulse" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-foreground/[0.03] ring-1 ring-foreground/8">
              <p className="text-[13px] text-foreground/80 leading-relaxed">{aiInsight}</p>
            </div>
          )}
        </section>

        {/* Inventory health score */}
        <section>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35 mb-3">ðŸ“Š Inventory Health</p>
          {[
            { label: 'Products with sales', value: signals.active.filter(p => (p.units_sold_30d ?? 0) > 0).length, total: signals.active.length, color: 'bg-emerald-500' },
            { label: 'Well-stocked (14d+)', value: signals.active.filter(p => { const d = daysToZero(p); return d === null || d > 14; }).length, total: signals.active.length, color: 'bg-blue-500' },
            { label: 'Dead stock', value: signals.deadStock.length, total: signals.active.length, color: 'bg-red-400', invert: true },
          ].map(row => (
            <div key={row.label} className="mb-2.5">
              <div className="flex justify-between mb-1">
                <p className="text-[10px] text-foreground/55">{row.label}</p>
                <p className="text-[10px] font-bold text-foreground/70">{row.value}/{row.total}</p>
              </div>
              <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full ${row.color} transition-all duration-700`}
                  style={{ width: `${row.total > 0 ? (row.value / row.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </section>
      </div>
    </motion.div>
  );
};
