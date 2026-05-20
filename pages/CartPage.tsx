import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  ShoppingCart, Heart, Trash2, Minus, Plus, Store, ArrowRight, 
  ShieldCheck, Tag, Info, CheckCircle2, Truck, AlertTriangle, 
  Package, ExternalLink, Zap, Gift
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

  useEffect(() => { refreshProducts(); }, []);

  useEffect(() => {
    const fetchVendors = async () => {
      const sellerIds = Array.from(new Set(cart.map(i => i.seller_id)));
      if (sellerIds.length === 0) {
        setLoadingVendors(false);
        return;
      }
      
      const { data } = await supabase
        .from('vendor_profiles')
        .select('seller_id, store_name, delivery_fee, is_verified')
        .in('seller_id', sellerIds);
        
      if (data) {
        const map: Record<string, any> = {};
        data.forEach((v: any) => { 
          map[v.seller_id] = { 
            name: v.store_name, 
            fee: Number(v.delivery_fee || 0),
            verified: v.is_verified
          }; 
        });
        setVendorMap(map);
      }
      setLoadingVendors(false);
    };
    fetchVendors();
  }, [cart]);

  // ───────────────────────────────────────────────
  // Item price with auto-apply discount (non-BOGO)
  // ───────────────────────────────────────────────
  const calculateItemPrice = (item: CartItem) => {
    const basePrice = getEffectiveUnitPrice(item);
    const activeOffer = getActiveOfferForProduct(item.id);
    
    if (activeOffer && activeOffer.is_auto_apply && activeOffer.campaign_type !== 'bogo') {
      let discountedPrice = basePrice;
      if (activeOffer.type === 'percentage') {
        discountedPrice = basePrice - (basePrice * activeOffer.value / 100);
      } else {
        discountedPrice = Math.max(0, basePrice - activeOffer.value);
      }
      return { price: Math.round(discountedPrice), originalPrice: basePrice, offer: activeOffer };
    }
    return { price: basePrice, originalPrice: null, offer: null };
  };

  // ───────────────────────────────────────────────
  // Financial calculations
  // ───────────────────────────────────────────────
  const subtotal = cart.reduce((sum, item) => {
    const { price } = calculateItemPrice(item);
    return sum + (price * item.quantity);
  }, 0);
  
  const totalVAT = cart.reduce((sum, item) => {
    const price = getEffectiveUnitPrice(item);
    const vatRate = normalizeVatRate(item.selectedVariant?.vat_rate ?? item.vat_rate ?? 0.18);
    return sum + (calculateVatIncluded(price, vatRate) * item.quantity);
  }, 0);

  const deliveryFeeTotal = Object.values(vendorMap).reduce((acc, v: any) => acc + (v.fee || 0), 0);

  // ───────────────────────────────────────────────
  // Upsell / BOGO prompts (your original logic, just safer)
  // ───────────────────────────────────────────────
  const upsellOpportunity = useMemo(() => {
    if (cart.length === 0) return null;

    for (const item of cart) {
      const itemOffer = offers.find(o => 
        o.campaign_type === 'bogo' && 
        o.status === 'active' &&
        (
          (o.target_type === 'product' && o.target_ids?.includes(item.id)) || 
          (o.target_type === 'store' && o.seller_id === item.seller_id) ||
          (o.target_type === 'category' && o.target_ids?.includes(item.category))
        )
      );

      if (itemOffer && itemOffer.buy_quantity && itemOffer.get_quantity) {
        const cycle = itemOffer.buy_quantity + itemOffer.get_quantity;
        const remainder = item.quantity % cycle;
        if (remainder === itemOffer.buy_quantity) {
          return {
            type: 'bogo',
            title: 'Free Item Unlocked!',
            msg: `You qualify for ${itemOffer.get_quantity} FREE ${item.name}! Add to bag now.`,
            action: () => updateQuantity(item.id, itemOffer.get_quantity!, item.variant_id),
            icon: Gift
          };
        }
      }
    }

    const potentialCoupons = offers.filter(o => 
      (o.target_type === 'store' || o.scope === 'platform') && 
      o.min_order_value && 
      o.min_order_value > subtotal &&
      o.status === 'active'
    );

    if (potentialCoupons.length > 0) {
      const best = potentialCoupons.sort((a,b) => (a.min_order_value! - subtotal) - (b.min_order_value! - subtotal))[0];
      const diff = best.min_order_value! - subtotal;
      if (diff < 50000) {
        return {
          type: 'spend',
          title: 'So Close!',
          msg: `Add ${formatTZS(diff)} to unlock ${best.title} (${best.code})`,
          action: () => navigate('/shop'),
          icon: Zap
        };
      }
    }

    return null;
  }, [cart, subtotal, offers, navigate, updateQuantity]);

  // ───────────────────────────────────────────────
  // Auto-apply BOGO discount
  // ───────────────────────────────────────────────
  const autoApplyDiscount = useMemo(() => {
    let totalDiscount = 0;
    const processedItems = new Set<string>();

    cart.forEach(item => {
      if (processedItems.has(item.id)) return;
      const activeOffer = getActiveOfferForProduct(item.id);
      if (activeOffer && activeOffer.is_auto_apply && activeOffer.campaign_type === 'bogo' && activeOffer.buy_quantity && activeOffer.get_quantity) {
        const { price } = calculateItemPrice(item);
        const totalSets = Math.floor(item.quantity / (activeOffer.buy_quantity + activeOffer.get_quantity));
        if (totalSets > 0) {
          totalDiscount += (totalSets * activeOffer.get_quantity * price);
        }
        processedItems.add(item.id);
      }
    });
    return totalDiscount;
  }, [cart, getActiveOfferForProduct]);

  // ───────────────────────────────────────────────
  // Manual coupon discount
  // ───────────────────────────────────────────────
  const discountAmount = appliedCoupon ? (() => {
    if (appliedCoupon.min_order_value && subtotal < appliedCoupon.min_order_value) return 0;

    if (appliedCoupon.campaign_type === 'shipping') {
      return deliveryFeeTotal;
    }

    if (appliedCoupon.campaign_type === 'bogo' && appliedCoupon.buy_quantity && appliedCoupon.get_quantity) {
      const targetItems = cart.filter(item => 
        appliedCoupon.target_type === 'store' || 
        (appliedCoupon.target_type === 'product' && appliedCoupon.target_ids?.includes(item.id)) ||
        (appliedCoupon.target_type === 'category' && appliedCoupon.target_ids?.includes(item.category))
      );
      
      let totalDiscount = 0;
      targetItems.forEach(item => {
        const { price } = calculateItemPrice(item);
        const totalSets = Math.floor(item.quantity / (appliedCoupon.buy_quantity! + appliedCoupon.get_quantity!));
        if (totalSets > 0) {
          totalDiscount += (totalSets * appliedCoupon.get_quantity! * price);
        }
      });
      return totalDiscount;
    }

    if (appliedCoupon.type === 'percentage') {
      return Math.floor((subtotal * appliedCoupon.value) / 100);
    } else if (appliedCoupon.type === 'fixed') { 
      return appliedCoupon.value; 
    }
    return 0;
  })() : 0;

  const couponDiscountOnSubtotal = (appliedCoupon && appliedCoupon.campaign_type !== 'shipping') ? discountAmount : 0;
  const shippingFee = (appliedCoupon && appliedCoupon.campaign_type === 'shipping') ? 0 : Number(deliveryFeeTotal);
  const total = Math.max(0, subtotal + shippingFee - autoApplyDiscount - couponDiscountOnSubtotal);
  const totalDiscountAmount = (() => {
    const val = autoApplyDiscount + couponDiscountOnSubtotal + (Number(deliveryFeeTotal) - shippingFee);
    console.log('totalDiscountAmount:', val, 'autoApplyDiscount:', autoApplyDiscount, 'couponDiscountOnSubtotal:', couponDiscountOnSubtotal, 'deliveryFeeTotal:', deliveryFeeTotal, 'shippingFee:', shippingFee);
    return val;
  })();

  // ───────────────────────────────────────────────
  // Group items by seller
  // ───────────────────────────────────────────────
  const groupedItems = useMemo(() => {
    const groups: Record<string, CartItem[]> = {};
    cart.forEach(item => {
      const sid = item.seller_id;
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(item);
    });
    return groups;
  }, [cart]);

  // ───────────────────────────────────────────────
  // Coupon apply handler (your original + minor safety)
  // ───────────────────────────────────────────────
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .eq('status', 'active')
        .lte('start_date', now)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .single();

      if (error || !data) throw new Error("Invalid or expired coupon code.");
      const offer = data as Offer;
      
      if (offer.min_order_value && subtotal < offer.min_order_value) throw new Error(`Order must exceed ${formatTZS(offer.min_order_value)}`);
      if (offer.max_usage && (offer.current_usage || 0) >= offer.max_usage) throw new Error("Coupon usage limit reached.");

      if (offer.campaign_type === 'bogo') {
        const hasItems = cart.some(item => 
          offer.target_type === 'store' || 
          (offer.target_type === 'product' && offer.target_ids?.includes(item.id)) ||
          (offer.target_type === 'category' && offer.target_ids?.includes(item.category))
        );
        if (!hasItems) throw new Error("Cart does not contain eligible items for this BOGO offer.");
      }
      
      setAppliedCoupon(offer);
      addToast(`Coupon ${offer.code} applied!`, "success");
    } catch (e: any) {
      setAppliedCoupon(null);
      addToast(e.message, "error");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleCheckoutClick = () => {
    if (!user) {
      addToast("Please login to secure your order", "info");
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setIsCheckoutOpen(true);
  };

  const handleCompleteOrder = async (details: { address: Address, paymentMethod: string, deliveryFee: number, note: string, paymentRef?: string, isGift?: boolean, giftMessage?: string, deliveryDate?: string, deliverySlot?: string }) => {
    try {
      const newOrder = await placeOrder({ 
        ...details, 
        vat: totalVAT, 
        subtotal: subtotal, 
        discount: totalDiscountAmount, 
        coupon: appliedCoupon 
      });
      setIsCheckoutOpen(false);
      navigate('/order-confirmation', { state: { order: newOrder } });
      addToast("Order placed successfully!", "success");
    } catch (e: any) {
      console.error(e);
      addToast(e.message || "Failed to place order.", "error");
    }
  };

  // ───────────────────────────────────────────────
  // Empty cart UI (your original)
  // ───────────────────────────────────────────────
  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-6 py-20 text-center animate-in fade-in zoom-in-95 font-sans min-h-[80vh] flex flex-col items-center justify-center">
        <div className="w-48 h-48 bg-foreground/[0.04] rounded-full flex items-center justify-center mb-8 relative group">
          <ShoppingCart className="w-16 h-16 text-foreground/20 group-hover:text-foreground/60 transition-colors duration-500" />
          <div className="absolute top-8 right-10 w-4 h-4 bg-foreground/15 rounded-full animate-bounce"></div>
        </div>
        <h2 className="text-4xl md:text-6xl font-black text-foreground mb-6 font-display tracking-tighter uppercase leading-none">Bag Empty</h2>
        <p className="text-foreground/50 mb-12 max-w-md mx-auto font-medium text-base leading-relaxed">Your collection awaits. Discover authentic artifacts from Tanzania's finest creators.</p>
        <Link to="/shop"><Button size="lg" variant="brand" className="px-12 h-16 rounded-full shadow-2xl shadow-emerald-500/20 font-black uppercase tracking-widest text-xs hover:scale-105 transition-transform">Start Collecting</Button></Link>
      </div>
    );
  }

  // ───────────────────────────────────────────────
  // Main render
  // ───────────────────────────────────────────────
  return (
    <div className="container mx-auto px-4 md:px-6 py-6 font-sans pt-24 md:pt-36 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 relative">
        
        {/* LEFT COLUMN: Items Grouped by Vendor */}
        <div className="flex-1 space-y-10">
          <div className="flex justify-between items-end pb-6 border-b border-foreground/8">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-foreground font-display uppercase tracking-tight">Shopping Bag</h1>
              <p className="text-foreground/50 text-sm font-bold mt-1 uppercase tracking-wider">{cart.length} Products selected</p>
            </div>
          </div>

          {upsellOpportunity && (
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-500/20 flex items-center justify-between gap-4 animate-in slide-in-from-top-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-background/20 backdrop-blur-md rounded-full">
                  <upsellOpportunity.icon className="w-6 h-6"/>
                </div>
                <div>
                  <h4 className="font-black uppercase tracking-wide text-sm">{upsellOpportunity.title}</h4>
                  <p className="text-xs font-medium opacity-90">{upsellOpportunity.msg}</p>
                </div>
              </div>
              <button onClick={upsellOpportunity.action} className="px-5 py-2 bg-background text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-background/90 transition-colors shadow-sm whitespace-nowrap">
                {upsellOpportunity.type === 'bogo' ? 'Add Now' : 'Shop Now'}
              </button>
            </div>
          )}

          <div className="space-y-12">
            {(Object.entries(groupedItems) as [string, CartItem[]][]).map(([sellerId, items], vendorIndex) => {
              const vendor = vendorMap[sellerId];
              return (
                <motion.div 
                  key={sellerId} 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: vendorIndex * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between px-2">
                    <Link to={`/store/${sellerId}`} className="flex items-center gap-2 text-foreground uppercase tracking-widest text-xs font-black hover:opacity-70 transition-colors">
                      <Store className="w-4 h-4 text-brand-500" />
                      <span>{vendor?.name || 'Loading Store...'}</span>
                      {vendor?.verified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />}
                    </Link>
                    <Badge variant="outline" className="text-[9px] font-bold border-brand-200 text-brand-700 bg-brand-50 dark:bg-brand-900/10 dark:border-brand-900/50">
                      Delivery: {formatTZS(vendor?.fee || 0)}
                    </Badge>
                  </div>
                  
                  <motion.div 
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={{
                      hidden: { opacity: 0 },
                      visible: {
                        opacity: 1,
                        transition: { staggerChildren: 0.05 }
                      }
                    }}
                    className="bg-background rounded-3xl border border-foreground/8 overflow-hidden shadow-sm divide-y divide-foreground/5"
                  >
                    {items.map((item, index) => {
                      const variant = item.selectedVariant;
                      const { price, originalPrice, offer } = calculateItemPrice(item);
                      const stock = variant?.stock ?? item.stock ?? 0;
                      const isStockLow = stock > 0 && stock < 5;
                      const variantLabel = variant ? Object.values(variant.attributes ?? {}).join(' / ') : null;
                      const image = variant?.image_url || item.images?.[0] || 'https://via.placeholder.com/300';

                      // Safe unique key — fixes duplicate key error
                      const itemKey = variant?.id 
                        ? `${item.id}-${variant.id}`
                        : `${item.id}-no-variant`;

                      return (
                        <motion.div 
                          key={`${itemKey}-${index}`}
                          variants={{
                            hidden: { opacity: 0, x: -10 },
                            visible: { opacity: 1, x: 0, transition: { duration: 0.4 } }
                          }}
                          className="flex flex-col sm:flex-row gap-6 p-6 group hover:bg-foreground/[0.02] transition-colors relative"
                        >
                          {/* Image */}
                          <div 
                            className="w-full sm:w-32 aspect-square rounded-[1.5rem] overflow-hidden bg-foreground/[0.06] shrink-0 border border-foreground/10 relative cursor-pointer group/img" 
                            onClick={() => setActiveProduct(item)}
                          >
                            <img 
                              src={image} 
                              alt={item.name} 
                              className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-700" 
                            />
                            {isStockLow && (
                              <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-[7px] font-black uppercase text-center py-1">
                                Low Stock
                              </div>
                            )}
                          </div>
                          
                          {/* Details */}
                          <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
                            <div className="space-y-2">
                              <div className="flex justify-between items-start">
                                <h3 
                                  className="font-bold text-sm sm:text-base text-foreground leading-tight truncate pr-4 cursor-pointer hover:text-brand-600 transition-colors uppercase" 
                                  onClick={() => setActiveProduct(item)}
                                >
                                  {item.name}
                                </h3>
                                <div className="text-right">
                                  <p className="font-black text-sm sm:text-base whitespace-nowrap">{formatTZS(price)}</p>
                                  {originalPrice && originalPrice > price && (
                                    <p className="text-[10px] text-foreground/40 line-through">
                                      {formatTZS(originalPrice)}
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider bg-foreground/[0.06] text-foreground/50">
                                  {item.category}
                                </Badge>
                                {variantLabel && (
                                  <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-foreground/10">
                                    {variantLabel}
                                  </Badge>
                                )}
                                {offer && (
                                  <Badge className={`${offer.campaign_type === 'bogo' ? 'bg-indigo-600' : 'bg-red-500'} text-white border-none text-[10px] font-black uppercase tracking-widest flex items-center gap-1`}>
                                    {offer.campaign_type === 'bogo' ? <Gift className="w-3 h-3"/> : <Zap className="w-3 h-3 fill-current"/>}
                                    {offer.title}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex justify-between items-end mt-6">
                              <div className="flex items-center gap-1 bg-foreground/[0.05] p-1 rounded-xl border border-foreground/8">
                                <button 
                                  onClick={() => updateQuantity(item.id, -1, variant?.id)} 
                                  disabled={item.quantity <= 1} 
                                  className="w-11 h-11 rounded-lg flex items-center justify-center bg-background shadow-sm hover:scale-95 transition-all disabled:opacity-50 text-foreground/60"
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="w-4 h-4"/>
                                </button>
                                <span className="text-sm font-black w-10 text-center tabular-nums">{item.quantity}</span>
                                <button 
                                  onClick={() => updateQuantity(item.id, 1, variant?.id)} 
                                  disabled={item.quantity >= stock}
                                  className="w-11 h-11 rounded-lg flex items-center justify-center bg-background shadow-sm hover:scale-95 transition-all text-foreground"
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="w-4 h-4"/>
                                </button>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-[10px] font-bold uppercase text-foreground/40">Total</p>
                                  <p className="text-sm font-black text-foreground">{formatTZS(price * item.quantity)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => {
                                      toggleWishlist(item);
                                      removeFromCart(item.id, variant?.id);
                                      addToast("Moved to wishlist", "success");
                                    }}
                                    className="w-11 h-11 flex items-center justify-center text-foreground/25 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                                    title="Save for later"
                                    aria-label="Save for later"
                                  >
                                    <Heart className="w-5 h-5"/>
                                  </button>
                                  <button 
                                    onClick={() => removeFromCart(item.id, variant?.id)} 
                                    className="w-11 h-11 flex items-center justify-center text-foreground/25 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                    title="Remove"
                                    aria-label="Remove item"
                                  >
                                    <Trash2 className="w-5 h-5"/>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Summary */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="lg:w-[420px] shrink-0 relative"
        >
          <div className="space-y-6 lg:sticky lg:top-32">
            <Card className="p-6 md:p-8 rounded-3xl bg-background border border-foreground/8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 blur-[80px] rounded-full pointer-events-none"></div>
              
              <h3 className="font-black text-lg mb-8 uppercase tracking-tight flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-brand-500" /> Order Summary
              </h3>
              
              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-xs font-bold text-foreground/50 uppercase tracking-wide">
                  <span>Subtotal</span>
                  <span className="text-foreground">{formatTZS(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-foreground/50 uppercase tracking-wide">
                  <span className="flex items-center gap-1">VAT Included <Info className="w-3 h-3"/></span>
                  <span className="text-foreground">{formatTZS(Math.round(totalVAT))}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-foreground/50 uppercase tracking-wide">
                  <span>Est. Delivery</span>
                  <span className="text-foreground">{formatTZS(Number(deliveryFeeTotal))}</span>
                </div>
                
                {autoApplyDiscount > 0 && (
                  <div className="flex justify-between text-xs font-black text-emerald-500 uppercase tracking-wide bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg">
                    <span>Auto-applied Savings</span>
                    <span>-{formatTZS(autoApplyDiscount)}</span>
                  </div>
                )}
                {couponDiscountOnSubtotal > 0 && (
                  <div className="flex justify-between text-xs font-black text-emerald-500 uppercase tracking-wide bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg">
                    <span>Coupon '{appliedCoupon?.code}'</span>
                    <span>-{formatTZS(couponDiscountOnSubtotal)}</span>
                  </div>
                )}
                {Number(deliveryFeeTotal) > shippingFee && (
                  <div className="flex justify-between text-xs font-black text-emerald-500 uppercase tracking-wide bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg">
                    <span>Free Shipping</span>
                    <span>-{formatTZS(Number(deliveryFeeTotal) - shippingFee)}</span>
                  </div>
                )}
                
                <div className="h-px bg-foreground/8 my-4"></div>
                
                <div className="flex justify-between items-end">
                  <span className="font-black text-sm uppercase text-foreground tracking-widest">Total Pay</span>
                  <div className="text-right">
                    <span className="font-black text-3xl md:text-5xl tracking-tighter text-foreground block leading-[0.9] font-display">
                      {formatTZS(Math.round(total))}
                    </span>
                    <span className="text-[9px] font-bold text-foreground/40 uppercase tracking-widest">Inclusive of all taxes</span>
                  </div>
                </div>
              </div>

              {/* Coupon Input */}
              <div className="mb-8">
                <Label className="mb-2 ml-1">Promo Code</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
                    <Input 
                      placeholder="ENTER CODE" 
                      value={couponCode} 
                      onChange={(e: any) => setCouponCode(e.target.value)} 
                      className="h-12 bg-foreground/[0.04] border-none rounded-2xl text-xs font-black uppercase tracking-widest pl-10" 
                      disabled={!!appliedCoupon} 
                    />
                  </div>
                  <Button 
                    className="h-12 w-12 p-0 rounded-2xl bg-foreground text-background shadow-lg" 
                    onClick={handleApplyCoupon} 
                    disabled={!!appliedCoupon || !couponCode} 
                    isLoading={validatingCoupon}
                  >
                    {appliedCoupon ? <CheckCircle2 className="w-5 h-5"/> : <ArrowRight className="w-5 h-5" />}
                  </Button>
                </div>
                {appliedCoupon && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-emerald-600 font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/10 py-2 rounded-xl">
                    <CheckCircle2 className="w-3 h-3"/> Coupon "{appliedCoupon.code}" Active
                  </div>
                )}
              </div>

              <Button 
                onClick={handleCheckoutClick} 
                variant="brand" 
                className="w-full h-16 text-xs font-black uppercase tracking-[0.25em] shadow-2xl shadow-emerald-500/20 rounded-2xl transition-all group"
              >
                Secure Checkout <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              
              <div className="mt-6 flex flex-col items-center gap-2">
                <div className="flex gap-3 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">M-Pesa</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">Tigo</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">Airtel</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">Bank</span>
                </div>
                <div className="flex items-center gap-2 text-[8px] font-bold text-foreground/40 uppercase tracking-widest">
                  <ShieldCheck className="w-3 h-3" /> Encrypted & Secure
                </div>
              </div>
            </Card>
          </div>
        </motion.div>
      </div>

      {isCheckoutOpen && (
        <CheckoutModal 
          total={total} 
          subtotal={subtotal} 
          vat={totalVAT} 
          discount={totalDiscountAmount} 
          onClose={() => setIsCheckoutOpen(false)} 
          onComplete={handleCompleteOrder} 
        />
      )}
      
      {activeProduct && (
        <ProductModal 
          product={activeProduct} 
          isOpen={!!activeProduct}
          onClose={() => setActiveProduct(null)} 
        />
      )}
    </div>
  );
};