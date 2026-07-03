/**
 * CheckoutPage — dedicated checkout page at /checkout
 * Replaces CheckoutModal overlay on CartPage.
 * Cart totals passed via navigation state; falls back to
 * recalculating from AppContext if state is missing.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Palmtree } from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { CheckoutModal } from '../components/CheckoutComponents';
import { getEffectiveUnitPrice } from '../components/checkout/shared';
import { fetchVacationSellers } from '../services/shopService';
import { previewCartDiscount, type DiscountPreview } from '../services/walletApi';
import { Button } from '../components/UI';
import { Address } from '../types';

export const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, placeOrder, user } = useAppState();

  // Totals from navigation state (set by CartPage) or recalculated.
  // NOTE: these are display estimates only — place_order_atomic recomputes
  // subtotal/VAT/total server-side via compute_cart_totals, which applies each
  // product's own vat_rate and only for VRN-registered sellers. The flat 18%
  // fallback here can therefore overstate VAT vs. what the order will record.
  const { total, subtotal, vat, discount, couponCode } = useMemo(() => {
    if (location.state?.total !== undefined) return location.state as any;
    // Variant-aware pricing — plain `price_at_add || price` ignored variant prices.
    const sub = cart.reduce((s, i) => s + getEffectiveUnitPrice(i) * (i.quantity || 1), 0);
    const vatAmt = sub * 0.18;
    return { total: sub + vatAmt, subtotal: sub, vat: vatAmt, discount: 0, couponCode: null };
  }, [location.state, cart]);

  // Vacation-mode guard: an order may not include items from a store on
  // vacation. place_order_atomic rejects these server-side too — this is the
  // friendly client-side gate.
  const [vacationStores, setVacationStores] = useState<string[]>([]);
  useEffect(() => {
    const sellerIds = cart.map((i: any) => i.seller_id).filter(Boolean);
    if (!sellerIds.length) { setVacationStores([]); return; }
    let live = true;
    fetchVacationSellers(sellerIds).then(map => {
      if (live) setVacationStores(Array.from(new Set(Object.values(map))));
    });
    return () => { live = false; };
  }, [cart]);

  // Discount preview: best-of(manual coupon, auto-apply offer). place_order_atomic
  // recomputes and applies the same best-of server-side; this drives the summary.
  const [discountPreview, setDiscountPreview] = useState<DiscountPreview | null>(null);
  useEffect(() => {
    const items = cart.map((i: any) => ({
      product_id: i.id, variant_id: i.variant_id || null,
      quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
    }));
    if (!items.length) { setDiscountPreview(null); return; }
    let live = true;
    previewCartDiscount(items, couponCode || null)
      .then(p => { if (live) setDiscountPreview(p); })
      .catch(() => { if (live) setDiscountPreview(null); });
    return () => { live = false; };
  }, [cart, couponCode]);

  // Prefer the server-previewed discount (includes auto-apply offers the buyer
  // never typed a code for); fall back to whatever CartPage passed.
  const effectiveDiscount = discountPreview ? discountPreview.discount : discount;
  const discountLabel = discountPreview && discountPreview.discount > 0
    ? (discountPreview.source === 'auto'
        ? `Auto discount${discountPreview.title ? ` · ${discountPreview.title}` : ''}`
        : discountPreview.title || 'Discount')
    : undefined;

  if (!user) { navigate('/login', { replace: true }); return null; }
  if (!cart.length && !location.state) { navigate('/cart', { replace: true }); return null; }

  const handleComplete = async (details: {
    address: Address; paymentMethod: string; deliveryFee: number;
    note: string; paymentRef?: string; isGift?: boolean;
    giftMessage?: string; deliveryDate?: string; deliverySlot?: string;
  }) => {
    const newOrder = await placeOrder({
      ...details,
      vat,
      subtotal,
      discount: effectiveDiscount,
      couponCode: couponCode || null,
    });
    navigate('/order-confirmation', { state: { order: newOrder } });
  };

  return (
    <div className="min-h-screen bg-background pt-16">
      {/* Back header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-foreground/8">
        <div className="container mx-auto max-w-3xl px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate('/cart')}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-foreground/[0.06] transition-colors">
            <ArrowLeft className="w-4 h-4 text-foreground/60" />
          </button>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-foreground/40" />
            <span className="text-sm font-bold text-foreground">Checkout</span>
          </div>
        </div>
      </div>

      {/* CheckoutModal rendered inline — no overlay, full page */}
      <div className="container mx-auto max-w-3xl px-4 py-6">
        {vacationStores.length > 0 ? (
          <div className="rounded-3xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-6 md:p-8 flex flex-col items-center text-center gap-4">
            <span className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center">
              <Palmtree className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            </span>
            <div>
              <h2 className="font-bold text-amber-900 dark:text-amber-200 text-base">
                {vacationStores.length === 1 ? `${vacationStores[0]} is on vacation` : 'Some sellers are on vacation'}
              </h2>
              <p className="text-sm text-amber-800/70 dark:text-amber-300/70 mt-1.5 leading-relaxed max-w-md">
                {vacationStores.join(', ')} {vacationStores.length === 1 ? 'is' : 'are'} not accepting
                orders right now. Please remove their items from your cart to continue,
                or check back when they return.
              </p>
            </div>
            <Button variant="secondary" onClick={() => navigate('/cart')} className="rounded-2xl">
              Back to cart
            </Button>
          </div>
        ) : (
        <CheckoutModal
          total={total}
          subtotal={subtotal}
          vat={vat}
          discount={effectiveDiscount}
          discountLabel={discountLabel}
          onClose={() => navigate('/cart')}
          onComplete={handleComplete}
        />
        )}
      </div>
    </div>
  );
};
