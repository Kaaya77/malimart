import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, MapPin, Truck, ShieldCheck, X,
  Plus, Smartphone, Banknote, Home, Receipt,
  ShoppingBag, Store, Info, ChevronLeft, ChevronDown, ChevronUp,
  Package, ArrowRight, CheckCircle2, Clock, Wallet,
  Zap, Hash, Ban, Loader2, Copy, Calendar, Gift, MessageSquare,
  CreditCard, Landmark, PenLine, Locate, Navigation, ShoppingCart,
  HelpCircle, Phone, Lock, Sparkles, AlertCircle
} from 'lucide-react';
import { Button, Input, Label, Card, useToast, Badge, Switch, Textarea } from '../UI';
import { formatTZS, CURRENCY, isValidTanzanianPhone } from '../../constants';
import { useAppState } from '../../context/AppContext';
import { Order, OrderStatus, Address, VendorProfile, CartItem } from '../../types';
import { fetchVendorProfiles, fetchSellerPaymentChannels } from '../../services/shopService';
import { supabase } from '../../services/supabaseClient';

import { getEffectiveUnitPrice } from './shared';
import { AddressForm } from './AddressForm';
import { PaymentInstructions } from './PaymentInstructions';

// ─────────────────────────────────────────────
// CheckoutModal
// ─────────────────────────────────────────────
interface CheckoutModalProps {
  total: number; subtotal: number; vat: number; discount: number;
  discountLabel?: string;
  couponCode?: string | null;
  onClose: () => void;
  onComplete: (details: { address: Address; paymentMethod: string; deliveryFee: number; note: string; paymentRef?: string; isGift?: boolean; giftMessage?: string; deliveryDate?: string; deliverySlot?: string; walletAmount?: number }) => Promise<void>;
}


export const CheckoutModal = ({ total: initialTotal, subtotal, vat, discount, discountLabel, couponCode = null, onClose, onComplete }: CheckoutModalProps) => {
  const { addresses, addAddress, cart, user } = useAppState();
  const { addToast } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [isAddingAddr, setIsAddingAddr] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliverySlot, setDeliverySlot] = useState('Standard');
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'lipa_namba' | 'mobile_transfer' | 'cash'>('lipa_namba');
  const [paymentRef, setPaymentRef] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [sellerDetails, setSellerDetails] = useState<VendorProfile[]>([]);
  const [areVendorsLoaded, setAreVendorsLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  const [useWalletBalance, setUseWalletBalance] = useState(false);

  useEffect(() => {
    if (addresses.length > 0 && !selectedAddress) {
      setSelectedAddress(addresses.find(a => a.is_default) || addresses[0]);
    }
  }, [addresses]);

  // Lock the page behind the full-screen checkout and allow Escape to close.
  // (Backdrop-click dismissal is intentionally NOT wired — too easy to lose a
  // half-filled order mid-payment.)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isSubmitting) onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onEsc); };
  }, [onClose, isSubmitting]);

  useEffect(() => {
    const fetchSellers = async () => {
      const ids = Array.from(new Set(cart.map(i => i.seller_id)));
      if (!ids.length) { setAreVendorsLoaded(true); return; }
      try {
        // Storefront fields (delivery fee, name…) come from the RLS-safe public
        // view; payment-receiving numbers (Lipa Namba, mobile money, bank) come
        // from the get_seller_payment_channels RPC — which returns ONLY those
        // fields to signed-in shoppers. Merge both so the payment panel can show
        // real numbers and only offer methods the seller actually configured.
        const [profiles, channels] = await Promise.all([
          fetchVendorProfiles(ids),
          fetchSellerPaymentChannels(ids),
        ]);
        const merged = ids.map(sid => ({
          ...(profiles[sid] || { seller_id: sid }),
          ...(channels[sid] || {}),
        })) as VendorProfile[];
        setSellerDetails(merged);
      } catch (e) { console.error(e); }
      finally { setAreVendorsLoaded(true); }
    };
    fetchSellers();
  }, [cart]);

  const deliveryFeeTotal = useMemo(() => {
    const uids = Array.from(new Set(cart.map(i => i.seller_id)));
    return uids.reduce<number>((acc, sid) => acc + Number(sellerDetails.find(s => s.seller_id === sid)?.delivery_fee || 0), 0);
  }, [cart, sellerDetails]);

  // Delivery actually charged, after any free-shipping campaign. Uses the same
  // compute_shipping_waiver the server (placeOrder) applies, so the previewed
  // delivery here matches the charge. placeOrder still receives the RAW fee and
  // does the one authoritative waiver — we display the result, not pre-waive it.
  const [shippingWaiver, setShippingWaiver] = useState(0);
  useEffect(() => {
    if (!areVendorsLoaded) { setShippingWaiver(0); return; }
    const items = cart.map(i => ({ product_id: i.id, variant_id: i.variant_id || null, quantity: i.quantity }));
    let cancelled = false;
    supabase.rpc('compute_shipping_waiver', { p_items: items, p_coupon_code: couponCode || null, p_delivery_fee: deliveryFeeTotal })
      .then(({ data }) => { if (!cancelled) setShippingWaiver(Math.max(0, Number(data) || 0)); });
    return () => { cancelled = true; };
  }, [cart, couponCode, deliveryFeeTotal, areVendorsLoaded]);
  const effectiveDelivery = Math.max(0, deliveryFeeTotal - shippingWaiver);

  const finalTotal = subtotal + vat + effectiveDelivery - discount;

  // ── Wallet spend ──
  // Display estimate only — place_order_atomic re-clamps the wallet amount to
  // the caller's real profiles.wallet_balance and the server-computed order
  // total, then debits atomically. Row hidden entirely at zero balance.
  const walletBalance = Math.max(0, Math.floor(Number(user?.wallet_balance) || 0));
  const payableTotal = Math.max(0, Math.round(finalTotal));
  const walletApplied = useWalletBalance ? Math.min(walletBalance, payableTotal) : 0;
  const amountDue = payableTotal - walletApplied;
  const walletCoversAll = walletApplied > 0 && amountDue === 0;

  // Only offer payment methods every seller in the cart has actually configured.
  // Gating fields mirror PaymentInstructions: lipa_namba/mobile_number → Mobile
  // Money, account_number → Bank Transfer. Cash-on-delivery needs no seller setup.
  // Payment fields are merged from get_seller_payment_channels above.
  const availableMethods = useMemo(() => {
    const sellerIds = Array.from(new Set(cart.map(i => i.seller_id)));
    const sellersFor = (sid: string) => sellerDetails.find(s => s.seller_id === sid);
    const everySellerHas = (pred: (s?: VendorProfile) => boolean) =>
      sellerIds.length > 0 && sellerIds.every(sid => pred(sellersFor(sid)));

    // Always SHOW every method — but disable (blank out) the ones a seller in the
    // cart hasn't configured, instead of removing them entirely, so buyers know
    // the option exists and why it's unavailable. Cash never needs seller config.
    const mobileOk = everySellerHas(s => !!(s?.lipa_namba || s?.mobile_number));
    const bankOk = everySellerHas(s => !!s?.account_number);
    return [
      { id: 'lipa_namba' as const, label: 'Mobile Money', icon: Smartphone, desc: 'M-Pesa · Tigo · Airtel', disabled: !mobileOk, disabledReason: "Seller hasn't set up mobile money" },
      { id: 'mobile_transfer' as const, label: 'Bank Transfer', icon: Landmark, desc: 'Direct Bank', disabled: !bankOk, disabledReason: "Seller hasn't set up bank transfer" },
      { id: 'cash' as const, label: 'Cash on Delivery', icon: Banknote, desc: 'Pay at Door', disabled: false, disabledReason: '' },
    ];
  }, [cart, sellerDetails]);

  // Keep the selected method valid & enabled as availability resolves (async).
  useEffect(() => {
    if (!areVendorsLoaded) return;
    if (!availableMethods.some(m => m.id === paymentMethod && !m.disabled)) {
      setPaymentMethod(availableMethods.find(m => !m.disabled)?.id ?? 'cash');
    }
  }, [areVendorsLoaded, availableMethods, paymentMethod]);

  const groupedItems = useMemo(() => {
    const g: Record<string, CartItem[]> = {};
    cart.forEach(item => { if (!g[item.seller_id]) g[item.seller_id] = []; g[item.seller_id].push(item); });
    return g;
  }, [cart]);

  const nextDays = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; }), []);

  const handleComplete = async () => {
    if (!selectedAddress) return addToast("Select a delivery address", "error");
    // Wallet covers the whole order → no external payment, no reference needed.
    if (!walletCoversAll) {
      if (paymentMethod === 'lipa_namba') {
        if (!isValidTanzanianPhone(senderPhone?.trim() || '')) return addToast("Enter a valid sender phone number", "error");
        if (!paymentRef?.trim() || paymentRef.trim().length < 4) return addToast("Enter transaction reference", "error");
      } else if (paymentMethod === 'mobile_transfer' && (!paymentRef?.trim() || paymentRef.trim().length < 4)) {
        return addToast("Enter bank transfer reference", "error");
      }
    }
    setIsSubmitting(true);
    try {
      const methodLabel = walletCoversAll ? 'Wallet' : paymentMethod === 'cash' ? 'Cash on Delivery' : paymentMethod === 'lipa_namba' ? 'Mobile Money' : 'Bank Transfer';
      const finalRef = walletCoversAll ? '' : senderPhone ? `${paymentRef} (from: ${senderPhone})` : paymentRef;
      await onComplete({ address: selectedAddress, paymentMethod: methodLabel, deliveryFee: deliveryFeeTotal, note: orderNote, paymentRef: finalRef, isGift, giftMessage, deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined, deliverySlot, walletAmount: walletApplied });
    } catch (e: any) {
      // placeOrder maps RPC failures to actionable messages (out of stock,
      // product removed, session expired) — show those, not a generic error.
      addToast(e?.message || "Failed to process order", "error");
    }
    finally { setIsSubmitting(false); }
  };

  const canProceed = selectedAddress && (
    step === 1 ||
    walletCoversAll ||
    paymentMethod === 'cash' ||
    (paymentMethod === 'lipa_namba' && paymentRef.trim().length >= 4 && isValidTanzanianPhone(senderPhone.trim())) ||
    (paymentMethod === 'mobile_transfer' && paymentRef.trim().length >= 4)
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[350] flex items-end md:items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }}
      >
        <motion.div
          role="dialog" aria-modal="true" aria-label="Checkout"
          initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative w-full max-w-5xl bg-background overflow-hidden flex flex-col md:flex-row border border-foreground/10"
          style={{
            height: '95dvh',
            borderRadius: 'clamp(16px, 3vw, 28px) clamp(16px, 3vw, 28px) 0 0',
          }}
        >
          {/* ── MOBILE: Collapsible summary strip ── */}
          <div className="md:hidden border-b border-foreground/8 bg-background z-30 flex-shrink-0">
            <button
              onClick={() => setShowMobileSummary(s => !s)}
              className="w-full px-5 py-3.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-foreground/40" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/50">{cart.length} items</span>
                {showMobileSummary ? <ChevronUp className="w-3 h-3 text-foreground/30" /> : <ChevronDown className="w-3 h-3 text-foreground/30" />}
              </div>
              <span className="text-base font-black text-foreground tracking-tight">{formatTZS(amountDue)}</span>
            </button>

            <AnimatePresence>
              {showMobileSummary && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4 border-t border-foreground/8">
                    <div className="py-3 space-y-3 max-h-[28vh] overflow-y-auto">
                      {cart.map((item, i) => {
                        const price = getEffectiveUnitPrice(item);
                        return (
                          <div key={i} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-foreground/[0.05] flex-shrink-0">
                                <img src={item.selectedVariant?.image_url || item.images?.[0]} className="w-full h-full object-cover" alt="" />
                                <span className="absolute -top-0.5 -right-0.5 bg-foreground text-background text-[7px] font-black w-4 h-4 flex items-center justify-center rounded-full">{item.quantity}</span>
                              </div>
                              <span className="text-[10px] font-bold text-foreground/70 truncate">{item.name}</span>
                            </div>
                            <span className="text-[10px] font-black text-foreground flex-shrink-0">{formatTZS(price * item.quantity)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="pt-3 border-t border-foreground/8 space-y-1.5">
                      <div className="flex justify-between text-[9px] font-bold text-foreground/40 uppercase tracking-wider"><span>Subtotal</span><span>{formatTZS(subtotal)}</span></div>
                      <div className="flex justify-between text-[9px] font-bold text-foreground/40 uppercase tracking-wider"><span>Delivery</span><span>{areVendorsLoaded ? (effectiveDelivery === 0 && deliveryFeeTotal > 0 ? 'Free' : formatTZS(effectiveDelivery)) : '…'}</span></div>
                      {discount > 0 && <div className="flex justify-between text-[9px] font-black text-emerald-500 uppercase tracking-wider"><span className="truncate pr-2">{discountLabel || 'Discount'}</span><span>-{formatTZS(discount)}</span></div>}
                      {walletApplied > 0 && <div className="flex justify-between text-[9px] font-black text-emerald-500 uppercase tracking-wider"><span>Wallet</span><span>-{formatTZS(walletApplied)}</span></div>}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── MAIN AREA ── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 px-5 md:px-8 py-4 md:py-5 border-b border-foreground/8 flex items-center justify-between bg-background">
              <div>
                <div className="flex items-center gap-2">
                  {step === 2 && (
                    <button onClick={() => setStep(1)} className="w-7 h-7 flex items-center justify-center rounded-full bg-foreground/[0.05] hover:bg-foreground/10 transition-colors mr-1">
                      <ChevronLeft className="w-4 h-4 text-foreground" />
                    </button>
                  )}
                  <h2 className="text-[13px] font-black uppercase tracking-[0.18em] text-foreground">
                    {step === 1 ? 'Delivery' : 'Payment'}
                  </h2>
                </div>
                {/* Progress dots */}
                <div className="flex items-center gap-1.5 mt-2 ml-0.5">
                  <div className="h-[3px] w-12 rounded-full bg-foreground" />
                  <div className={`h-[3px] w-12 rounded-full transition-all duration-300 ${step === 2 ? 'bg-foreground' : 'bg-foreground/15'}`} />
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-foreground/30 ml-1">Step {step}/2</span>
                </div>
              </div>
              <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-foreground/[0.05] hover:bg-foreground/10 transition-colors flex-shrink-0">
                <X className="w-4 h-4 text-foreground/50" />
              </button>
            </div>

            {/* Scrollable form */}
            <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="p-5 md:p-8 space-y-8">

                {/* ── STEP 1: Delivery ── */}
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">

                      {/* Address */}
                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5" /> Delivery Address
                          </h3>
                          {!isAddingAddr && (
                            <button onClick={() => setIsAddingAddr(true)} className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-foreground/40 hover:text-foreground transition-colors border border-foreground/12 rounded-lg px-3 py-1.5">
                              <Plus className="w-3 h-3" /> Add New
                            </button>
                          )}
                        </div>

                        {isAddingAddr ? (
                          <AddressForm onSave={async d => { await addAddress(d); setIsAddingAddr(false); }} onCancel={() => setIsAddingAddr(false)} />
                        ) : (
                          <div className="space-y-3">
                            {addresses.length === 0 && (
                              <div className="text-center py-10 border-2 border-dashed border-foreground/10 rounded-2xl">
                                <MapPin className="w-8 h-8 mx-auto mb-3 text-foreground/20" />
                                <p className="text-[10px] font-black uppercase tracking-wider text-foreground/30">No saved addresses</p>
                                <button onClick={() => setIsAddingAddr(true)} className="mt-3 text-[9px] font-black uppercase tracking-wider text-foreground border-b border-foreground/30 pb-px">Add one now</button>
                              </div>
                            )}
                            {addresses.map(addr => (
                              <motion.div
                                key={addr.id} onClick={() => setSelectedAddress(addr)}
                                whileTap={{ scale: 0.99 }}
                                className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedAddress?.id === addr.id ? 'border-foreground bg-background shadow-lg' : 'border-foreground/8 bg-foreground/[0.02] hover:border-foreground/20'}`}
                              >
                                {selectedAddress?.id === addr.id && (
                                  <div className="absolute top-0 right-0 w-8 h-8 bg-foreground flex items-center justify-center rounded-bl-xl rounded-tr-2xl">
                                    <Check className="w-3.5 h-3.5 text-background" />
                                  </div>
                                )}
                                <div className="flex items-center gap-3 mb-2">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${addr.label.toLowerCase().includes('home') ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-500' : 'bg-foreground/[0.06] text-foreground/40'}`}>
                                    {addr.label.toLowerCase().includes('home') ? <Home className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                  </div>
                                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-foreground">{addr.label}</span>
                                  {addr.is_default && <span className="text-[8px] font-black uppercase tracking-wider bg-foreground/8 text-foreground/40 px-2 py-0.5 rounded-full">Default</span>}
                                </div>
                                <p className="text-[12px] font-bold text-foreground ml-11 leading-tight">{addr.street}</p>
                                <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-wider ml-11 mt-0.5">{addr.city}{addr.postal_code ? ` • ${addr.postal_code}` : ''}</p>
                                {addr.phone && <p className="text-[10px] text-foreground/40 font-bold ml-11 mt-0.5 font-mono">{addr.phone}</p>}
                                {addr.landmark && <p className="text-[9px] text-foreground/30 ml-11 mt-1 flex items-center gap-1"><Navigation className="w-2.5 h-2.5" />{addr.landmark}</p>}
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </section>

                      {/* Delivery Schedule */}
                      <section>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground mb-4 flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" /> Delivery Schedule
                        </h3>
                        <div className="bg-foreground/[0.03] border border-foreground/8 rounded-2xl p-4 space-y-4">
                          {/* Date picker */}
                          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
                            {nextDays.map((d, i) => {
                              const iso = d.toISOString().split('T')[0];
                              const isSelected = deliveryDate === iso;
                              return (
                                <motion.button key={i} whileTap={{ scale: 0.95 }} onClick={() => setDeliveryDate(iso)}
                                  className={`flex flex-col items-center min-w-[64px] h-[68px] rounded-xl border-2 transition-all flex-shrink-0 ${isSelected ? 'border-foreground bg-foreground text-background' : 'border-foreground/10 text-foreground/50 hover:border-foreground/25'}`}
                                >
                                  <span className="text-[8px] font-black uppercase tracking-wider mt-2">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                  <span className="text-xl font-black leading-tight">{d.getDate()}</span>
                                  <span className="text-[7px] font-bold opacity-60">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                                </motion.button>
                              );
                            })}
                          </div>
                          {/* Slot picker */}
                          <div className="grid grid-cols-2 gap-2">
                            {['Morning (8-12)', 'Afternoon (12-4)', 'Evening (4-8)', 'Standard'].map(slot => (
                              <button key={slot} onClick={() => setDeliverySlot(slot)}
                                className={`h-10 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${deliverySlot === slot ? 'bg-foreground text-background' : 'bg-foreground/[0.04] text-foreground/40 hover:bg-foreground/[0.08]'}`}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      </section>

                      {/* Gift toggle */}
                      <section>
                        <button onClick={() => setIsGift(g => !g)} className="flex items-center gap-3 w-full">
                          <div className={`w-10 h-6 rounded-full relative transition-colors ${isGift ? 'bg-foreground' : 'bg-foreground/15'}`}>
                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-background shadow-sm transform transition-transform ${isGift ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2">
                            <Gift className="w-3.5 h-3.5 text-indigo-400" /> Send as Gift
                          </span>
                        </button>
                        <AnimatePresence>
                          {isGift && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-4">
                              <textarea
                                placeholder="Write a gift message..."
                                value={giftMessage}
                                onChange={e => setGiftMessage(e.target.value)}
                                className="w-full h-24 bg-foreground/[0.03] border border-foreground/10 rounded-xl p-4 text-sm font-medium text-foreground placeholder:text-foreground/30 outline-none focus:border-foreground/25 transition-all resize-none"
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </section>
                    </motion.div>
                  )}

                  {/* ── STEP 2: Payment ── */}
                  {step === 2 && (
                    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">

                      {/* Wallet balance — hidden entirely at zero balance */}
                      {walletBalance > 0 && (
                        <section>
                          <div className={`rounded-2xl border-2 p-4 transition-all ${useWalletBalance ? 'border-emerald-500/40 bg-emerald-500/[0.06]' : 'border-foreground/8 bg-foreground/[0.02]'}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${useWalletBalance ? 'bg-emerald-500/15 text-emerald-500' : 'bg-foreground/[0.06] text-foreground/40'}`}>
                                  <Wallet className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-foreground">Use wallet balance</p>
                                  <p className="text-[10px] font-bold text-foreground/40 mt-0.5">Available: {formatTZS(walletBalance)}</p>
                                </div>
                              </div>
                              <Switch checked={useWalletBalance} onCheckedChange={setUseWalletBalance} />
                            </div>
                            <AnimatePresence>
                              {useWalletBalance && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                  <div className="mt-3 pt-3 border-t border-emerald-500/15 space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                      <span>Wallet applied</span><span>-{formatTZS(walletApplied)}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                                      <span>Remaining to pay</span><span className="text-foreground">{formatTZS(amountDue)}</span>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </section>
                      )}

                      {/* Wallet covers everything — no external payment needed */}
                      {walletCoversAll && (
                        <div className="flex items-start gap-2 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
                          <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 leading-relaxed">
                            Your wallet covers the full order — no other payment is needed. Just confirm below.
                          </p>
                        </div>
                      )}

                      {/* Payment method selector */}
                      {!walletCoversAll && (
                      <section>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground mb-4 flex items-center gap-2">
                          <Wallet className="w-3.5 h-3.5" /> Payment Method
                        </h3>
                        <div className="grid gap-3 grid-cols-3">
                          {availableMethods.map(m => (
                            <motion.button key={m.id} whileTap={m.disabled ? undefined : { scale: 0.97 }}
                              onClick={() => { if (!m.disabled) setPaymentMethod(m.id as any); }}
                              disabled={m.disabled}
                              title={m.disabled ? m.disabledReason : undefined}
                              className={`relative flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all ${
                                m.disabled
                                  ? 'border-foreground/8 bg-foreground/[0.02] opacity-45 cursor-not-allowed'
                                  : paymentMethod === m.id ? 'border-emerald-500 bg-emerald-500/[0.06]' : 'border-foreground/10 hover:border-foreground/25'}`}
                            >
                              {!m.disabled && paymentMethod === m.id && <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                              <m.icon className={`w-6 h-6 mb-2 ${!m.disabled && paymentMethod === m.id ? 'text-emerald-600' : 'text-foreground/40'}`} />
                              <p className={`text-[13px] font-black leading-tight ${!m.disabled && paymentMethod === m.id ? 'text-foreground' : 'text-foreground/70'}`}>{m.label}</p>
                              {m.disabled
                                ? <p className="text-[9px] font-semibold text-foreground/35 mt-0.5 leading-tight">Not set up</p>
                                : m.desc && <p className="text-[10px] font-semibold text-foreground/40 mt-0.5 leading-tight">{m.desc}</p>}
                            </motion.button>
                          ))}
                        </div>
                        {areVendorsLoaded && availableMethods.every(m => m.disabled || m.id === 'cash') && (
                          <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>This seller hasn't set up online payment methods yet — cash on delivery is the only option for this order.</span>
                          </div>
                        )}
                      </section>
                      )}

                      {/* Payment details panel */}
                      {!walletCoversAll && paymentMethod !== 'cash' && (
                        <section className="bg-foreground rounded-2xl overflow-hidden">
                          <div className="p-5 md:p-6">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-background/40 mb-4">Payment Channels</p>
                            <div className="space-y-3 mb-6">
                              {(Object.entries(groupedItems) as [string, CartItem[]][]).map(([sid, items]) => {
                                const seller = sellerDetails.find(s => s.seller_id === sid);
                                const itemSum = items.reduce((acc, i) => acc + getEffectiveUnitPrice(i) * i.quantity, 0);
                                const sellerTotal = itemSum + (seller?.delivery_fee || 0);
                                let payName = seller?.store_name || 'Merchant';
                                let payNumber: string | null = null;
                                let payLabel = 'Account';
                                if (paymentMethod === 'mobile_transfer') {
                                  payName = seller?.bank_account_name || seller?.store_name || 'Merchant';
                                  payNumber = seller?.account_number || null;
                                  payLabel = seller?.bank_name || 'Bank';
                                } else {
                                  if (seller?.lipa_namba) { payNumber = seller.lipa_namba; payLabel = 'Lipa Namba'; }
                                  else if (seller?.mobile_number) { payNumber = seller.mobile_number; payLabel = seller.mobile_operator || 'Mobile'; payName = seller.mobile_name || payName; }
                                }
                                return (
                                  <div key={sid} className="bg-white/10 rounded-xl p-4 flex items-center justify-between gap-3 border border-white/10">
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-bold uppercase tracking-wide text-background/55 mb-1.5">{payName} • {formatTZS(Math.round(sellerTotal))}</p>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {payNumber ? (
                                          <>
                                            <span className="text-[11px] font-black bg-emerald-500 text-white px-2.5 py-1 rounded-md uppercase tracking-wide">{payLabel}</span>
                                            <span className="font-mono font-black text-background text-lg tracking-wider">{payNumber}</span>
                                          </>
                                        ) : (
                                          <span className="text-[11px] font-bold text-background/60">
                                            Payment number not available — ask the seller via chat before paying.
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {payNumber && (
                                      <button onClick={() => { navigator.clipboard.writeText(payNumber!); addToast("Copied!", "success"); }}
                                        className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                                      >
                                        <Copy className="w-4 h-4 text-background/70" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Transaction entry */}
                            <div className="space-y-3">
                              <div className="relative">
                                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-background/30" />
                                <input
                                  placeholder="Sender Phone (e.g. 07XX XXX XXX)"
                                  value={senderPhone}
                                  onChange={e => setSenderPhone(e.target.value)}
                                  aria-label="Sender phone number"
                                  aria-invalid={senderPhone.trim().length > 0 && senderPhone.trim().length < 9}
                                  className="w-full h-11 bg-black/25 border border-white/10 rounded-xl pl-11 text-[11px] font-mono font-bold text-white placeholder:text-white/25 outline-none focus:border-white/30 transition-all"
                                />
                              </div>
                              <div className="relative">
                                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-background/30" />
                                <input
                                  placeholder="TRANSACTION ID"
                                  value={paymentRef}
                                  onChange={e => setPaymentRef(e.target.value.toUpperCase())}
                                  aria-label="Mobile money transaction ID"
                                  aria-invalid={paymentRef.trim().length > 0 && paymentRef.trim().length < 4}
                                  className="w-full h-13 bg-black/25 border border-white/15 rounded-xl pl-11 text-[12px] font-mono font-black tracking-[0.18em] text-white placeholder:text-white/20 uppercase outline-none focus:border-white/40 transition-all"
                                  style={{ height: '52px' }}
                                />
                              </div>
                              {/* Why the button is disabled — inline, not just a dead button */}
                              {(senderPhone.trim().length < 9 || paymentRef.trim().length < 4) && (
                                <p className="text-[10px] font-bold text-amber-300/90 leading-relaxed" aria-live="polite">
                                  {senderPhone.trim().length < 9 && paymentRef.trim().length < 4
                                    ? 'Enter the phone number you paid from and the transaction ID from your confirmation SMS.'
                                    : senderPhone.trim().length < 9
                                      ? 'Enter the phone number you paid from (at least 9 digits).'
                                      : 'Enter the transaction ID from your confirmation SMS (at least 4 characters).'}
                                </p>
                              )}
                            </div>
                            {sellerDetails.length === 1 && <PaymentInstructions method={paymentMethod} seller={sellerDetails[0]} />}
                          </div>
                        </section>
                      )}

                      {/* Note */}
                      <section>
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-2 block flex items-center gap-1.5">
                          <MessageSquare className="w-3 h-3" /> Driver Note
                        </label>
                        <textarea
                          placeholder="Gate code, specific directions, call before delivery..."
                          value={orderNote}
                          onChange={e => setOrderNote(e.target.value)}
                          className="w-full h-20 bg-foreground/[0.04] border border-foreground/10 rounded-xl p-4 text-sm font-medium text-foreground placeholder:text-foreground/25 outline-none focus:border-foreground/25 transition-all resize-none"
                        />
                      </section>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom spacer for action bar */}
              <div className="h-24" />
            </div>

            {/* ── Action bar ── */}
            <div
              className="flex-shrink-0 bg-background border-t border-foreground/8 px-5 md:px-8 flex gap-3"
              style={{ paddingTop: '12px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
            >
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => step === 1 ? setStep(2) : handleComplete()}
                disabled={!canProceed || isSubmitting}
                className="flex-1 h-13 rounded-xl bg-foreground text-background text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 group disabled:opacity-50 transition-opacity"
                style={{ height: '52px' }}
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : step === 1 ? (
                  <>Continue to Payment <ArrowRight className="w-4 h-4 stroke-[2] group-hover:translate-x-0.5 transition-transform" /></>
                ) : (
                  <><Lock className="w-4 h-4 stroke-[2]" />Confirm Order • {formatTZS(amountDue)}</>
                )}
              </motion.button>
            </div>
          </div>

          {/* ── DESKTOP: Receipt sidebar ── */}
          <div className="hidden md:flex w-[340px] lg:w-[380px] bg-foreground/[0.025] border-l border-foreground/8 flex-col flex-shrink-0">
            <div className="p-8 flex-1 overflow-y-auto">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-foreground/40 mb-6 flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5" /> Receipt Preview
              </p>
              <div className="space-y-4 mb-6">
                {cart.map((item, i) => {
                  const price = getEffectiveUnitPrice(item);
                  return (
                    <div key={i} className="flex gap-3 items-center group">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-foreground/[0.05] border border-foreground/8 flex-shrink-0 relative">
                        <img src={item.selectedVariant?.image_url || item.images?.[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                        <span className="absolute bottom-0 right-0 bg-foreground text-background text-[7px] px-1 py-0.5 font-black rounded-tl-md">{item.quantity}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-tight truncate text-foreground">{item.name}</p>
                        <p className="text-[9px] text-foreground/40 font-bold mt-0.5">{formatTZS(price * item.quantity)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-foreground/8 p-8 space-y-3">
              {[
                { label: 'Subtotal', value: formatTZS(subtotal) },
                { label: 'VAT (18%)', value: formatTZS(Math.round(vat)) },
                { label: 'Delivery', value: areVendorsLoaded ? (effectiveDelivery === 0 && deliveryFeeTotal > 0 ? 'Free' : formatTZS(effectiveDelivery)) : '...' },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-[10px] font-bold text-foreground/40 uppercase tracking-wider">
                  <span>{row.label}</span><span className="text-foreground/60">{row.value}</span>
                </div>
              ))}
              {discount > 0 && (
                <div className="flex justify-between text-[10px] font-black text-emerald-500 uppercase tracking-wider">
                  <span className="truncate pr-2">{discountLabel || 'Discount'}</span><span>-{formatTZS(discount)}</span>
                </div>
              )}
              {walletApplied > 0 && (
                <div className="flex justify-between text-[10px] font-black text-emerald-500 uppercase tracking-wider">
                  <span>Wallet Balance</span><span>-{formatTZS(walletApplied)}</span>
                </div>
              )}
              <div className="pt-4 border-t border-foreground/8 flex justify-between items-end">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60">Total Due</span>
                <span className="text-2xl font-black tracking-tight text-foreground leading-none">{formatTZS(amountDue)}</span>
              </div>
              <div className="flex items-center gap-2 text-[8px] font-bold text-foreground/25 uppercase tracking-wider pt-2">
                <Lock className="w-3 h-3" /> Encrypted & Secure
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
