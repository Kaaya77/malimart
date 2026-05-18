import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { ProductCard } from '../ProductCard';
import { Product } from '../../types';

interface ProductGridSectionProps {
  title: string;
  description: string;
  products: Product[];
  navigate: (path: string) => void;
  setActiveProduct: (product: Product) => void;
}

/**
 * Section wrapper for a horizontal-feeling product grid.
 *
 * Changes vs. previous:
 *  - Section header now uses a baseline-aligned title + small uppercase eyebrow
 *  - "See all" link replaces the green pill — link-style, no decoration
 *  - 4-col grid on lg → 3 on md → 2 on mobile (tighter columns, more product per fold)
 *  - Bigger gap-x for breathing room, smaller gap-y so the eye flows down
 */
export const ProductGridSection = ({
  title,
  description,
  products,
  navigate,
  setActiveProduct,
}: ProductGridSectionProps) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4 }}
      className="container mx-auto px-6 sm:px-8 py-14 md:py-20"
    >
      <header className="flex items-end justify-between gap-6 mb-8 md:mb-10">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45 mb-2">
            Curated for you
          </p>
          <h2 className="font-sans text-2xl md:text-[32px] font-semibold tracking-tight text-foreground leading-tight">
            {title}
          </h2>
          {description && (
            <p className="mt-1.5 text-sm md:text-[15px] text-foreground/55 font-medium max-w-md">
              {description}
            </p>
          )}
        </div>

        <button
          onClick={() => navigate('/shop')}
          className="group flex items-center gap-1.5 text-sm font-semibold text-foreground/70 hover:text-foreground transition-colors flex-shrink-0"
        >
          See all
          <ArrowUpRight className="w-4 h-4 stroke-[2.2] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10">
        {products.map((p, i) => (
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
