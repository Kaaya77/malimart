import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Loader2, ChevronLeft, Package, User, Truck,
  CheckCircle2, Clock, XCircle, RefreshCw, MapPin, Phone,
  MessageCircle, AlertCircle, ArrowRight, Zap, ReceiptIcon,
  ShoppingBag, Calendar, DollarSign
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { useToast } from './UI';
import { supabase } from '../services/supabaseClient';
import { formatTZS } from '../constants';
import { rateLimit } from '../src/security';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * SellerOrders — uses get_seller_orders() RPC which:
 *  - Runs SECURITY DEFINER (bypasses RLS complexity)
 *  - Returns flat rows with all joined data already resolved
 *  - Validates caller is the seller
 *  - Handles the order_status enum cast properly
 */

type OrderStatus = 'pending'|'processing'|'confirmed'|'in_transit'|'shipped'|'delivered'|'cancelled'|'refunded'|'disputed'|'failed';

const STATUS: Record<string, { label: string; color: string; bg: string; dot: string; icon: React.ElementType; next?: string; nextLabel?: string }> = {
  pending:    { label:'Pending',    color:'text-amber-600',   bg:'bg-amber-50 dark:bg-amber-900/20',   dot:'bg-amber-400', icon:Clock,         next:'processing', nextLabel:'Confirm Order' },
  processing: { label:'Confirmed',  color:'text-blue-600',    bg:'bg-blue-50 dark:bg-blue-900/20',     dot:'bg-blue-500',  icon:Package,       next:'in_transit', nextLabel:'Mark Shipped' },
  confirmed:  { label:'Confirmed',  color:'text-blue-600',    bg:'bg-blue-50 dark:bg-blue-900/20',     dot:'bg-blue-500',  icon:Package,       next:'in_transit', nextLabel:'Mark Shipped' },
  in_transit: { label:'Shipped',    color:'text-purple-600',  bg:'bg-purple-50 dark:bg-purple-900/20', dot:'bg-purple-500',icon:Truck,         next:'delivered',  nextLabel:'Mark Delivered' },
  shipped:    { label:'Shipped',    color:'text-purple-600',  bg:'bg-purple-50 dark:bg-purple-900/20', dot:'bg-purple-500',icon:Truck,         next:'delivered',  nextLabel:'Mark Delivered' },
  delivered:  { label:'Delivered',  color:'text-emerald-600', bg:'bg-emerald-50 dark:bg-emerald-900/20',dot:'bg-emerald-500',icon:CheckCircle2 },
  cancelled:  { label:'Cancelled',  color:'text-red-500',     bg:'bg-red-50 dark:bg-red-900/20',       dot:'bg-red-400',   icon:XCircle },
  refunded:   { label:'Refunded',   color:'text-orange-500',  bg:'bg-orange-50 dark:bg-orange-900/20', dot:'bg-orange-400',icon:RefreshCw },
  disputed:   { label:'Disputed',   color:'text-red-700',     bg:'bg-red-100 dark:bg-red-900/30',      dot:'bg-red-600',   icon:AlertCircle },
  failed:     { label:'Failed',     color:'text-gray-500',    bg:'bg-gray-50 dark:bg-gray-900/20',     dot:'bg-gray-400',  icon:XCircle },
};

const Dot: React.FC<{ status: string; pulse?: boolean }> = ({ status, pulse }) => {
  const cfg = STATUS[status] || STATUS.pending;
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot} ${pulse ? 'animate-pulse' : ''}`} />;
};

const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS[status] || STATUS.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" />{cfg.label}
    </span>
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

export const SellerOrders = ({ sellerId, onContactBuyer }: { sellerId: string; onContactBuyer: (buyerId: string, productId?: string, orderId?: string) => void }) => {
  const { addToast } = useToast();
  const { sellerOrders: contextOrders, refreshSellerData } = useAppState();
  const [orders, setOrders] = useState<GroupedOrder[]>([]);
  const [loading, setLoading] = useState(!contextOrders?.length);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<GroupedOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<Set<string>>(new Set());

  // ── Fetch via RPC ──────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      // Try full fetch; on timeout retry with smaller limit
      let data: any;
      const { data: d1, error: e1 } = await supabase.rpc('get_seller_orders', {
        p_seller_id: sellerId, p_limit: 50, p_offset: 0,
      });
      if (e1) {
        const isTimeout = e1.message?.includes('timeout') || e1.code === '57014' || e1.message?.includes('canceling');
        if (isTimeout) {
          // Retry with smaller batch — don't show error to user
          const { data: d2, error: e2 } = await supabase.rpc('get_seller_orders', {
            p_seller_id: sellerId, p_limit: 20, p_offset: 0,
          });
          if (e2) throw e2;
          data = d2;
        } else {
          throw e1;
        }
      } else {
        data = d1;
      }
      const rows = (data as OrderRow[]) || [];
      const grouped = groupRows(rows);
      setOrders(grouped);
      if (selected) {
        const fresh = grouped.find(o => o.id === selected.id);
        if (fresh) setSelected(fresh);
      }
    } catch (err: any) {
      // Only show error on non-silent fetches and non-timeout errors
      const isTimeout = err?.message?.includes('timeout') || err?.code === '57014' || err?.message?.includes('canceling');
      if (!silent && !isTimeout) addToast(`Failed to load orders: ${err.message}`, 'error');
      // On timeout, keep existing data — don't clear orders
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sellerId, selected?.id]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  // Seed from preloaded context data instantly (no spinner)
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchOrders(true))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sellerId]);

  // ── Status update ─────────────────────────────────────────────────────────
  const handleStatus = async (orderId: string, newStatus: string) => {
    if (!rateLimit(`status-${orderId}`, 5)) return addToast('Slow down', 'error');
    setUpdating(p => new Set(p).add(orderId));

    // Optimistic update
    const patch = (list: GroupedOrder[]) => list.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
    setOrders(patch);
    if (selected?.id === orderId) setSelected(p => p ? { ...p, status: newStatus } : p);

    try {
      const { error } = await supabase.rpc('update_order_status_rbac', { p_order_id: orderId, p_new_status: newStatus, p_cancel_reason: null });
      if (error) throw error;
      const labels: Record<string,string> = { processing:'Order confirmed ✓', in_transit:'Marked as shipped ✓', delivered:'Marked as delivered ✓', cancelled:'Order cancelled' };
      addToast(labels[newStatus] || `Updated to ${newStatus}`, 'success');
      fetchOrders(true);
    } catch (err: any) {
      addToast(err.message || 'Update failed', 'error');
      fetchOrders(true); // rollback
    } finally {
      setUpdating(p => { const s = new Set(p); s.delete(orderId); return s; });
    }
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => orders.filter(o => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
      || (statusFilter === 'in_transit' && o.status === 'shipped')
      || (statusFilter === 'processing' && o.status === 'confirmed');
    const q = search.toLowerCase();
    const matchSearch = !q || o.id.slice(0,8).includes(q)
      || o.buyer.name?.toLowerCase().includes(q)
      || o.items.some(i => i.product_name?.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  }), [orders, statusFilter, search]);

  const stats = useMemo(() => ({
    pending:   orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => ['processing','confirmed'].includes(o.status)).length,
    shipped:   orders.filter(o => ['in_transit','shipped'].includes(o.status)).length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  }), [orders]);

  // ── Detail panel ──────────────────────────────────────────────────────────
  if (selected) {
    const cfg = STATUS[selected.status] || STATUS.pending;
    const isUpdating = updating.has(selected.id);
    const addr = selected.shipping_address || {};

    return (
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 flex-shrink-0">
          <button onClick={() => setSelected(null)} className="w-9 h-9 flex items-center justify-center rounded-full bg-foreground/[0.05] hover:bg-foreground/10 transition-colors">
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35">Order</p>
            <h3 className="font-bold text-sm text-foreground font-mono">#{selected.id.slice(0,8).toUpperCase()}</h3>
          </div>
          <StatusChip status={selected.status} />
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
          {/* Action card */}
          {cfg.next && (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Action required</p>
                  <p className="text-[11px] text-emerald-600/70 mt-0.5">
                    {selected.status === 'pending' ? 'Confirm this order to start processing.' : 'Update the shipment status.'}
                  </p>
                </div>
                <button
                  onClick={() => handleStatus(selected.id, cfg.next!)}
                  disabled={isUpdating}
                  className="h-9 px-4 rounded-xl bg-emerald-600 text-white text-[11px] font-black hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-1.5 flex-shrink-0 disabled:opacity-60"
                >
                  {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Zap className="w-3 h-3" />{cfg.nextLabel}</>}
                </button>
              </div>
              {['pending','processing','confirmed'].includes(selected.status) && (
                <button onClick={() => { if (confirm('Cancel this order?')) { handleStatus(selected.id,'cancelled'); setSelected(null); }}}
                  className="mt-2 text-[11px] font-bold text-red-400 hover:text-red-600 transition-colors">
                  Cancel order
                </button>
              )}
            </div>
          )}

          {/* Items */}
          <div className="rounded-2xl border border-foreground/8 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-foreground/8 bg-foreground/[0.02]">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40">Items</p>
            </div>
            {selected.items.map((item, i) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-foreground/5 last:border-0">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-foreground/[0.05] flex-shrink-0">
                  {item.product_images?.[0] && <img src={item.product_images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{item.product_name}</p>
                  <p className="text-[10px] text-foreground/40">Qty: {item.quantity}</p>
                </div>
                <p className="text-xs font-bold text-foreground">{formatTZS(item.unit_price * item.quantity)}</p>
              </div>
            ))}
            <div className="px-4 py-3 bg-foreground/[0.02] space-y-1">
              {[
                ['Subtotal', formatTZS(selected.subtotal)],
                selected.delivery_fee > 0 ? ['Delivery', formatTZS(selected.delivery_fee)] : null,
                selected.discount_amount > 0 ? ['Discount', `−${formatTZS(selected.discount_amount)}`] : null,
              ].filter(Boolean).map(([l,v]) => (
                <div key={l} className="flex justify-between text-[10px] text-foreground/50"><span>{l}</span><span>{v}</span></div>
              ))}
              <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-foreground/8 mt-1">
                <span>Total</span><span>{formatTZS(selected.total)}</span>
              </div>
            </div>
          </div>

          {/* Delivery address */}
          <div className="rounded-2xl border border-foreground/8 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-foreground/8 bg-foreground/[0.02] flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-foreground/40" />
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40">Delivery</p>
            </div>
            <div className="p-4 space-y-0.5">
              <p className="text-sm font-semibold text-foreground">{addr.label || 'Delivery Address'}</p>
              {addr.street && <p className="text-xs text-foreground/60">{addr.street}</p>}
              {addr.city && <p className="text-xs text-foreground/60">{[addr.city, addr.postal_code].filter(Boolean).join(', ')}</p>}
              {addr.landmark && <p className="text-xs text-foreground/40">Near: {addr.landmark}</p>}
              {addr.phone && (
                <div className="flex items-center gap-1 pt-2 mt-1 border-t border-foreground/5">
                  <Phone className="w-3 h-3 text-foreground/30" />
                  <p className="text-xs font-medium text-foreground/60">{addr.phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Buyer */}
          <div className="rounded-2xl border border-foreground/8 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-foreground/8 bg-foreground/[0.02] flex items-center gap-1.5">
              <User className="w-3 h-3 text-foreground/40" />
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40">Buyer</p>
            </div>
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{selected.buyer.name || 'Buyer'}</p>
                <p className="text-xs text-foreground/45 truncate">{selected.buyer.email}</p>
                {selected.buyer.phone && <p className="text-xs text-foreground/40">{selected.buyer.phone}</p>}
              </div>
              <button onClick={() => onContactBuyer(selected.buyer.id, undefined, selected.id)}
                className="flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-foreground/15 text-[10px] font-bold text-foreground/60 hover:bg-foreground/[0.05] transition-colors">
                <MessageCircle className="w-3 h-3" />Message
              </button>
            </div>
          </div>

          {/* Payment */}
          <div className="rounded-2xl border border-foreground/8 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-2">Payment</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs"><span className="text-foreground/50">Method</span><span className="font-semibold text-foreground">{selected.payment_method || '—'}</span></div>
              {selected.payment_ref && <div className="flex justify-between text-xs"><span className="text-foreground/50">Reference</span><span className="font-mono text-[10px] text-foreground/60 truncate max-w-[60%] text-right">{selected.payment_ref}</span></div>}
            </div>
          </div>

          {/* Note */}
          {selected.note && (
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200/40 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600 mb-1">Buyer Note</p>
              <p className="text-xs text-foreground/70 leading-relaxed">{selected.note}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Orders list ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4 flex-shrink-0">
        {[
          { label:'Pending',   value:stats.pending,   color:'text-amber-500',   s:'pending' },
          { label:'Confirmed', value:stats.confirmed,  color:'text-blue-500',    s:'processing' },
          { label:'Shipped',   value:stats.shipped,   color:'text-purple-500',  s:'in_transit' },
          { label:'Delivered', value:stats.delivered, color:'text-emerald-500', s:'delivered' },
        ].map(st => (
          <button key={st.s} onClick={() => setStatusFilter(p => p === st.s ? 'all' : st.s)}
            className={`rounded-xl p-2.5 text-center transition-all ${statusFilter===st.s ? 'bg-foreground/10 ring-1 ring-foreground/20' : 'bg-foreground/[0.03] hover:bg-foreground/[0.06]'}`}>
            <p className={`text-xl font-black tabular-nums ${st.color}`}>{st.value}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide text-foreground/35 mt-0.5">{st.label}</p>
          </button>
        ))}
      </div>

      {/* Search + refresh */}
      <div className="flex gap-2 mb-3 flex-shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order, buyer, product…"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-foreground/[0.04] border border-foreground/8 text-xs text-foreground placeholder:text-foreground/30 outline-none focus:border-foreground/25 transition-colors" />
        </div>
        <button onClick={() => fetchOrders(true)} disabled={refreshing}
          className="w-10 h-10 rounded-xl bg-foreground/[0.04] border border-foreground/8 flex items-center justify-center hover:bg-foreground/[0.07] transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 text-foreground/50 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto no-scrollbar flex-shrink-0">
        {['all','pending','processing','in_transit','delivered','cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`flex-shrink-0 h-6 px-3 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${statusFilter===s ? 'bg-foreground text-background' : 'bg-foreground/[0.05] text-foreground/45 hover:bg-foreground/10'}`}>
            {s==='all'?'All':s==='in_transit'?'Shipped':s==='processing'?'Confirmed':s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {loading ? (
          Array.from({length:4}).map((_,i) => <div key={i} className="h-20 rounded-2xl bg-foreground/[0.04] animate-pulse" />)
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-foreground/[0.04] flex items-center justify-center">
              <Package className="w-6 h-6 text-foreground/20" />
            </div>
            <p className="text-xs font-bold text-foreground/30 uppercase tracking-wider">
              {search ? 'No orders match' : statusFilter==='pending' ? 'No pending orders' : 'No orders'}
            </p>
          </div>
        ) : (
          filtered.map(order => {
            const cfg = STATUS[order.status] || STATUS.pending;
            const isUpd = updating.has(order.id);
            const firstImg = order.items[0]?.product_images?.[0];
            const isPending = order.status === 'pending';

            return (
              <div key={order.id} onClick={() => setSelected(order)}
                className={`rounded-2xl border cursor-pointer transition-all hover:shadow-sm ${
                  isPending ? 'border-amber-300 dark:border-amber-700/40 bg-amber-50/30 dark:bg-amber-900/10' : 'border-foreground/8 bg-foreground/[0.015] hover:bg-foreground/[0.03]'
                }`}>
                <div className="flex items-center gap-3 p-3.5">
                  {/* Thumb */}
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-foreground/[0.06] flex-shrink-0">
                    {firstImg ? <img src={firstImg} alt="" className="w-full h-full object-cover" loading="lazy" /> : <Package className="w-5 h-5 text-foreground/20 m-auto mt-3" />}
                    {order.items.length > 1 && (
                      <span className="absolute bottom-0 right-0 bg-foreground/80 text-background text-[7px] font-black px-0.5 rounded-tl-md">+{order.items.length-1}</span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[10px] font-black text-foreground/35 font-mono">#{order.id.slice(0,8).toUpperCase()}</span>
                      <StatusChip status={order.status} />
                    </div>
                    <p className="text-xs font-semibold text-foreground truncate">
                      {order.items[0]?.product_name}{order.items.length>1?` +${order.items.length-1} more`:''}
                    </p>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-foreground/35">{order.buyer.name} · {new Date(order.created_at).toLocaleDateString('en-TZ',{day:'numeric',month:'short'})}</span>
                      <span className="text-xs font-bold text-foreground">{formatTZS(order.total)}</span>
                    </div>
                  </div>
                </div>
                {/* Quick confirm for pending */}
                {isPending && (
                  <div className="px-3.5 pb-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleStatus(order.id,'processing')} disabled={isUpd}
                      className="w-full h-8 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-60">
                      {isUpd ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Zap className="w-3 h-3" />Confirm Order</>}
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
