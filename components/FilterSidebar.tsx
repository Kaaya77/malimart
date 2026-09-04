import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Filter, RotateCcw, Star } from 'lucide-react';
import { Category } from '../types';
import { TANZANIA_REGIONS } from '../constants';
import { useFocusTrap } from '../hooks/useFocusTrap';

/**
 * FilterSidebar — the Shop page's advanced-filter drawer.
 *
 * Rebuilt alongside the Explore/Shop merge. The old drawer collected
 * Materials/Colors/Sizes selections that ShopPage's filtering logic never
 * actually applied to results — three sections of dead weight that looked
 * functional and weren't. Dropped rather than wired up: nothing in the
 * catalog carries that data today, so "wiring them up" would mean inventing
 * fields with nothing behind them. Location's free-text input is now a
 * region select (TANZANIA_REGIONS) — the region a product actually has is a
 * known enum, not a string a shopper has to spell correctly.
 */

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onFilterChange: (filters: any) => void;
  activeFilters: any;
}

const PRICE_MAX = 5000000;

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  isOpen, onClose, categories, onFilterChange, activeFilters,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, isOpen);
  const [priceRange, setPriceRange] = useState<[number, number]>(activeFilters.priceRange || [0, PRICE_MAX]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(activeFilters.categories || []);
  const [region, setRegion] = useState<string>(activeFilters.location || '');
  const [rating, setRating] = useState<number | null>(activeFilters.rating || null);
  const [verified, setVerified] = useState<boolean>(activeFilters.verified || false);
  const [stock, setStock] = useState<boolean>(activeFilters.stock || false);

  const handleReset = () => {
    setPriceRange([0, PRICE_MAX]);
    setSelectedCategories([]);
    setRegion('');
    setRating(null);
    setVerified(false);
    setStock(false);
    onFilterChange({
      priceRange: [0, PRICE_MAX], categories: [], location: '', rating: null, verified: false, stock: false,
    });
  };

  const handleApply = () => {
    onFilterChange({ priceRange, categories: selectedCategories, location: region, rating, verified, stock });
    onClose();
  };

  const toggleCategory = (name: string) => {
    setSelectedCategories(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]);
  };

  const sectionLabel = 'text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-3';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
          />
          <motion.div
            ref={panelRef} role="dialog" aria-modal="true" aria-label="Filters" tabIndex={-1}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed top-0 right-0 h-full w-full max-w-sm bg-background shadow-2xl z-[101] flex flex-col outline-none"
          >
            <div className="px-5 py-4 border-b border-foreground/8 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Filter className="w-4 h-4 text-foreground/50" />
                <h2 className="text-lg font-bold tracking-tight text-foreground">Filters</h2>
              </div>
              <button onClick={onClose} aria-label="Close filters" className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-foreground/[0.06] text-foreground/50 transition-colors">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-7">
              {/* Price */}
              <section>
                <h3 className={sectionLabel}>Price (TZS)</h3>
                <div className="flex items-center justify-between text-sm font-bold text-foreground mb-2 tabular-nums">
                  <span>{priceRange[0].toLocaleString()}</span>
                  <span>{priceRange[1].toLocaleString()}</span>
                </div>
                <div className="space-y-3">
                  <input
                    type="range" aria-label="Minimum price" min={0} max={PRICE_MAX} step={10000}
                    value={priceRange[0]}
                    onChange={e => { const next = parseInt(e.target.value); setPriceRange([Math.min(next, priceRange[1] - 10000), priceRange[1]]); }}
                    className="w-full accent-emerald-500"
                  />
                  <input
                    type="range" aria-label="Maximum price" min={0} max={PRICE_MAX} step={10000}
                    value={priceRange[1]}
                    onChange={e => { const next = parseInt(e.target.value); setPriceRange([priceRange[0], Math.max(next, priceRange[0] + 10000)]); }}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </section>

              {/* Categories */}
              {categories.length > 0 && (
                <section>
                  <h3 className={sectionLabel}>Category</h3>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => toggleCategory(cat.name)}
                        aria-pressed={selectedCategories.includes(cat.name)}
                        className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-colors ${
                          selectedCategories.includes(cat.name)
                            ? 'bg-emerald-600 text-white'
                            : 'bg-foreground/[0.05] text-foreground/70 hover:bg-foreground/[0.09]'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Region */}
              <section>
                <label htmlFor="filter-region" className={sectionLabel}>Region</label>
                <select
                  id="filter-region"
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                  className="w-full h-11 bg-foreground/[0.04] border border-foreground/10 rounded-xl px-3.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                >
                  <option value="">All regions</option>
                  {TANZANIA_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </section>

              {/* Rating */}
              <section>
                <h3 className={sectionLabel}>Minimum rating</h3>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setRating(star === rating ? null : star)}
                      aria-label={`${star} stars and up`}
                      aria-pressed={!!rating && star <= rating}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${rating && star <= rating ? 'bg-emerald-600 text-white' : 'bg-foreground/[0.05] text-foreground/40 hover:bg-foreground/[0.09]'}`}
                    >
                      <Star className={`w-4 h-4 ${rating && star <= rating ? 'fill-current' : ''}`} />
                    </button>
                  ))}
                </div>
              </section>

              {/* Toggles */}
              <section className="space-y-1">
                <label className="flex items-center justify-between py-2.5 cursor-pointer min-h-11">
                  <span className="text-sm font-semibold text-foreground">Verified sellers only</span>
                  <div
                    role="switch" aria-checked={verified}
                    onClick={() => setVerified(!verified)}
                    className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${verified ? 'bg-emerald-500' : 'bg-foreground/15'}`}
                  >
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${verified ? 'translate-x-5' : ''}`} />
                  </div>
                </label>
                <label className="flex items-center justify-between py-2.5 cursor-pointer min-h-11">
                  <span className="text-sm font-semibold text-foreground">In stock only</span>
                  <div
                    role="switch" aria-checked={stock}
                    onClick={() => setStock(!stock)}
                    className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${stock ? 'bg-emerald-500' : 'bg-foreground/15'}`}
                  >
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${stock ? 'translate-x-5' : ''}`} />
                  </div>
                </label>
              </section>
            </div>

            <div
              className="px-5 pt-4 border-t border-foreground/8 grid grid-cols-2 gap-3 shrink-0"
              style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
            >
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-1.5 h-12 rounded-2xl border border-foreground/15 text-xs font-bold uppercase tracking-wider text-foreground/70 hover:bg-foreground/[0.04] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              <button
                onClick={handleApply}
                className="h-12 rounded-2xl bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Apply filters
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
