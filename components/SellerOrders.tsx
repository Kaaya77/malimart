import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Loader2, ChevronLeft, Package, User, Truck, ShoppingBag,
  CheckCircle2, Clock, XCircle, RefreshCw, Bell, MapPin, Phone,
  MessageCircle, ChevronDown, AlertCircle, ReceiptIcon, ArrowUpDown,
  Calendar, Hash, Filter, Zap
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { Button, Input, Badge, useToast } from './UI';
import { supabase } from '../services/supabaseClient';
import { formatTZS } from '../constants';
import { rateLimit } from '../src/security';

/**
 * SellerOrders — Complete rewrite.
 *
 * Fixes:
 * 1. Realtime subscription on order_items (seller_id filter) — instant updates
 * 2. Correct status flow: pending → processing → in_transit → delivered
 * 3. RBAC status updates via update_order_status_rbac RPC
 * 4. Fast optimistic UI — updates locally before DB confirms
 * 5. Address displayed from shipping_address JSONB
 * 6. Buyer contact details surfaced on order detail
 */

type OrderStatus = 'pending' | 'processing' | 'in_transit' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' | 'disputed';

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; icon: React.ElementType; next?: OrderStatus; nextLabel?: string }> = {
  pending:    { label: 'Pending',     color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20',   icon: Clock,        next: 'processing', nextLabel: 'Confirm Order' },
  processing: { label: 'Confirmed',   color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20',     icon: Package,      next: 'in_transit', nextLabel: 'Mark Shipped' },
  in_transit: { label: 'Shipped',     color: 'text-purple-600',  bg: 'bg-purple-50 dark:bg-purple-900/20', icon: Truck,        next: 'delivered',  nextLabel: 'Mark Delivered' },
  shipped:    { label: 'Shipped',     color: 'text-purple-600',  bg: 'bg-purple-50 dark:bg-purple-900/20', icon: Truck,        next: 'delivered',  nextLabel: 'Mark Delivered' },
  delivered:  { label: 'Delivered',   color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCircle2 },
  cancelled:  { label: 'Cancelled',   color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-900/20',       icon: XCircle },
  refunded:   { label: 'Refunded',    color: 'text-orange-600',  bg: 'bg-orange-50 dark:bg-orange-900/20', icon: RefreshCw },
  disputed:   { label: 'Disputed',    color: 'text-red-700',     bg: 'bg-red-100 dark:bg-red-900/30',      icon: AlertCircle },
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status as OrderStatus] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" />{cfg.label}
    </span>
  );
};

export const SellerOrders = ({ sellerId, onContactBuyer }: {
  sellerId: string;
  onContactBuyer: (buyerId: string, productId?: string, orderId?: string) => void;
}) => {
  const { addToast } = useToast();
  const { user } = useAppState();

  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // ─── Fetch all orders for this seller ───────────────────────────────────────
  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    const { data, error } = await supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        product_id,
        quantity,
        price_at_purchase,
        sku,
        seller_id,
        product:products(id, name, images, price),
        order:orders(
          id, status, created_at, updated_at,
          subtotal, delivery_fee, discount_amount, total,
          payment_method, payment_ref, note,
          shipping_address,
          buyer:profiles(id, full_name, email, phone, avatar_url)
        )
      `)
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    if (error) {
      if (!silent) addToast('Failed to load orders', 'error');
    } else if (data) {
      // Group order_items by order_id
      const orderMap: Record<string, any> = {};
      (data as any[]).forEach(item => {
        const orderId = item.order?.id;
        if (!orderId) return;
        if (!orderMap[orderId]) {
          orderMap[orderId] = {
            ...item.order,
            items: [],
          };
        }
        orderMap[orderId].items.push({
          id: item.id,
          product: item.product,
          quantity: item.quantity,
          price_at_purchase: item.price_at_purchase,
          sku: item.sku,
        });
      });
      const grouped = Object.values(orderMap).sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setOrders(grouped);
      // Refresh selected order if open
      if (selectedOrder) {
        const fresh = grouped.find((o: any) => o.id === selectedOrder.id);
        if (fresh) setSelectedOrder(fresh);
      }
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, [sellerId, addToast, selectedOrder?.id]);

  // ─── Realtime ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchOrders();

    // Listen for new/updated orders on order_items for this seller
    const channel = supabase
      .channel(`seller-orders-${sellerId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_items',
        filter: `seller_id=eq.${sellerId}`,
      }, () => fetchOrders(true))
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
      }, (payload: any) => {
        // If the updated order belongs to us, refresh
        if (orders.some((o: any) => o.id === payload.new.id)) {
          fetchOrders(true);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sellerId]);

  // ─── Status update ───────────────────────────────────────────────────────────
  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    if (!rateLimit(`status-${orderId}`, 3)) {
      return addToast('Too many updates. Wait a moment.', 'error');
    }

    // Optimistic update
    setUpdatingIds(prev => new Set(prev).add(orderId));
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    if (selectedOrder?.id === orderId) setSelectedOrder((p: any) => ({ ...p, status: newStatus }));

    try {
      const { error } = await supabase.rpc('update_order_status_rbac', {
        p_order_id: orderId,
        p_new_status: newStatus,
      });
      if (error) throw error;

      const labels: Record<string, string> = {
        processing: 'Order confirmed ✓',
        in_transit: 'Marked as shipped ✓',
        delivered: 'Marked as delivered ✓',
        cancelled: 'Order cancelled',
      };
      addToast(labels[newStatus] || `Status updated to ${newStatus}`, 'success');
      fetchOrders(true);
    } catch (err: any) {
      addToast(err.message || 'Failed to update status', 'error');
      // Rollback
      fetchOrders(true);
    } finally {
      setUpdatingIds(prev => { const s = new Set(prev); s.delete(orderId); return s; });
    }
  };

  // ─── Filters ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return orders.filter(o => {
      const matchStatus = statusFilter === 'all' || o.status === statusFilter;
      const q = searchTerm.toLowerCase();
      const matchSearch = !q
        || o.id.toLowerCase().includes(q)
        || o.buyer?.full_name?.toLowerCase().includes(q)
        || o.items?.some((i: any) => i.product?.name?.toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [orders, statusFilter, searchTerm]);

  const stats = useMemo(() => ({
    pending:   orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => o.status === 'processing').length,
    shipped:   orders.filter(o => ['in_transit','shipped'].includes(o.status)).length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  }), [orders]);

  // ─── Order detail panel ──────────────────────────────────────────────────────
  if (selectedOrder) {
    const cfg = STATUS_CONFIG[selectedOrder.status as OrderStatus] || STATUS_CONFIG.pending;
    const nextStatus = cfg.next;
    const addr = selectedOrder.shipping_address || {};
    const isUpdating = updatingIds.has(selectedOrder.id);

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 flex-shrink-0">
          <button
            onClick={() => setSelectedOrder(null)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-foreground/[0.05] hover:bg-foreground/10 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 mb-0.5">Order</p>
            <h3 className="font-bold text-foreground text-sm truncate">#{selectedOrder.id.slice(0, 8).toUpperCase()}</h3>
          </div>
          <StatusBadge status={selectedOrder.status} />
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Status action */}
          {nextStatus && (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Action required</p>
                <p className="text-[11px] text-emerald-600/70 mt-0.5">
                  {selectedOrder.status === 'pending' ? 'Review and confirm this order.' : 'Update shipment status.'}
                </p>
              </div>
              <Button
                onClick={() => handleUpdateStatus(selectedOrder.id, nextStatus)}
                disabled={isUpdating}
                className="h-9 px-4 text-[11px] font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 flex-shrink-0"
              >
                {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : cfg.nextLabel}
              </Button>
            </div>
          )}

          {/* Cancel option for pending/processing */}
          {['pending','processing'].includes(selectedOrder.status) && (
            <button
              onClick={() => {
                if (confirm('Cancel this order? This cannot be undone.')) {
                  handleUpdateStatus(selectedOrder.id, 'cancelled');
                  setSelectedOrder(null);
                }
              }}
              className="w-full text-[11px] font-bold text-red-500 hover:text-red-600 py-2 transition-colors"
            >
              Cancel order
            </button>
          )}

          {/* Items */}
          <div className="rounded-2xl border border-foreground/8 overflow-hidden">
            <div className="px-4 py-3 border-b border-foreground/8 bg-foreground/[0.02]">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">Items</p>
            </div>
            <div className="divide-y divide-foreground/5">
              {selectedOrder.items?.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3.5">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-foreground/[0.05] flex-shrink-0">
                    {item.product?.images?.[0] && (
                      <img src={item.product.images[0]} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{item.product?.name}</p>
                    <p className="text-[10px] text-foreground/40">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-xs font-bold text-foreground flex-shrink-0">
                    {formatTZS(item.price_at_purchase * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-foreground/8 bg-foreground/[0.02] space-y-1.5">
              <div className="flex justify-between text-[10px] text-foreground/50">
                <span>Subtotal</span><span>{formatTZS(selectedOrder.subtotal)}</span>
              </div>
              {selectedOrder.delivery_fee > 0 && (
                <div className="flex justify-between text-[10px] text-foreground/50">
                  <span>Delivery</span><span>{formatTZS(selectedOrder.delivery_fee)}</span>
                </div>
              )}
              {selectedOrder.discount_amount > 0 && (
                <div className="flex justify-between text-[10px] text-emerald-600">
                  <span>Discount</span><span>−{formatTZS(selectedOrder.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-foreground/8">
                <span>Total</span><span>{formatTZS(selectedOrder.total)}</span>
              </div>
            </div>
          </div>

          {/* Delivery address */}
          <div className="rounded-2xl border border-foreground/8 overflow-hidden">
            <div className="px-4 py-3 border-b border-foreground/8 bg-foreground/[0.02] flex items-center gap-2">
              <MapPin className="w-3 h-3 text-foreground/40" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">Delivery Address</p>
            </div>
            <div className="p-4 space-y-1">
              <p className="text-sm font-semibold text-foreground">{addr.label || 'Delivery'}</p>
              <p className="text-xs text-foreground/60">{addr.street}</p>
              <p className="text-xs text-foreground/60">{[addr.city, addr.postal_code].filter(Boolean).join(', ')}</p>
              {addr.landmark && <p className="text-xs text-foreground/40">Near: {addr.landmark}</p>}
              {addr.phone && (
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-foreground/5">
                  <Phone className="w-3 h-3 text-foreground/40" />
                  <p className="text-xs font-medium text-foreground/60">{addr.phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Buyer info */}
          {selectedOrder.buyer && (
            <div className="rounded-2xl border border-foreground/8 overflow-hidden">
              <div className="px-4 py-3 border-b border-foreground/8 bg-foreground/[0.02] flex items-center gap-2">
                <User className="w-3 h-3 text-foreground/40" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">Buyer</p>
              </div>
              <div className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedOrder.buyer.full_name || 'Buyer'}</p>
                  <p className="text-xs text-foreground/50">{selectedOrder.buyer.email}</p>
                </div>
                <Button
                  onClick={() => onContactBuyer(selectedOrder.buyer.id, undefined, selectedOrder.id)}
                  variant="outline"
                  className="h-8 px-3 text-[10px] font-bold rounded-xl border-foreground/15 gap-1.5"
                >
                  <MessageCircle className="w-3 h-3" /> Message
                </Button>
              </div>
            </div>
          )}

          {/* Payment info */}
          <div className="rounded-2xl border border-foreground/8 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-3">Payment</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-foreground/50">Method</span>
                <span className="font-semibold text-foreground">{selectedOrder.payment_method}</span>
              </div>
              {selectedOrder.payment_ref && (
                <div className="flex justify-between text-xs">
                  <span className="text-foreground/50">Reference</span>
                  <span className="font-mono text-foreground/70 text-[10px]">{selectedOrder.payment_ref}</span>
                </div>
              )}
            </div>
          </div>

          {/* Note */}
          {selectedOrder.note && (
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-700/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 mb-1">Buyer Note</p>
              <p className="text-xs text-foreground/70 leading-relaxed">{selectedOrder.note}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Orders list ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2 mb-4 flex-shrink-0">
        {[
          { label: 'Pending',   value: stats.pending,   color: 'text-amber-600',   status: 'pending' },
          { label: 'Confirmed', value: stats.confirmed,  color: 'text-blue-600',    status: 'processing' },
          { label: 'Shipped',   value: stats.shipped,   color: 'text-purple-600',  status: 'in_transit' },
          { label: 'Delivered', value: stats.delivered, color: 'text-emerald-600', status: 'delivered' },
        ].map(s => (
          <button
            key={s.status}
            onClick={() => setStatusFilter(prev => prev === s.status ? 'all' : s.status)}
            className={`rounded-xl p-2.5 text-center transition-all ${
              statusFilter === s.status ? 'bg-foreground/10 ring-1 ring-foreground/20' : 'bg-foreground/[0.03] hover:bg-foreground/[0.06]'
            }`}
          >
            <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-foreground/40 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex gap-2 mb-4 flex-shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search order ID, buyer, product…"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-foreground/[0.04] border border-foreground/8 text-xs text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/25 transition-colors"
          />
        </div>
        <button
          onClick={() => fetchOrders(true)}
          disabled={isRefreshing}
          className="w-10 h-10 rounded-xl bg-foreground/[0.04] border border-foreground/8 flex items-center justify-center hover:bg-foreground/[0.07] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-foreground/50 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto no-scrollbar flex-shrink-0">
        {['all','pending','processing','in_transit','delivered','cancelled'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex-shrink-0 h-7 px-3 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${
              statusFilter === s
                ? 'bg-foreground text-background'
                : 'bg-foreground/[0.05] text-foreground/50 hover:bg-foreground/10'
            }`}
          >
            {s === 'all' ? 'All' : s === 'in_transit' ? 'Shipped' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-foreground/[0.04] animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-10 h-10 text-foreground/15 mx-auto mb-3" />
            <p className="text-xs font-bold text-foreground/30 uppercase tracking-wider">
              {statusFilter === 'pending' ? 'No pending orders' : 'No orders found'}
            </p>
          </div>
        ) : (
          filtered.map(order => {
            const cfg = STATUS_CONFIG[order.status as OrderStatus] || STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const isUpdating = updatingIds.has(order.id);
            const firstProduct = order.items?.[0]?.product;
            const isPending = order.status === 'pending';

            return (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`rounded-2xl border cursor-pointer transition-all hover:shadow-sm ${
                  isPending
                    ? 'border-amber-300 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/10'
                    : 'border-foreground/8 bg-foreground/[0.02] hover:bg-foreground/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3 p-3.5">
                  {/* Product thumb */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-foreground/[0.06] flex-shrink-0 relative">
                    {firstProduct?.images?.[0]
                      ? <img src={firstProduct.images[0]} alt="" className="w-full h-full object-cover" />
                      : <Package className="w-5 h-5 text-foreground/20 m-auto mt-3.5" />
                    }
                    {order.items?.length > 1 && (
                      <span className="absolute bottom-0 right-0 bg-foreground/80 text-background text-[8px] font-black px-1 rounded-tl-md">
                        +{order.items.length - 1}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-black text-foreground/40 font-mono">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-xs font-semibold text-foreground truncate">
                      {firstProduct?.name}{order.items?.length > 1 ? ` +${order.items.length - 1} more` : ''}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-foreground/40">
                        {order.buyer?.full_name} · {new Date(order.created_at).toLocaleDateString('en-TZ', { day:'numeric', month:'short' })}
                      </span>
                      <span className="text-xs font-bold text-foreground">{formatTZS(order.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Quick confirm button for pending orders */}
                {isPending && (
                  <div
                    className="px-3.5 pb-3 pt-0"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'processing')}
                      disabled={isUpdating}
                      className="w-full h-8 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      {isUpdating
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <><Zap className="w-3 h-3" />Confirm Order</>
                      }
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
