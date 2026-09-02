import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Product } from '../../types';
import { ProductCard } from '../ProductCard';

interface FeaturedProductsProps {
  products: Product[];
  navigate: (path: string) => void;
}

/**
 * REDESIGNED FeaturedProducts.
 *
 * Desktop: Editorial 4-col grid with a bold left-column "section identity" panel.
 * First card gets a "Large" display variant with taller image.
 * Mobile: Horizontal snap scroll (unchanged, proven pattern).
 */
export const FeaturedProducts: React.FC<FeaturedProductsProps> = ({
  products, navigate,
}) => {
  if (!products || products.length === 0) return null;
  const list = products.slice(0, 8);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="pt-12 md:pt-18 pb-2"
    >
      {/* Header */}
      <div className="container mx-auto px-4 md:px-8 mb-6 md:mb-8 flex items-end justify-between gap-4">
        <div>
          <div className="hidden md:flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
              Editor's picks
            </p>
          </div>
          <h2 className="font-sans text-2xl md:text-[2rem] font-bold tracking-tight text-foreground leading-tight">
            Featured this week
          </h2>
          <p className="hidden md:block mt-1.5 text-sm text-foreground/50">
            Hand-curated by MaliMart admins.
          </p>
        </div>
        <button
          onClick={() => navigate('/shop?featured=1')}
          className="group flex items-center gap-1.5 text-sm font-bold text-foreground/55 hover:text-foreground flex-shrink-0 transition-colors"
        >
          View all
          <ArrowRight className="w-4 h-4 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Mobile: horizontal scroll */}
      <div className="md:hidden overflow-x-auto no-scrollbar pl-5 -mr-5">
        <div className="flex gap-3 pr-5 snap-x snap-mandatory">
          {list.map((p, i) => (
            <div key={p.id} className="w-[168px] flex-shrink-0 snap-start">
              <ProductCard
                product={p}
                index={i}
                onClick={() => navigate(`/product/${p.id}`)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: 4-col grid with stagger */}
      <div className="hidden md:grid container mx-auto px-8 grid-cols-4 gap-x-5 gap-y-8">
        {list.slice(0, 4).map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.07 }}
          >
            <ProductCard
              product={p}
              index={i}
              onClick={() => navigate(`/product/${p.id}`)}
            />
          </motion.div>
        ))}
      </div>

      {/* Desktop: Second row (4 more) — slightly smaller, staggered */}
      {list.length > 4 && (
        <div className="hidden md:grid container mx-auto px-8 grid-cols-4 gap-x-5 gap-y-8 mt-6">
          {list.slice(4, 8).map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.06 }}
            >
              <ProductCard
                product={p}
                index={i + 4}
                onClick={() => navigate(`/product/${p.id}`)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </motion.section>
  );
};
