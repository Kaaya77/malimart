import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Gift, Zap } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppState } from '../context/AppContext';
import { useToast, CountBadge } from '../components/UI';
import { CURRENCY, formatTZS, getEffectiveUnitPrice, calculateVatIncluded, normalizeVatRate } from '../constants';
import { Product, Offer, Address, CartItem } from '../types';
import { fetchVendorProfiles, fetchActiveOfferByCode } from '../services/shopService';
import { useCartTotals } from '../hooks/useCartTotals';
import { UpsellBanner } from '../components/cart/UpsellBanner';
import { VendorGroup } from '../components/cart/VendorGroup';
import { OrderSummary } from '../components/cart/OrderSummary';
import { UndoBar } from '../components/cart/UndoBar';
import { AbandonmentModal } from '../components/cart/AbandonmentModal';
import { CartSkeleton } from '../components/cart/CartSkeleton';
import { EmptyState } from '../components/ui/EmptyState';

export const CartPage = () => {
  const {
    cart, removeFromCart, updateQuantity, placeOrder, user,
    refreshProducts, addToCart, toggleWishlist, wishlist, offers, getActiveOfferForProduct,
  } = useAppState();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [vendorMap, setVendorMap] = useState<Record<string, { name: string; fee: number; verified: boolean }>>({});
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Offer | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [lastRemoved, setLastRemoved] = useState<CartItem | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Warn on browser close when cart has items
  useEffect(() => {
    if (cart.length < 2) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [cart.length]);

  // Show abandonment modal after 90s of inactivity
  useEffect(() => {
    if (cart.length < 2) return;
    const t = setTimeout(() => setShowAbandonModal(true), 90_000);
    return () => clearTimeout(t);
  }, [cart.length]);

  useEffect(() => { refreshProducts(); }, [refreshProducts]);

  useEffect(() => {
    let cancelled = false;
    const fetchVendors = async () => {
      const sellerIds = Array.from(new Set(cart.map(i => i.seller_id).filter(Boolean)));
      if (sellerIds.length === 0) { setLoadingVendors(false); return; }
      // Buyers can't read the base vendor_profiles table (RLS: owner/admin only) —
      // go through the public_vendor_profiles view via the shop service.
      const profiles = await fetchVendorProfiles(sellerIds);
      if (cancelled) return;
      const map: Record<string, { name: string; fee: number; verified: boolean }> = {};
      sellerIds.forEach(sid => {
        const p = profiles[sid];
        // Fall back to the seller name embedded on the cart item so the group
        // header never sticks on a loading label if the profile is missing.
        const fallbackName = cart.find(i => i.seller_id === sid)?.seller_name || 'MaliMart Seller';
        map[sid] = p
          ? { name: p.store_name || fallbackName, fee: Number(p.delivery_fee || 0), verified: !!p.is_verified }
          : { name: fallbackName, fee: 0, verified: false };
      });
      setVendorMap(map);
      setLoadingVendors(false);
    };
    fetchVendors();
    return () => { cancelled = true; };
  }, [cart]);

  const handleRemove = (item: CartItem, variantId?: string) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    removeFromCart(item.id, variantId);
    setLastRemoved(item);
    undoTimerRef.current = setTimeout(() => setLastRemoved(null), 5000);
  };

  const handleUndoRemove = () => {
    if (!lastRemoved) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    addToCart(lastRemoved as unknown as Product, lastRemoved.selectedVariant, lastRemoved.quantity);
    setLastRemoved(null);
  };

  const handleSaveForLater = (item: CartItem, variantId?: string) => {
    toggleWishlist(item);
    handleRemove(item, variantId);
    addToast('Saved to wishlist', 'success');
  };

  // ── Item price with auto-apply discount (non-BOGO) ───────────────────────
  const calculateItemPrice = (item: CartItem) => {
    const basePrice = getEffectiveUnitPrice(item);
    const activeOffer = getActiveOfferForProduct(item.id);
    if (activeOffer && activeOffer.is_auto_apply && activeOffer.campaign_type !== 'bogo') {
      const discountedPrice = activeOffer.type === 'percentage'
        ? basePrice - (basePrice * activeOffer.value / 100)
        : Math.max(0, basePrice - activeOffer.value);
      return { price: Math.round(discountedPrice), originalPrice: basePrice, offer: activeOffer };
    }
    return { price: basePrice, originalPrice: null, offer: null };
  };

  // ── Financial calculations ───────────────────────────────────────────────
  const subtotal = cart.reduce((sum, item) => sum + (calculateItemPrice(item).price * item.quantity), 0);

  const localVAT = cart.reduce((sum, item) => {
    const price = getEffectiveUnitPrice(item);
    const vatRate = normalizeVatRate(item.selectedVariant?.vat_rate ?? item.vat_rate ?? 0.18);
    return sum + (calculateVatIncluded(price, vatRate) * item.quantity);
  }, 0);

  const deliveryFeeTotal = Object.values(vendorMap).reduce((acc, v: any) => acc + (v.fee || 0), 0);

  const upsellOpportunity = useMemo(() => {
    if (cart.length === 0) return null;
    for (const item of cart) {
      const itemOffer = offers.find(o =>
        o.campaign_type === 'bogo' && o.status === 'active' &&
        ((o.target_type === 'product' && o.target_ids?.includes(item.id)) ||
         (o.target_type === 'store' && o.seller_id === item.seller_id) ||
         (o.target_type === 'category' && o.target_ids?.includes(item.category)))
      );
      if (itemOffer?.buy_quantity && itemOffer?.get_quantity) {
        const cycle = itemOffer.buy_quantity + itemOffer.get_quantity;
        if (item.quantity % cycle === itemOffer.buy_quantity) {
          return {
            type: 'bogo' as const,
            title: 'Free Item Unlocked!',
            msg: `You qualify for ${itemOffer.get_quantity} FREE ${item.name}!`,
            action: () => updateQuantity(item.id, itemOffer.get_quantity!, item.variant_id),
            icon: Gift,
          };
        }
      }
    }
    const best = offers
      .filter(o => (o.target_type === 'store' || o.scope === 'platform') && o.min_order_value && o.min_order_value > subtotal && o.status === 'active')
      .sort((a, b) => (a.min_order_value! - subtotal) - (b.min_order_value! - subtotal))[0];
    if (best && best.min_order_value! - subtotal < 50000) {
      return {
        type: 'spend' as const,
        title: 'So Close!',
        msg: `Add ${formatTZS(best.min_order_value! - subtotal)} to unlock ${best.title} (${best.code})`,
        action: () => navigate('/shop'),
        icon: Zap,
      };
    }
    return null;
  }, [cart, subtotal, offers, navigate, updateQuantity]);

  const autoApplyDiscount = useMemo(() => {
    let total = 0;
    const seen = new Set<string>();
    cart.forEach(item => {
      if (seen.has(item.id)) return;
      const activeOffer = getActiveOfferForProduct(item.id);
      if (activeOffer?.is_auto_apply && activeOffer.campaign_type === 'bogo' && activeOffer.buy_quantity && activeOffer.get_quantity) {
        const { price } = calculateItemPrice(item);
        const sets = Math.floor(item.quantity / (activeOffer.buy_quantity + activeOffer.get_quantity));
        if (sets > 0) total += sets * activeOffer.get_quantity * price;
        seen.add(item.id);
      }
    });
    return total;
  }, [cart, getActiveOfferForProduct]);

  const discountAmount = appliedCoupon ? (() => {
    if (appliedCoupon.min_order_value && subtotal < appliedCoupon.min_order_value) return 0;
    if (appliedCoupon.campaign_type === 'shipping') return deliveryFeeTotal;
    if (appliedCoupon.campaign_type === 'bogo' && appliedCoupon.buy_quantity && appliedCoupon.get_quantity) {
      return cart
        .filter(item =>
          appliedCoupon.target_type === 'store' ||
          (appliedCoupon.target_type === 'product' && appliedCoupon.target_ids?.includes(item.id)) ||
          (appliedCoupon.target_type === 'category' && appliedCoupon.target_ids?.includes(item.category))
        )
        .reduce((d, item) => {
          const { price } = calculateItemPrice(item);
          const sets = Math.floor(item.quantity / (appliedCoupon.buy_quantity! + appliedCoupon.get_quantity!));
          return d + (sets > 0 ? sets * appliedCoupon.get_quantity! * price : 0);
        }, 0);
    }
    if (appliedCoupon.type === 'percentage') return Math.floor((subtotal * appliedCoupon.value) / 100);
    if (appliedCoupon.type === 'fixed') return appliedCoupon.value;
    return 0;
  })() : 0;

  const couponDiscountOnSubtotal = (appliedCoupon && appliedCoupon.campaign_type !== 'shipping') ? discountAmount : 0;
  const shippingFee = (appliedCoupon && appliedCoupon.campaign_type === 'shipping') ? 0 : Number(deliveryFeeTotal);
  const localTotal = Math.max(0, subtotal + shippingFee - autoApplyDiscount - couponDiscountOnSubtotal);
  const totalDiscountAmount = autoApplyDiscount + couponDiscountOnSubtotal + (Number(deliveryFeeTotal) - shippingFee);

  const cartTotalsItems = useMemo(
    () => cart.map((i: any) => ({ product_id: i.id, variant_id: i.variant_id || null, quantity: i.quantity })),
    [cart]
  );
  const { totals: srvTotals, loading: totalsLoading } = useCartTotals({
    items: cartTotalsItems,
    deliveryFee: Number(deliveryFeeTotal),
    couponCode: appliedCoupon?.code ?? null,
  });
  const totalVAT = totalsLoading ? localVAT : srvTotals.vat_amount;
  // Show the server-authoritative total (matches what checkout charges);
  // fall back to the local estimate only while the server figure is loading.
  const total = totalsLoading ? localTotal : srvTotals.total;

  const groupedItems = useMemo(() => {
    const groups: Record<string, CartItem[]> = {};
    cart.forEach(item => {
      const sid = item.seller_id;
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(item);
    });
    return groups;
  }, [cart]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    try {
      const data = await fetchActiveOfferByCode(couponCode.toUpperCase());
      if (!data) throw new Error('Invalid or expired coupon code.');
      const offer = data as Offer;
      if (offer.min_order_value && subtotal < offer.min_order_value) throw new Error(`Order must exceed ${formatTZS(offer.min_order_value)}`);
      if (offer.max_usage && (offer.current_usage || 0) >= offer.max_usage) throw new Error('Coupon usage limit reached.');
      if (offer.campaign_type === 'bogo') {
        const hasItems = cart.some(item =>
          offer.target_type === 'store' ||
          (offer.target_type === 'product' && offer.target_ids?.includes(item.id)) ||
          (offer.target_type === 'category' && offer.target_ids?.includes(item.category))
        );
        if (!hasItems) throw new Error('Cart does not contain eligible items for this BOGO offer.');
      }
      setAppliedCoupon(offer);
      addToast(`Coupon ${offer.code} applied!`, 'success');
    } catch (e: any) {
      setAppliedCoupon(null);
      addToast(e.message, 'error');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleCheckoutClick = () => {
    if (!user) {
      addToast('Please login to secure your order', 'info');
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    navigate('/checkout', { state: { total, subtotal, vat: totalVAT, discount: totalDiscountAmount, couponCode: appliedCoupon?.code ?? null } });
  };

  if (loadingVendors && cart.length > 0) return <CartSkeleton />;

  // ── Empty state ──────────────────────────────────────────────────────────
  if (cart.length === 0) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <EmptyState
          icon="cart"
          title="Your bag is empty"
          description="Your collection awaits. Discover authentic artifacts from Tanzania's finest creators."
          action={{ label: 'Start Shopping', onClick: () => navigate('/shop') }}
        />
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <>
      <div className="container mx-auto px-4 md:px-6 font-sans pt-20 md:pt-28 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 relative">

          {/* LEFT: Items by vendor */}
          <div className="flex-1 space-y-10">
            <div className="flex justify-between items-end pb-6 border-b border-foreground/8">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl md:text-4xl font-black text-foreground font-display uppercase tracking-tight">Shopping Bag</h1>
                  <CountBadge count={cart.length} />
                </div>
                <p className="text-foreground/50 text-sm font-bold mt-1 uppercase tracking-wider" aria-live="polite">
                  {cart.length} {cart.length === 1 ? 'Product' : 'Products'} selected
                  {Object.keys(groupedItems).length > 1 && (
                    <span className="text-foreground/35"> · {Object.keys(groupedItems).length} sellers</span>
                  )}
                </p>
              </div>
            </div>

            {upsellOpportunity && <UpsellBanner opportunity={upsellOpportunity} />}

            <div className="space-y-12">
              {(Object.entries(groupedItems) as [string, CartItem[]][]).map(([sellerId, items], vendorIndex) => (
                <VendorGroup
                  key={sellerId}
                  sellerId={sellerId}
                  items={items}
                  vendor={vendorMap[sellerId]}
                  vendorIndex={vendorIndex}
                  calculateItemPrice={calculateItemPrice}
                  onUpdateQuantity={updateQuantity}
                  onRemove={handleRemove}
                  onSaveForLater={handleSaveForLater}
                  onNavigate={navigate}
                />
              ))}
            </div>
          </div>

          {/* RIGHT: Order summary */}
          <OrderSummary
            itemCount={cart.length}
            subtotal={subtotal}
            totalVAT={totalVAT}
            deliveryFeeTotal={deliveryFeeTotal}
            shippingFee={shippingFee}
            autoApplyDiscount={autoApplyDiscount}
            couponDiscountOnSubtotal={couponDiscountOnSubtotal}
            total={total}
            appliedCoupon={appliedCoupon}
            couponCode={couponCode}
            validatingCoupon={validatingCoupon}
            onCouponChange={setCouponCode}
            onApplyCoupon={handleApplyCoupon}
            onCheckout={handleCheckoutClick}
          />
        </div>
      </div>

      <UndoBar lastRemoved={lastRemoved} onUndo={handleUndoRemove} />

      <AbandonmentModal
        open={showAbandonModal}
        cart={cart}
        onClose={() => setShowAbandonModal(false)}
        onCheckout={() => navigate('/checkout')}
      />
    </>
  );
};
