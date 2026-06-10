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

export const OfferCard = ({ offer, onEdit, onDelete, onToggle, addToast }: any) => {
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