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

import { CampaignModal } from './seller-offers/CampaignModal';
import { OfferCard } from './seller-offers/OfferCard';

export const SellerOffers = ({ sellerId, preselectedProduct }: { sellerId: string; preselectedProduct?: any }) => {
  const { products, sellerOffers: contextOffers } = useAppState();
  const { addToast } = useToast();
  const [offers, setOffers] = useState<Offer[]>(contextOffers as Offer[] || []);
  const [isLoading, setIsLoading] = useState(!contextOffers?.length);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const myProducts = useMemo(() => products.filter(p => p.seller_id === sellerId), [products, sellerId]);
  const CACHE_KEY = `seller:offers:${sellerId}`;

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

  // Seed from context instantly (same pattern as SellerOrders)
  useEffect(() => {
    if (contextOffers?.length) {
      setOffers(contextOffers as Offer[]);
      setIsLoading(false);
    }
  }, [contextOffers]);

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
