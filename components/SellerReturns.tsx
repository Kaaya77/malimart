import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppState } from '../context/AppContext';
import { useToast } from './UI';
import { supabase } from '../services/supabaseClient';
import { withCache, invalidate } from '../services/queryCache';
import { rateLimit } from '../src/security';
import { formatTZS } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, RefreshCw, PackageX, Clock, CheckCircle2,
  XCircle, MessageCircle, AlertCircle,
  RotateCcw, Loader2, User, X, ChevronRight, FileText, Calendar
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
  open:     { label: 'Under Review', color: 'text-amber-600',    bg: 'bg-amber-50 dark:bg-amber-900/20',    icon: Clock },
  resolved: { label: 'Resolved',     color: 'text-emerald-600',  bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCircle2 },
  refunded: { label: 'Refunded',     color: 'text-blue-600',     bg: 'bg-blue-50 dark:bg-blue-900/20',       icon: RotateCcw },
  closed:   { label: 'Closed',       color: 'text-foreground/40', bg: 'bg-foreground/[0.05]',               icon: XCircle },
};

const REASON_LABELS: Record<string, string> = {
  wrong_item_sent:       'Wrong item sent',
  item_damaged:          'Item damaged or defective',
  item_not_as_described: 'Not as described',
  item_not_received:     'Item not received',
  seller_not_responding: 'Seller not responding',
  refund_not_processed:  'Refund not processed',
  other:                 'Other',
};

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_CFG[status] || STATUS_CFG.open;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
      {cfg.label}
    </span>
  );
};

// ── Detail modal ──────────────────────────────────────────────────────────────
const DisputeModal = ({ dispute, onClose, onUpdateStatus, onMessage, updating }: {
  dispute: Dispute;
  onClose: () => void;
  onUpdateStatus: (id: string, status: 'resolved' | 'refunded' | 'closed') => void;
  onMessage: (buyerId: string, orderId: string) => void;
  updating: boolean;
}) => {
  const dateStr = new Date(dispute.created_at).toLocaleDateString('en-TZ', { weekday:'short', day:'numeric', month:'long', year:'numeric' });

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-background shadow-2xl border-l border-foreground/[0.08] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-foreground/[0.07] shrink-0">
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-foreground/[0.05] hover:bg-foreground/10 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-foreground/60" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black font-mono text-foreground/35 uppercase tracking-widest">
                #{dispute.order_id.slice(0, 8).toUpperCase()}
              </span>
              <StatusBadge status={dispute.status} />
            </div>
            <p className="text-[10px] text-foreground/30 mt-0.5">{dateStr}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">

            {/* Action card for open disputes */}
            {dispute.status === 'open' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4"
              >
                <p className="text-xs font-black text-amber-700 dark:text-amber-400 mb-1">Review required</p>
                <p className="text-[11px] text-foreground/55 mb-3 leading-relaxed">
                  This customer has filed a dispute. Review the claim and choose how to proceed.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onUpdateStatus(dispute.id, 'resolved')}
                    disabled={updating}
                    className="flex-1 h-9 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CheckCircle2 className="w-3.5 h-3.5" />Mark Resolved</>}
                  </button>
                  <button
                    onClick={() => onUpdateStatus(dispute.id, 'refunded')}
                    disabled={updating}
                    className="flex-1 h-9 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><RotateCcw className="w-3.5 h-3.5" />Approve Refund</>}
                  </button>
                </div>
                <button
                  onClick={() => onUpdateStatus(dispute.id, 'closed')}
                  disabled={updating}
                  className="mt-2 text-[10px] font-bold text-foreground/35 hover:text-foreground/60 transition-colors block"
                >
                  Close without action
                </button>
              </motion.div>
            )}

            {/* Claim details */}
            <section>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35 mb-2 px-1">Claim details</p>
              <div className="rounded-2xl border border-foreground/[0.08] overflow-hidden divide-y divide-foreground/[0.05]">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-foreground/35 mb-1">Reason</p>
                      <p className="text-sm font-bold text-foreground">{REASON_LABELS[dispute.reason] || dispute.reason}</p>
                    </div>
                  </div>
                </div>
                {dispute.description && (
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-foreground/[0.05] flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="w-3.5 h-3.5 text-foreground/40" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-foreground/35 mb-1">Customer statement</p>
                        <p className="text-[11px] text-foreground/65 leading-relaxed">{dispute.description}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="p-4 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-foreground/[0.05] flex items-center justify-center shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-foreground/40" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-foreground/35 mb-0.5">Filed</p>
                    <p className="text-xs font-semibold text-foreground">{dateStr}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Customer */}
            {dispute.buyer && (
              <section>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35 mb-2 px-1">Customer</p>
                <div className="rounded-2xl border border-foreground/[0.08] p-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-sm font-black text-white shrink-0 overflow-hidden">
                    {dispute.buyer.avatar_url
                      ? <img src={dispute.buyer.avatar_url} alt="" className="w-full h-full object-cover" />
                      : (dispute.buyer.full_name?.[0] || '?').toUpperCase()
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{dispute.buyer.full_name}</p>
                    <p className="text-[10px] text-foreground/40 truncate">{dispute.buyer.email}</p>
                  </div>
                  <button onClick={() => onMessage(dispute.buyer_id, dispute.order_id)}
                    className="shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black uppercase tracking-wide hover:bg-brand-500/15 transition-colors">
                    <MessageCircle className="w-3.5 h-3.5" /> Message
                  </button>
                </div>
              </section>
            )}

            {/* Order ref */}
            {dispute.order && (
              <section>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35 mb-2 px-1">Linked order</p>
                <div className="rounded-2xl border border-foreground/[0.08] p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black font-mono text-foreground/35 uppercase tracking-widest mb-0.5">
                      #{dispute.order_id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-sm font-bold text-foreground">{formatTZS(Number(dispute.order.total) || 0)}</p>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full ${
                    dispute.order.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-foreground/[0.05] text-foreground/40'
                  }`}>{dispute.order.status}</span>
                </div>
              </section>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
export const SellerReturns = ({ userId, onContactBuyer }: {
  userId: string;
  onContactBuyer: (buyerId: string, productId?: string, orderId?: string) => void;
}) => {
  const { addToast } = useToast();
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
      const { error } = await supabase.rpc('update_dispute_status', { p_dispute_id: disputeId, p_new_status: newStatus });
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

  const STATUS_PILLS = [
    { id: 'all',      label: 'All',      color: '#94a3b8', count: disputes.length },
    { id: 'open',     label: 'Open',     color: '#f59e0b', count: stats.open },
    { id: 'resolved', label: 'Resolved', color: '#10b981', count: stats.resolved },
    { id: 'refunded', label: 'Refunded', color: '#3b82f6', count: stats.refunded },
    { id: 'closed',   label: 'Closed',   color: '#94a3b8', count: disputes.filter(d => d.status === 'closed').length },
  ];

  return (
    <div>
      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {[
          { label: 'Open',     value: stats.open,     color: '#f59e0b', filter: 'open' },
          { label: 'Resolved', value: stats.resolved, color: '#10b981', filter: 'resolved' },
          { label: 'Refunded', value: stats.refunded, color: '#3b82f6', filter: 'refunded' },
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

      {/* Search */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search order, customer, reason…"
            className="w-full h-10 pl-10 pr-3 rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] text-xs text-foreground placeholder:text-foreground/30 outline-none focus:border-foreground/25 transition-all" />
        </div>
        <button onClick={() => fetchDisputes(true)} disabled={refreshing}
          className="w-10 h-10 rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] flex items-center justify-center hover:bg-foreground/[0.08] transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 text-foreground/50 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status pills */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-0.5">
        {STATUS_PILLS.map(sp => (
          <button key={sp.id}
            onClick={() => setStatusFilter(sp.id)}
            className="flex-shrink-0 flex items-center gap-1.5 h-7 px-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
            style={statusFilter === sp.id ? { background: sp.color, color: 'white' } : { background: 'rgba(var(--foreground-rgb, 0 0 0) / 0.05)', color: 'rgba(var(--foreground-rgb, 0 0 0) / 0.4)' }}
          >
            {sp.label}
            {sp.count > 0 && (
              <span className="px-1 rounded text-[8px] font-black"
                style={statusFilter === sp.id ? { background: 'rgba(255,255,255,0.25)' } : { background: 'rgba(0,0,0,0.08)' }}>
                {sp.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-foreground/[0.04] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-3xl bg-foreground/[0.04] border border-foreground/[0.07] flex items-center justify-center">
            <PackageX className="w-7 h-7 text-foreground/15" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-foreground/25 uppercase tracking-widest">
              {search ? 'No matching disputes' : statusFilter === 'open' ? 'No open claims' : 'No returns yet'}
            </p>
            <p className="text-[10px] text-foreground/20 mt-1">Returns and disputes will appear here</p>
          </div>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-2">
            {filtered.map(dispute => {
              const cfg = STATUS_CFG[dispute.status] || STATUS_CFG.open;
              const Icon = cfg.icon;
              const isOpen = dispute.status === 'open';
              const isUpd = updating === dispute.id;

              return (
                <motion.div
                  key={dispute.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  onClick={() => setSelected(dispute)}
                  className={`rounded-2xl border cursor-pointer transition-all group hover:shadow-md ${
                    isOpen
                      ? 'border-amber-300/50 dark:border-amber-700/30 bg-amber-50/20 dark:bg-amber-900/10 hover:border-amber-400/60'
                      : 'border-foreground/[0.07] bg-foreground/[0.015] hover:bg-foreground/[0.03] hover:border-foreground/15'
                  }`}
                >
                  <div className="flex items-center gap-3 p-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                      <Icon className={`w-4.5 h-4.5 ${cfg.color}`} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[10px] font-black font-mono text-foreground/30 uppercase tracking-widest">
                          #{dispute.order_id.slice(0, 8).toUpperCase()}
                        </span>
                        <StatusBadge status={dispute.status} />
                      </div>
                      <p className="text-xs font-bold text-foreground truncate">
                        {REASON_LABELS[dispute.reason] || dispute.reason}
                      </p>
                      <p className="text-[10px] text-foreground/35 mt-0.5">
                        {dispute.buyer?.full_name || 'Customer'} · {new Date(dispute.created_at).toLocaleDateString('en-TZ', { day:'numeric', month:'short' })}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-foreground/20 shrink-0 group-hover:text-foreground/40 transition-colors" />
                  </div>

                  {isOpen && (
                    <div className="px-3.5 pb-3.5 flex gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleUpdateStatus(dispute.id, 'resolved')}
                        disabled={!!isUpd}
                        className="flex-1 h-8 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        {isUpd ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle2 className="w-3 h-3" />Resolve</>}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(dispute.id, 'refunded')}
                        disabled={!!isUpd}
                        className="flex-1 h-8 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        {isUpd ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RotateCcw className="w-3 h-3" />Refund</>}
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <DisputeModal
            dispute={selected}
            onClose={() => setSelected(null)}
            onUpdateStatus={handleUpdateStatus}
            onMessage={(buyerId, orderId) => {
              setSelected(null);
              onContactBuyer(buyerId, undefined, orderId);
            }}
            updating={updating === selected.id}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
