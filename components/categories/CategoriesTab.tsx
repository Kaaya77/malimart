import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { LayoutGrid, Package, Tag } from 'lucide-react';
import { CATEGORY_IMAGES, CATEGORY_EMOJIS } from './categoryConstants';

// Honeycomb (Apple-Watch-style) column count by viewport width.
const useHoneycombCols = () => {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      setCols(w < 380 ? 3 : w < 640 ? 4 : w < 1024 ? 6 : 8);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  return cols;
};

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

interface CategoriesTabProps {
  visibleCategories: any[];
  categoryCounts: Record<string, number>;
  categoryThumbs?: Record<string, string>;
  searchQ: string;
  expandedCat: string | null;
  onSearchChange: (q: string) => void;
  onExpandCat: (id: string | null) => void;
  onViewDeals: () => void;
}

export const CategoriesTab: React.FC<CategoriesTabProps> = ({
  visibleCategories, categoryCounts, categoryThumbs = {}, searchQ, expandedCat,
  onSearchChange, onExpandCat, onViewDeals,
}) => {
  const cols = useHoneycombCols();
  const rows = chunk(visibleCategories, cols);

  const Bubble = ({ cat }: { cat: any }) => {
    const thumb = categoryThumbs[cat.name] || CATEGORY_IMAGES[cat.name] || cat.image_url || '';
    const emoji = CATEGORY_EMOJIS[cat.name] || '🛍️';
    const count = categoryCounts[cat.name];
    return (
      <Link
        to={`/shop?category=${encodeURIComponent(cat.name)}`}
        className="group flex flex-col items-center gap-1.5 text-center w-[5.5rem] shrink-0"
      >
        <div className="relative w-[4.25rem] h-[4.25rem] sm:w-[4.75rem] sm:h-[4.75rem] rounded-full overflow-hidden ring-1 ring-foreground/10 group-hover:ring-emerald-500/60 shadow-sm group-hover:shadow-lg group-hover:-translate-y-1 group-active:scale-95 transition-all bg-gradient-to-br from-emerald-500/15 to-teal-500/10 flex items-center justify-center">
          {thumb ? (
            <>
              <img src={thumb} alt={cat.name} className="w-full h-full object-cover group-hover:scale-[1.08] transition-transform duration-500" loading="lazy" decoding="async" />
              <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-background shadow ring-1 ring-foreground/10 flex items-center justify-center text-xs">{emoji}</span>
            </>
          ) : (
            <span className="text-3xl">{emoji}</span>
          )}
        </div>
        <div className="min-w-0 w-full">
          <h3 className="text-[10px] sm:text-[11px] font-bold text-foreground leading-tight line-clamp-1">{cat.name}</h3>
          <p className="text-[9px] text-foreground/40">{count ? `${count}` : 'Browse'}</p>
        </div>
      </Link>
    );
  };

  return (
  <motion.div key="cats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
    {/* Search lives in the page hero — one input, one state, no duplicate box */}
    {visibleCategories.length === 0 ? (
      <div className="flex flex-col items-center py-16 border border-dashed border-foreground/15 rounded-3xl text-foreground/35">
        <LayoutGrid className="w-10 h-10 mb-3 opacity-20" />
        <p className="font-semibold text-sm">No categories match "{searchQ}"</p>
        <button onClick={() => onSearchChange('')} className="mt-3 text-xs font-bold text-emerald-500">Clear search</button>
      </div>
    ) : (
      // Honeycomb bubble cluster (Apple-Watch style): each row is offset by half
      // a bubble from the last so the circles nest into a hex packing.
      <div className="flex flex-col items-center gap-y-4 py-2">
        {rows.map((row, ri) => (
          <div
            key={ri}
            className="flex justify-center gap-x-2 sm:gap-x-3"
            style={{ marginLeft: ri % 2 === 1 ? '2.75rem' : 0 }}
          >
            {row.map((cat: any) => <Bubble key={cat.id} cat={cat} />)}
          </div>
        ))}
      </div>
    )}

    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-foreground/8">
      <Link to="/shop" className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-foreground text-background text-sm font-bold hover:opacity-85 transition-opacity">
        <Package className="w-4 h-4" /> Browse All Products
      </Link>
      <button
        onClick={onViewDeals}
        className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl border border-foreground/15 text-foreground text-sm font-semibold hover:bg-foreground/[0.04] transition-colors"
      >
        <Tag className="w-4 h-4" /> View Deals
      </button>
    </div>
  </motion.div>
  );
};
