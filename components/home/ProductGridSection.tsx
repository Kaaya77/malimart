import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
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
 * Product grid section.
 *
 * Mobile: 2 cols, horizontally-tight; the cards do the visual work.
 * Tablet (md): 3 cols. Desktop (lg+): 4 cols.
 *
 * Section header is single-line on mobile (no helper copy) to keep the
 * scroll fast — the grid below explains itself.
 */
export const ProductGridSection = ({
  title,
  description,
  products,
  navigate,
  setActiveProduct,
}: ProductGridSectionProps) => {
  if (!products || products.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4 }}
      className="container mx-auto px-5 md:px-8 py-12 md:py-16"
    >
      <header className="flex items-end justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h2 className="font-sans text-xl md:text-[28px] font-semibold tracking-tight text-foreground leading-tight">
            {title}
          </h2>
          {description && (
            <p className="hidden md:block mt-1 text-sm text-foreground/55 font-medium max-w-md">
              {description}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate('/shop')}
          className="text-sm font-semibold text-foreground/70 hover:text-foreground flex items-center gap-1 group flex-shrink-0"
        >
          See all
          <ArrowRight className="w-4 h-4 stroke-[2.2] group-hover:translate-x-0.5 transition-transform" />
        </button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 md:gap-x-5 gap-y-8 md:gap-y-10">
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
