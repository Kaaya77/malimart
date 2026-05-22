import React from 'react';
import { motion } from 'framer-motion';
import { Truck, ShieldCheck, RotateCcw, Wallet, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * REDESIGNED TrustStrip — Premium manifesto section.
 *
 * Instead of 4 plain cards, this is a full-bleed editorial block:
 *  - Dark/light contrasting background
 *  - Large headline "Built for Tanzania"
 *  - Animated stat counters
 *  - 4 trust pillars as horizontal items with icon + description
 *  - CTA to /shop
 */

const PILLARS = [
  {
    icon: Truck,
    headline: 'Nationwide Delivery',
    sub: 'Mombasa to Mtwara. All 27 regions covered, every week.',
    stat: '27',
    statLabel: 'Regions',
    color: '#10b981',
  },
  {
    icon: ShieldCheck,
    headline: 'Buyer Protection',
    sub: 'Pay with confidence. Full refund if your order isn\'t as described.',
    stat: '100%',
    statLabel: 'Protected',
    color: '#3b82f6',
  },
  {
    icon: RotateCcw,
    headline: 'Easy Returns',
    sub: 'Changed your mind? 7-day hassle-free return window.',
    stat: '7',
    statLabel: 'Day returns',
    color: '#f59e0b',
  },
  {
    icon: Wallet,
    headline: 'Mobile Money',
    sub: 'M-Pesa, Tigo Pesa & Airtel Money — pay the Tanzanian way.',
    stat: '3',
    statLabel: 'Providers',
    color: '#ec4899',
  },
];

export const TrustStrip: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="container mx-auto px-5 md:px-8 py-10 md:py-16">
      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-[2rem] overflow-hidden bg-foreground text-background"
        style={{ minHeight: '18rem' }}
      >
        {/* Background texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Gradient glow blobs */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 p-7 md:p-10">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 md:mb-10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-background/40 mb-2">
                Our Promise
              </p>
              <h2 className="font-sans font-bold text-2xl md:text-4xl text-background leading-tight tracking-tight">
                Built for Tanzania. <br className="hidden md:block" />
                <span className="text-background/50">Trusted by thousands.</span>
              </h2>
            </div>
            <button
              onClick={() => navigate('/shop')}
              className="group self-start md:self-auto inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-background/10 hover:bg-background/20 text-background/80 hover:text-background text-sm font-semibold transition-all border border-background/15"
            >
              Start shopping
              <ArrowRight className="w-4 h-4 stroke-[2.2] group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Pillars */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {PILLARS.map((p, i) => {
              const Icon = p.icon;
              return (
                <motion.div
                  key={p.headline}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.07 }}
                  className="flex flex-col gap-3"
                >
                  {/* Icon + stat */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${p.color}22` }}
                    >
                      <Icon className="w-4.5 h-4.5" style={{ color: p.color }} />
                    </div>
                    <div>
                      <p className="text-lg md:text-xl font-bold text-background leading-none tabular-nums">
                        {p.stat}
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-background/40">
                        {p.statLabel}
                      </p>
                    </div>
                  </div>

                  {/* Text */}
                  <div>
                    <p className="text-sm font-semibold text-background leading-snug mb-1">
                      {p.headline}
                    </p>
                    <p className="text-xs text-background/50 leading-relaxed hidden md:block">
                      {p.sub}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </section>
  );
};
