import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Loader2, Package, User, Truck,
  CheckCircle2, Clock, XCircle, RefreshCw, MapPin, Phone,
  MessageCircle, AlertCircle, Zap, ReceiptIcon,
  ShoppingBag, X, ChevronRight, Filter, ArrowUpDown,
  Gift, StickyNote, CreditCard, Hash, Calendar,
  TrendingUp, Eye
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { useToast } from './UI';
import { supabase } from '../services/supabaseClient';
import { formatTZS } from '../constants';
import { rateLimit } from '../src/security';
import { withCache, invalidate } from '../services/queryCache';
import { motion, AnimatePresence } from 'framer-motion';
import { orderStatus } from './orderStatusConfig';

type OrderStatus = 'pending'|'processing'|'confirmed'|'in_transit'|'shipped'|'delivered'|'cancelled'|'refunded'|'disputed'|'failed';

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = orderStatus(status);
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
      {cfg.label}
    </span>
  );
};

// ── Pipeline step indicator ──────────────────────────────────────────────────
const Pipeline = ({ status }: { status: string }) => {
  const STEPS = [
    { key: 'pending',    label: 'Placed' },
    { key: 'processing', label: 'Confirmed' },
    { key: 'in_transit', label: 'Shipped' },
    { key: 'delivered',  label: 'Delivered' },
  ];
  const cancelled = ['cancelled','refunded','failed','disputed'].includes(status);
  const currentIdx = cancelled ? -1 : STEPS.findIndex(s =>
    status === s.key || (s.key === 'processing' && status === 'confirmed') || (s.key === 'in_transit' && status === 'shipped')
  );

  if (cancelled) return null;

  return (
    <div className="flex items-center gap-0 mb-5">
      {STEPS.map((step, i) => {
        const done = i <= currentIdx;
        const current = i === currentIdx;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={{ scale: current ? [1, 1.12, 1] : 1 }}
                transition={{ repeat: current ? Infinity : 0, duration: 2 }}
                className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                  done
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'bg-background border-foreground/15'
                } ${current ? 'ring-4 ring-emerald-500/20' : ''}`}
              >
                {done
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  : <span className="w-2 h-2 rounded-full bg-foreground/15" />
                }
              </motion.div>
              <span className={`text-[8px] font-black uppercase tracking-wide ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/25'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-1 mb-5 transition-colors ${i < currentIdx ? 'bg-emerald-500' : 'bg-foreground/10'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

interface OrderRow {
  item_id: string; order_id: string; product_id: string; quantity: number;
  unit_price: number; sku: string; order_status: string;
  order_created_at: string; order_updated_at: string;
  total: number; subtotal: number; delivery_fee: number; discount_amount: number;
  payment_method: string; payment_ref: string; note: string;
  shipping_address: any; cancel_reason: string; is_gift: boolean; gift_message: string;
  buyer_id: string; buyer_name: string; buyer_email: string; buyer_phone: string; buyer_avatar: string;
  product_name: string; product_images: string[]; product_price: number;
}

interface GroupedOrder {
  id: string; status: string; created_at: string; updated_at: string;
  total: number; subtotal: number; delivery_fee: number; discount_amount: number;
  payment_method: string; payment_ref: string; note: string;
  shipping_address: any; cancel_reason: string; is_gift: boolean; gift_message: string;
  buyer: { id: string; name: string; email: string; phone: string; avatar: string };
  items: { id: string; product_id: string; product_name: string; product_images: string[]; quantity: number; unit_price: number }[];
}

function groupRows(rows: OrderRow[]): GroupedOrder[] {
  const map = new Map<string, GroupedOrder>();
  for (const r of rows) {
    if (!map.has(r.order_id)) {
      map.set(r.order_id, {
        id: r.order_id, status: r.order_status,
        created_at: r.order_created_at, updated_at: r.order_updated_at,
        total: Number(r.total), subtotal: Number(r.subtotal),
        delivery_fee: Number(r.delivery_fee), discount_amount: Number(r.discount_amount),
        payment_method: r.payment_method, payment_ref: r.payment_ref,
        note: r.note, shipping_address: r.shipping_address,
        cancel_reason: r.cancel_reason, is_gift: r.is_gift, gift_message: r.gift_message,
        buyer: { id: r.buyer_id, name: r.buyer_name, email: r.buyer_email, phone: r.buyer_phone, avatar: r.buyer_avatar },
        items: [],
      });
    }
    map.get(r.order_id)!.items.push({
      id: r.item_id, product_id: r.product_id,
      product_name: r.product_name, product_images: r.product_images,
      quantity: r.quantity, unit_price: Number(r.unit_price),
    });
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ── Order detail slide-over modal ─────────────────────────────────────────────
const OrderDetailModal = ({ order, onClose, onStatus, onMessage, updating }: {
  order: GroupedOrder;
  onClose: () => void;
  onStatus: (id: string, status: string) => void;
  onMessage: (buyerId: string, orderId: string) => void;
  updating: boolean;
}) => {
  const cfg = orderStatus(order.status);
  const addr = order.shipping_address || {};
  const dateStr = new Date(order.created_at).toLocaleDateString('en-TZ', { weekday:'short', day:'numeric', month:'long', year:'numeric' });
  const timeStr = new Date(order.created_at).toLocaleTimeString('en-TZ', { hour:'2-digit', minute:'2-digit' });

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-background shadow-2xl border-l border-foreground/[0.08] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-foreground/[0.07] shrink-0">
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-foreground/[0.05] hover:bg-foreground/10 transition-colors">
            <X className="w-4 h-4 text-foreground/60" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black font-mono text-foreground/35 uppercase tracking-widest">
                #{order.id.slice(0, 8).toUpperCase()}
              </span>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-[10px] text-foreground/30 mt-0.5">{dateStr} · {timeStr}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-black text-foreground">{formatTZS(order.total)}</p>
            <p className="text-[9px] text-foreground/30 font-semibold uppercase tracking-wide">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">

            {/* Pipeline */}
            <Pipeline status={order.status} />

            {/* Action card */}
            {cfg.next && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-4"
              >
                <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 mb-1">Action required</p>
                <p className="text-[11px] text-foreground/55 mb-3 leading-relaxed">
                  {order.status === 'pending'
                    ? 'Confirm this order to notify the buyer and begin processing.'
                    : order.status === 'processing' || order.status === 'confirmed'
                    ? 'Once dispatched, mark as shipped so the buyer can track their package.'
                    : 'Update to delivered once the buyer has received the order.'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onStatus(order.id, cfg.next!)}
                    disabled={updating}
                    className={`flex-1 h-9 rounded-xl text-white text-[11px] font-black uppercase tracking-wide flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 ${cfg.nextColor}`}
                  >
                    {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Zap className="w-3.5 h-3.5" />{cfg.nextLabel}</>}
                  </button>
                  {['pending','processing','confirmed'].includes(order.status) && (
                    <button
                      onClick={() => { if (confirm('Cancel this order?')) { onStatus(order.id, 'cancelled'); onClose(); } }}
                      className="h-9 px-4 rounded-xl bg-red-500/10 text-red-500 text-[11px] font-black uppercase tracking-wide hover:bg-red-500/15 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Items */}
            <section>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35 mb-2 px-1">Items ordered</p>
              <div className="rounded-2xl border border-foreground/[0.08] overflow-hidden divide-y divide-foreground/[0.05]">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3.5">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-foreground/[0.06] shrink-0">
                      {item.product_images?.[0]
                        ? <img src={item.product_images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                        : <Package className="w-5 h-5 text-foreground/20 m-auto mt-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{item.product_name}</p>
                      <p className="text-[10px] text-foreground/40 mt-0.5">
                        {formatTZS(item.unit_price)} × {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-black text-foreground shrink-0">{formatTZS(item.unit_price * item.quantity)}</p>
                  </div>
                ))}
                <div className="p-3.5 bg-foreground/[0.02] space-y-1.5">
                  {[
                    ['Subtotal', formatTZS(order.subtotal)],
                    order.delivery_fee > 0 ? ['Delivery fee', formatTZS(order.delivery_fee)] : null,
                    order.discount_amount > 0 ? ['Discount', `−${formatTZS(order.discount_amount)}`] : null,
                  ].filter(Boolean).map(([l, v]) => (
                    <div key={l as string} className="flex justify-between text-[11px] text-foreground/45">
                      <span>{l}</span><span>{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-black text-foreground pt-2 border-t border-foreground/[0.08] mt-1">
                    <span>Total</span><span>{formatTZS(order.total)}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Buyer */}
            <section>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35 mb-2 px-1">Buyer</p>
              <div className="rounded-2xl border border-foreground/[0.08] p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-sm font-black text-white shrink-0">
                  {(order.buyer.name || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{order.buyer.name || 'Buyer'}</p>
                  <p className="text-[10px] text-foreground/40 truncate">{order.buyer.email}</p>
                  {order.buyer.phone && (
                    <div className="flex items-center gap-1 mt-1">
                      <Phone className="w-2.5 h-2.5 text-foreground/30" />
                      <span className="text-[10px] text-foreground/40">{order.buyer.phone}</span>
                    </div>
                  )}
                </div>
                <button onClick={() => onMessage(order.buyer.id, order.id)}
                  className="shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase tracking-wide hover:bg-brand-500/15 transition-colors">
                  <MessageCircle className="w-3.5 h-3.5" /> Message
                </button>
              </div>
            </section>

            {/* Delivery */}
            <section>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35 mb-2 px-1">Delivery address</p>
              <div className="rounded-2xl border border-foreground/[0.08] p-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-foreground/[0.05] flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-foreground/40" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{addr.label || 'Delivery Address'}</p>
                    {addr.street && <p className="text-[11px] text-foreground/55 mt-0.5">{addr.street}</p>}
                    {addr.city && <p className="text-[11px] text-foreground/55">{[addr.city, addr.postal_code].filter(Boolean).join(', ')}</p>}
                    {addr.landmark && <p className="text-[10px] text-foreground/35 mt-1">Near: {addr.landmark}</p>}
                  </div>
                </div>
              </div>
            </section>

            {/* Payment */}
            <section>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35 mb-2 px-1">Payment</p>
              <div className="rounded-2xl border border-foreground/[0.08] p-4 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-foreground/[0.05] flex items-center justify-center shrink-0">
                  <CreditCard className="w-3.5 h-3.5 text-foreground/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground capitalize">{order.payment_method || '—'}</p>
                  {order.payment_ref && (
                    <p className="text-[10px] font-mono text-foreground/40 mt-0.5 truncate">Ref: {order.payment_ref}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Gift / Note */}
            {(order.is_gift || order.note) && (
              <section>
                {order.is_gift && (
                  <div className="rounded-2xl bg-pink-500/5 border border-pink-500/15 p-4 mb-3 flex items-start gap-3">
                    <Gift className="w-4 h-4 text-pink-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-pink-600 dark:text-pink-400">Gift order</p>
                      {order.gift_message && <p className="text-[11px] text-foreground/60 mt-1 leading-relaxed italic">"{order.gift_message}"</p>}
                    </div>
                  </div>
                )}
                {order.note && (
                  <div className="rounded-2xl bg-amber-500/5 border border-amber-500/15 p-4 flex items-start gap-3">
                    <StickyNote className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-amber-600 dark:text-amber-400 mb-1">Buyer note</p>
                      <p className="text-[11px] text-foreground/65 leading-relaxed">{order.note}</p>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
};

// ── Order card (list view) ────────────────────────────────────────────────────
const OrderCard = ({ order, onOpen, onQuickConfirm, updating }: {
  order: GroupedOrder;
  onOpen: () => void;
  onQuickConfirm: (id: string) => void;
  updating: boolean;
}) => {
  const cfg = orderStatus(order.status);
  const isPending = order.status === 'pending';
  const firstImg = order.items[0]?.product_images?.[0];
  const extraItems = order.items.length - 1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`rounded-2xl border cursor-pointer transition-all hover:shadow-md group ${
        isPending
          ? 'border-amber-300/50 dark:border-amber-700/30 bg-amber-50/20 dark:bg-amber-900/10 hover:border-amber-400/60'
          : 'border-foreground/[0.07] bg-foreground/[0.015] hover:bg-foreground/[0.03] hover:border-foreground/15'
      }`}
      onClick={onOpen}
    >
      <div className="flex items-center gap-3 p-3.5">
        {/* Thumbnail stack */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-foreground/[0.06]">
            {firstImg
              ? <img src={firstImg} alt="" className="w-full h-full object-cover" loading="lazy" />
              : <Package className="w-5 h-5 text-foreground/20 m-auto mt-3.5" />}
          </div>
          {extraItems > 0 && (
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-foreground text-background text-[8px] font-black flex items-center justify-center border-2 border-background">
              +{extraItems}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-[10px] font-black font-mono text-foreground/30 uppercase tracking-wider">
              #{order.id.slice(0, 8).toUpperCase()}
            </span>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-xs font-bold text-foreground truncate">
            {order.items[0]?.product_name}{extraItems > 0 ? ` +${extraItems} more` : ''}
          </p>
          <div className="flex items-center justify-between mt-0.5 gap-2">
            <span className="text-[10px] text-foreground/35 truncate">
              {order.buyer.name} · {new Date(order.created_at).toLocaleDateString('en-TZ', { day:'numeric', month:'short' })}
            </span>
            <span className="text-xs font-black text-foreground shrink-0">{formatTZS(order.total)}</span>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-foreground/20 shrink-0 group-hover:text-foreground/40 transition-colors" />
      </div>

      {/* Quick confirm strip */}
      {isPending && (
        <div className="px-3.5 pb-3.5" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onQuickConfirm(order.id)}
            disabled={updating}
            className="w-full h-8 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Zap className="w-3 h-3" />Confirm this order</>}
          </button>
        </div>
      )}
    </motion.div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
export const SellerOrders = ({ sellerId, onContactBuyer }: {
  sellerId: string;
  onContactBuyer: (buyerId: string, productId?: string, orderId?: string) => void;
}) => {
  const { addToast } = useToast();
  const { sellerOrders: contextOrders, refreshSellerData } = useAppState();
  const [orders, setOrders] = useState<GroupedOrder[]>([]);
  const [loading, setLoading] = useState(!contextOrders?.length);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<GroupedOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<Set<string>>(new Set());

  const ORDERS_CACHE_KEY = `seller:orders:${sellerId}`;

  const fetchOrders = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      if (silent) invalidate(ORDERS_CACHE_KEY);
      const data = await withCache(ORDERS_CACHE_KEY, 30_000, async () => {
        const { data: d, error } = await supabase.rpc('get_seller_orders', { p_seller_id: sellerId, p_limit: 50, p_offset: 0 });
        if (error) {
          const isTimeout = error.message?.includes('timeout') || error.code === '57014';
          if (isTimeout) {
            const { data: d2, error: e2 } = await supabase.rpc('get_seller_orders', { p_seller_id: sellerId, p_limit: 20, p_offset: 0 });
            if (!e2) return d2;
          }
          throw error;
        }
        return d;
      });
      const grouped = groupRows((data as OrderRow[]) || []);
      setOrders(grouped);
      if (selected) {
        const fresh = grouped.find(o => o.id === selected.id);
        if (fresh) setSelected(fresh);
      }
    } catch (err: any) {
      const isTimeout = err?.message?.includes('timeout') || err?.code === '57014';
      if (!silent && !isTimeout) addToast('Failed to load orders', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sellerId, selected?.id]);

  useEffect(() => {
    if (contextOrders?.length) {
      setOrders(groupRows(contextOrders as any));
      setLoading(false);
    }
  }, [contextOrders]);

  useEffect(() => {
    fetchOrders();
    const ch = supabase.channel(`seller-orders-${sellerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items', filter: `seller_id=eq.${sellerId}` }, () => fetchOrders(true))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sellerId]);

  const handleStatus = async (orderId: string, newStatus: string) => {
    if (!rateLimit(`status-${orderId}`, 5)) return addToast('Slow down', 'error');
    setUpdating(p => new Set(p).add(orderId));
    const patch = (list: GroupedOrder[]) => list.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
    setOrders(patch);
    if (selected?.id === orderId) setSelected(p => p ? { ...p, status: newStatus } : p);
    try {
      const { error } = await supabase.rpc('update_order_status_rbac', { p_order_id: orderId, p_new_status: newStatus, p_cancel_reason: null });
      if (error) throw error;
      const labels: Record<string, string> = { processing:'Order confirmed ✓', in_transit:'Marked as shipped ✓', delivered:'Marked as delivered ✓', cancelled:'Order cancelled' };
      addToast(labels[newStatus] || `Updated to ${newStatus}`, 'success');
      invalidate(ORDERS_CACHE_KEY);
      fetchOrders(true);
    } catch (err: any) {
      addToast(err.message || 'Update failed', 'error');
      fetchOrders(true);
    } finally {
      setUpdating(p => { const s = new Set(p); s.delete(orderId); return s; });
    }
  };

  const filtered = useMemo(() => orders.filter(o => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
      || (statusFilter === 'in_transit' && o.status === 'shipped')
      || (statusFilter === 'processing' && o.status === 'confirmed');
    const q = search.toLowerCase();
    const matchSearch = !q || o.id.slice(0, 8).includes(q)
      || o.buyer.name?.toLowerCase().includes(q)
      || o.items.some(i => i.product_name?.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  }), [orders, statusFilter, search]);

  const counts = useMemo(() => ({
    pending:   orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => ['processing','confirmed'].includes(o.status)).length,
    shipped:   orders.filter(o => ['in_transit','shipped'].includes(o.status)).length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  }), [orders]);

  const STATUS_FILTERS = [
    { id: 'all',        label: 'All',       count: orders.length, color: '#94a3b8' },
    { id: 'pending',    label: 'Pending',   count: counts.pending, color: '#f59e0b' },
    { id: 'processing', label: 'Confirmed', count: counts.confirmed, color: '#3b82f6' },
    { id: 'in_transit', label: 'Shipped',   count: counts.shipped, color: '#8b5cf6' },
    { id: 'delivered',  label: 'Delivered', count: counts.delivered, color: '#10b981' },
    { id: 'cancelled',  label: 'Cancelled', count: orders.filter(o => o.status === 'cancelled').length, color: '#ef4444' },
  ];

  return (
    <div>
      {/* Summary tiles */}
      <div className="grid grid-cols-4 gap-2.5 mb-5">
        {[
          { label: 'Pending',   value: counts.pending,   color: '#f59e0b', filter: 'pending' },
          { label: 'Confirmed', value: counts.confirmed, color: '#3b82f6', filter: 'processing' },
          { label: 'Shipped',   value: counts.shipped,   color: '#8b5cf6', filter: 'in_transit' },
          { label: 'Delivered', value: counts.delivered, color: '#10b981', filter: 'delivered' },
        ].map(st => (
          <button key={st.filter}
            onClick={() => setStatusFilter(p => p === st.filter ? 'all' : st.filter)}
            className={`rounded-2xl p-3 text-center transition-all border ${
              statusFilter === st.filter
                ? 'border-foreground/20 bg-foreground/[0.06] shadow-sm'
                : 'border-foreground/[0.07] bg-foreground/[0.02] hover:bg-foreground/[0.04]'
            }`}>
            <p className="text-2xl font-black tabular-nums" style={{ color: st.color }}>{st.value}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-foreground/35 mt-0.5">{st.label}</p>
          </button>
        ))}
      </div>

      {/* Search + refresh */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by order ID, buyer, product…"
            className="w-full h-10 pl-10 pr-3 rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] text-xs text-foreground placeholder:text-foreground/30 outline-none focus:border-foreground/25 focus:bg-foreground/[0.06] transition-all"
          />
        </div>
        <button onClick={() => fetchOrders(true)} disabled={refreshing}
          className="w-10 h-10 rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] flex items-center justify-center hover:bg-foreground/[0.08] transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 text-foreground/50 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status pills */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-0.5">
        {STATUS_FILTERS.map(sf => (
          <button key={sf.id}
            onClick={() => setStatusFilter(sf.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 h-7 px-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
              statusFilter === sf.id
                ? 'text-white shadow-sm'
                : 'bg-foreground/[0.05] text-foreground/40 hover:bg-foreground/10 hover:text-foreground/65'
            }`}
            style={statusFilter === sf.id ? { background: sf.color } : {}}
          >
            {sf.label}
            {sf.count > 0 && (
              <span className={`px-1 py-0 rounded text-[8px] font-black ${
                statusFilter === sf.id ? 'bg-white/25 text-white' : 'bg-foreground/10 text-foreground/50'
              }`}>{sf.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[78px] rounded-2xl bg-foreground/[0.04] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-3xl bg-foreground/[0.04] border border-foreground/[0.07] flex items-center justify-center">
            <ShoppingBag className="w-7 h-7 text-foreground/15" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-foreground/25 uppercase tracking-widest">
              {search ? 'No matching orders' : statusFilter === 'all' ? 'No orders yet' : `No ${statusFilter} orders`}
            </p>
            {search && (
              <button onClick={() => setSearch('')} className="text-[10px] text-brand-500 font-bold mt-2 hover:underline">
                Clear search
              </button>
            )}
          </div>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-2">
            {filtered.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onOpen={() => setSelected(order)}
                onQuickConfirm={(id) => handleStatus(id, 'processing')}
                updating={updating.has(order.id)}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <OrderDetailModal
            order={selected}
            onClose={() => setSelected(null)}
            onStatus={handleStatus}
            onMessage={(buyerId, orderId) => {
              setSelected(null);
              onContactBuyer(buyerId, undefined, orderId);
            }}
            updating={updating.has(selected.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
