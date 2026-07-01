/**
 * ORDER_STATUS_CONFIG — the single source of truth for how an order status
 * looks and behaves anywhere in the app (buyer orders, seller orders,
 * dashboard charts). One label, one palette, one workflow map.
 *
 * `next`/`nextLabel`/`nextColor` describe the seller's forward transition
 * (pending → processing → in_transit → delivered); terminal or buyer-driven
 * states have none.
 *
 * `hex` is the chart color (donut/legend) matching the Tailwind 500-shade of
 * each status family so chips and charts visibly agree.
 */
import React from 'react';
import {
  Clock, Package, Truck, CheckCircle2, XCircle, RefreshCw, AlertCircle,
} from 'lucide-react';

export interface OrderStatusConfig {
  label: string;
  color: string;             // chip text class
  bg: string;                // chip background classes
  icon: React.ElementType;
  hex: string;               // chart color
  next?: string;             // seller workflow transition target
  nextLabel?: string;
  nextColor?: string;        // transition button classes
}

export const ORDER_STATUS_CONFIG: Record<string, OrderStatusConfig> = {
  pending:          { label: 'Pending',   color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20',     icon: Clock,        hex: '#f59e0b',
                      next: 'processing', nextLabel: 'Confirm Order',   nextColor: 'bg-emerald-600 hover:bg-emerald-700' },
  processing:       { label: 'Confirmed', color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20',       icon: Package,      hex: '#3b82f6',
                      next: 'in_transit', nextLabel: 'Mark as Shipped', nextColor: 'bg-blue-600 hover:bg-blue-700' },
  confirmed:        { label: 'Confirmed', color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20',       icon: Package,      hex: '#3b82f6',
                      next: 'in_transit', nextLabel: 'Mark as Shipped', nextColor: 'bg-blue-600 hover:bg-blue-700' },
  in_transit:       { label: 'Shipped',   color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-900/20',   icon: Truck,        hex: '#8b5cf6',
                      next: 'delivered',  nextLabel: 'Mark Delivered',  nextColor: 'bg-violet-600 hover:bg-violet-700' },
  shipped:          { label: 'Shipped',   color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-900/20',   icon: Truck,        hex: '#8b5cf6',
                      next: 'delivered',  nextLabel: 'Mark Delivered',  nextColor: 'bg-violet-600 hover:bg-violet-700' },
  ready_for_pickup: { label: 'Ready',     color: 'text-teal-600',    bg: 'bg-teal-50 dark:bg-teal-900/20',       icon: Package,      hex: '#14b8a6' },
  delivered:        { label: 'Delivered', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCircle2, hex: '#10b981' },
  cancelled:        { label: 'Cancelled', color: 'text-red-500',     bg: 'bg-red-50 dark:bg-red-900/20',         icon: XCircle,      hex: '#ef4444' },
  refunded:         { label: 'Refunded',  color: 'text-orange-500',  bg: 'bg-orange-50 dark:bg-orange-900/20',   icon: RefreshCw,    hex: '#f97316' },
  disputed:         { label: 'Disputed',  color: 'text-red-700',     bg: 'bg-red-100 dark:bg-red-900/30',        icon: AlertCircle,  hex: '#dc2626' },
  failed:           { label: 'Failed',    color: 'text-slate-500',   bg: 'bg-slate-50 dark:bg-slate-900/20',     icon: XCircle,      hex: '#64748b' },
};

/** Config for a status, falling back to `pending` for unknown values. */
export const orderStatus = (status?: string): OrderStatusConfig =>
  ORDER_STATUS_CONFIG[status ?? ''] ?? ORDER_STATUS_CONFIG.pending;
