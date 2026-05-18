import React from 'react';
import { motion } from 'framer-motion';
import { Truck, ShieldCheck, RotateCcw, Wallet } from 'lucide-react';

/**
 * Trust signals strip.
 *
 * Single row of 4 small cards: delivery, buyer protection, easy returns,
 * mobile money payments. Lives near the bottom of the homepage as a
 * reassurance before the fold ends.
 *
 * Mobile: 2x2 grid. Desktop: 4 cols.
 */
const ITEMS = [
  { icon: Truck, label: 'Nationwide delivery', sub: 'Across all 27 regions' },
  { icon: ShieldCheck, label: 'Buyer protection', sub: 'Refund if not as described' },
  { icon: RotateCcw, label: 'Easy returns', sub: '7-day return window' },
  { icon: Wallet, label: 'Mobile money', sub: 'M-Pesa, Tigo Pesa, Airtel' },
];

export const TrustStrip: React.FC = () => {
  return (
    <section className="container mx-auto px-5 md:px-8 py-10 md:py-16">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {ITEMS.map((it, i) => {
          const Icon = it.icon;
          return (
            <motion.div
              key={it.label}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.25) }}
              className="rounded-2xl p-4 md:p-5 bg-foreground/[0.03] hover:bg-foreground/[0.05] transition-colors"
            >
              <Icon className="w-5 h-5 md:w-6 md:h-6 text-foreground/70 mb-2.5 stroke-[2]" />
              <p className="text-[13px] md:text-sm font-semibold text-foreground leading-tight">
                {it.label}
              </p>
              <p className="text-[11px] md:text-xs text-foreground/50 mt-1 leading-snug">
                {it.sub}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
