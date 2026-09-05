import { useDebounce } from '../src/hooks/useDebounce';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, X, ArrowUpDown, Loader2, Shuffle, Store, LayoutGrid, Tag } from 'lucide-react';
import { BackendError } from '../components/UI';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppState } from '../context/AppContext';
import { ProductCard } from '../components/ProductCard';
import { FilterSidebar } from '../components/FilterSidebar';
import { Product, VendorProfile } from '../types';
import { searchProductsServer } from '../services/searchService';
import { shopProductsServer, fetchActiveStores } from '../services/shopService';
import { categoryCountsServer } from '../services/exploreService';
import { MaliEmptyState } from '../components/MaliSoul';
import { StoresTab } from '../components/categories/StoresTab';
import { DealsTab } from '../components/categories/DealsTab';

/**
 * ShopPage — the merged Explore + Shop experience.
 *
 * Used to be two separate pages with two separate identities: /shop (a flat
 * filterable grid, no browse/discovery framing) and /categories aka
 * "Explore" (a tabbed hub — Categories bubbles, Stores, Trending, Deals —
 * that never shared state with /shop at all: its search box didn't touch
 * the URL, its category bubbles just linked OUT to /shop, and its Trending
 * tab reimplemented a second, lighter product card with no cart/wishlist
 * actions because it never used the real ProductCard).
 *
 * One page now. One search box, one product card, one filter/sort system,
 * one category-count source. What survives from each original:
 *  - Shop's server-backed search/filter/sort/grid (shopProductsServer),
 *    now with real pagination (the RPC always supported `offset`; nothing
 *    called it, so results were hard-capped at 48 with no way to see more).
 *  - Explore's tabbed framing and dark hero, trimmed from 4 tabs to 3 —
 *    "Categories" is gone as a destination because category browsing is
 *    now a filter chip row on the product grid itself, not a separate page
 *    of bubbles that just links back to Shop anyway. "Trending" is gone as
 *    a tab for the same reason: it's the "Top Rated" / "Most Popular" sort
 *    on the SAME grid, not a second product-listing pipeline with its own
 *    heuristic that could quietly disagree with the first.
 *  - Stores and Deals keep their existing tab bodies (StoresTab/DealsTab)
 *    verbatim — both were already solid, tab-scoped experiences; only the
 *    page shell around them changed.
 */

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'popular', label: 'Most Popular' },
];

const PAGE_SIZE = 48;
const VENDOR_PAGE = 24;

type ShopTab = 'all' | 'stores' | 'deals';

const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <button
    onClick={onRemove}
    aria-label={`Remove filter ${label}`}
    className="flex-shrink-0 flex items-center gap-1.5 h-7 px-3 rounded-full bg-foreground text-background text-[11px] font-semibold active:scale-95 transition-transform"
  >
    {label}
    <X className="w-3 h-3 stroke-[3]" />
  </button>
);

export const ShopPage: React.FC = () => {
  const { products, categories, offers, isLoading, catalogError, refreshProducts, followSeller, unfollowSeller, isFollowing, user } = useAppState();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ─── Tab ─────────────────────────────────────────────────────────────────
  const urlTab = searchParams.get('tab');
  const [tab, setTabState] = useState<ShopTab>(urlTab === 'stores' || urlTab === 'deals' ? urlTab : 'all');
  const setTab = (t: ShopTab) => {
    setTabState(t);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (t === 'all') next.delete('tab'); else next.set('tab', t);
      return next;
    }, { replace: true });
  };

  // ─── Search (shared between the products grid and the Stores tab) ──────────
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || searchParams.get('search') || '');

  // ─── Products: filters/sort ──────────────────────────────────────────────
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'relevance');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<any>({
    priceRange: [0, 5000000],
    categories: searchParams.get('category') ? [searchParams.get('category')!] : [],
    location: '',
    rating: null,
    verified: false,
    stock: false,
  });

  useEffect(() => {
    const q = searchParams.get('q') || searchParams.get('search');
    if (q) setSearchQuery(q);
    const cat = searchParams.get('category');
    if (cat) setActiveFilters((prev: any) => ({ ...prev, categories: [cat] }));
  }, [searchParams]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeFilters.categories?.length) count++;
    if (activeFilters.location) count++;
    if (activeFilters.rating) count++;
    if (activeFilters.verified) count++;
    if (activeFilters.stock) count++;
    if (activeFilters.priceRange?.[0] > 0 || activeFilters.priceRange?.[1] < 5000000) count++;
    return count;
  }, [activeFilters]);

  // ─── Category chip rail — counts sourced full-catalog when available ───────
  const [serverCounts, setServerCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => { categoryCountsServer().then(setServerCounts).catch(() => setServerCounts(null)); }, []);
  const categoryCounts = useMemo(() => {
    if (serverCounts) return serverCounts;
    const counts: Record<string, number> = {};
    for (const p of products) {
      if (p.status === 'inactive' || !p.category) continue;
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts;
  }, [products, serverCounts]);
  const activeCategories = categories.filter(c => c.is_active !== false);

  // ─── Server-backed product search/filter/sort, with real pagination ───────
  const debouncedQuery = useDebounce(searchQuery, 350);
  const debouncedFilters = useDebounce(JSON.stringify(activeFilters), 400);
  const [serverResults, setServerResults] = useState<Product[] | null>(null);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [shopLoading, setShopLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (tab !== 'all') return;
    const filters = JSON.parse(debouncedFilters);
    let cancelled = false;
    setPage(0);
    setShopLoading(true);
    shopProductsServer({
      query: debouncedQuery,
      category: filters.categories?.[0],
      minPrice: filters.priceRange?.[0],
      maxPrice: filters.priceRange?.[1],
      minRating: filters.rating,
      verified: filters.verified,
      inStock: filters.stock,
      region: filters.location,
      sort: sortBy,
      limit: PAGE_SIZE,
      offset: 0,
    }).then(res => {
      if (cancelled) return;
      if (res) {
        setServerResults(res.products);
        setServerTotal(res.totalCount);
        setShopLoading(false);
        return;
      }
      setServerTotal(null);
      if (debouncedQuery.trim().length >= 2) {
        searchProductsServer(debouncedQuery).then(r2 => {
          if (!cancelled) { setServerResults(r2); setShopLoading(false); }
        });
      } else {
        setServerResults(null);
        setShopLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [debouncedQuery, debouncedFilters, sortBy, tab]);

  const handleLoadMore = async () => {
    if (loadingMore || serverTotal === null || !serverResults) return;
    setLoadingMore(true);
    const filters = JSON.parse(debouncedFilters);
    const nextPage = page + 1;
    const res = await shopProductsServer({
      query: debouncedQuery,
      category: filters.categories?.[0],
      minPrice: filters.priceRange?.[0],
      maxPrice: filters.priceRange?.[1],
      minRating: filters.rating,
      verified: filters.verified,
      inStock: filters.stock,
      region: filters.location,
      sort: sortBy,
      limit: PAGE_SIZE,
      offset: nextPage * PAGE_SIZE,
    });
    if (res) {
      setServerResults(prev => [...(prev || []), ...res.products]);
      setPage(nextPage);
    }
    setLoadingMore(false);
  };

  // Bootstrap guard: if the primary RPC fails and context products are also
  // empty once loading settles, force a context refresh so the fallback path
  // has data. Runs at most once per mount.
  const didBootstrap = useRef(false);
  useEffect(() => {
    if (tab === 'all' && !shopLoading && serverResults === null && products.length === 0 && !isLoading && !didBootstrap.current) {
      didBootstrap.current = true;
      refreshProducts();
    }
  }, [shopLoading, serverResults, products.length, isLoading, refreshProducts, tab]);

  const filteredProducts = useMemo(() => {
    const source = serverResults ?? products;
    let list = source.filter(p => p.status !== 'inactive');

    if (searchQuery.trim() && !(serverResults?.length)) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.seller_name?.toLowerCase().includes(q)
      );
    }
    if (activeFilters.categories?.length) {
      list = list.filter(p => activeFilters.categories.some((c: string) => p.category === c || p.category?.toLowerCase() === c.toLowerCase()));
    }
    if (activeFilters.priceRange) {
      list = list.filter(p => p.price >= activeFilters.priceRange[0] && p.price <= activeFilters.priceRange[1]);
    }
    if (activeFilters.rating) list = list.filter(p => (p.rating || 0) >= activeFilters.rating);
    if (activeFilters.verified) list = list.filter(p => p.is_verified);
    if (activeFilters.stock) list = list.filter(p => p.stock > 0);
    if (activeFilters.location?.trim()) {
      const loc = activeFilters.location.toLowerCase();
      list = list.filter(p => p.location?.toLowerCase().includes(loc));
    }

    switch (sortBy) {
      case 'newest': list = [...list].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()); break;
      case 'price_asc': list = [...list].sort((a, b) => a.price - b.price); break;
      case 'price_desc': list = [...list].sort((a, b) => b.price - a.price); break;
      case 'rating': list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
      case 'popular': list = [...list].sort((a, b) => (b.rating || 0) * (b.review_count || 0) - (a.rating || 0) * (a.review_count || 0)); break;
    }
    return list;
  }, [products, serverResults, searchQuery, activeFilters, sortBy]);

  // Valid whenever the server path is active: shopProductsServer already
  // applied query/category/price/rating/verified/stock/region server-side,
  // so filteredProducts' client-side pass over serverResults re-applies the
  // same predicates idempotently rather than narrowing further — comparing
  // its length to serverTotal is a safe proxy for "more pages exist" with
  // filters/search active, not just on an unfiltered browse.
  const hasMoreProducts = tab === 'all' && serverTotal !== null && filteredProducts.length < serverTotal;

  const clearAllFilters = () => {
    setSearchQuery('');
    setActiveFilters({ priceRange: [0, 5000000], categories: [], location: '', rating: null, verified: false, stock: false });
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('q'); n.delete('search'); n.delete('category'); return n; }, { replace: true });
  };

  const toggleCategoryChip = (name: string) => {
    setActiveFilters((prev: any) => {
      const has = prev.categories?.includes(name);
      const nextCats = has ? [] : [name];
      setSearchParams(sp => {
        const n = new URLSearchParams(sp);
        if (nextCats.length) n.set('category', name); else n.delete('category');
        return n;
      }, { replace: true });
      return { ...prev, categories: nextCats };
    });
  };

  // ─── Stores tab data ────────────────────────────────────────────────────
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [storeFilter, setStoreFilter] = useState<'all' | 'verified' | 'new'>('all');
  const [regionFilter, setRegionFilter] = useState('');
  const [vendorPage, setVendorPage] = useState(1);
  const [hasMoreVendors, setHasMoreVendors] = useState(false);
  useEffect(() => {
    if (tab !== 'stores') return;
    let live = true;
    setLoadingVendors(true);
    fetchActiveStores(vendorPage, VENDOR_PAGE).then(({ stores, hasMore }) => {
      if (!live) return;
      setVendors(stores);
      setHasMoreVendors(hasMore);
      setLoadingVendors(false);
    });
    return () => { live = false; };
  }, [tab, vendorPage]);

  const storeRegions = useMemo(() => ['', ...Array.from(new Set(vendors.map(v => v.region).filter(Boolean) as string[])).sort()], [vendors]);
  const filteredVendors = useMemo(() => {
    let v = vendors;
    if (searchQuery) v = v.filter(x => x.store_name?.toLowerCase().includes(searchQuery.toLowerCase()) || x.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    if (storeFilter === 'verified') v = v.filter(x => x.is_verified);
    if (storeFilter === 'new') v = v.filter(x => !x.is_verified && (x.total_sales || 0) < 10);
    if (regionFilter) v = v.filter(x => x.region === regionFilter);
    return v;
  }, [vendors, searchQuery, storeFilter, regionFilter]);

  // ─── Deals tab data ─────────────────────────────────────────────────────
  const activeDeals = useMemo(() => offers.filter(o => o.status === 'active').sort((a, b) => (b.is_flash_sale ? 1 : 0) - (a.is_flash_sale ? 1 : 0)), [offers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams(prev => {
      const n = new URLSearchParams(prev);
      if (searchQuery.trim()) n.set('q', searchQuery); else { n.delete('q'); n.delete('search'); }
      return n;
    });
  };

  const totalProductCount = Object.values(categoryCounts).reduce((a, b) => a + b, 0) || products.length;

  const TABS: { id: ShopTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'all', label: 'All products', icon: LayoutGrid },
    { id: 'stores', label: 'Stores', icon: Store },
    { id: 'deals', label: 'Deals', icon: Tag, badge: activeDeals.length || undefined },
  ];

  return (
    <div className="min-h-screen bg-background pt-16 md:pt-20 pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* Hero */}
      <div className="bg-stone-900 text-stone-50 px-4 md:px-8 pt-6 md:pt-10 pb-4 md:pb-6">
        <div className="container mx-auto">
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone-50/55 font-bold mb-2 md:mb-3">Shop MaliMart</p>
          <h1 className="text-2xl md:text-5xl font-bold tracking-tight leading-tight mb-3 md:mb-4">
            Everything Tanzania sells, <span className="text-emerald-400">in one place</span>
          </h1>
          <div className="flex items-center gap-5 text-xs text-stone-50/50 mb-4">
            {totalProductCount > 0 && (
              <span className="flex items-center gap-1.5"><LayoutGrid className="w-3.5 h-3.5 text-emerald-400" /><span className="font-bold text-stone-50/80">{totalProductCount.toLocaleString()}</span> products</span>
            )}
            <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-emerald-400" /><span className="font-bold text-stone-50/80">{activeCategories.length || Object.keys(categoryCounts).length}</span> categories</span>
          </div>
          <form onSubmit={handleSearch} className="relative max-w-lg">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-50/55 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={tab === 'stores' ? 'Search stores…' : 'Search products, stores, categories…'}
              className="w-full h-11 bg-white/10 border border-white/20 rounded-2xl pl-10 pr-10 text-sm text-stone-50 placeholder:text-stone-50/55 focus:outline-none focus:border-emerald-400/60 transition-colors"
            />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(''); clearAllFilters(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-50/55 hover:text-stone-50">
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Tabs + (on the products tab) filter/sort */}
      {/* z-40, not z-20: ProductCard's own wishlist/add-to-cart buttons sit at
          z-30 (see ProductCardActions.tsx) so they stay above the card image
          they float over — a header below that bled visibly under them on
          scroll. z-40 matches the tier the mobile bottom nav already uses. */}
      <div className="sticky top-16 md:top-20 z-40 bg-background/95 backdrop-blur-xl border-b border-foreground/8">
        <div className="container mx-auto px-4 md:px-8 py-2.5 flex flex-wrap items-center gap-2.5">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
                  className={`relative flex items-center gap-2 px-4 h-11 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${tab === t.id ? 'bg-foreground text-background' : 'text-foreground/45 hover:text-foreground hover:bg-foreground/[0.05]'}`}>
                  <Icon className="w-3.5 h-3.5 stroke-[2]" />
                  {t.label}
                  {t.badge ? (
                    <span className="w-4 h-4 rounded-full bg-rose-500 dark:bg-rose-600 text-white ring-1 ring-background/40 text-[9px] font-black tabular-nums flex items-center justify-center">{t.badge}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {tab === 'all' && (
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                onClick={() => setIsFilterOpen(true)}
                className={`relative flex items-center gap-2 h-11 px-4 rounded-xl border text-sm font-semibold transition-colors active:scale-95 ${activeFilterCount > 0 ? 'bg-foreground text-background border-foreground' : 'bg-foreground/[0.04] text-foreground border-foreground/10 hover:bg-foreground/[0.08]'}`}
              >
                <SlidersHorizontal className="w-4 h-4 stroke-[2]" />
                <span className="hidden sm:inline">Filter</span>
                {activeFilterCount > 0 && <span className="w-5 h-5 rounded-full bg-emerald-500 text-background text-[10px] font-bold flex items-center justify-center tabular-nums">{activeFilterCount}</span>}
              </button>
              <div className="relative">
                <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/40 stroke-[2] pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={e => {
                    const v = e.target.value;
                    setSortBy(v);
                    setSearchParams(prev => { const n = new URLSearchParams(prev); if (v === 'relevance') n.delete('sort'); else n.set('sort', v); return n; }, { replace: true });
                  }}
                  className="h-11 pl-9 pr-3 max-w-[9.5rem] sm:max-w-none truncate rounded-xl bg-foreground/[0.04] border border-foreground/10 text-foreground text-sm font-semibold focus:outline-none appearance-none cursor-pointer hover:bg-foreground/[0.08] transition-colors sm:pr-4"
                  aria-label="Sort products"
                >
                  {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {tab === 'all' && activeCategories.length > 0 && (
          <div className="container mx-auto px-4 md:px-8 pb-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => toggleCategoryChip('')}
              className={`flex-shrink-0 h-8 px-3.5 rounded-full text-[11px] font-bold transition-colors ${!activeFilters.categories?.length ? 'bg-foreground text-background' : 'bg-foreground/[0.05] text-foreground/60 hover:bg-foreground/[0.09]'}`}
            >
              All
            </button>
            {activeCategories.slice(0, 12).map(c => (
              <button
                key={c.id}
                onClick={() => toggleCategoryChip(c.name)}
                className={`flex-shrink-0 h-8 px-3.5 rounded-full text-[11px] font-bold transition-colors whitespace-nowrap ${activeFilters.categories?.includes(c.name) ? 'bg-foreground text-background' : 'bg-foreground/[0.05] text-foreground/60 hover:bg-foreground/[0.09]'}`}
              >
                {c.name}{categoryCounts[c.name] ? <span className="opacity-50 font-medium"> · {categoryCounts[c.name]}</span> : ''}
              </button>
            ))}
          </div>
        )}

        {tab === 'all' && (activeFilterCount > 0 || searchQuery.trim()) && (
          <div className="container mx-auto px-4 md:px-8 pb-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {searchQuery.trim() && <FilterChip label={`"${searchQuery.trim()}"`} onRemove={() => { setSearchQuery(''); setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('q'); n.delete('search'); return n; }, { replace: true }); }} />}
            {activeFilters.categories?.map((cat: string) => <FilterChip key={cat} label={cat} onRemove={() => toggleCategoryChip(cat)} />)}
            {(activeFilters.priceRange?.[0] > 0 || activeFilters.priceRange?.[1] < 5000000) && (
              <FilterChip label={`TZS ${activeFilters.priceRange[0].toLocaleString()} – ${activeFilters.priceRange[1].toLocaleString()}`} onRemove={() => setActiveFilters((prev: any) => ({ ...prev, priceRange: [0, 5000000] }))} />
            )}
            {activeFilters.rating && <FilterChip label={`${activeFilters.rating}★ & up`} onRemove={() => setActiveFilters((prev: any) => ({ ...prev, rating: null }))} />}
            {activeFilters.location?.trim() && <FilterChip label={activeFilters.location} onRemove={() => setActiveFilters((prev: any) => ({ ...prev, location: '' }))} />}
            {activeFilters.verified && <FilterChip label="Verified sellers" onRemove={() => setActiveFilters((prev: any) => ({ ...prev, verified: false }))} />}
            {activeFilters.stock && <FilterChip label="In stock" onRemove={() => setActiveFilters((prev: any) => ({ ...prev, stock: false }))} />}
            <button onClick={clearAllFilters} className="flex-shrink-0 h-7 px-3 rounded-full text-[11px] font-semibold text-foreground/50 hover:text-foreground border border-foreground/12 hover:border-foreground/30 transition-colors active:scale-95">
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="container mx-auto px-4 md:px-8 py-6">
        <AnimatePresence mode="wait">
          {tab === 'all' && (
            <motion.div key="all" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="text-sm text-foreground/50 mb-3">
                {(shopLoading || isLoading) ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading products…</span>
                ) : (
                  <><span className="font-semibold text-foreground">{serverTotal ?? filteredProducts.length}</span> products{searchQuery ? ` for "${searchQuery}"` : ''}</>
                )}
              </p>

              {(shopLoading || isLoading) ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-8 md:gap-x-5 md:gap-y-10">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="shimmer aspect-[4/5] rounded-2xl" />
                      <div className="shimmer h-3 w-3/4 rounded-full" />
                      <div className="shimmer h-4 w-1/2 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-16 text-center">
                  {catalogError && products.length === 0 ? (
                    <BackendError message={catalogError} onRetry={refreshProducts} />
                  ) : (
                    <>
                      <MaliEmptyState kind="search" />
                      <div className="-mt-6">
                        <button onClick={clearAllFilters} className="px-6 py-3 rounded-2xl bg-foreground text-background text-sm font-semibold active:scale-95 transition-transform">
                          Clear all filters
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-8 md:gap-x-5 md:gap-y-10">
                    {filteredProducts.map((p, i) => (
                      <ProductCard key={p.id} product={p} index={i} onClick={() => navigate(`/product/${p.id}`)} />
                    ))}
                  </div>
                  {hasMoreProducts && (
                    <div className="flex justify-center mt-10">
                      <button onClick={handleLoadMore} disabled={loadingMore} className="h-11 px-8 rounded-xl bg-foreground/[0.06] hover:bg-foreground/[0.1] text-foreground text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2">
                        {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                        {loadingMore ? 'Loading…' : 'Load more products'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {tab === 'stores' && (
            <div>
              <StoresTab
                filteredVendors={filteredVendors}
                loadingVendors={loadingVendors}
                searchQ={searchQuery}
                storeFilter={storeFilter}
                regionFilter={regionFilter}
                storeRegions={storeRegions}
                isFollowing={isFollowing}
                followSeller={followSeller}
                unfollowSeller={unfollowSeller}
                user={user}
                onSearchChange={setSearchQuery}
                onStoreFilterChange={setStoreFilter}
                onRegionChange={setRegionFilter}
              />
              {hasMoreVendors && !loadingVendors && (
                <div className="flex justify-center mt-8">
                  <button onClick={() => setVendorPage(p => p + 1)} className="h-11 px-8 rounded-xl bg-foreground/[0.06] hover:bg-foreground/[0.1] text-foreground text-sm font-bold transition-colors">
                    Load more stores
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'deals' && <DealsTab activeDeals={activeDeals} products={products} />}
        </AnimatePresence>
      </div>

      {tab === 'all' && (
        <FilterSidebar
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          categories={categories}
          onFilterChange={setActiveFilters}
          activeFilters={activeFilters}
        />
      )}

      {tab === 'all' && products.length > 0 && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2, type: 'spring', stiffness: 300 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => {
            const active = products.filter(p => p.status !== 'inactive');
            if (!active.length) return;
            const pick = active[Math.floor(Math.random() * active.length)];
            navigate(`/product/${pick.id}`);
          }}
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom)+1rem)] md:bottom-8 right-4 z-[70] flex items-center gap-2 h-12 px-5 rounded-full bg-foreground text-background text-xs font-black uppercase tracking-widest shadow-xl shadow-black/20 hover:shadow-2xl transition-shadow"
          aria-label="Discover a random product"
        >
          <motion.span animate={{ rotate: [0, 20, -20, 0] }} transition={{ repeat: Infinity, repeatDelay: 4, duration: 0.6 }}>
            <Shuffle className="w-4 h-4" />
          </motion.span>
          <span className="hidden sm:inline">Surprise me</span>
        </motion.button>
      )}
    </div>
  );
};

export default ShopPage;
