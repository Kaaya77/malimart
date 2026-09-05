import React from 'react';
import { ArrowRight, ShieldCheck, Tag, Info, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button, Input, Card, Label } from '../UI';
import { Offer } from '../../types';
import { formatTZS } from '../../constants';

interface OrderSummaryProps {
  itemCount: number;
  subtotal: number;
  totalVAT: number;
  deliveryFeeTotal: number;
  shippingFee: number;
  autoApplyDiscount: number;
  couponDiscountOnSubtotal: number;
  total: number;
  appliedCoupon: Offer | null;
  couponCode: string;
  validatingCoupon: boolean;
  onCouponChange: (code: string) => void;
  onApplyCoupon: () => void;
  onCheckout: () => void;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  itemCount, subtotal, totalVAT, deliveryFeeTotal, shippingFee,
  autoApplyDiscount, couponDiscountOnSubtotal, total,
  appliedCoupon, couponCode, validatingCoupon,
  onCouponChange, onApplyCoupon, onCheckout,
}) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.6 }}
    className="lg:w-[420px] shrink-0 relative"
  >
    <div className="space-y-6 lg:sticky lg:top-32">
      <Card className="p-6 md:p-7 rounded-3xl bg-background border border-foreground/8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-500/[0.06] blur-[80px] rounded-full pointer-events-none" />

        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-1 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Order Summary
        </p>
        <h3 className="font-black text-xl text-foreground mb-6">{itemCount} {itemCount === 1 ? 'item' : 'items'}</h3>

        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm text-foreground/55">
            <span>Subtotal</span>
            <span className="text-foreground font-semibold tabular-nums">{formatTZS(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-foreground/55">
            <span className="flex items-center gap-1">VAT <Info className="w-3 h-3" /></span>
            <span className="text-foreground font-semibold tabular-nums">{formatTZS(Math.round(totalVAT))}</span>
          </div>
          <div className="flex justify-between text-sm text-foreground/55">
            <span>Delivery</span>
            <span className="text-foreground font-semibold tabular-nums">{formatTZS(Number(deliveryFeeTotal))}</span>
          </div>

          {autoApplyDiscount > 0 && (
            <div className="flex justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-xl">
              <span>Auto-applied savings</span>
              <span className="tabular-nums">-{formatTZS(autoApplyDiscount)}</span>
            </div>
          )}
          {couponDiscountOnSubtotal > 0 && (
            <div className="flex justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-xl">
              <span>Coupon '{appliedCoupon?.code}'</span>
              <span className="tabular-nums">-{formatTZS(couponDiscountOnSubtotal)}</span>
            </div>
          )}
          {Number(deliveryFeeTotal) > shippingFee && (
            <div className="flex justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-xl">
              <span>Free shipping</span>
              <span className="tabular-nums">-{formatTZS(Number(deliveryFeeTotal) - shippingFee)}</span>
            </div>
          )}

          <div className="h-px bg-foreground/8 my-3" />

          <div className="flex justify-between items-end">
            <span className="font-bold text-sm text-foreground">Total</span>
            <div className="text-right">
              <span className="font-black text-3xl md:text-4xl tracking-tight text-foreground block leading-[0.95] tabular-nums">
                {formatTZS(Math.round(total))}
              </span>
              {totalVAT > 0 && (
                <span className="text-[10px] font-medium text-foreground/40">Inclusive of all taxes</span>
              )}
            </div>
          </div>
        </div>

        {/* Coupon Input */}
        <div className="mb-6">
          <Label className="mb-2 ml-1">Promo code</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
              <Input
                placeholder="Enter code"
                value={couponCode}
                onChange={(e: any) => onCouponChange(e.target.value)}
                className="h-11 bg-foreground/[0.04] border-none rounded-2xl text-sm font-semibold uppercase tracking-wide pl-10"
                disabled={!!appliedCoupon}
              />
            </div>
            {/* Labelled, not a bare icon square. It was `w-12 p-0` with only an
                arrow, and it is disabled until a code is typed — so at
                disabled:opacity-50 over bg-foreground it read as an inert grey
                tile rather than a button. The word carries the affordance;
                aria-label covers the applied state where the icon changes. */}
            {/* Spacing comes from mr-2 on the icon, NOT gap on the button:
                Button wraps its children in an inner span, so a `gap-*` in
                className lands on the outer button and never separates the
                icon from the label — it rendered as "→APPLY". */}
            <Button
              className="h-11 px-5 rounded-2xl bg-foreground text-background shadow-sm shrink-0"
              onClick={onApplyCoupon}
              disabled={!!appliedCoupon || !couponCode}
              isLoading={validatingCoupon}
              aria-label={appliedCoupon ? 'Coupon applied' : 'Apply coupon code'}
            >
              {appliedCoupon ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              <span className="text-sm font-bold">
                {appliedCoupon ? 'Applied' : 'Apply'}
              </span>
            </Button>
          </div>
          {appliedCoupon && (
            <div className="mt-2.5 flex items-center justify-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 py-2 rounded-xl">
              <CheckCircle2 className="w-3.5 h-3.5" /> Coupon "{appliedCoupon.code}" active
            </div>
          )}
        </div>

        <Button
          onClick={onCheckout}
          variant="brand"
          className="w-full h-14 text-sm font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all group"
        >
          Secure Checkout · {itemCount} {itemCount === 1 ? 'item' : 'items'}
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>

        <div className="mt-5 flex flex-col items-center gap-2">
          <div className="flex gap-3 opacity-40">
            {['M-Pesa', 'Tigo', 'Airtel', 'Bank'].map(p => (
              <span key={p} className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">{p}</span>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-foreground/35">
            <ShieldCheck className="w-3 h-3" /> Encrypted & secure
          </div>
        </div>
      </Card>
    </div>
  </motion.div>
);
