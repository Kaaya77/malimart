/**
 * CheckoutPage — dedicated checkout page at /checkout
 * Replaces CheckoutModal overlay on CartPage.
 * Cart totals passed via navigation state; falls back to
 * recalculating from AppContext if state is missing.
 */
import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { CheckoutModal } from '../components/CheckoutComponents';
import { getEffectiveUnitPrice } from '../components/checkout/shared';
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
      discount,
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
        <CheckoutModal
          total={total}
          subtotal={subtotal}
          vat={vat}
          discount={discount}
          onClose={() => navigate('/cart')}
          onComplete={handleComplete}
        />
      </div>
    </div>
  );
};
