import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, ArrowRight, TrendingUp, Tag, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../context/AppContext';
import { CURRENCY } from '../constants';

interface SearchModalProps {
  isSearchOpen: boolean;
  setIsSearchOpen: (isOpen: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleSearch: (e: React.FormEvent) => void;
  isSearching: boolean;
  searchResults: { products: any[]; categories: string[] };
  searchInputRef: React.RefObject<HTMLInputElement>;
}

const RECENT_KEY = 'malimart:recent-searches';

/**
 * Mobile-first full-screen search.
 *
 * No giant editorial heading (the previous version had a 7xl placeholder
 * input — looked dated, wasted vertical space on mobile).
 *
 * Structure:
 *   - Compact pill input at top with close button
 *   - If no query: trending categories + recent searches + popular products grid
 *   - If query: inline results filtered from local products
 *
 * Esc + click backdrop both close.
 */
export const SearchModal = ({
  isSearchOpen,
  setIsSearchOpen,
  searchQuery,
  setSearchQuery,
  handleSearch,
  isSearching,
  searchInputRef,
}: SearchModalProps) => {
  const navigate = useNavigate();
  const { products } = useAppState();

  // Local search results from in-memory product list (fast, no extra fetch)
  const liveResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return products
      .filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.seller_name?.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [searchQuery, products]);

  // Popular products (rating × reviews)
  const popularProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => (b.rating || 0) * (b.review_count || 0) - (a.rating || 0) * (a.review_count || 0))
      .slice(0, 6);
  }, [products]);

  const trendingTags = useMemo(() => {
    const tagSet = new Set<string>();
    products.forEach(p => p.category && tagSet.add(p.category));
    return Array.from(tagSet).slice(0, 8);
  }, [products]);

  // Recent searches (localStorage)
  const [recent, setRecent] = React.useState<string[]>([]);
  useEffect(() => {
    if (!isSearchOpen) return;
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      setRecent(raw ? JSON.parse(raw) : []);
    } catch { setRecent([]); }
  }, [isSearchOpen]);

  const pushRecent = (q: string) => {
    if (!q.trim()) return;
    const next = [q, ...recent.filter(r => r !== q)].slice(0, 5);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
  };

  // Focus input on open
  useEffect(() => {
    if (!isSearchOpen) return;
    const t = setTimeout(() => searchInputRef.current?.focus(), 120);
    document.body.style.overflow = 'hidden';
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setIsSearchOpen(false);
    window.addEventListener('keydown', onEsc);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onEsc);
    };
  }, [isSearchOpen, setIsSearchOpen, searchInputRef]);

  const goToShop = (q: string) => {
    pushRecent(q);
    navigate(`/shop?q=${encodeURIComponent(q)}`);
    setIsSearchOpen(false);
  };

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[120] bg-background flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center gap-2 p-4 md:p-5 border-b border-foreground/8">
            <form onSubmit={(e) => { pushRecent(searchQuery); handleSearch(e); }} className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/45 stroke-[2.2]" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search products, brands, sellers…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-11 pr-12 rounded-xl bg-foreground/[0.04] text-foreground text-[15px] font-medium placeholder:text-foreground/40 focus:outline-none focus:bg-foreground/[0.07] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-foreground/10 text-foreground/70 hover:bg-foreground/15 flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              )}
            </form>
            <button
              onClick={() => setIsSearchOpen(false)}
              className="text-sm font-semibold text-foreground/70 hover:text-foreground px-3"
            >
              Cancel
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {/* Live results */}
            {searchQuery.trim().length >= 2 && (
              <div className="px-4 md:px-5 py-4">
                {isSearching ? (
                  <div className="flex items-center justify-center py-12 text-foreground/45">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Searching…
                  </div>
                ) : liveResults.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-foreground/55">
                      No results for <span className="font-semibold text-foreground">"{searchQuery}"</span>.
                    </p>
                    <button
                      onClick={() => goToShop(searchQuery)}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                      Search all of MaliMart
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/45 mb-3">
                      Matching products
                    </p>
                    <div className="space-y-2">
                      {liveResults.map(p => (
                        <button
                          key={p.id}
                          onClick={() => { setIsSearchOpen(false); navigate(`/product/${p.id}`); pushRecent(p.name); }}
                          className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-foreground/[0.04] text-left transition-colors"
                        >
                          <img src={p.images?.[0]} alt={p.name} className="w-12 h-12 rounded-lg object-cover bg-foreground/5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                            <p className="text-[12px] text-foreground/50 truncate">{p.seller_name} · {p.category}</p>
                          </div>
                          <span className="text-sm font-bold text-foreground tabular-nums flex-shrink-0">
                            {CURRENCY} {Math.round(p.price).toLocaleString()}
                          </span>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => goToShop(searchQuery)}
                      className="w-full mt-4 h-12 rounded-xl bg-foreground/[0.04] hover:bg-foreground/[0.07] text-sm font-semibold text-foreground flex items-center justify-center gap-1.5 transition-colors"
                    >
                      See all results for "{searchQuery}"
                      <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Empty state */}
            {searchQuery.trim().length < 2 && (
              <div className="px-4 md:px-5 py-4 space-y-7">
                {recent.length > 0 && (
                  <section>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/45 mb-2.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Recent
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {recent.map(r => (
                        <button
                          key={r}
                          onClick={() => goToShop(r)}
                          className="px-3 py-1.5 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08] text-[13px] font-medium text-foreground transition-colors"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {trendingTags.length > 0 && (
                  <section>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/45 mb-2.5 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" /> Categories
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {trendingTags.map(t => (
                        <button
                          key={t}
                          onClick={() => { setIsSearchOpen(false); navigate(`/shop?category=${encodeURIComponent(t)}`); }}
                          className="px-3 py-1.5 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08] text-[13px] font-medium text-foreground transition-colors"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {popularProducts.length > 0 && (
                  <section>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/45 mb-3 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" /> Trending products
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {popularProducts.map(p => (
                        <button
                          key={p.id}
                          onClick={() => { setIsSearchOpen(false); navigate(`/product/${p.id}`); }}
                          className="text-left group"
                        >
                          <div className="aspect-square rounded-xl overflow-hidden bg-foreground/5 mb-2">
                            <img src={p.images?.[0]} alt={p.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                          </div>
                          <p className="text-[13px] font-semibold text-foreground line-clamp-1">{p.name}</p>
                          <p className="text-xs font-bold text-foreground/70 tabular-nums">{CURRENCY} {Math.round(p.price).toLocaleString()}</p>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
