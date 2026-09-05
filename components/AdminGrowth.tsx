import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Badge, PremiumStatCard, useToast, ConfirmModal } from './UI';
import { listOffers, createOffer, updateOffer, deleteOffer } from '../services/adminApi';
import { TrendingUp, Plus, Trash2, Edit2, Save, X, Zap, Gift, Truck, Tag, ToggleLeft, ToggleRight, Calendar, Users, Target, Percent, DollarSign, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatTZS } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';

interface Campaign {
  id: string;
  title: string;
  code?: string;
  campaign_type: string;
  target_type: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_order_value?: number;
  max_usage?: number;
  current_usage?: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'inactive' | 'expired';
  scope: string;
  is_auto_apply?: boolean;
  is_flash_sale?: boolean;
  buy_quantity?: number;
  get_quantity?: number;
  profiles?: { full_name: string };
}

const CAMPAIGN_TYPES = [
  { value: 'discount', label: 'Discount', icon: Percent, desc: 'Fixed or % off' },
  { value: 'bogo', label: 'BOGO', icon: Gift, desc: 'Buy X get Y free' },
  { value: 'shipping', label: 'Free Shipping', icon: Truck, desc: 'Waive delivery fees' },
  { value: 'flash_sale', label: 'Flash Sale', icon: Zap, desc: 'Time-limited deal' },
];

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-emerald-500/[0.1] text-emerald-700 dark:text-emerald-400',
  inactive: 'bg-foreground/[0.05] text-foreground/40',
  expired: 'bg-rose-500/[0.1] text-rose-600 dark:text-rose-400',
};

function deriveStatus(c: Campaign): string {
  const now = new Date();
  if (c.status === 'inactive') return 'inactive';
  if (c.end_date && new Date(c.end_date) < now) return 'expired';
  if (c.start_date && new Date(c.start_date) > now) return 'scheduled';
  return 'active';
}

export const AdminGrowth = () => {
  const { addToast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');

  // Form state
  const [form, setForm] = useState({
    title: '',
    code: '',
    campaign_type: 'discount',
    target_type: 'store',
    type: 'percentage' as 'percentage' | 'fixed',
    value: 10,
    min_order_value: 0,
    max_usage: 0,
    start_date: '',
    end_date: '',
    is_auto_apply: false,
    buy_quantity: 1,
    get_quantity: 1,
    status: 'active',
  });

  const resetForm = () => setForm({
    title: '', code: '', campaign_type: 'discount', target_type: 'store',
    type: 'percentage', value: 10, min_order_value: 0, max_usage: 0,
    start_date: '', end_date: '', is_auto_apply: false, buy_quantity: 1, get_quantity: 1, status: 'active',
  });

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await listOffers();
    if (!error && data) setCampaigns(data as Campaign[]);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const handleEdit = (c: Campaign) => {
    setEditingCampaign(c);
    setForm({
      title: c.title || '',
      code: c.code || '',
      // Reconstruct the 'flash_sale' picker option from the is_flash_sale flag
      // (the DB stores flash sales as campaign_type='discount').
      campaign_type: c.is_flash_sale ? 'flash_sale' : (c.campaign_type || 'discount'),
      target_type: c.target_type || 'store',
      type: c.type || 'percentage',
      value: c.value || 10,
      min_order_value: c.min_order_value || 0,
      max_usage: c.max_usage || 0,
      start_date: c.start_date ? c.start_date.split('T')[0] : '',
      end_date: c.end_date ? c.end_date.split('T')[0] : '',
      is_auto_apply: c.is_auto_apply || false,
      buy_quantity: c.buy_quantity || 1,
      get_quantity: c.get_quantity || 1,
      status: c.status || 'active',
    });
    setShowForm(true);
  };

  const validateForm = () => {
    if (!form.title.trim()) { addToast('Campaign name is required', 'error'); return false; }
    if (!form.code.trim() && !form.is_auto_apply) { addToast('Coupon code is required unless auto-apply', 'error'); return false; }
    if (form.value <= 0) { addToast('Discount value must be greater than 0', 'error'); return false; }
    if (form.type === 'percentage' && form.value > 100) { addToast('Percentage cannot exceed 100%', 'error'); return false; }
    if (!form.start_date) { addToast('Start date is required', 'error'); return false; }
    if (!form.end_date) { addToast('End date is required', 'error'); return false; }
    if (new Date(form.end_date) <= new Date(form.start_date)) { addToast('End date must be after start date', 'error'); return false; }
    // Sanitize code: uppercase, alphanumeric
    if (form.code && !/^[A-Z0-9_-]+$/i.test(form.code)) { addToast('Code must be alphanumeric (A-Z, 0-9, - _)', 'error'); return false; }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    // Flash sales are modelled app-wide as a normal discount PLUS the
    // is_flash_sale flag (that flag drives the buyer countdown/urgency UI) —
    // NOT a distinct campaign_type. Map the 'flash_sale' picker option onto that
    // shape so admin-created flash sales match seller-created ones. Flash sales
    // always auto-apply.
    const isFlash = form.campaign_type === 'flash_sale';
    const payload = {
      title: form.title.trim(),
      code: form.code.toUpperCase().trim(),
      campaign_type: isFlash ? 'discount' : form.campaign_type,
      target_type: form.target_type,
      type: form.type,
      value: Number(form.value),
      min_order_value: form.min_order_value > 0 ? Number(form.min_order_value) : null,
      max_usage: form.max_usage > 0 ? Number(form.max_usage) : null,
      start_date: new Date(form.start_date).toISOString(),
      end_date: new Date(form.end_date).toISOString(),
      is_auto_apply: isFlash ? true : form.is_auto_apply,
      is_flash_sale: isFlash,
      buy_quantity: form.campaign_type === 'bogo' ? Number(form.buy_quantity) : null,
      get_quantity: form.campaign_type === 'bogo' ? Number(form.get_quantity) : null,
      scope: 'platform',
      status: form.status,
    };
    try {
      if (editingCampaign) {
        const { error } = await updateOffer(editingCampaign.id, payload);
        if (error) throw error;
        addToast('Campaign updated successfully', 'success');
      } else {
        const { error } = await createOffer({ ...payload, current_usage: 0 });
        if (error) throw error;
        addToast('Campaign launched successfully', 'success');
      }
      resetForm(); setShowForm(false); setEditingCampaign(null); fetchCampaigns();
    } catch (err: any) {
      addToast(err.message || 'Failed to save campaign', 'error');
    } finally { setIsSaving(false); }
  };

  const handleToggleStatus = async (c: Campaign) => {
    const newStatus = c.status === 'active' ? 'inactive' : 'active';
    const { error } = await updateOffer(c.id, { status: newStatus });
    if (error) { addToast('Failed to update status', 'error'); return; }
    addToast(`Campaign ${newStatus === 'active' ? 'activated' : 'paused'}`, 'success');
    fetchCampaigns();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await deleteOffer(deletingId);
    if (error) { addToast('Failed to delete campaign', 'error'); }
    else { addToast('Campaign deleted', 'success'); fetchCampaigns(); }
    setDeletingId(null);
  };

  const filtered = campaigns.filter(c => {
    if (filterStatus === 'all') return true;
    return deriveStatus(c) === filterStatus;
  });

  const stats = {
    total: campaigns.length,
    active: campaigns.filter(c => deriveStatus(c) === 'active').length,
    totalUsage: campaigns.reduce((sum, c) => sum + (c.current_usage || 0), 0),
  };

  const fieldCls = 'w-full h-11 bg-foreground/[0.04] border border-foreground/10 rounded-xl px-4 text-sm font-medium text-foreground outline-none focus:border-foreground/30 transition-all placeholder:text-foreground/30';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header — same eyebrow + title pattern used across the rest of the
          app (homepage sections, settings, shop) rather than this tab's old
          heavier all-caps display type. */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/40 mb-2">Platform Marketing</p>
          <h2 className="text-2xl md:text-[2rem] font-bold tracking-tight text-foreground">Growth Engine</h2>
        </div>
        <button
          onClick={() => { resetForm(); setEditingCampaign(null); setShowForm(true); }}
          className="flex items-center gap-2 h-10 px-5 bg-foreground text-background rounded-2xl text-[10px] font-black uppercase tracking-[0.18em] hover:opacity-85 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Campaigns', value: stats.total, icon: Target },
          { label: 'Active Now', value: stats.active, icon: CheckCircle2 },
          { label: 'Total Redemptions', value: stats.totalUsage, icon: Users },
        ].map(s => (
          <div key={s.label} className="bg-foreground/[0.03] border border-foreground/[0.08] rounded-2xl p-5 flex items-center gap-4">
            <div className="w-9 h-9 bg-emerald-500/[0.1] rounded-xl flex items-center justify-center flex-shrink-0">
              <s.icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/40">{s.label}</p>
              <p className="text-xl font-black text-foreground tabular-nums">{s.value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Campaign Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border border-foreground/10 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-foreground/8 bg-foreground/[0.02]">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground">
                  {editingCampaign ? 'Edit Campaign' : 'New Campaign'}
                </p>
                <button onClick={() => { setShowForm(false); setEditingCampaign(null); resetForm(); }}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-foreground/[0.06] hover:bg-foreground/10 transition-colors">
                  <X className="w-3.5 h-3.5 text-foreground/50" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Campaign type */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-[0.18em] text-foreground/40 mb-2 block">Campaign Type</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {CAMPAIGN_TYPES.map(ct => (
                      <button key={ct.value} onClick={() => setForm(f => ({ ...f, campaign_type: ct.value }))}
                        aria-pressed={form.campaign_type === ct.value}
                        className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-colors text-center ${form.campaign_type === ct.value ? 'border-emerald-500/30 bg-emerald-500/[0.08]' : 'border-foreground/[0.08] hover:border-foreground/20'}`}
                      >
                        <ct.icon className={`w-4 h-4 ${form.campaign_type === ct.value ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/35'}`} />
                        <span className={`text-[9px] font-black uppercase tracking-wider ${form.campaign_type === ct.value ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground/45'}`}>{ct.label}</span>
                        <span className="text-[8px] text-foreground/35 font-medium">{ct.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-wider text-foreground/40">Campaign Name *</label>
                    <input className={fieldCls} placeholder="e.g. Summer Mega Sale" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-wider text-foreground/40">
                      Coupon Code {form.is_auto_apply ? '(auto-apply, optional)' : '*'}
                    </label>
                    <input className={fieldCls + ' font-mono uppercase tracking-widest'} placeholder="e.g. SUMMER30" value={form.code}
                      onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))} />
                  </div>
                </div>

                {/* BOGO fields */}
                {form.campaign_type === 'bogo' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-wider text-foreground/40">Buy Quantity</label>
                      <input type="number" min={1} className={fieldCls} value={form.buy_quantity} onChange={e => setForm(f => ({ ...f, buy_quantity: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-wider text-foreground/40">Get Quantity Free</label>
                      <input type="number" min={1} className={fieldCls} value={form.get_quantity} onChange={e => setForm(f => ({ ...f, get_quantity: Number(e.target.value) }))} />
                    </div>
                  </div>
                )}

                {/* Discount value (not for BOGO/shipping) */}
                {!['bogo', 'shipping'].includes(form.campaign_type) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-wider text-foreground/40">Discount Type</label>
                      <select className={fieldCls + ' appearance-none cursor-pointer'} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount (TZS)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-wider text-foreground/40">
                        Value {form.type === 'percentage' ? '(%)' : '(TZS)'}
                      </label>
                      <input type="number" min={1} max={form.type === 'percentage' ? 100 : undefined} className={fieldCls} value={form.value} onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))} />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-wider text-foreground/40">Min Order Value (TZS)</label>
                    <input type="number" min={0} className={fieldCls} placeholder="0 = no minimum" value={form.min_order_value || ''} onChange={e => setForm(f => ({ ...f, min_order_value: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-wider text-foreground/40">Max Uses</label>
                    <input type="number" min={0} className={fieldCls} placeholder="0 = unlimited" value={form.max_usage || ''} onChange={e => setForm(f => ({ ...f, max_usage: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-wider text-foreground/40">Target Audience</label>
                    <select className={fieldCls + ' appearance-none cursor-pointer'} value={form.target_type} onChange={e => setForm(f => ({ ...f, target_type: e.target.value }))}>
                      <option value="store">All Users</option>
                      <option value="product">Specific Products</option>
                      <option value="category">Category</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-wider text-foreground/40">Start Date *</label>
                    <input type="date" className={fieldCls} value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-wider text-foreground/40">End Date *</label>
                    <input type="date" className={fieldCls} value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-4">
                  <button onClick={() => setForm(f => ({ ...f, is_auto_apply: !f.is_auto_apply }))}
                    aria-pressed={form.is_auto_apply}
                    className={`flex items-center gap-2 h-9 px-4 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-colors ${form.is_auto_apply ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-400' : 'border-foreground/[0.12] text-foreground/40 hover:border-foreground/25'}`}
                  >
                    <Zap className="w-3.5 h-3.5" /> Auto-Apply {form.is_auto_apply ? 'On' : 'Off'}
                  </button>
                  <div className="flex items-center gap-2">
                    <label className="text-[9px] font-black uppercase tracking-wider text-foreground/40">Status:</label>
                    <select className="h-9 bg-foreground/[0.04] border border-foreground/10 rounded-xl px-3 text-[10px] font-black text-foreground outline-none" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      <option value="active">Active</option>
                      <option value="inactive">Draft</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setShowForm(false); setEditingCampaign(null); resetForm(); }}
                    className="flex-1 h-11 rounded-xl border border-foreground/12 text-[9px] font-black uppercase tracking-wider text-foreground/50 hover:text-foreground transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={isSaving}
                    className="flex-[2] h-11 rounded-xl bg-foreground text-background text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50">
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {editingCampaign ? 'Update Campaign' : 'Launch Campaign'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(['all', 'active', 'inactive', 'expired'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-4 h-8 rounded-full text-[9px] font-black uppercase tracking-wider flex-shrink-0 transition-all ${filterStatus === s ? 'bg-foreground text-background' : 'bg-foreground/[0.04] text-foreground/40 hover:bg-foreground/[0.08]'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Campaign List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-foreground/[0.04] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-foreground/10 rounded-2xl">
          <Target className="w-10 h-10 mx-auto mb-3 text-foreground/15" />
          <p className="text-[10px] font-black uppercase tracking-wider text-foreground/30">No campaigns found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const status = deriveStatus(c);
            const usagePct = c.max_usage ? Math.min(100, ((c.current_usage || 0) / c.max_usage) * 100) : 0;
            return (
              <motion.div key={c.id} layout
                className="border border-foreground/8 rounded-2xl p-5 bg-background hover:border-foreground/15 transition-all"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-black text-sm text-foreground">{c.title}</h4>
                      <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLOR[status] || STATUS_COLOR.inactive}`}>
                        {status}
                      </span>
                      {c.is_flash_sale && (
                        <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/[0.1] text-amber-600 dark:text-amber-400">⚡ Flash</span>
                      )}
                      {c.is_auto_apply && !c.is_flash_sale && (
                        <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/[0.1] text-sky-600 dark:text-sky-400">Auto</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[9px] font-bold text-foreground/40 uppercase tracking-wider">
                      {c.code && <span className="font-mono font-black text-foreground bg-foreground/[0.06] px-2 py-0.5 rounded-md">{c.code}</span>}
                      <span>
                        {c.campaign_type === 'bogo'
                          ? `Buy ${c.buy_quantity} Get ${c.get_quantity} Free`
                          : c.campaign_type === 'shipping'
                          ? 'Free Shipping'
                          : c.type === 'percentage' ? `${c.value}% Off` : `${formatTZS(c.value)} Off`}
                      </span>
                      {c.min_order_value ? <span>Min: {formatTZS(c.min_order_value)}</span> : null}
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(c.end_date).toLocaleDateString()}</span>
                    </div>
                    {c.max_usage && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[8px] font-bold text-foreground/30 mb-1">
                          <span>{c.current_usage || 0}/{c.max_usage} used</span>
                          <span>{Math.round(usagePct)}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-foreground/8 overflow-hidden">
                          <div className="h-full bg-foreground/40 rounded-full transition-all" style={{ width: `${usagePct}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleToggleStatus(c)}
                      className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${status === 'active' ? 'bg-emerald-500/[0.1] text-emerald-600 dark:text-emerald-400' : 'bg-foreground/[0.05] text-foreground/30 hover:text-foreground'}`}
                      title={status === 'active' ? 'Pause' : 'Activate'}
                    >
                      {status === 'active' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleEdit(c)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-foreground/[0.04] hover:bg-foreground/[0.1] text-foreground/50 hover:text-foreground transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeletingId(c.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-foreground/[0.04] hover:bg-rose-500/[0.08] text-foreground/30 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Campaign"
        message="This will permanently delete the campaign and all associated usage data. This cannot be undone."
        confirmText="Delete"
        isDestructive
      />
    </div>
  );
};
