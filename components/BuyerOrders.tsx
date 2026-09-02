import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Package, Clock, ChevronLeft, RotateCcw, AlertCircle,
  ShoppingBag, MapPin, CreditCard, MessageCircle, Truck, CheckCircle2,
  XCircle, RefreshCw, Star, Trash2
} from 'lucide-react';
import { Badge, useToast, ConfirmModal } from './UI';
import { formatTZS } from '../constants';
import { Order, VendorProfile } from '../types';
import { CancelOrderModal } from './CancelOrderModal';
import { OrderTracking } from './CheckoutComponents';
import { orderStatus } from './orderStatusConfig';
import { SwipeableRow } from './SwipeableRow';

/**
 * BuyerOrders — completely field-safe rewrite.
 * Handles both item.products and item.product field shapes.
 * Uses correct column names: discount_amount, shipping_address, cancel_reason.
 */

const getItemProduct = (item: any) => item.products || item.product || {};

const StatusChip: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const cfg = orderStatus(status);
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold ${cfg.bg} ${cfg.color} ${size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'}`}>
      <Icon className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {cfg.label}
    </span>
  );
};

const FILTER_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Confirmed' },
  { value: 'in_transit', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const BuyerOrders = ({
  orders,
  onCancel,
  onDelete,
  onReorder,
  onContactSeller,
  onPrintReceipt,
  fetchVendorProfile,
}: {
  orders: Order[];
  onCancel: (id: string, reason: string) => void;
  onDelete: (id: string) => void;
  onReorder: (order: Order) => void;
  onContactSeller: (sellerId: string, context?: any) => void;
  onPrintReceipt: (order: Order, seller?: VendorProfile) => void;
  fetchVendorProfile: (id: string) => Promise<VendorProfile | null>;
}) => {
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancelModal, setCancelModal] = useState(false);
  // "Remove from history" was a one-click, unconfirmed, irreversible-looking
  // action on real order data. It now confirms first.
  const [removeModal, setRemoveModal] = useState(false);
  const [removing, setRemoving] = useState(false);

  const filtered = useMemo(() => {
    return orders
      .filter(o => {
        if (o.deleted_at) return false;
        const matchStatus =
          statusFilter === 'all'
          || o.status === statusFilter
          || (statusFilter === 'processing' && o.status === 'confirmed')
          || (statusFilter === 'in_transit' && (o.status === 'shipped' || o.status === 'in_transit'));
        const q = searchTerm.toLowerCase();
        const matchSearch = !q
          || o.id.toLowerCase().includes(q)
          || o.items?.some((i: any) => {
            const p = getItemProduct(i);
            return (p.name || '').toLowerCase().includes(q);
          });
        return matchStatus && matchSearch;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [orders, statusFilter, searchTerm]);

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selectedOrder) {
    const addr = (selectedOrder as any).shipping_address || {};
    const sellerId = selectedOrder.items?.[0] ? (getItemProduct(selectedOrder.items[0]).seller_id || (selectedOrder.items[0] as any).seller_id) : null;

    return (
      <div className="flex flex-col h-[calc(100vh-200px)] min-h-0">
        <div className="flex items-center gap-3 mb-5 flex-shrink-0">
          <button onClick={() => setSelectedOrder(null)}
            className="w-9 h-9 rounded-full bg-foreground/[0.05] hover:bg-foreground/10 flex items-center justify-center transition-colors">
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35">Order</p>
            <h3 className="font-bold text-sm text-foreground font-mono">#{selectedOrder.id.slice(0,8).toUpperCase()}</h3>
          </div>
          <StatusChip status={selectedOrder.status} />
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          {/* Order tracking */}
          <OrderTracking order={selectedOrder} />

          {/* Items */}
          <div className="rounded-2xl border border-foreground/8 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-foreground/8 bg-foreground/[0.02]">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40">Items ({selectedOrder.items?.length || 0})</p>
            </div>
            {selectedOrder.items?.map((item: any, i: number) => {
              const prod = getItemProduct(item);
              const unitPrice = Number(item.price_at_purchase) || Number(prod.price) || 0;
              return (
                <div key={item.id || i} className="flex items-center gap-3 px-4 py-3 border-b border-foreground/5 last:border-0">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-foreground/[0.05] flex-shrink-0">
                    {prod.images?.[0] && <img src={prod.images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{prod.name || 'Product'}</p>
                    <p className="text-[10px] text-foreground/40">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-xs font-bold text-foreground">{formatTZS(unitPrice * item.quantity)}</p>
                </div>
              );
            })}
            {/* Totals */}
            <div className="px-4 py-3 bg-foreground/[0.02] space-y-1.5">
              <div className="flex justify-between text-[10px] text-foreground/50">
                <span>Subtotal</span><span>{formatTZS(Number((selectedOrder as any).subtotal) || 0)}</span>
              </div>
              {Number((selectedOrder as any).delivery_fee) > 0 && (
                <div className="flex justify-between text-[10px] text-foreground/50">
                  <span>Delivery</span><span>{formatTZS(Number((selectedOrder as any).delivery_fee))}</span>
                </div>
              )}
              {Number((selectedOrder as any).discount_amount) > 0 && (
                <div className="flex justify-between text-[10px] text-emerald-600">
                  <span>Discount</span><span>−{formatTZS(Number((selectedOrder as any).discount_amount))}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-foreground/8">
                <span>Total Paid</span><span>{formatTZS(Number(selectedOrder.total) || 0)}</span>
              </div>
            </div>
          </div>

          {/* Address */}
          {addr.city && (
            <div className="rounded-2xl border border-foreground/8 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-foreground/8 bg-foreground/[0.02] flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-foreground/40" />
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40">Delivery</p>
              </div>
              <div className="p-4 space-y-0.5">
                {addr.label && <p className="text-sm font-semibold text-foreground">{addr.label}</p>}
                {addr.street && <p className="text-xs text-foreground/60">{addr.street}</p>}
                {addr.city && <p className="text-xs text-foreground/60">{[addr.city, addr.postal_code].filter(Boolean).join(', ')}</p>}
                {addr.landmark && <p className="text-xs text-foreground/40">Near: {addr.landmark}</p>}
                {addr.phone && <p className="text-xs text-foreground/40 mt-1">{addr.phone}</p>}
              </div>
            </div>
          )}

          {/* Delivery details — set by the seller before marking the order shipped */}
          {(selectedOrder as any).delivery_method && (
            <div className="rounded-2xl border border-blue-200/50 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/10 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-blue-200/40 dark:border-blue-900/30 flex items-center gap-1.5">
                <Truck className="w-3 h-3 text-blue-500" />
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">How it's being delivered</p>
              </div>
              <div className="p-4 space-y-1">
                <p className="text-sm font-semibold text-foreground">{(selectedOrder as any).delivery_method}</p>
                {Number((selectedOrder as any).actual_delivery_fee) > 0 && (
                  <p className="text-xs text-foreground/60">Delivery cost: {formatTZS(Number((selectedOrder as any).actual_delivery_fee))}</p>
                )}
                {(selectedOrder as any).driver_name && (
                  <p className="text-xs text-foreground/60">Driver: {(selectedOrder as any).driver_name}</p>
                )}
                {(selectedOrder as any).driver_phone && (
                  <p className="text-xs text-foreground/60">Contact: {(selectedOrder as any).driver_phone}</p>
                )}
                {(selectedOrder as any).delivery_notes && (
                  <p className="text-xs text-foreground/50 mt-1.5 pt-1.5 border-t border-blue-200/40 dark:border-blue-900/30">{(selectedOrder as any).delivery_notes}</p>
                )}
              </div>
            </div>
          )}

          {/* Payment */}
          <div className="rounded-2xl border border-foreground/8 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-2">Payment</p>
            <div className="flex justify-between text-xs">
              <span className="text-foreground/50">Method</span>
              <span className="font-semibold text-foreground">{(selectedOrder as any).payment_method || '—'}</span>
            </div>
          </div>

          {/* Cancel reason */}
          {selectedOrder.status === 'cancelled' && (selectedOrder as any).cancel_reason && (
            <div className="rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200/40 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500 mb-1">Cancellation Reason</p>
              <p className="text-xs text-foreground/70">{(selectedOrder as any).cancel_reason}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pb-4">
            {sellerId && (
              <button onClick={() => onContactSeller(sellerId, { type: 'order', id: selectedOrder.id, label: `Order #${selectedOrder.id.slice(0,8)}` })}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-foreground/10 hover:bg-foreground/[0.04] text-sm font-semibold text-foreground/60 hover:text-foreground transition-all">
                <MessageCircle className="w-4 h-4" />Contact Seller
              </button>
            )}
            {/* Free cancellation only while the seller hasn't started preparing.
                After that, cancellation is the seller's call — the buyer requests
                it through the order chat instead of hitting a server error. */}
            {selectedOrder.status === 'pending' && (
              <button onClick={() => setCancelModal(true)}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-red-200 dark:border-red-900/40 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">
                <XCircle className="w-4 h-4" />Cancel Order
              </button>
            )}
            {['processing','confirmed'].includes(selectedOrder.status) && sellerId && (
              <div className="space-y-1.5">
                <button onClick={() => onContactSeller(sellerId, { type: 'order', id: selectedOrder.id, label: `Order #${selectedOrder.id.slice(0,8)}` })}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-amber-300/50 dark:border-amber-700/40 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">
                  <XCircle className="w-4 h-4" />Request Cancellation
                </button>
                <p className="text-[10px] text-foreground/40 text-center leading-relaxed px-2">
                  The seller has started preparing this order, so cancellation is their call — send them a message and they can cancel it for you.
                </p>
              </div>
            )}
            {/* Terminal orders can be removed from history (soft delete via hide_my_order —
                the seller's and admin's records are unaffected). */}
            {['delivered','cancelled','refunded','failed'].includes(selectedOrder.status) && (
              <button
                onClick={() => setRemoveModal(true)}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-foreground/10 text-sm font-semibold text-foreground/45 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">
                <Trash2 className="w-4 h-4" />Remove from history
              </button>
            )}
          </div>
        </div>

        {cancelModal && (
          <CancelOrderModal
            isOpen={cancelModal}
            role="buyer"
            onClose={() => setCancelModal(false)}
            onConfirm={async (reason: string) => {
              await onCancel(selectedOrder.id, reason);
              setCancelModal(false);
              setSelectedOrder(null);
            }}
          />
        )}

        {/* Destructive-action guard. The copy states plainly that this only
            affects the buyer's own view — which is now actually true: it sets
            orders.hidden_at rather than the global deleted_at, so the seller's
            records and the order totals are untouched. */}
        <ConfirmModal
          isOpen={removeModal}
          isDestructive
          title="Remove from your history?"
          message="This hides the order from your list. Your order totals and reward points stay as they are, and the seller's records are unaffected."
          confirmText={removing ? 'Removing…' : 'Remove'}
          cancelText="Keep it"
          onClose={() => setRemoveModal(false)}
          onConfirm={async () => {
            if (removing) return;
            setRemoving(true);
            try {
              await onDelete(selectedOrder.id);
              setRemoveModal(false);
              setSelectedOrder(null);
            } catch {
              // deleteOrder already rolls back optimistic state and toasts.
            } finally {
              setRemoving(false);
            }
          }}
        />
      </div>
    );
  }

  // ── Orders list ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-0">
      {/* Search */}
      <div className="relative mb-3 flex-shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
        <input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search orders or products…"
          className="w-full h-10 pl-9 pr-3 rounded-xl bg-foreground/[0.04] border border-foreground/8 text-xs text-foreground placeholder:text-foreground/30 outline-none focus:border-foreground/25 transition-colors"
        />
      </div>

      {/* Status tabs. Wrapped in a relative shell so the right edge can carry a
          fade — the rail was sliced by the viewport, so "Cancelled" read as
          truncated text rather than as a scrollable row. */}
      <div className="relative mb-4">
      <div className="flex gap-1 overflow-x-auto no-scrollbar flex-shrink-0">
        {FILTER_TABS.map(tab => (
          <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
            className={`flex-shrink-0 h-7 px-3 rounded-full text-[10px] font-bold transition-all ${
              statusFilter === tab.value ? 'bg-foreground text-background' : 'bg-foreground/[0.05] text-foreground/45 hover:bg-foreground/10'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-foreground/[0.04] flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 text-foreground/20" />
            </div>
            <p className="text-xs font-bold text-foreground/30 uppercase tracking-wider">
              {statusFilter === 'all' ? 'No orders yet' : `No ${statusFilter} orders`}
            </p>
          </div>
        ) : (
          filtered.map(order => {
            const firstItem = order.items?.[0] as any;
            const firstProduct = firstItem ? getItemProduct(firstItem) : {};

            // Swipe action depends on order state: pending → cancel (opens the
            // reason modal); terminal → remove from history; otherwise no swipe.
            const isTerminal = ['delivered','cancelled','refunded','failed'].includes(order.status);
            const isPending = order.status === 'pending';
            const swipeProps = isPending
              ? { label: 'Cancel', icon: XCircle, bgClass: 'bg-amber-500', removeOnAction: false,
                  onDelete: () => { setSelectedOrder(order); setCancelModal(true); } }
              : isTerminal
              ? { label: 'Remove', icon: Trash2, bgClass: 'bg-red-500', removeOnAction: true,
                  onDelete: () => onDelete(order.id) }
              : { disabled: true, onDelete: () => {} };

            return (
              <SwipeableRow key={order.id} className="rounded-2xl" {...swipeProps}>
              <motion.button
                onClick={() => setSelectedOrder(order)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full text-left rounded-2xl border border-foreground/8 bg-foreground/[0.02] hover:bg-foreground/[0.04] hover:border-foreground/20 transition-all p-3.5 flex items-center gap-3"
              >
                {/* Thumb */}
                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-foreground/[0.06] flex-shrink-0">
                  {firstProduct.images?.[0]
                    ? <img src={firstProduct.images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                    : <Package className="w-5 h-5 text-foreground/20 m-auto mt-3.5" />
                  }
                  {(order.items?.length || 0) > 1 && (
                    <span className="absolute bottom-0 right-0 bg-foreground/80 text-background text-[7px] font-black px-0.5 rounded-tl-md">
                      +{(order.items?.length || 0) - 1}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-black text-foreground/35 font-mono">
                      #{order.id.slice(0,8).toUpperCase()}
                    </span>
                    <StatusChip status={order.status} size="sm" />
                  </div>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {firstProduct.name || 'Order'}
                    {(order.items?.length || 0) > 1 ? ` +${(order.items?.length || 0) - 1} more` : ''}
                  </p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[10px] text-foreground/35">
                      {new Date(order.created_at).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {formatTZS(Number(order.total) || 0)}
                    </span>
                  </div>
                </div>
              </motion.button>
              </SwipeableRow>
            );
          })
        )}
      </div>
    </div>
  );
};
