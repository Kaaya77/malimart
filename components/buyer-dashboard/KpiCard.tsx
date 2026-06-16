import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: string;
  trend?: { value: number; positive: boolean };
  sub?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({ label, value, icon: Icon, accent, trend, sub }) => (
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
