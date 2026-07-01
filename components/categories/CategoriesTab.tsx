import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { LayoutGrid, Search, ArrowRight, Package, Tag, X, ChevronRight } from 'lucide-react';
import { CATEGORY_IMAGES, CATEGORY_EMOJIS } from './categoryConstants';

interface CategoriesTabProps {
  visibleCategories: any[];
  categoryCounts: Record<string, number>;
  searchQ: string;
  expandedCat: string | null;
  onSearchChange: (q: string) => void;
  onExpandCat: (id: string | null) => void;
  onViewDeals: () => void;
}

export const CategoriesTab: React.FC<CategoriesTabProps> = ({
  visibleCategories, categoryCounts, searchQ, expandedCat,
  onSearchChange, onExpandCat, onViewDeals,
}) => (
  <motion.div key="cats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
    {/* Search lives in the page hero — one input, one state, no duplicate box */}
    {visibleCategories.length === 0 ? (
      <div className="flex flex-col items-center py-16 border border-dashed border-foreground/15 rounded-3xl text-foreground/35">
        <LayoutGrid className="w-10 h-10 mb-3 opacity-20" />
        <p className="font-semibold text-sm">No categories match "{searchQ}"</p>
        <button onClick={() => onSearchChange('')} className="mt-3 text-xs font-bold text-emerald-500">Clear search</button>
      </div>
    ) : (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {visibleCategories.map((cat: any) => {
          const img = CATEGORY_IMAGES[cat.name] || cat.image_url || `https://picsum.photos/seed/${encodeURIComponent(cat.name)}/400/500`;
          const count = categoryCounts[cat.name];
          const isExpanded = expandedCat === cat.id;
          const subs: any[] = cat.subcategories || [];

          return (
            <div key={cat.id} className="flex flex-col gap-2">
              <Link
                to={`/shop?category=${encodeURIComponent(cat.name)}`}
                className="group relative aspect-[4/5] rounded-3xl overflow-hidden bg-foreground/[0.04] block"
              >
                <img src={img} alt={cat.name} className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500" loading="lazy" decoding="async" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <span className="text-base mb-0.5 block">{CATEGORY_EMOJIS[cat.name] || '🛍️'}</span>
                      <h3 className="text-white font-bold text-sm leading-tight">{cat.name}</h3>
                      <p className="text-white/55 text-[10px] mt-0.5">
                        {count ? `${count} product${count === 1 ? '' : 's'}` : 'Browse'}
                      </p>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 group-hover:bg-white/30 transition-colors">
                      <ArrowRight className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>
              </Link>

              {subs.length > 0 && (
                <div>
                  <div className={`flex flex-wrap gap-1.5 overflow-hidden transition-all ${isExpanded ? 'max-h-40' : 'max-h-[2.2rem]'}`}>
                    {subs.map((s: any) => (
                      <Link
                        key={s.id}
                        to={`/shop?category=${encodeURIComponent(s.name)}`}
                        className="flex-shrink-0 h-7 px-2.5 rounded-full bg-foreground/[0.05] text-foreground/60 text-[10px] font-semibold hover:bg-foreground/10 hover:text-foreground transition-colors whitespace-nowrap"
                      >
                        {s.name}
                      </Link>
                    ))}
                  </div>
                  {subs.length > 3 && (
                    <button
                      onClick={() => onExpandCat(isExpanded ? null : cat.id)}
                      className="mt-1 text-[10px] font-bold text-foreground/35 hover:text-emerald-500 transition-colors flex items-center gap-0.5"
                    >
                      {isExpanded ? 'Show less' : `+${subs.length - 3} more`}
                      <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
