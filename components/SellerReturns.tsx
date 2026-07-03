import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppState } from '../context/AppContext';
import { useToast } from './UI';
import { supabase } from '../services/supabaseClient';
import { getSellerDisputes, updateDisputeStatus, respondToDispute } from '../services/sellerApi';
import { approveReturn, rejectReturn, processReturnRefund } from '../services/walletApi';
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
  status: 'open' | 'under_review' | 'resolved' | 'rejected' | 'closed' | 'refunded';
  seller_response?: string | null;
  seller_responded_at?: string | null;
  refund_amount?: number | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at?: string;
  order?: any;
  buyer?: { full_name: string; avatar_url: string; email: string; phone?: string };
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  open:     { label: 'Under Review', color: 'text-amber-600',    bg: 'bg-amber-50 dark:bg-amber-900/20',    icon: Clock },
  under_review: { label: 'Under Review', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20',   icon: Clock },
  resolved: { label: 'Approved',     color: 'text-emerald-600',  bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCircle2 },
  refunded: { label: 'Refunded',     color: 'text-blue-600',     bg: 'bg-blue-50 dark:bg-blue-900/20',       icon: RotateCcw },
  rejected: { label: 'Declined',     color: 'text-red-600',      bg: 'bg-red-50 dark:bg-red-900/20',         icon: XCircle },
  closed:   { label: 'Closed',       color: 'text-foreground/40', bg: 'bg-foreground/[0.05]',               icon: XCircle },
};

const REASON_LABELS: Record<string, string> = {
  wrong_item_sent:       'Wrong item sent',
  item_damaged:          'Item damaged or defective',
  item_not_as_described: 'Not as described',
  item_not_received:     'Item not received',
  seller_not_responding: 'Seller not responding',
  refund_not_processed:  'Refund not processed',
  seller_reported_fraud: 'Suspected fraud (reported by you)',
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
const DisputeModal = ({ dispute, onClose, onUpdateStatus, onApprove, onReject, onRefund, onMessage, onRespond, updating, responding }: {
  dispute: Dispute;
  onClose: () => void;
  onUpdateStatus: (id: string, status: 'closed') => void;
  onApprove: (id: string, amount: number) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  onRefund: (id: string) => Promise<void>;
  onMessage: (buyerId: string, orderId: string) => void;
  onRespond: (id: string, text: string) => Promise<void>;
  updating: boolean;
  responding: boolean;
}) => {
  const [responseText, setResponseText] = useState('');
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle');
  const [refundAmount, setRefundAmount] = useState<string>(String(Math.round(Number(dispute.order?.total) || 0)));
  const [rejectReason, setRejectReason] = useState('');
  const isPending = dispute.status === 'open' || dispute.status === 'under_review';
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
          <button onClick={onClose} aria-label="Close return details"
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

            {/* Action card — returns state machine (open → approve/reject; resolved → refund) */}
            {isPending && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4"
              >
                <p className="text-xs font-black text-amber-700 dark:text-amber-400 mb-1">Review required</p>
                <p className="text-[11px] text-foreground/55 mb-3 leading-relaxed">
                  This customer requested a return. Approve it (with the refund amount) or decline it with a reason.
                </p>

                {mode === 'idle' && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setMode('approve')}
                        disabled={updating}
                        className="flex-1 h-9 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />Approve
                      </button>
                      <button
                        onClick={() => setMode('reject')}
                        disabled={updating}
                        className="flex-1 h-9 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-red-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        <XCircle className="w-3.5 h-3.5" />Decline
                      </button>
                    </div>
                    <button
                      onClick={() => onUpdateStatus(dispute.id, 'closed')}
                      disabled={updating}
                      className="text-[10px] font-bold text-foreground/35 hover:text-foreground/60 transition-colors block"
                    >
                      Close without action
                    </button>
                  </div>
                )}

                {mode === 'approve' && (
                  <div className="space-y-2.5">
                    <div>
                      <label htmlFor="return-refund-amount" className="text-[9px] font-black uppercase tracking-[0.18em] text-foreground/45 block mb-1">Refund amount (TZS)</label>
                      <input
                        id="return-refund-amount"
                        type="number" min={0} inputMode="numeric"
                        value={refundAmount}
                        onChange={e => setRefundAmount(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-background border border-foreground/[0.12] text-sm font-bold text-foreground outline-none focus:border-emerald-500 transition-all"
                      />
                      <p className="text-[9px] text-foreground/35 mt-1">Cannot exceed the order total ({formatTZS(Number(dispute.order?.total) || 0)}).</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setMode('idle'); }}
                        disabled={updating}
                        className="h-9 px-3 rounded-xl bg-foreground/[0.06] text-foreground/60 text-[10px] font-black uppercase tracking-wide hover:bg-foreground/10 transition-all disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => onApprove(dispute.id, Math.round(Number(refundAmount) || 0))}
                        disabled={updating || !(Number(refundAmount) > 0)}
                        className="flex-1 h-9 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                      >
                        {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CheckCircle2 className="w-3.5 h-3.5" />Approve Return</>}
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'reject' && (
                  <div className="space-y-2.5">
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      rows={3} maxLength={500}
                      placeholder="Why are you declining this return? (min 5 characters)"
                      className="w-full rounded-xl bg-background border border-foreground/[0.12] p-3 text-xs text-foreground placeholder:text-foreground/30 outline-none focus:border-red-500 transition-all resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setMode('idle'); }}
                        disabled={updating}
                        className="h-9 px-3 rounded-xl bg-foreground/[0.06] text-foreground/60 text-[10px] font-black uppercase tracking-wide hover:bg-foreground/10 transition-all disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => onReject(dispute.id, rejectReason.trim())}
                        disabled={updating || rejectReason.trim().length < 5}
                        className="flex-1 h-9 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-red-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                      >
                        {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><XCircle className="w-3.5 h-3.5" />Decline Return</>}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Approved — awaiting refund payout to the buyer's wallet */}
            {dispute.status === 'resolved' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-blue-500/10 border border-blue-500/20 p-4"
              >
                <p className="text-xs font-black text-blue-700 dark:text-blue-400 mb-1">Return approved</p>
                <p className="text-[11px] text-foreground/55 mb-3 leading-relaxed">
                  Approved for a refund of <span className="font-black text-foreground">{formatTZS(Number(dispute.refund_amount) || 0)}</span>.
                  Process the refund to credit the buyer's wallet.
                </p>
                <button
                  onClick={() => onRefund(dispute.id)}
                  disabled={updating}
                  className="w-full h-9 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><RotateCcw className="w-3.5 h-3.5" />Process Refund</>}
                </button>
              </motion.div>
            )}

            {/* Rejected — show the reason */}
            {dispute.status === 'rejected' && dispute.rejection_reason && (
              <div className="rounded-2xl bg-red-500/[0.06] border border-red-500/15 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-red-600/70 mb-1">Return declined</p>
                <p className="text-[11px] text-foreground/65 leading-relaxed">{dispute.rejection_reason}</p>
              </div>
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

            {/* Seller response — one response per dispute */}
            <section>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35 mb-2 px-1">Your response</p>
              {dispute.seller_response ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-foreground/65 leading-relaxed">{dispute.seller_response}</p>
                      {dispute.seller_responded_at && (
                        <p className="text-[9px] text-foreground/30 mt-1.5">
                          Sent {new Date(dispute.seller_responded_at).toLocaleDateString('en-TZ', { day:'numeric', month:'long', year:'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : dispute.status === 'open' ? (
                <div className="rounded-2xl border border-foreground/[0.08] p-4 space-y-3">
                  <p className="text-[11px] text-foreground/55 leading-relaxed">
                    Share your side of the story. Your response is sent to the buyer and the MaliMart review team. You can respond once.
                  </p>
                  <textarea
                    value={responseText}
                    onChange={e => setResponseText(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="Explain what happened from your side… (min 10 characters)"
                    className="w-full rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] p-3 text-xs text-foreground placeholder:text-foreground/30 outline-none focus:border-foreground/25 transition-all resize-none"
                  />
                  <button
                    onClick={() => onRespond(dispute.id, responseText)}
                    disabled={responding || responseText.trim().length < 10}
                    className="w-full h-9 rounded-xl bg-foreground text-background text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    {responding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Submit Response'}
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-foreground/[0.08] p-4">
                  <p className="text-[11px] text-foreground/40">This dispute was closed before you responded.</p>
                </div>
              )}
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
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);

  const fetchDisputes = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      if (silent) invalidate(DISPUTES_CACHE_KEY);
      const data = await withCache(DISPUTES_CACHE_KEY, 60_000, () => getSellerDisputes());
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

  // Only "close without action" goes through here now. Money-moving transitions
  // (approve → refund) use handleApprove/handleRefund so the buyer's wallet is
  // always credited through process_return_refund — never a bare status flip.
  const handleUpdateStatus = async (disputeId: string, newStatus: 'closed') => {
    if (!rateLimit(`dispute-${disputeId}`, 3)) return addToast('Too fast, slow down', 'error');
    setUpdating(disputeId);
    try {
      await updateDisputeStatus(disputeId, newStatus);
      addToast('Case closed', 'success');
      invalidate(DISPUTES_CACHE_KEY);
      fetchDisputes(true);
    } catch (err: any) {
      addToast(err.message || 'Update failed', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const handleRespond = async (disputeId: string, text: string) => {
    if (!rateLimit(`dispute-respond-${disputeId}`, 3)) { addToast('Too fast, slow down', 'error'); return; }
    setResponding(true);
    try {
      await respondToDispute(disputeId, text.trim());
      addToast('Response sent to the buyer and MaliMart review team', 'success');
      invalidate(DISPUTES_CACHE_KEY);
      await fetchDisputes(true);
    } catch (err: any) {
      addToast(err.message || 'Failed to send response', 'error');
    } finally {
      setResponding(false);
    }
  };

  const handleApprove = async (disputeId: string, amount: number) => {
    if (!rateLimit(`return-approve-${disputeId}`, 3)) { addToast('Too fast, slow down', 'error'); return; }
    setUpdating(disputeId);
    try {
      await approveReturn(disputeId, amount);
      addToast('Return approved — process the refund to credit the buyer', 'success');
      invalidate(DISPUTES_CACHE_KEY);
      await fetchDisputes(true);
    } catch (err: any) {
      addToast(err.message || 'Approval failed', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const handleReject = async (disputeId: string, reason: string) => {
    if (!rateLimit(`return-reject-${disputeId}`, 3)) { addToast('Too fast, slow down', 'error'); return; }
    setUpdating(disputeId);
    try {
      await rejectReturn(disputeId, reason);
      addToast('Return declined — the buyer has been notified', 'success');
      invalidate(DISPUTES_CACHE_KEY);
      await fetchDisputes(true);
    } catch (err: any) {
      addToast(err.message || 'Could not decline', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const handleRefund = async (disputeId: string) => {
    if (!rateLimit(`return-refund-${disputeId}`, 3)) { addToast('Too fast, slow down', 'error'); return; }
    setUpdating(disputeId);
    try {
      const res = await processReturnRefund(disputeId);
      addToast(`Refund of ${formatTZS(res?.amount || 0)} credited to the buyer's wallet`, 'success');
      invalidate(DISPUTES_CACHE_KEY);
      await fetchDisputes(true);
    } catch (err: any) {
      addToast(err.message || 'Refund failed', 'error');
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
                    <div className="px-3.5 pb-3.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelected(dispute)}
                        disabled={!!isUpd}
                        className="w-full h-8 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        {isUpd ? <Loader2 className="w-3 h-3 animate-spin" /> : <><FileText className="w-3 h-3" />Review Return</>}
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
            onApprove={handleApprove}
            onReject={handleReject}
            onRefund={handleRefund}
            onMessage={(buyerId, orderId) => {
              setSelected(null);
              onContactBuyer(buyerId, undefined, orderId);
            }}
            onRespond={handleRespond}
            updating={updating === selected.id}
            responding={responding}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
