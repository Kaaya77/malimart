import { Product } from '../../types';

export interface InventoryProduct extends Product {
  units_sold_30d?: number;
  revenue_30d?: number;
  is_low_stock?: boolean;
  is_out_of_stock?: boolean;
  recent_movements?: InventoryMovement[];
}

export interface InventoryMovement {
  id: string;
  reason: string;
  delta: number;
  stock_before: number;
  stock_after: number;
  created_at: string;
  notes?: string;
}

export const timeAgo = (d?: string) => {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short' });
};

export const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: 'Active',    color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  draft:    { label: 'Draft',     color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20' },
  inactive: { label: 'Inactive',  color: 'text-foreground/40', bg: 'bg-foreground/[0.05]' },
  archived: { label: 'Archived',  color: 'text-foreground/30', bg: 'bg-foreground/[0.03]' },
  suspended:{ label: 'Suspended', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
};

export const REASON_LABELS: Record<string, string> = {
  sale: 'Sale', sale_reversed: 'Return', return: 'Return',
  restock: 'Restock', adjustment: 'Manual adj.',
  damaged: 'Damaged', reserved: 'Reserved', reservation_released: 'Released',
};

// ── Stock Adjustment Modal ─────────────────────────────────────────────────────