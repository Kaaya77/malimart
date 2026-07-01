import React from 'react';
import { ORDER_STATUS_CONFIG } from '../orderStatusConfig';

export const timeAgo = (d?: string): string => {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short' });
};

export const TIERS = [
  { name: 'Starter', color: '#94a3b8', bg: 'bg-slate-100 dark:bg-slate-800',        threshold: 0,     next: 500   },
  { name: 'Bronze',  color: '#cd7f32', bg: 'bg-amber-50 dark:bg-amber-900/20',       threshold: 500,   next: 3000  },
  { name: 'Silver',  color: '#94a3b8', bg: 'bg-slate-50 dark:bg-slate-800/60',       threshold: 3000,  next: 10000 },
  { name: 'Gold',    color: '#f59e0b', bg: 'bg-yellow-50 dark:bg-yellow-900/20',     threshold: 10000, next: null  },
] as const;

export const getLoyaltyTier = (points: number) => {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (points >= TIERS[i].threshold) return TIERS[i] as any;
  }
  return TIERS[0] as any;
};

// Derived view of the shared ORDER_STATUS_CONFIG (label + chart hex + icon).
// Kept as its own export so buyer-dashboard consumers keep their shape.
export const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> =
  Object.fromEntries(
    Object.entries(ORDER_STATUS_CONFIG).map(([k, c]) => [k, { label: c.label, color: c.hex, icon: c.icon }])
  );

export const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4'];
