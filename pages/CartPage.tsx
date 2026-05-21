import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Heart, Trash2, Minus, Plus, Store, ArrowRight,
  ShieldCheck, Tag, Info, CheckCircle2, Truck, AlertTriangle,
  Package, Zap, Gift, ChevronRight, X, Sparkles, Lock
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppState } from '../context/AppContext';
import { Button, Input, Badge, useToast, Card, Label, Skeleton } from '../components/UI';
import { CheckoutModal } from '../components/CheckoutComponents';
import { ProductModal } from '../components/ProductModal';
import { CURRENCY, formatTZS, getEffectiveUnitPrice, calculateVatIncluded, normalizeVatRate } from '../constants';
import { Product, Offer, Address, CartItem } from '../types';
import { supabase } from '../services/supabaseClient';

export const CartPage = () => {
  const {
    cart, removeFromCart, updateQuantity, placeOrder, user,
    refreshProducts, addToCart, toggleWishlist, wishlist, offers, getActiveOfferForProduct
  } = useAppState();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [vendorMap, setVendorMap] = useState<Record<string, { name: string, fee: number, verified: boolean }>>({});
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Offer | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponFocused, setCouponFocused] = useState(false);

  useEffect(() => { refreshProducts(); }, []);

  useEffect(() => {
    const fetchVendors = async () => {
      const sellerIds = Array.from(new Set(cart.map(i => i.seller_id)));
      if (!sellerIds.length) { setLoadingVendors(false); return; }
      const { data } = await supabase.from('vendor_profiles').select('seller_id, store_name, delivery_fee, is_verified').in('seller_id', sellerIds);
      if (data) {
        const map: Record<string, any> = {};
        data.forEach((v: any) => { map[v.seller_id] = { name: v.store_name, fee: Number(v.delivery_fee || 0), verified: v.is_verified }; });
        setVendorMap(map);
      }
      setLoadingVendors(false);
    };
    fetchVendors();
  }, [cart]);

  const calculateItemPrice = (item: CartItem) => {
    const basePrice = getEffectiveUnitPrice(item);
    const activeOffer = getActiveOfferForProduct(item.id);
    if (activeOffer?.is_auto_apply && activeOffer.campaign_type !== 'bogo') {
      let dp = basePrice;
      if (activeOffer.type === 'percentage') dp = basePrice - (basePrice * activeOffer.value / 100);
      else dp = Math.max(0, basePrice - activeOffer.value);
      return { price: Math.round(dp), originalPrice: basePrice, offer: activeOffer };
    }
    return { price: basePrice, originalPrice: null, offer: null };
  };

  const subtotal = cart.reduce((sum, item) => sum + calculateItemPrice(item).price * item.quantity, 0);
  const totalVAT = cart.reduce((sum, item) => {
    const price = getEffectiveUnitPrice(item);
    const vatRate = normalizeVatRate(item.selectedVariant?.vat_rate ?? item.vat_rate ?? 0.18);
    return sum + (calculateVatIncluded(price, vatRate) * item.quantity);
  }, 0);
  const deliveryFeeTotal = Object.values(vendorMap).reduce((acc, v: any) => acc + (v.fee || 0), 0);

  const upsellOpportunity = useMemo(() => {
    if (!cart.length) return null;
    for (const item of cart) {
      const itemOffer = offers.find(o =>
        o.campaign_type === 'bogo' && o.status === 'active' &&
        ((o.target_type === 'product' && o.target_ids?.includes(item.id)) ||
          (o.target_type === 'store' && o.seller_id === item.seller_id) ||
          (o.target_type === 'category' && o.target_ids?.includes(item.category)))
      );
      if (itemOffer?.buy_quantity && itemOffer.get_quantity) {
        const cycle = itemOffer.buy_quantity + itemOffer.get_quantity;
        if (item.quantity % cycle === itemOffer.buy_quantity) {
          return { type: 'bogo', title: 'Free Item Unlocked!', msg: `Add ${itemOffer.get_quantity} FREE ${item.name}`, action: () => updateQuantity(item.id, itemOffer.get_quantity!, item.variant_id), icon: Gift };
        }
      }
    }
    const potentialCoupons = offers.filter(o => (o.target_type === 'store' || o.scope === 'platform') && o.min_order_value && o.min_order_value > subtotal && o.status === 'active');
    if (potentialCoupons.length) {
      const best = potentialCoupons.sort((a, b) => (a.min_order_value! - subtotal) - (b.min_order_value! - subtotal))[0];
      const diff = best.min_order_value! - subtotal;
      if (diff < 50000) return { type: 'spend', title: 'Almost There!', msg: `Add ${formatTZS(diff)} to unlock ${best.title}`, action: () => navigate('/shop'), icon: Zap };
    }
    return null;
  }, [cart, subtotal, offers, navigate, updateQuantity]);

  const autoApplyDiscount = useMemo(() => {
    let total = 0;
    const processed = new Set<string>();
    cart.forEach(item => {
      if (processed.has(item.id)) return;
      const offer = getActiveOfferForProduct(item.id);
      if (offer?.is_auto_apply && offer.campaign_type === 'bogo' && offer.buy_quantity && offer.get_quantity) {
        const { price } = calculateItemPrice(item);
        const sets = Math.floor(item.quantity / (offer.buy_quantity + offer.get_quantity));
        if (sets > 0) total += sets * offer.get_quantity * price;
        processed.add(item.id);
      }
    });
    return total;
  }, [cart, getActiveOfferForProduct]);

  const discountAmount = appliedCoupon ? (() => {
    if (appliedCoupon.min_order_value && subtotal < appliedCoupon.min_order_value) return 0;
    if (appliedCoupon.campaign_type === 'shipping') return deliveryFeeTotal;
    if (appliedCoupon.campaign_type === 'bogo' && appliedCoupon.buy_quantity && appliedCoupon.get_quantity) {
      let d = 0;
      cart.filter(item => appliedCoupon.target_type === 'store' || (appliedCoupon.target_type === 'product' && appliedCoupon.target_ids?.includes(item.id)) || (appliedCoupon.target_type === 'category' && appliedCoupon.target_ids?.includes(item.category))).forEach(item => {
        const { price } = calculateItemPrice(item);
        const sets = Math.floor(item.quantity / (appliedCoupon.buy_quantity! + appliedCoupon.get_quantity!));
        if (sets > 0) d += sets * appliedCoupon.get_quantity! * price;
      });
      return d;
    }
    if (appliedCoupon.type === 'percentage') return Math.floor((subtotal * appliedCoupon.value) / 100);
    if (appliedCoupon.type === 'fixed') return appliedCoupon.value;
    return 0;
  })() : 0;

  const couponDiscountOnSubtotal = (appliedCoupon && appliedCoupon.campaign_type !== 'shipping') ? discountAmount : 0;
  const shippingFee = (appliedCoupon && appliedCoupon.campaign_type === 'shipping') ? 0 : Number(deliveryFeeTotal);
  const total = Math.max(0, subtotal + shippingFee - autoApplyDiscount - couponDiscountOnSubtotal);
  const totalDiscountAmount = autoApplyDiscount + couponDiscountOnSubtotal + (Number(deliveryFeeTotal) - shippingFee);

  const groupedItems = useMemo(() => {
    const groups: Record<string, CartItem[]> = {};
    cart.forEach(item => { if (!groups[item.seller_id]) groups[item.seller_id] = []; groups[item.seller_id].push(item); });
    return groups;
  }, [cart]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase.from('offers').select('*').eq('code', couponCode.toUpperCase()).eq('status', 'active').lte('start_date', now).or(`end_date.is.null,end_date.gte.${now}`).single();
      if (error || !data) throw new Error("Invalid or expired coupon code.");
      const offer = data as Offer;
      if (offer.min_order_value && subtotal < offer.min_order_value) throw new Error(`Order must exceed ${formatTZS(offer.min_order_value)}`);
      if (offer.max_usage && (offer.current_usage || 0) >= offer.max_usage) throw new Error("Coupon usage limit reached.");
      if (offer.campaign_type === 'bogo') {
        const hasItems = cart.some(item => offer.target_type === 'store' || (offer.target_type === 'product' && offer.target_ids?.includes(item.id)) || (offer.target_type === 'category' && offer.target_ids?.includes(item.category)));
        if (!hasItems) throw new Error("Cart does not contain eligible items.");
      }
      setAppliedCoupon(offer);
      addToast(`Coupon ${offer.code} applied!`, "success");
    } catch (e: any) { setAppliedCoupon(null); addToast(e.message, "error"); }
    finally { setValidatingCoupon(false); }
  };

  const handleCheckoutClick = () => {
    if (!user) { addToast("Please login to checkout", "info"); navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`); return; }
    setIsCheckoutOpen(true);
  };

  const handleCompleteOrder = async (details: { address: Address, paymentMethod: string, deliveryFee: number, note: string, paymentRef?: string, isGift?: boolean, giftMessage?: string, deliveryDate?: string, deliverySlot?: string }) => {
    try {
      const newOrder = await placeOrder({ ...details, vat: totalVAT, subtotal, discount: totalDiscountAmount, coupon: appliedCoupon });
      setIsCheckoutOpen(false);
      navigate('/order-confirmation', { state: { order: newOrder } });
      addToast("Order placed successfully!", "success");
    } catch (e: any) { addToast(e.message || "Failed to place order.", "error"); }
  };

  // ── Empty state ──
  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center pt-20 pb-32">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <div className="w-24 h-24 rounded-full border-2 border-foreground/10 flex items-center justify-center mx-auto mb-8">
            <ShoppingCart className="w-10 h-10 stroke-[1] text-foreground/30" />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tight text-foreground mb-3">Bag Empty</h2>
          <p className="text-foreground/40 text-sm font-medium mb-8 max-w-xs mx-auto leading-relaxed">Your bag is waiting. Discover products from Tanzania's finest vendors.</p>
          <Link to="/shop">
            <motion.button whileTap={{ scale: 0.97 }} className="h-12 px-8 bg-foreground text-background rounded-xl text-[10px] font-black uppercase tracking-[0.2em]">
              Start Shopping
            </motion.button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans" style={{ paddingTop: 'max(80px, env(safe-area-inset-top) + 64px)' }}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-32 md:pb-20">

        {/* ── Page header ── */}
        <div className="py-6 md:py-10 border-b border-foreground/8 mb-6 md:mb-10">
          <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-foreground">Shopping Bag</h1>
          <p className="text-foreground/40 text-[11px] uppercase tracking-[0.2em] font-bold mt-1">{cart.length} {cart.length === 1 ? 'item' : 'items'} selected</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-12">

          {/* ── LEFT: Items ── */}
          <div className="flex-1 space-y-6">

            {/* Upsell banner */}
            <AnimatePresence>
              {upsellOpportunity && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-foreground/10 bg-foreground/[0.03]"
                >
                  <div className="w-9 h-9 rounded-xl bg-foreground flex items-center justify-center flex-shrink-0">
                    <upsellOpportunity.icon className="w-4 h-4 text-background" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-foreground">{upsellOpportunity.title}</p>
                    <p className="text-[9px] text-foreground/50 font-bold mt-0.5 truncate">{upsellOpportunity.msg}</p>
                  </div>
                  <button onClick={upsellOpportunity.action} className="flex-shrink-0 text-[9px] font-black uppercase tracking-[0.15em] text-foreground border-b border-foreground/30 hover:border-foreground pb-px transition-colors">
                    {upsellOpportunity.type === 'bogo' ? 'Add' : 'Shop'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Vendor groups */}
            {(Object.entries(groupedItems) as [string, CartItem[]][]).map(([sellerId, items], vi) => {
              const vendor = vendorMap[sellerId];
              return (
                <motion.div
                  key={sellerId}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: vi * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Vendor header */}
                  <div className="flex items-center justify-between px-1 mb-3">
                    <Link to={`/store/${sellerId}`} className="flex items-center gap-2 text-foreground hover:opacity-70 transition-opacity">
                      <Store className="w-3.5 h-3.5 text-foreground/40" />
                      <span className="text-[10px] font-black uppercase tracking-[0.18em]">
                        {loadingVendors ? '...' : (vendor?.name || 'Unknown Store')}
                      </span>
                      {vendor?.verified && <CheckCircle2 className="w-3 h-3 text-blue-500" />}
                    </Link>
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-foreground/40">
                      <Truck className="w-3 h-3" />
                      {loadingVendors ? '...' : formatTZS(vendor?.fee || 0)} delivery
                    </div>
                  </div>

                  {/* Items card */}
                  <div className="rounded-2xl border border-foreground/8 overflow-hidden divide-y divide-foreground/5 bg-background">
                    {items.map((item, itemIdx) => {
                      const variant = item.selectedVariant;
                      const { price, originalPrice, offer } = calculateItemPrice(item);
                      const stock = variant?.stock ?? item.stock ?? 0;
                      const isLowStock = stock > 0 && stock < 5;
                      const variantLabel = variant ? Object.values(variant.attributes ?? {}).join(' / ') : null;
                      const image = variant?.image_url || item.images?.[0] || 'https://via.placeholder.com/300';
                      const itemKey = variant?.id ? `${item.id}-${variant.id}` : `${item.id}-${itemIdx}`;

                      return (
                        <div key={itemKey} className="flex gap-4 p-4 md:p-5 group hover:bg-foreground/[0.015] transition-colors">
                          {/* Image */}
                          <div
                            className="w-20 h-24 md:w-24 md:h-28 rounded-xl overflow-hidden bg-foreground/[0.04] flex-shrink-0 border border-foreground/8 relative cursor-pointer"
                            onClick={() => setActiveProduct(item)}
                          >
                            <img src={image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            {isLowStock && (
                              <div className="absolute bottom-0 left-0 right-0 bg-amber-500 text-white text-[7px] font-black uppercase text-center py-0.5">
                                {stock} left
                              </div>
                            )}
                            {offer && (
                              <div className="absolute top-1.5 left-1.5 bg-foreground text-background text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md">
                                DEAL
                              </div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <button onClick={() => setActiveProduct(item)} className="text-left">
                                  <h3 className="font-black text-[13px] md:text-sm text-foreground uppercase tracking-tight line-clamp-2 leading-tight hover:opacity-70 transition-opacity">
                                    {item.name}
                                  </h3>
                                </button>
                                <div className="flex-shrink-0 flex items-center gap-1">
                                  <div className="text-right">
                                    <p className="font-black text-[13px] md:text-sm text-foreground whitespace-nowrap">{formatTZS(price)}</p>
                                    {originalPrice && originalPrice > price && (
                                      <p className="text-[9px] text-foreground/30 line-through">{formatTZS(originalPrice)}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {(variantLabel || item.category) && (
                                  <span className="text-[8px] font-black uppercase tracking-[0.15em] text-foreground/40 bg-foreground/[0.05] px-2 py-0.5 rounded-md">
                                    {variantLabel || item.category}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions row */}
                            <div className="flex items-end justify-between mt-3 gap-2">
                              {/* Stepper */}
                              <div className="flex items-center border border-foreground/12 rounded-lg overflow-hidden">
                                <button onClick={() => updateQuantity(item.id, -1, variant?.id)} disabled={item.quantity <= 1} className="w-9 h-9 flex items-center justify-center text-foreground/50 hover:bg-foreground/[0.06] disabled:opacity-30 transition-colors" aria-label="Decrease">
                                  <Minus className="w-3 h-3 stroke-[2]" />
                                </button>
                                <span className="w-8 text-center text-[11px] font-black text-foreground select-none">{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.id, 1, variant?.id)} disabled={item.quantity >= stock} className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-foreground/[0.06] disabled:opacity-30 transition-colors" aria-label="Increase">
                                  <Plus className="w-3 h-3 stroke-[2]" />
                                </button>
                              </div>

                              {/* Right actions */}
                              <div className="flex items-center gap-1">
                                <p className="text-[10px] font-black text-foreground/40 mr-2 hidden sm:block">{formatTZS(price * item.quantity)}</p>
                                <button
                                  onClick={() => { toggleWishlist(item); removeFromCart(item.id, variant?.id); addToast("Saved for later", "success"); }}
                                  className="w-9 h-9 flex items-center justify-center rounded-lg text-foreground/25 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                                  aria-label="Save for later"
                                >
                                  <Heart className="w-4 h-4 stroke-[1.5]" />
                                </button>
                                <button
                                  onClick={() => removeFromCart(item.id, variant?.id)}
                                  className="w-9 h-9 flex items-center justify-center rounded-lg text-foreground/25 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                  aria-label="Remove"
                                >
                                  <Trash2 className="w-4 h-4 stroke-[1.5]" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* ── RIGHT: Summary ── */}
          <div className="lg:w-[380px] xl:w-[420px] shrink-0">
            <div className="lg:sticky lg:top-24 space-y-4">

              {/* Summary card */}
              <div className="rounded-2xl border border-foreground/10 bg-background overflow-hidden">
                <div className="p-5 border-b border-foreground/8">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> Order Summary
                  </h3>
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex justify-between text-[11px] font-bold text-foreground/50">
                    <span className="uppercase tracking-wider">Subtotal ({cart.length} items)</span>
                    <span className="text-foreground font-black">{formatTZS(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold text-foreground/50">
                    <span className="uppercase tracking-wider flex items-center gap-1">VAT <Info className="w-3 h-3" /></span>
                    <span className="text-foreground/60">{formatTZS(Math.round(totalVAT))}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold text-foreground/50">
                    <span className="uppercase tracking-wider">Delivery</span>
                    <span className="text-foreground/60">{loadingVendors ? '...' : formatTZS(deliveryFeeTotal)}</span>
                  </div>

                  {autoApplyDiscount > 0 && (
                    <div className="flex justify-between text-[11px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/15 px-2.5 py-2 rounded-lg">
                      <span className="uppercase tracking-wider">Auto Savings</span>
                      <span>-{formatTZS(autoApplyDiscount)}</span>
                    </div>
                  )}
                  {couponDiscountOnSubtotal > 0 && (
                    <div className="flex justify-between text-[11px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/15 px-2.5 py-2 rounded-lg">
                      <span className="uppercase tracking-wider">"{appliedCoupon?.code}"</span>
                      <span>-{formatTZS(couponDiscountOnSubtotal)}</span>
                    </div>
                  )}

                  <div className="border-t border-foreground/8 pt-3 flex justify-between items-end">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/50">Total Pay</span>
                    <div className="text-right">
                      <p className="text-2xl md:text-3xl font-black tracking-tight text-foreground leading-none">{formatTZS(Math.round(total))}</p>
                      <p className="text-[8px] font-bold text-foreground/30 uppercase tracking-wider mt-0.5">All taxes included</p>
                    </div>
                  </div>
                </div>

                {/* Coupon */}
                <div className="px-5 pb-5">
                  <div className={`flex gap-2 border rounded-xl overflow-hidden transition-all ${couponFocused ? 'border-foreground/40' : 'border-foreground/12'}`}>
                    <div className="flex items-center pl-4">
                      <Tag className="w-3.5 h-3.5 text-foreground/30" />
                    </div>
                    <input
                      placeholder="PROMO CODE"
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value)}
                      onFocus={() => setCouponFocused(true)}
                      onBlur={() => setCouponFocused(false)}
                      onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                      disabled={!!appliedCoupon}
                      className="flex-1 h-11 bg-transparent text-[11px] font-black uppercase tracking-[0.15em] outline-none text-foreground placeholder:text-foreground/25 disabled:opacity-50 min-w-0"
                    />
                    {appliedCoupon ? (
                      <button onClick={() => setAppliedCoupon(null)} className="h-11 px-4 text-[9px] font-black uppercase text-foreground/40 hover:text-red-500 transition-colors flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={handleApplyCoupon}
                        disabled={!couponCode.trim() || validatingCoupon}
                        className="h-11 px-4 bg-foreground text-background text-[9px] font-black uppercase tracking-[0.12em] flex-shrink-0 disabled:opacity-30 transition-opacity"
                      >
                        {validatingCoupon ? '...' : 'Apply'}
                      </button>
                    )}
                  </div>
                  {appliedCoupon && (
                    <div className="flex items-center gap-2 mt-2 text-[9px] font-black uppercase tracking-wider text-emerald-500">
                      <CheckCircle2 className="w-3 h-3" /> Coupon active
                    </div>
                  )}
                </div>

                {/* CTA */}
                <div className="px-5 pb-5">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCheckoutClick}
                    className="w-full h-14 bg-foreground text-background rounded-xl text-[10px] font-black uppercase tracking-[0.22em] flex items-center justify-center gap-2 group"
                  >
                    <Lock className="w-3.5 h-3.5 stroke-[2]" />
                    Secure Checkout
                    <ArrowRight className="w-4 h-4 stroke-[2] group-hover:translate-x-0.5 transition-transform" />
                  </motion.button>

                  {/* Trust badges */}
                  <div className="mt-4 flex items-center justify-center gap-4 text-[8px] font-black uppercase tracking-[0.15em] text-foreground/30">
                    <span className="flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" />M-Pesa</span>
                    <span className="w-px h-3 bg-foreground/15" />
                    <span>Tigo</span>
                    <span className="w-px h-3 bg-foreground/15" />
                    <span>Airtel</span>
                    <span className="w-px h-3 bg-foreground/15" />
                    <span>Bank</span>
                  </div>
                </div>
              </div>

              {/* Secure note */}
              <div className="flex items-center gap-2 px-2 text-[9px] font-bold text-foreground/30 uppercase tracking-wider">
                <Lock className="w-3 h-3" />
                256-bit encrypted checkout
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile sticky checkout bar ── */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-foreground/8 px-4 flex items-center gap-3"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))', paddingTop: '12px' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[8px] uppercase tracking-[0.18em] font-black text-foreground/40">Total</p>
          <p className="text-base font-black text-foreground leading-tight">{formatTZS(Math.round(total))}</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleCheckoutClick}
          className="h-12 px-6 bg-foreground text-background rounded-xl text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 flex-shrink-0"
        >
          <Lock className="w-3 h-3 stroke-[2]" />
          Checkout
        </motion.button>
      </div>

      {isCheckoutOpen && (
        <CheckoutModal total={total} subtotal={subtotal} vat={totalVAT} discount={totalDiscountAmount} onClose={() => setIsCheckoutOpen(false)} onComplete={handleCompleteOrder} />
      )}
      {activeProduct && (
        <ProductModal product={activeProduct} isOpen={!!activeProduct} onClose={() => setActiveProduct(null)} />
      )}
    </div>
  );
};
