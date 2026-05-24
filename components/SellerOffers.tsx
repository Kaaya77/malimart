import { useAppState } from '../context/AppContext';
import { rateLimit, isValidPrice } from '../src/security';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap, Truck, Repeat, Percent, Tag, Copy,
  CheckCircle2, Trash2, Edit2, Power, PowerOff, Ticket,
  Plus, X, ChevronDown, ArrowRight, Sparkles, Calendar,
  Target, Settings2, ChevronLeft
} from 'lucide-react';
import { Button, Input, Badge, useToast, Label, Switch, ConfirmModal } from './UI';
import { supabase } from '../services/supabaseClient';
import { withCache, invalidate } from '../services/queryCache';
import { Offer } from '../types';
import { formatTZS, CURRENCY } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';

// ── Live preview card ─────────────────────────────────────────────────────────
const CampaignPreviewCard = ({ formData, gradient }: { formData: any; gradient: string }) => (
  <div className="w-full rounded-2xl overflow-hidden shadow-xl border border-white/10">
    <div className={`bg-gradient-to-br ${gradient} p-5 relative overflow-hidden`}>
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
      <div className="relative z-10 flex items-start justify-between">
        <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
          {formData.campaign_mode === 'flash' ? <Zap className="w-5 h-5" />
            : formData.campaign_type === 'shipping' ? <Truck className="w-5 h-5" />
            : formData.campaign_type === 'bogo' ? <Repeat className="w-5 h-5" />
            : <Percent className="w-5 h-5" />}
        </div>
        <div className="text-right">
          {formData.campaign_type === 'bogo' ? (
            <>
              <span className="text-[9px] uppercase tracking-[0.2em] text-white/70 block">Bundle</span>
              <span className="text-2xl font-black text-white leading-none">B{formData.buy_quantity}G{formData.get_quantity}</span>
            </>
          ) : formData.campaign_type === 'shipping' ? (
            <span className="text-xl font-black text-white leading-none">FREE SHIP</span>
          ) : (
            <>
              <span className="text-[9px] uppercase tracking-[0.2em] text-white/70 block">Save</span>
              <span className="text-3xl font-black text-white leading-none">
                {formData.type === 'percentage' ? `${formData.value || 0}%` : formatTZS(formData.value || 0)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
    <div className="bg-background/95 dark:bg-foreground/[0.04] p-4 border-t border-foreground/[0.06]">
      <p className="font-bold text-foreground text-sm leading-snug mb-2 line-clamp-1">
        {formData.title || 'Campaign Name'}
      </p>
      <p className="text-[10px] text-foreground/45 leading-relaxed line-clamp-2">
        {formData.target_type === 'store' ? 'Applies to entire store.' : `Applies to ${formData.target_ids.length} selected product${formData.target_ids.length !== 1 ? 's' : ''}.`}
        {formData.min_order_value > 0 ? ` Min. ${formatTZS(formData.min_order_value)}.` : ''}
        {formData.campaign_mode === 'flash' ? ' ⚡ Limited time!' : ''}
      </p>
      <div className="mt-3">
        {formData.campaign_mode === 'coupon' ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-foreground/[0.05] rounded-xl border border-dashed border-foreground/15">
            <Ticket className="w-3.5 h-3.5 text-foreground/40 shrink-0" />
            <span className="font-mono text-xs tracking-widest text-foreground font-bold">{formData.code || 'CODE'}</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500/5 rounded-xl border border-emerald-500/15">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Auto-Applied</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

// ── Step indicator ────────────────────────────────────────────────────────────
const StepBar = ({ step, total }: { step: number; total: number }) => (
  <div className="flex items-center gap-1.5 mb-6">
    {Array.from({ length: total }).map((_, i) => (
      <motion.div key={i}
        animate={{ width: i === step ? 24 : 8, opacity: i <= step ? 1 : 0.25 }}
        className="h-1.5 rounded-full bg-brand-500"
        transition={{ duration: 0.3 }}
      />
    ))}
    <span className="text-[10px] text-foreground/30 font-bold ml-1">{step + 1} / {total}</step>
  </div>
);

// ── Create / edit modal ───────────────────────────────────────────────────────
const CampaignModal = ({ onClose, onSave, editingOffer, myProducts, isSubmitting, addToast }: any) => {
  const [step, setStep] = useState(0);
  const STEPS = ['Type', 'Configure', 'Target', 'Launch'];

  const [formData, setFormData] = useState({
    title: editingOffer?.title || '',
    code: editingOffer?.code || '',
    campaign_mode: editingOffer ? (editingOffer.is_flash_sale ? 'flash' : editingOffer.is_auto_apply ? 'sale' : 'coupon') : 'coupon' as 'coupon' | 'sale' | 'flash',
    campaign_type: (editingOffer?.campaign_type || 'discount') as 'discount' | 'bogo' | 'shipping',
    type: (editingOffer?.type || 'percentage') as 'percentage' | 'fixed',
    value: editingOffer?.value || 0,
    min_order_value: editingOffer?.min_order_value || 0,
    buy_quantity: editingOffer?.buy_quantity || 2,
    get_quantity: editingOffer?.get_quantity || 1,
    max_usage: editingOffer?.max_usage || 0,
    start_date: editingOffer?.start_date ? new Date(editingOffer.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    end_date: editingOffer?.end_date ? new Date(editingOffer.end_date).toISOString().split('T')[0] : '',
    target_type: (editingOffer?.target_type || 'store') as 'store' | 'product',
    target_ids: editingOffer?.target_ids || [] as string[],
  });

  const set = (key: string, val: any) => setFormData(p => ({ ...p, [key]: val }));

  const gradient = useMemo(() => {
    if (formData.campaign_mode === 'flash') return 'from-amber-500 to-red-600';
    if (formData.campaign_type === 'shipping') return 'from-emerald-500 to-teal-500';
    if (formData.campaign_type === 'bogo') return 'from-indigo-500 to-purple-600';
    if (formData.type === 'percentage' && formData.value >= 25) return 'from-rose-500 to-pink-600';
    return 'from-blue-600 to-indigo-700';
  }, [formData]);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    set('code', code);
  };

  const setFlashDuration = (hours: number) => {
    const end = new Date();
    end.setHours(end.getHours() + hours);
    set('end_date', end.toISOString().split('T')[0]);
  };

  const canNext = () => {
    if (step === 1) {
      if (formData.campaign_type !== 'shipping' && formData.campaign_type !== 'bogo' && !formData.value) return false;
      if (formData.campaign_mode === 'flash' && !formData.end_date) return false;
    }
    if (step === 2 && formData.target_type === 'product' && formData.target_ids.length === 0) return false;
    if (step === 3 && formData.campaign_mode === 'coupon' && !formData.code) return false;
    return true;
  };

  const selectedProducts = useMemo(() => myProducts.filter((p: any) => formData.target_ids.includes(p.id)), [myProducts, formData.target_ids]);

  const CAMPAIGN_TYPES = [
    { id: 'discount', mode: 'sale',   label: 'Discount',     icon: Percent, desc: '% or fixed price off', gradient: 'from-blue-500 to-indigo-600' },
    { id: 'bogo',     mode: 'sale',   label: 'Bundle Deal',  icon: Repeat,  desc: 'Buy X, get Y free', gradient: 'from-indigo-500 to-purple-600' },
    { id: 'flash',    mode: 'flash',  label: 'Flash Sale',   icon: Zap,     desc: 'Timed urgent deal', gradient: 'from-amber-500 to-red-600' },
    { id: 'shipping', mode: 'sale',   label: 'Free Shipping',icon: Truck,   desc: 'Waive delivery cost', gradient: 'from-emerald-500 to-teal-600' },
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-4 md:inset-8 lg:inset-12 z-50 bg-background rounded-3xl shadow-2xl border border-foreground/[0.08] flex overflow-hidden max-w-5xl mx-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Left: live preview */}
        <div className="hidden md:flex w-80 shrink-0 flex-col items-center justify-center gap-6 bg-foreground/[0.02] border-r border-foreground/[0.07] p-8">
          <div className="w-full">
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-foreground/25 mb-4 text-center">Live Preview</p>
            <CampaignPreviewCard formData={formData} gradient={gradient} />
          </div>
          <div className="text-center">
            <p className="text-[9px] text-foreground/25 font-bold uppercase tracking-widest">Preview updates as you type</p>
          </div>
        </div>

        {/* Right: form */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-foreground/[0.07] shrink-0">
            <div>
              <h2 className="text-base font-black text-foreground">{editingOffer ? 'Edit Campaign' : 'New Campaign'}</h2>
              <p className="text-[10px] text-foreground/35 font-semibold">Step {step + 1}: {STEPS[step]}</p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl bg-foreground/[0.05] hover:bg-foreground/10 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-foreground/60" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            <StepBar step={step} total={STEPS.length} />

            <AnimatePresence mode="wait">
              {/* Step 0: Type */}
              {step === 0 && (
                <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h3 className="text-sm font-black text-foreground mb-1">Choose campaign type</h3>
                  <p className="text-[11px] text-foreground/45 mb-5">What kind of offer do you want to create?</p>
                  <div className="grid grid-cols-2 gap-3">
                    {CAMPAIGN_TYPES.map(ct => {
                      const Icon = ct.icon;
                      const active = (ct.mode === 'flash' && formData.campaign_mode === 'flash') ||
                        (ct.mode !== 'flash' && formData.campaign_mode !== 'flash' && formData.campaign_type === ct.id);
                      return (
                        <button key={ct.id}
                          onClick={() => {
                            const isFlash = ct.mode === 'flash';
                            set('campaign_type', isFlash ? 'discount' : ct.id as any);
                            set('campaign_mode', ct.mode as any);
                            if (ct.id === 'shipping') { set('target_type', 'store'); set('target_ids', []); }
                          }}
                          className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                            active
                              ? 'border-foreground/25 bg-foreground/[0.06] shadow-sm'
                              : 'border-foreground/[0.07] bg-foreground/[0.02] hover:bg-foreground/[0.04]'
                          }`}
                        >
                          <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ct.gradient} flex items-center justify-center shrink-0`}>
                            <Icon className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
                          </span>
                          <div>
                            <p className="text-xs font-black text-foreground">{ct.label}</p>
                            <p className="text-[10px] text-foreground/40 mt-0.5">{ct.desc}</p>
                          </div>
                          {active && <CheckCircle2 className="w-4 h-4 text-brand-500 ml-auto shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Campaign name */}
                  <div className="mt-5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 block mb-2">Campaign name</label>
                    <input
                      value={formData.title}
                      onChange={e => set('title', e.target.value)}
                      placeholder="e.g. Summer sale, Weekend flash…"
                      className="w-full h-11 px-4 rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] text-sm text-foreground placeholder:text-foreground/25 outline-none focus:border-foreground/25 transition-all"
                    />
                  </div>
                </motion.div>
              )}

              {/* Step 1: Configure */}
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h3 className="text-sm font-black text-foreground mb-1">Set the terms</h3>
                  <p className="text-[11px] text-foreground/45 mb-5">Configure the value and constraints for your offer.</p>

                  {/* BOGO */}
                  {formData.campaign_type === 'bogo' && (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 block mb-2">Customer buys</label>
                        <div className="flex items-center gap-2">
                          <input type="number" min="1" value={formData.buy_quantity}
                            onChange={e => set('buy_quantity', Number(e.target.value))}
                            className="flex-1 h-12 px-4 rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] text-sm font-black text-center text-foreground outline-none focus:border-foreground/25 transition-all" />
                          <span className="text-[10px] text-foreground/35 font-bold">items</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 block mb-2">Gets free</label>
                        <div className="flex items-center gap-2">
                          <input type="number" min="1" value={formData.get_quantity}
                            onChange={e => set('get_quantity', Number(e.target.value))}
                            className="flex-1 h-12 px-4 rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] text-sm font-black text-center text-foreground outline-none focus:border-foreground/25 transition-all" />
                          <span className="text-[10px] text-foreground/35 font-bold">free</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Discount value */}
                  {formData.campaign_type === 'discount' && (
                    <div className="mb-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 block mb-2">Discount</label>
                      <div className="flex gap-2 mb-3">
                        {(['percentage', 'fixed'] as const).map(t => (
                          <button key={t}
                            onClick={() => set('type', t)}
                            className={`flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all ${
                              formData.type === t
                                ? 'bg-foreground text-background border-foreground'
                                : 'bg-foreground/[0.04] text-foreground/40 border-foreground/[0.08] hover:bg-foreground/[0.07]'
                            }`}
                          >
                            {t === 'percentage' ? 'Percentage %' : `Fixed ${CURRENCY}`}
                          </button>
                        ))}
                      </div>
                      <input type="number" min="0" value={formData.value || ''}
                        onChange={e => set('value', Number(e.target.value))}
                        placeholder={formData.type === 'percentage' ? 'e.g. 20' : 'e.g. 5000'}
                        className="w-full h-12 px-4 rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] text-lg font-black text-foreground placeholder:text-foreground/20 outline-none focus:border-foreground/25 transition-all" />
                    </div>
                  )}

                  {/* Flash duration */}
                  {formData.campaign_mode === 'flash' && (
                    <div className="mb-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 block mb-2">Duration (quick pick)</label>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[12, 24, 48].map(h => (
                          <button key={h} onClick={() => setFlashDuration(h)}
                            className="h-10 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] hover:bg-foreground/[0.07] text-[10px] font-black uppercase tracking-wide text-foreground/50 transition-all">
                            {h}h
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-foreground/30 block mb-1.5">Start</label>
                          <input type="date" value={formData.start_date}
                            onChange={e => set('start_date', e.target.value)}
                            className="w-full h-10 px-3 rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] text-xs text-foreground outline-none focus:border-foreground/25 transition-all" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-foreground/30 block mb-1.5">End *</label>
                          <input type="date" value={formData.end_date}
                            onChange={e => set('end_date', e.target.value)}
                            className="w-full h-10 px-3 rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] text-xs text-foreground outline-none focus:border-foreground/25 transition-all" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Constraints */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 block mb-2">Min. spend ({CURRENCY})</label>
                      <input type="number" min="0" value={formData.min_order_value || ''}
                        onChange={e => set('min_order_value', Number(e.target.value))}
                        placeholder="None"
                        className="w-full h-10 px-3 rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] text-xs text-foreground placeholder:text-foreground/25 outline-none focus:border-foreground/25 transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 block mb-2">Usage limit</label>
                      <input type="number" min="0" value={formData.max_usage || ''}
                        onChange={e => set('max_usage', Number(e.target.value))}
                        placeholder="Unlimited"
                        className="w-full h-10 px-3 rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] text-xs text-foreground placeholder:text-foreground/25 outline-none focus:border-foreground/25 transition-all" />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Target */}
              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h3 className="text-sm font-black text-foreground mb-1">Apply to</h3>
                  <p className="text-[11px] text-foreground/45 mb-5">Choose which products this campaign covers.</p>

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {(['store', 'product'] as const).map(tt => (
                      <button key={tt}
                        onClick={() => { set('target_type', tt); if (tt === 'store') set('target_ids', []); }}
                        disabled={formData.campaign_type === 'shipping' && tt === 'product'}
                        className={`flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          formData.target_type === tt
                            ? 'border-foreground/25 bg-foreground/[0.06] shadow-sm'
                            : 'border-foreground/[0.07] bg-foreground/[0.02] hover:bg-foreground/[0.04]'
                        }`}
                      >
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          formData.target_type === tt ? 'bg-brand-500/15 text-brand-500' : 'bg-foreground/[0.05] text-foreground/30'
                        }`}>
                          {tt === 'store' ? <Sparkles className="w-5 h-5" /> : <Target className="w-5 h-5" />}
                        </span>
                        <div className="text-center">
                          <p className="text-xs font-black text-foreground">{tt === 'store' ? 'Entire Store' : 'Specific Items'}</p>
                          <p className="text-[10px] text-foreground/35 mt-0.5">{tt === 'store' ? 'All products' : 'You choose'}</p>
                        </div>
                        {formData.target_type === tt && <CheckCircle2 className="w-4 h-4 text-brand-500" />}
                      </button>
                    ))}
                  </div>

                  {formData.target_type === 'product' && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 block mb-2">Select products</label>
                      <div className="relative mb-3">
                        <select
                          onChange={e => {
                            const id = e.target.value;
                            if (id && !formData.target_ids.includes(id)) {
                              set('target_ids', [...formData.target_ids, id]);
                            }
                            e.target.value = '';
                          }}
                          value=""
                          className="w-full h-10 pl-4 pr-10 rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] text-xs text-foreground outline-none focus:border-foreground/25 transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Add a product…</option>
                          {myProducts.map((p: any) => (
                            <option key={p.id} value={p.id} disabled={formData.target_ids.includes(p.id)}>
                              {p.name} — {formatTZS(p.price)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30 pointer-events-none" />
                      </div>
                      {selectedProducts.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedProducts.map((p: any) => (
                            <span key={p.id} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-black">
                              {p.name}
                              <button onClick={() => set('target_ids', formData.target_ids.filter((id: string) => id !== p.id))}
                                className="w-4 h-4 rounded-full bg-brand-500/20 flex items-center justify-center hover:bg-brand-500/30 transition-colors">
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Step 3: Launch */}
              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h3 className="text-sm font-black text-foreground mb-1">Activate</h3>
                  <p className="text-[11px] text-foreground/45 mb-5">Choose how buyers apply this offer.</p>

                  <div className="grid grid-cols-1 gap-3 mb-5">
                    {[
                      { mode: 'coupon', label: 'Coupon code', desc: 'Buyer enters a code at checkout', icon: Ticket },
                      { mode: 'sale',   label: 'Auto-apply',  desc: 'Discount applied automatically',  icon: Zap },
                    ].map(opt => {
                      const Icon = opt.icon;
                      const active = formData.campaign_mode === opt.mode ||
                        (opt.mode === 'sale' && formData.campaign_mode === 'flash');
                      return (
                        <button key={opt.mode}
                          onClick={() => set('campaign_mode', formData.campaign_mode === 'flash' ? 'flash' : opt.mode)}
                          disabled={formData.campaign_mode === 'flash'}
                          className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            active ? 'border-foreground/25 bg-foreground/[0.06]' : 'border-foreground/[0.07] bg-foreground/[0.02] hover:bg-foreground/[0.04]'
                          }`}
                        >
                          <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-brand-500/15 text-brand-500' : 'bg-foreground/[0.05] text-foreground/30'}`}>
                            <Icon className="w-4.5 h-4.5" />
                          </span>
                          <div className="flex-1">
                            <p className="text-xs font-black text-foreground">{opt.label}</p>
                            <p className="text-[10px] text-foreground/40 mt-0.5">{opt.desc}</p>
                          </div>
                          {active && <CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {formData.campaign_mode === 'coupon' && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 block mb-2">Coupon code *</label>
                      <div className="relative">
                        <Ticket className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
                        <input
                          value={formData.code}
                          onChange={e => set('code', e.target.value.toUpperCase())}
                          placeholder="e.g. SAVE20"
                          className="w-full h-12 pl-10 pr-24 rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] font-mono text-sm font-bold uppercase tracking-widest text-foreground placeholder:text-foreground/20 placeholder:normal-case outline-none focus:border-foreground/25 transition-all"
                        />
                        <button onClick={generateCode}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-3 rounded-lg bg-foreground/[0.07] hover:bg-foreground/10 text-[9px] font-black uppercase tracking-widest text-foreground/50 transition-colors">
                          Auto-gen
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {formData.campaign_mode === 'flash' && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <p className="text-[10px] font-black text-amber-600 dark:text-amber-400">⚡ Flash sale note</p>
                      <p className="text-[10px] text-foreground/50 mt-0.5">Flash sales are auto-applied and time-limited. Buyers see a countdown.</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer nav */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-foreground/[0.07] shrink-0">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-foreground/[0.05] text-foreground/60 text-xs font-black uppercase tracking-wide hover:bg-foreground/10 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
            <div className="flex-1" />
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext()}
                className="flex items-center gap-1.5 h-10 px-5 rounded-xl bg-foreground text-background text-xs font-black uppercase tracking-wide hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-40"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => onSave(formData)}
                disabled={isSubmitting || !canNext()}
                className="flex items-center gap-1.5 h-10 px-5 rounded-xl bg-brand-500 text-white text-xs font-black uppercase tracking-wide hover:bg-brand-600 transition-all active:scale-[0.98] disabled:opacity-40"
              >
                {isSubmitting ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : <Sparkles className="w-3.5 h-3.5" />}
                {editingOffer ? 'Update Campaign' : 'Launch Campaign'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
};

// ── Offer card (list) ─────────────────────────────────────────────────────────
const OfferCard = ({ offer, onEdit, onDelete, onToggle, addToast }: any) => {
  const isActive = offer.status === 'active';
  const GRADIENT: Record<string, string> = {
    flash: 'from-amber-400/20 to-red-500/20',
    shipping: 'from-emerald-400/20 to-teal-500/20',
    bogo: 'from-indigo-400/20 to-purple-500/20',
  };
  const gradient = offer.is_flash_sale ? GRADIENT.flash
    : offer.campaign_type === 'shipping' ? GRADIENT.shipping
    : offer.campaign_type === 'bogo' ? GRADIENT.bogo
    : 'from-blue-400/20 to-indigo-500/20';

  const ICON_COLOR: Record<string, string> = {
    flash: 'bg-amber-500/15 text-amber-500',
    shipping: 'bg-emerald-500/15 text-emerald-500',
    bogo: 'bg-indigo-500/15 text-indigo-500',
  };
  const iconCls = offer.is_flash_sale ? ICON_COLOR.flash
    : offer.campaign_type === 'shipping' ? ICON_COLOR.shipping
    : offer.campaign_type === 'bogo' ? ICON_COLOR.bogo
    : 'bg-blue-500/15 text-blue-500';

  const Icon = offer.is_flash_sale ? Zap
    : offer.campaign_type === 'shipping' ? Truck
    : offer.campaign_type === 'bogo' ? Repeat : Percent;

  return (
    <motion.div layout
      className={`relative rounded-2xl border overflow-hidden transition-all group ${
        isActive ? 'border-foreground/[0.09] bg-background' : 'border-foreground/[0.05] bg-foreground/[0.02] opacity-60'
      }`}
    >
      {/* Gradient accent strip */}
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${gradient.replace('/20', '')}`} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconCls}`}>
            <Icon className="w-4.5 h-4.5" strokeWidth={2.5} />
          </div>
          <div className="flex items-center gap-1.5">
            {offer.is_flash_sale && isActive && (
              <span className="h-5 px-2 rounded-full bg-amber-500/15 text-amber-600 text-[8px] font-black uppercase tracking-widest animate-pulse flex items-center">Flash</span>
            )}
            {offer.is_auto_apply && !offer.is_flash_sale && (
              <span className="h-5 px-2 rounded-full bg-emerald-500/10 text-emerald-600 text-[8px] font-black uppercase tracking-widest flex items-center">Auto</span>
            )}
            {!isActive && (
              <span className="h-5 px-2 rounded-full bg-foreground/[0.06] text-foreground/35 text-[8px] font-black uppercase tracking-widest flex items-center">Off</span>
            )}
          </div>
        </div>

        <div className="mb-1">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-foreground/30 mb-0.5">
            {offer.campaign_type === 'bogo' ? 'Bundle' : offer.campaign_type === 'shipping' ? 'Shipping' : 'Discount'}
          </p>
          <p className="text-2xl font-black text-foreground leading-none">
            {offer.campaign_type === 'bogo' ? `B${offer.buy_quantity} G${offer.get_quantity}`
              : offer.campaign_type === 'shipping' ? 'Free Ship'
              : offer.type === 'percentage' ? `${offer.value}% off`
              : formatTZS(offer.value) + ' off'}
          </p>
        </div>

        <p className="text-[10px] text-foreground/45 truncate mb-4">{offer.title}</p>

        {!offer.is_auto_apply ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-foreground/[0.04] rounded-xl border border-dashed border-foreground/10">
            <Ticket className="w-3.5 h-3.5 text-foreground/30 shrink-0" />
            <code className="flex-1 font-mono text-xs tracking-widest text-foreground font-bold truncate">{offer.code}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(offer.code); addToast('Code copied', 'success'); }}
              className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-foreground/10 transition-colors text-foreground/30 hover:text-foreground/60"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Auto-applied at checkout</span>
          </div>
        )}
      </div>

      {/* Hover actions */}
      <div className="flex items-center gap-1 px-5 pb-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onToggle(offer)}
          className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-wide transition-colors ${
            isActive ? 'text-foreground/40 hover:bg-foreground/[0.05]' : 'text-emerald-600 hover:bg-emerald-500/10'
          }`}>
          {isActive ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
          {isActive ? 'Disable' : 'Enable'}
        </button>
        <button onClick={() => onEdit(offer)}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-wide text-foreground/40 hover:bg-foreground/[0.05] transition-colors">
          <Edit2 className="w-3 h-3" /> Edit
        </button>
        <button onClick={() => onDelete(offer.id)}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-wide text-red-500/60 hover:bg-red-500/5 transition-colors ml-auto">
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>
    </motion.div>
  );
};

// ── Main export ───────────────────────────────────────────────────────────────
export const SellerOffers = ({ sellerId, preselectedProduct }: { sellerId: string; preselectedProduct?: any }) => {
  const { products, sellerOffers: contextOffers } = useAppState();
  const { addToast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const myProducts = useMemo(() => products.filter(p => p.seller_id === sellerId), [products, sellerId]);
  const CACHE_KEY = `seller:offers:direct:${sellerId}`;

  useEffect(() => {
    if (preselectedProduct) { setEditingOffer(null); setModalOpen(true); }
  }, [preselectedProduct]);

  const fetchOffers = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      if (silent) invalidate(CACHE_KEY);
      const data = await withCache(CACHE_KEY, 60_000, async () => {
        const { data: d, error } = await supabase.from('offers').select('*').eq('seller_id', sellerId).order('created_at', { ascending: false });
        if (error) throw error;
        return d;
      });
      setOffers(data as Offer[]);
    } catch (err: any) {
      if (!silent) addToast('Failed to load campaigns', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers(!!contextOffers?.length);
    const ch = supabase.channel(`offers-${sellerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `seller_id=eq.${sellerId}` }, () => fetchOffers(true))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sellerId]);

  const handleSave = async (formData: any) => {
    const isAuto = formData.campaign_mode !== 'coupon';
    setIsSubmitting(true);
    try {
      const finalCode = isAuto ? (formData.code || `AUTO-${Date.now().toString().slice(-6)}`) : formData.code.toUpperCase();
      const payload = {
        seller_id: sellerId,
        title: formData.title || (formData.campaign_type === 'bogo' ? `Buy ${formData.buy_quantity} Get ${formData.get_quantity}` : `${formData.value}${formData.type === 'percentage' ? '%' : ''} Off`),
        code: finalCode,
        campaign_type: formData.campaign_type,
        type: formData.type,
        value: formData.campaign_type === 'shipping' || formData.campaign_type === 'bogo' ? 100 : formData.value,
        min_order_value: formData.min_order_value,
        buy_quantity: formData.campaign_type === 'bogo' ? formData.buy_quantity : 0,
        get_quantity: formData.campaign_type === 'bogo' ? formData.get_quantity : 0,
        max_usage: formData.max_usage > 0 ? formData.max_usage : null,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        status: 'active',
        scope: 'seller',
        target_type: formData.target_type,
        target_ids: formData.target_ids,
        is_auto_apply: isAuto,
        is_flash_sale: formData.campaign_mode === 'flash',
      };
      let error;
      if (editingOffer) {
        const { error: e } = await supabase.from('offers').update(payload).eq('id', editingOffer.id);
        error = e;
      } else {
        const { error: e } = await supabase.from('offers').insert(payload);
        error = e;
      }
      if (error) throw error;
      addToast(editingOffer ? 'Campaign updated ✓' : 'Campaign launched ✓', 'success');
      setModalOpen(false);
      setEditingOffer(null);
      fetchOffers(false);
    } catch (e: any) {
      addToast(e.message || 'Failed to save', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (offer: Offer) => {
    const newStatus = offer.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('offers').update({ status: newStatus }).eq('id', offer.id);
    if (!error) {
      addToast(`Campaign ${newStatus === 'active' ? 'enabled' : 'disabled'}`, 'info');
      invalidate(CACHE_KEY);
      setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, status: newStatus as any } : o));
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('offers').delete().eq('id', deleteId);
    if (!error) {
      addToast('Campaign deleted', 'info');
      setOffers(prev => prev.filter(o => o.id !== deleteId));
    }
    setDeleteId(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-foreground/30 mb-1">{offers.length} campaign{offers.length !== 1 ? 's' : ''}</p>
          <p className="text-xs text-foreground/45">Coupons, auto-discounts & flash deals</p>
        </div>
        <button
          onClick={() => { setEditingOffer(null); setModalOpen(true); }}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all active:scale-[0.98] shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> New Campaign
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-2xl bg-foreground/[0.04] animate-pulse" />)}
        </div>
      ) : offers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 border border-dashed border-foreground/10 rounded-3xl bg-foreground/[0.01]">
          <div className="w-16 h-16 rounded-3xl bg-foreground/[0.04] border border-foreground/[0.07] flex items-center justify-center">
            <Tag className="w-7 h-7 text-foreground/15" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-foreground/25 uppercase tracking-widest">No campaigns yet</p>
            <p className="text-[10px] text-foreground/20 mt-1">Create your first offer to drive sales</p>
          </div>
          <button
            onClick={() => { setEditingOffer(null); setModalOpen(true); }}
            className="flex items-center gap-2 h-9 px-4 rounded-xl bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Create first campaign
          </button>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {offers.map(offer => (
              <OfferCard
                key={offer.id}
                offer={offer}
                onEdit={(o: Offer) => { setEditingOffer(o); setModalOpen(true); }}
                onDelete={(id: string) => setDeleteId(id)}
                onToggle={handleToggle}
                addToast={addToast}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <CampaignModal
            onClose={() => { setModalOpen(false); setEditingOffer(null); }}
            onSave={handleSave}
            editingOffer={editingOffer}
            myProducts={myProducts}
            isSubmitting={isSubmitting}
            addToast={addToast}
          />
        )}
      </AnimatePresence>

      {/* Confirm delete */}
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Campaign"
        message="This campaign will be permanently deleted and any active discounts will stop immediately."
        confirmText="Delete Campaign"
        isDestructive={true}
      />
    </div>
  );
};
