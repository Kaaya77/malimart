import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppState } from '../context/AppContext';
import { useToast } from './UI';
import { supabase } from '../services/supabaseClient';
import { withCache, invalidate } from '../services/queryCache';
import { rateLimit } from '../src/security';
import { formatTZS } from '../constants';
import { 
  Search, RefreshCw, PackageX, Clock, CheckCircle2, 
  XCircle, MessageCircle, ChevronLeft, AlertCircle,
  RotateCcw, Loader2, User, Package
} from 'lucide-react';

interface Dispute {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  reason: string;
  description: string;
  status: 'open' | 'resolved' | 'closed' | 'refunded';
  created_at: string;
  updated_at?: string;
  order?: any;
  buyer?: { full_name: string; avatar_url: string; email: string; phone?: string };
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  open:     { label: 'Under Review', color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20',    icon: Clock },
  resolved: { label: 'Resolved',     color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCircle2 },
  refunded: { label: 'Refunded',     color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20',       icon: RefreshCw },
  closed:   { label: 'Closed',       color: 'text-foreground/40',bg: 'bg-foreground/[0.05]',                icon: XCircle },
};

const StatusChip = ({ status }: { status: string }) => {
  const cfg = STATUS_CFG[status] || STATUS_CFG.open;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" />{cfg.label}
    </span>
  );
};

const REASON_LABELS: Record<string, string> = {
  wrong_item_sent:       'Wrong item sent',
  item_damaged:          'Item damaged / defective',
  item_not_as_described: 'Not as described',
  item_not_received:     'Item not received',
  seller_not_responding: 'Seller not responding',
  refund_not_processed:  'Refund not processed',
  other:                 'Other',
};

export const SellerReturns = ({
  userId,
  onContactBuyer,
}: {
  userId: string;
  onContactBuyer: (buyerId: string, productId?: string, orderId?: string) => void;
}) => {
  const { addToast } = useToast();
  const { sellerOrders } = useAppState(); // available for cross-reference
  const DISPUTES_CACHE_KEY = `seller:disputes:${userId}`;
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchDisputes = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      if (silent) invalidate(DISPUTES_CACHE_KEY);
      const data = await withCache(DISPUTES_CACHE_KEY, 60_000, async () => {
        const { data: d, error } = await supabase.rpc('get_seller_disputes', { p_seller_id: userId });
        if (error) throw error;
        return d;
      });
      setDisputes((data as Dispute[]) || []);
      if (selected) {
        const fresh = (data as Dispute[]).find(d => d.id === selected.id);
        if (fresh) setSelected(fresh);
      }
    } catch (err: any) {
      if (!silent) addToast('Failed to load returns', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, selected?.id]);

  useEffect(() => {
    fetchDisputes();
    const ch = supabase.channel(`disputes-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disputes', filter: `seller_id=eq.${userId}` },
        () => fetchDisputes(true))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const handleUpdateStatus = async (disputeId: string, newStatus: 'resolved' | 'refunded' | 'closed') => {
    if (!rateLimit(`dispute-${disputeId}`, 3)) return addToast('Too fast, slow down', 'error');
    setUpdating(disputeId);
    try {
      const { error } = await supabase.rpc('update_dispute_status', {
        p_dispute_id: disputeId,
        p_new_status: newStatus,
      });
      if (error) throw error;
      const labels = { resolved: 'Marked as resolved ✓', refunded: 'Refund approved ✓', closed: 'Case closed' };
      addToast(labels[newStatus], 'success');
      invalidate(DISPUTES_CACHE_KEY);
      fetchDisputes(true);
    } catch (err: any) {
      addToast(err.message || 'Update failed', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const stats = useMemo(() => ({
    open:     disputes.filter(d => d.status === 'open').length,
    resolved: disputes.filter(d => d.status === 'resolved').length,
    refunded: disputes.filter(d => d.status === 'refunded').length,
  }), [disputes]);

  const filtered = useMemo(() => disputes.filter(d => {
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q
      || d.order_id.toLowerCase().includes(q)
      || d.reason.toLowerCase().includes(q)
      || d.buyer?.full_name?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  }), [disputes, statusFilter, search]);

  // ── Detail panel ───────────────────────────────────────────────────────────
  if (selected) {
    const cfg = STATUS_CFG[selected.status] || STATUS_CFG.open;
    const isUpd = updating === selected.id;

    return (
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 flex-shrink-0">
          <button onClick={() => setSelected(null)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-foreground/[0.05] hover:bg-foreground/10 transition-colors">
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35">Return / Dispute</p>
            <h3 className="font-bold text-sm text-foreground font-mono">#{selected.order_id.slice(0, 8).toUpperCase()}</h3>
          </div>
          <StatusChip status={selected.status} />
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 min-h-0">
          {/* Action card for open disputes */}
          {selected.status === 'open' && (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 space-y-2">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Action required</p>
              <p className="text-[11px] text-amber-600/70">Review this claim and choose how to proceed.</p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleUpdateStatus(selected.id, 'resolved')}
                  disabled={!!isUpd}
                  className="flex-1 h-9 rounded-xl bg-emerald-600 text-white text-[11px] font-black hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {isUpd ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CheckCircle2 className="w-3 h-3" />Resolve</>}
                </button>
                <button
                  onClick={() => handleUpdateStatus(selected.id, 'refunded')}
                  disabled={!!isUpd}
                  className="flex-1 h-9 rounded-xl bg-blue-600 text-white text-[11px] font-black hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {isUpd ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><RefreshCw className="w-3 h-3" />Refund</>}
                </button>
              </div>
              <button
                onClick={() => handleUpdateStatus(selected.id, 'closed')}
                disabled={!!isUpd}
                className="text-[11px] font-bold text-foreground/40 hover:text-foreground/60 transition-colors"
              >
                Close without action
              </button>
            </div>
          )}

          {/* Reason & Description */}
          <div className="rounded-2xl border border-foreground/8 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-foreground/8 bg-foreground/[0.02]">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40">Claim Details</p>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="text-[10px] text-foreground/40 mb-0.5">Reason</p>
                <p className="text-sm font-semibold text-foreground">
                  {REASON_LABELS[selected.reason] || selected.reason}
                </p>
              </div>
              {selected.description && (
                <div>
                  <p className="text-[10px] text-foreground/40 mb-0.5">Description</p>
                  <p className="text-xs text-foreground/70 leading-relaxed">{selected.description}</p>
                </div>
              )}
              <p className="text-[10px] text-foreground/30">
                Filed {new Date(selected.created_at).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Buyer */}
          {selected.buyer && (
            <div className="rounded-2xl border border-foreground/8 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-foreground/8 bg-foreground/[0.02] flex items-center gap-1.5">
                <User className="w-3 h-3 text-foreground/40" />
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40">Customer</p>
              </div>
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-foreground/[0.06] overflow-hidden flex-shrink-0">
                    {selected.buyer.avatar_url
                      ? <img src={selected.buyer.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center text-sm font-black text-foreground/30">{selected.buyer.full_name?.[0]}</div>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{selected.buyer.full_name}</p>
                    <p className="text-[10px] text-foreground/40 truncate">{selected.buyer.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => onContactBuyer(selected.buyer_id, undefined, selected.order_id)}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-foreground/15 text-[10px] font-bold text-foreground/60 hover:bg-foreground/[0.05] transition-colors"
                >
                  <MessageCircle className="w-3 h-3" />Message
                </button>
              </div>
            </div>
          )}

          {/* Order reference */}
          {selected.order && (
            <div className="rounded-2xl border border-foreground/8 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-2">Order</p>
              <div className="flex justify-between text-xs">
                <span className="text-foreground/50 font-mono">#{selected.order_id.slice(0, 8).toUpperCase()}</span>
                <span className="font-bold text-foreground">{formatTZS(Number(selected.order.total) || 0)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4 flex-shrink-0">
        {[
          { label: 'Open',     value: stats.open,     color: 'text-amber-500',   s: 'open' },
          { label: 'Resolved', value: stats.resolved, color: 'text-emerald-500', s: 'resolved' },
          { label: 'Refunded', value: stats.refunded, color: 'text-blue-500',    s: 'refunded' },
        ].map(st => (
          <button key={st.s} onClick={() => setStatusFilter(p => p === st.s ? 'all' : st.s)}
            className={`rounded-xl p-2.5 text-center transition-all ${statusFilter === st.s ? 'bg-foreground/10 ring-1 ring-foreground/20' : 'bg-foreground/[0.03] hover:bg-foreground/[0.06]'}`}>
            <p className={`text-xl font-black tabular-nums ${st.color}`}>{st.value}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide text-foreground/35 mt-0.5">{st.label}</p>
          </button>
        ))}
      </div>

      {/* Search + refresh */}
      <div className="flex gap-2 mb-3 flex-shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order, customer, reason…"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-foreground/[0.04] border border-foreground/8 text-xs text-foreground placeholder:text-foreground/30 outline-none focus:border-foreground/25 transition-colors" />
        </div>
        <button onClick={() => fetchDisputes(true)} disabled={refreshing}
          className="w-10 h-10 rounded-xl bg-foreground/[0.04] border border-foreground/8 flex items-center justify-center hover:bg-foreground/[0.07] transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 text-foreground/50 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto no-scrollbar flex-shrink-0">
        {['all', 'open', 'resolved', 'refunded', 'closed'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`flex-shrink-0 h-6 px-3 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${statusFilter === s ? 'bg-foreground text-background' : 'bg-foreground/[0.05] text-foreground/45 hover:bg-foreground/10'}`}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-foreground/[0.04] animate-pulse" />)
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-foreground/[0.04] flex items-center justify-center">
              <PackageX className="w-6 h-6 text-foreground/20" />
            </div>
            <p className="text-xs font-bold text-foreground/30 uppercase tracking-wider">
              {search ? 'No results match' : statusFilter === 'open' ? 'No open claims' : 'No returns'}
            </p>
          </div>
        ) : (
          filtered.map(dispute => {
            const cfg = STATUS_CFG[dispute.status] || STATUS_CFG.open;
            const Icon = cfg.icon;
            const isOpen = dispute.status === 'open';
            const isUpd = updating === dispute.id;

            return (
              <div key={dispute.id} onClick={() => setSelected(dispute)}
                className={`rounded-2xl border cursor-pointer transition-all hover:shadow-sm ${isOpen
                  ? 'border-amber-300 dark:border-amber-700/40 bg-amber-50/30 dark:bg-amber-900/10'
                  : 'border-foreground/8 bg-foreground/[0.015] hover:bg-foreground/[0.03]'}`}>
                <div className="flex items-center gap-3 p-3.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[10px] font-black text-foreground/35 font-mono">#{dispute.order_id.slice(0, 8).toUpperCase()}</span>
                      <StatusChip status={dispute.status} />
                    </div>
                    <p className="text-xs font-semibold text-foreground truncate">
                      {REASON_LABELS[dispute.reason] || dispute.reason}
                    </p>
                    <p className="text-[10px] text-foreground/35 mt-0.5">
                      {dispute.buyer?.full_name || 'Customer'} · {new Date(dispute.created_at).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
                {/* Quick actions for open disputes */}
                {isOpen && (
                  <div className="px-3.5 pb-3 flex gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleUpdateStatus(dispute.id, 'resolved')} disabled={!!isUpd}
                      className="flex-1 h-8 rounded-xl bg-emerald-600 text-white text-[10px] font-black hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-1 disabled:opacity-60">
                      {isUpd ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle2 className="w-3 h-3" />Resolve</>}
                    </button>
                    <button onClick={() => handleUpdateStatus(dispute.id, 'refunded')} disabled={!!isUpd}
                      className="flex-1 h-8 rounded-xl bg-blue-600 text-white text-[10px] font-black hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-1 disabled:opacity-60">
                      {isUpd ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RefreshCw className="w-3 h-3" />Refund</>}
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
