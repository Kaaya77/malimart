import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Product } from '../../types';
import { ProductCard } from '../ProductCard';

interface FeaturedProductsProps {
  products: Product[];
  navigate: (path: string) => void;
  setActiveProduct: (p: Product) => void;
}

/**
 * Featured products section — admin-curated via the is_boosted flag.
 *
 * Renders nothing if there are no boosted products (so the homepage
 * doesn't show an awkward empty section before admin sets anything).
 *
 * Mobile: horizontal snap-scroll, cards stay 180px wide for thumb-scroll
 *   ergonomics — products feel like they keep going.
 * Desktop: 4-col grid.
 */
export const FeaturedProducts: React.FC<FeaturedProductsProps> = ({
  products,
  navigate,
  setActiveProduct,
}) => {
  if (!products || products.length === 0) return null;

  const list = products.slice(0, 8);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4 }}
      className="pt-10 md:pt-16 pb-2"
    >
      <div className="container mx-auto px-5 md:px-8 mb-5 md:mb-7 flex items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="hidden md:flex w-10 h-10 rounded-full bg-emerald-500/12 items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="md:hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 mb-1 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Editor's picks
            </p>
            <h2 className="font-sans text-xl md:text-[28px] font-semibold tracking-tight text-foreground leading-tight">
              Featured products
            </h2>
            <p className="hidden md:block mt-0.5 text-sm text-foreground/55 font-medium">
              Hand-picked by MaliMart admins this week.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/shop?featured=1')}
          className="text-sm font-semibold text-foreground/70 hover:text-foreground flex items-center gap-1 group flex-shrink-0"
        >
          All
          <ArrowRight className="w-4 h-4 stroke-[2.2] group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Mobile: horizontal scroll */}
      <div className="md:hidden overflow-x-auto no-scrollbar pl-5 -mr-5">
        <div className="flex gap-3 pr-5 snap-x snap-mandatory">
          {list.map((p, i) => (
            <div
              key={p.id}
              className="w-[170px] flex-shrink-0 snap-start"
            >
              <ProductCard
                product={p}
                index={i}
                onClick={() => navigate(`/product/${p.id}`)}
                onQuickView={() => setActiveProduct(p)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: 4-col grid */}
      <div className="hidden md:grid container mx-auto px-8 grid-cols-4 gap-x-5 gap-y-10">
        {list.slice(0, 4).map((p, i) => (
          <ProductCard
            key={p.id}
            product={p}
            index={i}
            onClick={() => navigate(`/product/${p.id}`)}
            onQuickView={() => setActiveProduct(p)}
          />
        ))}
      </div>
    </motion.section>
  );
};
