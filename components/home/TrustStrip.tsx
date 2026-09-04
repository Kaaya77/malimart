import React from 'react';
import { motion } from 'framer-motion';
import { Truck, ShieldCheck, RotateCcw, Wallet } from 'lucide-react';

/**
 * TrustStrip — the buyer-guarantee line.
 *
 * Was a 2x4 grid of tinted cards; still the flattest section on the page, but
 * a "card" is still a container with weight. Pared down further: no fill, no
 * radius, no per-item box at all — just icon+copy pairs on a plain hairline
 * strip, the way a checkout footer states its guarantees. Whitespace does the
 * separating; nothing is drawn to hold these four apart.
 */
const ITEMS = [
  { icon: Truck, label: 'Nationwide delivery', sub: 'All 31 regions' },
  { icon: ShieldCheck, label: 'Buyer protection', sub: 'Refund if not as described' },
  { icon: RotateCcw, label: 'Easy returns', sub: '7-day window' },
  { icon: Wallet, label: 'Mobile money', sub: 'M-Pesa, Tigo Pesa, Airtel' },
];

export const TrustStrip: React.FC = () => (
  <section className="border-y border-foreground/[0.06]">
    <div className="container mx-auto px-4 md:px-8 py-6 md:py-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 md:gap-x-14">
      {ITEMS.map((it, i) => {
        const Icon = it.icon;
        return (
          <motion.div
            key={it.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.16) }}
            className="flex items-center gap-2.5"
          >
            <Icon className="w-4 h-4 text-foreground/40 shrink-0" strokeWidth={2} />
            <span className="text-[13px] font-semibold text-foreground/80 whitespace-nowrap">{it.label}</span>
            <span className="hidden sm:inline text-[13px] text-foreground/35 whitespace-nowrap">— {it.sub}</span>
          </motion.div>
        );
      })}
    </div>
  </section>
);
