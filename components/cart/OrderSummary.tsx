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
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true, margin: '-50px' }}
    transition={{ duration: 0.6 }}
    className="lg:w-[420px] shrink-0 relative"
  >
    <div className="space-y-6 lg:sticky lg:top-32">
      <Card className="p-6 md:p-8 rounded-3xl bg-background border border-foreground/8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 blur-[80px] rounded-full pointer-events-none" />

        <h3 className="font-black text-lg mb-8 uppercase tracking-tight flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-brand-500" /> Order Summary
        </h3>

        <div className="space-y-4 mb-8">
          <div className="flex justify-between text-xs font-bold text-foreground/50 uppercase tracking-wide">
            <span>Subtotal</span>
            <span className="text-foreground">{formatTZS(subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs font-bold text-foreground/50 uppercase tracking-wide">
            <span className="flex items-center gap-1">VAT <Info className="w-3 h-3" /></span>
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

          <div className="h-px bg-foreground/8 my-4" />

          <div className="flex justify-between items-end">
            <span className="font-black text-sm uppercase text-foreground tracking-widest">Total Pay</span>
            <div className="text-right">
              <span className="font-black text-3xl md:text-5xl tracking-tighter text-foreground block leading-[0.9] font-display">
                {formatTZS(Math.round(total))}
              </span>
              {totalVAT > 0 && (
                <span className="text-[9px] font-bold text-foreground/40 uppercase tracking-widest">Inclusive of all taxes</span>
              )}
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
                onChange={(e: any) => onCouponChange(e.target.value)}
                className="h-12 bg-foreground/[0.04] border-none rounded-2xl text-xs font-black uppercase tracking-widest pl-10"
                disabled={!!appliedCoupon}
              />
            </div>
            <Button
              className="h-12 w-12 p-0 rounded-2xl bg-foreground text-background shadow-lg"
              onClick={onApplyCoupon}
              disabled={!!appliedCoupon || !couponCode}
              isLoading={validatingCoupon}
            >
              {appliedCoupon ? <CheckCircle2 className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
            </Button>
          </div>
          {appliedCoupon && (
            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-emerald-600 font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/10 py-2 rounded-xl">
              <CheckCircle2 className="w-3 h-3" /> Coupon "{appliedCoupon.code}" Active
            </div>
          )}
        </div>

        <Button
          onClick={onCheckout}
          variant="brand"
          className="w-full h-16 text-xs font-black uppercase tracking-[0.25em] shadow-2xl shadow-emerald-500/20 rounded-2xl transition-all group"
        >
          Secure Checkout · {itemCount} {itemCount === 1 ? 'item' : 'items'}
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>

        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="flex gap-3 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
            {['M-Pesa', 'Tigo', 'Airtel', 'Bank'].map(p => (
              <span key={p} className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">{p}</span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[8px] font-bold text-foreground/40 uppercase tracking-widest">
            <ShieldCheck className="w-3 h-3" /> Encrypted & Secure
          </div>
        </div>
      </Card>
    </div>
  </motion.div>
);
