import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { LayoutGrid, Package, Tag } from 'lucide-react';
import { CATEGORY_IMAGES, CATEGORY_EMOJIS } from './categoryConstants';

// Bubble geometry, kept in sync with the Bubble markup below.
const TILE = 88;        // w-[5.5rem]
const GAP_SM = 8;       // gap-x-2
const GAP_LG = 12;      // sm:gap-x-3
const MAX_OFFSET = 22;  // the honeycomb half-step (translateX)

/**
 * Honeycomb layout, MEASURED rather than guessed.
 *
 * The old version picked columns from hardcoded viewport breakpoints
 * (`w < 380 ? 3 : w < 640 ? 4 : ...`). Those numbers did not account for the
 * tiles' fixed 88px width, the gaps, the page gutter, OR the ±22px translateX
 * that offsets alternate rows — so a 4-column row is 376px wide and needs
 * ~452px of viewport before it fits. The result was clipped tiles at 320px and
 * again across 390-430px, i.e. most phones: the right-hand label ran off the
 * screen edge instead of wrapping.
 *
 * Now: fit the columns to the measured container, then SHRINK the decorative
 * offset to whatever slack is actually left over. Density is preserved and the
 * row can never exceed its container.
 */
const useHoneycomb = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState({ cols: 3, offset: 0 });

  const measure = useCallback(() => {
    const avail = ref.current?.clientWidth ?? 0;
    if (!avail) return;
    const gap = avail >= 640 ? GAP_LG : GAP_SM;
    const cols = Math.max(2, Math.min(8, Math.floor((avail + gap) / (TILE + gap))));
    const rowWidth = TILE * cols + gap * (cols - 1);
    // Half the leftover slack, capped at the design's half-step.
    const offset = Math.max(0, Math.min(MAX_OFFSET, (avail - rowWidth) / 2));
    setLayout(prev => (prev.cols === cols && prev.offset === offset ? prev : { cols, offset }));
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    // Observes the container itself, so it stays correct when a sidebar or
    // modal changes the available width without the viewport resizing.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return { ref, ...layout };
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
  const { ref: honeycombRef, cols, offset } = useHoneycomb();
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
      <div ref={honeycombRef} className="flex flex-col items-center gap-y-4 py-2 overflow-hidden">
        {rows.map((row, ri) => (
          <div
            key={ri}
            className="flex justify-center gap-x-2 sm:gap-x-3"
            // Offset alternate rows by ±¼ cell around the centre axis so the
            // circles nest into a hex packing without the whole cluster leaning
            // right (a plain marginLeft on odd rows shifted everything sideways).
            style={{ transform: rows.length > 1 && offset > 0 ? `translateX(${ri % 2 === 1 ? offset : -offset}px)` : undefined }}
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
