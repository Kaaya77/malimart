import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap, Truck, Repeat, Percent, Tag, Copy,
  CheckCircle2, Trash2, Edit2, Power, PowerOff, Ticket,
  Plus, X, ChevronDown, ArrowRight, Sparkles, Calendar,
  Target, Settings2, ChevronLeft, MoreVertical
} from 'lucide-react';
import { Button, Input, Badge, useToast, Label, Switch } from '../UI';
import { supabase } from '../../services/supabaseClient';
import { isValidPrice } from '../../src/security';
import { Offer } from '../../types';
import { formatTZS, CURRENCY } from '../../constants';
import { motion, AnimatePresence } from 'framer-motion';

export const OfferCard = ({ offer, onEdit, onDelete, onToggle, addToast }: any) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const isActive = offer.status === 'active';

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);
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
            {/* 3-dot menu — always visible on mobile */}
            <div className="relative md:hidden" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-foreground/[0.06] transition-colors text-foreground/40"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-8 z-50 w-40 rounded-xl border border-foreground/10 bg-background shadow-xl overflow-hidden"
                  >
                    <button
                      onClick={() => { onToggle(offer); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${isActive ? 'text-foreground/60 hover:bg-foreground/[0.05]' : 'text-emerald-600 hover:bg-emerald-500/10'}`}
                    >
                      {isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                      {isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => { onEdit(offer); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-foreground/60 hover:bg-foreground/[0.05] transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => { onDelete(offer.id); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-red-500 hover:bg-red-500/5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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

      {/* Action bar — always visible on mobile, hover-revealed on desktop */}
      <div className="flex items-center gap-1 px-5 pb-4 md:opacity-0 md:group-hover:opacity-100 md:transition-opacity">
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