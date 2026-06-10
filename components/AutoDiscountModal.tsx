/**
 * AutoDiscountModal — creates a time-limited sale offer for a product.
 * Since there's no separate pricing_rules table, this creates an offer
 * with is_flash_sale=false, target_type='product', target_ids=[product.id]
 * and a future end_date so it auto-expires. Sellers can manage it from Campaigns.
 */
import React, { useState } from 'react';
import { X, Save, Clock, Percent, Info, Loader2, CheckCircle2 } from 'lucide-react';
import { Product } from '../types';
import { supabase } from '../services/supabaseClient';
import { useAppState } from '../context/AppContext';
import { useToast } from './UI';
import { formatTZS } from '../constants';
import { rateLimit, isValidPrice } from '../src/security';

export const AutoDiscountModal = ({
  isOpen, onClose, product, onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSave: () => void;
}) => {
  const [days, setDays] = useState(14);
  const [discountPct, setDiscountPct] = useState(10);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { user } = useAppState();
  const { addToast } = useToast();

  if (!isOpen || !product) return null;

  const originalPrice = product.price || 0;
  const discountedPrice = Math.round(originalPrice * (1 - discountPct / 100));
  const endDate = new Date(Date.now() + days * 86400 * 1000);

  const handleSave = async () => {
    if (!user) return;
    if (!rateLimit('auto-discount', 5)) { addToast('Too fast', 'error'); return; }
    if (discountPct < 1 || discountPct > 90) { addToast('Discount must be between 1% and 90%', 'error'); return; }
    if (days < 1 || days > 365) { addToast('Duration must be 1–365 days', 'error'); return; }
    if (originalPrice <= 0) { addToast('Product has no price set', 'error'); return; }

    setIsSaving(true);
    try {
      // Create an offer that targets this specific product
      const { error } = await supabase.from('offers').insert({
        seller_id: user.id,
        title: `Auto-discount: ${discountPct}% off ${product.name}`,
        code: null,  // auto-apply, no coupon code needed
        type: 'percentage',
        value: discountPct,
        scope: 'product',
        target_type: 'product',
        target_ids: [product.id],
        is_auto_apply: true,
        auto_apply: true,
        is_flash_sale: false,
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: endDate.toISOString(),
        min_order_value: 0,
        max_usage: 0,  // unlimited
        description: `Auto-applied ${discountPct}% discount on ${product.name} · expires ${endDate.toLocaleDateString('en-TZ', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      });
      if (error) throw error;

      setSaved(true);
      addToast(`${discountPct}% discount applied — expires ${endDate.toLocaleDateString('en-TZ')}`, 'success');
      onSave();
    } catch (err: any) {
      addToast(err.message || 'Failed to create discount', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={saved ? onClose : undefined} />
      <div className="relative w-full max-w-sm bg-background border border-foreground/8 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-foreground/8">
          <div>
            <h2 className="text-base font-black text-foreground">Auto-Discount Rule</h2>
            <p className="text-xs text-foreground/40 mt-0.5 truncate max-w-[200px]">{product.name}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-foreground/[0.05] flex items-center justify-center hover:bg-foreground/10 transition-colors">
            <X className="w-4 h-4 text-foreground/60" />
          </button>
        </div>

        {saved ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <p className="text-base font-black text-foreground">Discount Active</p>
              <p className="text-xs text-foreground/50 mt-1">
                {discountPct}% off {product.name} until {endDate.toLocaleDateString('en-TZ', { day: 'numeric', month: 'long' })}
              </p>
              <p className="text-xs text-foreground/40 mt-1">Manage this in Campaigns → your active offers</p>
            </div>
            <button onClick={onClose}
              className="w-full h-10 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 transition-colors">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-5">
              {/* Info */}
              <div className="flex gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-900/30">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                  Creates an auto-applied discount on this product. It appears in your Campaigns tab and auto-expires after the duration. No coupon code needed — buyers see the reduced price automatically.
                </p>
              </div>

              {/* Duration */}
              <div>
                <label className="text-xs font-bold text-foreground/60 mb-2 flex items-center gap-1.5 block">
                  <Clock className="w-3.5 h-3.5" />Duration (days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={days}
                  onChange={e => setDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))}
                  className="w-full h-11 rounded-xl border border-foreground/15 bg-foreground/[0.04] px-4 text-sm text-foreground outline-none focus:border-foreground/30 transition-all"
                />
                <p className="text-[10px] text-foreground/35 mt-1">
                  Expires: {endDate.toLocaleDateString('en-TZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>

              {/* Discount */}
              <div>
                <label className="text-xs font-bold text-foreground/60 mb-2 flex items-center gap-1.5 block">
                  <Percent className="w-3.5 h-3.5" />Discount %
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="90"
                    value={discountPct}
                    onChange={e => setDiscountPct(parseInt(e.target.value))}
                    className="flex-1 accent-emerald-600"
                  />
                  <div className="w-16 h-11 rounded-xl border border-foreground/15 bg-foreground/[0.04] flex items-center justify-center">
                    <span className="text-base font-black text-emerald-600">{discountPct}%</span>
                  </div>
                </div>
              </div>

              {/* Price preview */}
              {originalPrice > 0 && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-foreground/[0.03]">
                  <div className="text-center">
                    <p className="text-[10px] text-foreground/40 mb-1">Original</p>
                    <p className="text-base font-black text-foreground line-through opacity-40">{formatTZS(originalPrice)}</p>
                  </div>
                  <div className="text-2xl text-foreground/20">→</div>
                  <div className="text-center">
                    <p className="text-[10px] text-foreground/40 mb-1">Discounted</p>
                    <p className="text-base font-black text-emerald-600">{formatTZS(discountedPrice)}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button onClick={onClose}
                className="flex-1 h-11 rounded-xl border border-foreground/15 text-sm font-semibold text-foreground/60 hover:bg-foreground/[0.04] transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 h-11 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Apply Discount</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
