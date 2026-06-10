import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap, Truck, Repeat, Percent, Tag, Copy,
  CheckCircle2, Trash2, Edit2, Power, PowerOff, Ticket,
  Plus, X, ChevronDown, ArrowRight, Sparkles, Calendar,
  Target, Settings2, ChevronLeft
} from 'lucide-react';
import { Button, Input, Badge, useToast, Label, Switch } from '../UI';
import { supabase } from '../../services/supabaseClient';
import { isValidPrice } from '../../src/security';
import { Offer } from '../../types';
import { formatTZS, CURRENCY } from '../../constants';
import { motion, AnimatePresence } from 'framer-motion';

export const CampaignPreviewCard = ({ formData, gradient }: { formData: any; gradient: string }) => (
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