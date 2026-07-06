import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppState } from '../context/AppContext';
import { categoryCountsServer, trendingProductsServer } from '../services/exploreService';
import { fetchActiveStores } from '../services/shopService';
import { CATEGORY_HIERARCHY } from '../constants';
import { VendorProfile } from '../types';
import { LayoutGrid, Store, Flame, Tag, Search } from 'lucide-react';
import { ExploreTab, TrendSubTab, CATEGORY_IMAGES } from '../components/categories/categoryConstants';
import { CategoriesTab } from '../components/categories/CategoriesTab';
import { StoresTab } from '../components/categories/StoresTab';
import { TrendingTab } from '../components/categories/TrendingTab';
import { DealsTab } from '../components/categories/DealsTab';

export const CategoriesPage = () => {
  const { categories, products, offers, followSeller, unfollowSeller, isFollowing, user } = useAppState();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlTab = searchParams.get('tab') as ExploreTab | null;
  const [tab, setTabState] = useState<ExploreTab>(
    urlTab === 'stores' || urlTab === 'trending' || urlTab === 'deals' ? urlTab : 'categories'
  );
  const setTab = (t: ExploreTab) => {
    setTabState(t);
    setSearchParams(t === 'categories' ? {} : { tab: t }, { replace: true });
  };

  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [storeFilter, setStoreFilter] = useState<'all' | 'verified' | 'new'>('all');
  const [regionFilter, setRegionFilter] = useState('');
  const [trendSub, setTrendSub] = useState<TrendSubTab>('hot');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [serverCounts, setServerCounts] = useState<Record<string, number> | null>(null);
  const [serverTrending, setServerTrending] = useState<any[] | null>(null);

  useEffect(() => {
    // Server data is an enhancement — on failure the client-side fallbacks
    // below take over instead of leaving the tab stuck on nulls.
    categoryCountsServer().then(setServerCounts).catch(() => setServerCounts(null));
    trendingProductsServer(16).then(setServerTrending).catch(() => setServerTrending(null));
  }, []);

  const VENDOR_PAGE = 24;
  const [vendorPage, setVendorPage] = useState(1);
  const [hasMoreVendors, setHasMoreVendors] = useState(false);
  useEffect(() => {
    if (tab !== 'stores') return;
    let live = true;
    setLoadingVendors(true);
    // RLS-safe: reads public_vendor_profiles via the service, never the
    // owner-only vendor_profiles table directly (which returns nothing here).
    fetchActiveStores(vendorPage, VENDOR_PAGE).then(({ stores, hasMore }) => {
      if (!live) return;
      setVendors(stores);
      setHasMoreVendors(hasMore);
      setLoadingVendors(false);
    });
    return () => { live = false; };
  }, [tab, vendorPage]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const categoryCounts = useMemo(() => {
    if (serverCounts) return serverCounts;
    const counts: Record<string, number> = {};
    for (const p of products) {
      if (p.status === 'inactive' || !p.category) continue;
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts;
  }, [products, serverCounts]);

  const organizedCategories = useMemo(() => {
    const top = categories.filter(c => !c.parent_id);
    const children = categories.filter(c => c.parent_id);
    const result = top.map(p => ({ ...p, subcategories: children.filter(c => c.parent_id === p.id) }));
    if (result.length === 0) {
      return Object.keys(CATEGORY_HIERARCHY).map(k => ({
        id: k, name: k, image_url: CATEGORY_IMAGES[k],
        subcategories: CATEGORY_HIERARCHY[k].map((s, i) => ({ id: `${k}-${i}`, name: s })),
      }));
    }
    return result.map((cat: any) => ({
      ...cat,
      subcategories: cat.subcategories.length > 0
        ? cat.subcategories
        : (CATEGORY_HIERARCHY[cat.name] || []).map((s: string, i: number) => ({ id: `${cat.id}-${i}`, name: s })),
    }));
  }, [categories]);

  const visibleCategories = useMemo(() => {
    if (!searchQ.trim()) return organizedCategories;
    const q = searchQ.toLowerCase();
    return organizedCategories.filter((c: any) =>
      c.name?.toLowerCase().includes(q) ||
      c.subcategories?.some((s: any) => s.name?.toLowerCase().includes(q))
    );
  }, [organizedCategories, searchQ]);

  const hotProducts = useMemo(() =>
    serverTrending?.length ? serverTrending :
    [...products].filter(p => p.status !== 'inactive')
      .sort((a, b) => (b.rating || 0) * ((b as any).review_count || 1) - (a.rating || 0) * ((a as any).review_count || 1))
      .slice(0, 16),
    [products, serverTrending]
  );
  const newArrivals = useMemo(() =>
    [...products].filter(p => p.status !== 'inactive')
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 16),
    [products]
  );
  const topRated = useMemo(() =>
    [...products].filter(p => p.status !== 'inactive' && (p.rating || 0) >= 4)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 16),
    [products]
  );
  const trendingProducts = trendSub === 'new' ? newArrivals : trendSub === 'rated' ? topRated : hotProducts;

  const activeDeals = useMemo(() =>
    offers.filter(o => o.status === 'active').sort((a, b) => (b.is_flash_sale ? 1 : 0) - (a.is_flash_sale ? 1 : 0)),
    [offers]
  );

  const storeRegions = useMemo(() =>
    ['', ...Array.from(new Set(vendors.map(v => v.region).filter(Boolean) as string[])).sort()],
    [vendors]
  );
  const filteredVendors = useMemo(() => {
    let v = vendors;
    if (searchQ) v = v.filter(x => x.store_name?.toLowerCase().includes(searchQ.toLowerCase()) || x.description?.toLowerCase().includes(searchQ.toLowerCase()));
    if (storeFilter === 'verified') v = v.filter(x => x.is_verified);
    if (storeFilter === 'new') v = v.filter(x => !x.is_verified && (x.total_sales || 0) < 10);
    if (regionFilter) v = v.filter(x => x.region === regionFilter);
    return v;
  }, [vendors, searchQ, storeFilter, regionFilter]);

  const totalProducts = Object.values(categoryCounts).reduce((a, b) => a + b, 0) || products.length;

  const TABS: { id: ExploreTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'categories', label: 'Categories', icon: LayoutGrid },
    { id: 'stores',     label: 'Stores',     icon: Store },
    { id: 'trending',   label: 'Trending',   icon: Flame },
    { id: 'deals',      label: 'Deals',      icon: Tag, badge: activeDeals.length || undefined },
  ];

  return (
    <div className="min-h-screen bg-background pt-16 md:pt-20 pb-[calc(5rem+env(safe-area-inset-bottom))]">

      {/* Hero */}
      <div className="bg-foreground text-background px-5 md:px-8 pt-6 md:pt-10 pb-4 md:pb-0">
        <div className="container mx-auto max-w-7xl">
          <p className="text-[10px] uppercase tracking-[0.3em] text-background/40 font-bold mb-2 md:mb-3">Explore MaliMart</p>
          <h1 className="text-2xl md:text-5xl font-bold tracking-tight leading-tight mb-3 md:mb-4">
            Discover Tanzania's{' '}
            <span className="text-emerald-400">Best Marketplace</span>
          </h1>
          <div className="flex items-center gap-5 text-xs text-background/50 mb-4">
            {totalProducts > 0 && (
              <span className="flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-background/80">{totalProducts.toLocaleString()}</span> products
              </span>
            )}
            {vendors.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-background/80">{vendors.length}</span> sellers
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold text-background/80">{organizedCategories.length || Object.keys(CATEGORY_HIERARCHY).length}</span> categories
            </span>
          </div>
          {/* Search — visible above the fold on mobile */}
          <div className="relative max-w-lg mb-4 md:mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-background/40 pointer-events-none" />
            <input
              type="search"
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); if (tab !== 'categories') setTab('categories'); }}
              placeholder="Search categories, stores…"
              className="w-full h-11 bg-background/10 border border-background/20 rounded-2xl pl-10 pr-4 text-sm text-background placeholder:text-background/40 focus:outline-none focus:border-emerald-400/60 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Tab navigation — sticky offset matches the fixed navbar height (h-16 / md:h-20) */}
      <div className="sticky top-16 md:top-20 z-20 bg-background/95 backdrop-blur-xl border-b border-foreground/8">
        <div className="container mx-auto max-w-7xl px-4 md:px-8">
          <div className="flex gap-1 overflow-x-auto no-scrollbar py-2">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`relative flex items-center gap-2 px-4 py-3 min-h-[44px] rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${tab === t.id ? 'bg-foreground text-background' : 'text-foreground/45 hover:text-foreground hover:bg-foreground/[0.05]'}`}>
                  <Icon className="w-3.5 h-3.5 stroke-[2]" />
                  {t.label}
                  {t.badge ? (
                    <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                      {t.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="container mx-auto max-w-7xl px-4 md:px-8 py-8">
        <AnimatePresence mode="wait">
          {tab === 'categories' && (
            <CategoriesTab
              visibleCategories={visibleCategories}
              categoryCounts={categoryCounts}
              searchQ={searchQ}
              expandedCat={expandedCat}
              onSearchChange={setSearchQ}
              onExpandCat={setExpandedCat}
              onViewDeals={() => setTab('deals')}
            />
          )}
          {tab === 'stores' && (
            <div>
              <StoresTab
                filteredVendors={filteredVendors}
                loadingVendors={loadingVendors}
                searchQ={searchQ}
                storeFilter={storeFilter}
                regionFilter={regionFilter}
                storeRegions={storeRegions}
                isFollowing={isFollowing}
                followSeller={followSeller}
                unfollowSeller={unfollowSeller}
                user={user}
                onSearchChange={setSearchQ}
                onStoreFilterChange={setStoreFilter}
                onRegionChange={setRegionFilter}
              />
              {hasMoreVendors && !loadingVendors && (
                <div className="flex justify-center mt-8">
                  <button onClick={() => setVendorPage(p => p + 1)}
                    className="h-11 px-8 rounded-xl bg-foreground/[0.06] hover:bg-foreground/[0.1] text-foreground text-sm font-bold transition-colors">
                    Load more stores
                  </button>
                </div>
              )}
            </div>
          )}
          {tab === 'trending' && (
            <TrendingTab
              trendingProducts={trendingProducts as any}
              trendSub={trendSub}
              organizedCategories={organizedCategories}
              onTrendSubChange={setTrendSub}
            />
          )}
          {tab === 'deals' && (
            <DealsTab activeDeals={activeDeals} products={products} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
