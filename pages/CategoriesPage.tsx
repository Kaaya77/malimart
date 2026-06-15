import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAppState } from '../context/AppContext';
import { supabase } from '../services/supabaseClient';
import { categoryCountsServer, trendingProductsServer } from '../services/exploreService';
import { formatTZS, CATEGORY_HIERARCHY } from '../constants';
import { VendorProfile } from '../types';
import {
  LayoutGrid, ArrowRight, Star, Store, BadgeCheck,
  Heart, Search, TrendingUp, Users, Package, MapPin,
  Flame, Crown, Clock, Tag, Zap, Gift, Sparkles, ChevronRight, X,
} from 'lucide-react';

// ─── Correct image map — overrides bad DB image_url values ───────────────────
const CATEGORY_IMAGES: Record<string, string> = {
  'Fashion & Beauty':    'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800',
  'Pantry & Spices':     'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=800',
  'Handicrafts':         'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&q=80&w=800',
  'Electronics':         'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&q=80&w=800',
  'Home & Living':       'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800',
  'Agriculture':         'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=800',
  'Construction':        'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=800',
  'Kids & Toys':         'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&q=80&w=800',
  'Vehicles':            'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&q=80&w=800',
  'Books & Stationery':  'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=800',
};

const CATEGORY_EMOJIS: Record<string, string> = {
  'Fashion & Beauty': '👗', 'Pantry & Spices': '🌶️', 'Handicrafts': '🪵',
  'Electronics': '📱', 'Home & Living': '🏠', 'Agriculture': '🌾',
  'Construction': '🏗️', 'Kids & Toys': '🧸', 'Vehicles': '🚗', 'Books & Stationery': '📚',
};

// ─── Flash-sale countdown ─────────────────────────────────────────────────────
function useCountdown(endDate?: string) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!endDate) return;
    const tick = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Ended'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endDate]);
  return timeLeft;
}

// ─── Store Card ───────────────────────────────────────────────────────────────
const StoreCard: React.FC<{
  vendor: VendorProfile;
  isFavorite: boolean;
  onFavoriteToggle: () => void;
  rank?: number;
}> = React.memo(({ vendor, isFavorite, onFavoriteToggle, rank }) => {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-background border border-foreground/8 rounded-3xl overflow-hidden hover:border-foreground/20 hover:shadow-lg transition-all group cursor-pointer"
      onClick={() => navigate(`/store/${vendor.seller_id}`)}
    >
      <div className="aspect-[16/7] relative overflow-hidden bg-foreground/[0.04]">
        {vendor.banner_url
          ? <img src={vendor.banner_url} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" loading="lazy" decoding="async"/>
          : <div className="w-full h-full bg-gradient-to-br from-emerald-500/10 to-foreground/10"/>
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"/>
        {rank && rank <= 3 && (
          <div className="absolute top-3 left-3">
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black text-white ${rank===1?'bg-amber-500':rank===2?'bg-gray-400':'bg-amber-700'}`}>
              <Crown className="w-3 h-3"/> #{rank}
            </div>
          </div>
        )}
        <button
          onClick={e => { e.stopPropagation(); onFavoriteToggle(); }}
          className={`absolute top-3 right-3 w-8 h-8 rounded-full backdrop-blur-md flex items-center justify-center transition-all active:scale-90 ${isFavorite ? 'bg-rose-500 text-white' : 'bg-white/80 text-foreground/60 hover:text-rose-500'}`}
        >
          <Heart className={`w-3.5 h-3.5 stroke-[2.5] ${isFavorite ? 'fill-current stroke-none' : ''}`}/>
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-foreground/[0.06] border-2 border-background -mt-8 shrink-0 shadow-md">
            {vendor.logo_url
              ? <img src={vendor.logo_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async"/>
              : <div className="w-full h-full flex items-center justify-center font-black text-lg text-foreground/40">{(vendor.store_name||'?')[0]}</div>
            }
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-foreground text-sm truncate">{vendor.store_name}</h3>
              {vendor.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0"/>}
            </div>
            <p className="text-xs text-foreground/45 truncate">{vendor.description?.slice(0, 40) || 'Tanzanian Seller'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-foreground/45">
          {vendor.rating && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-current stroke-none"/>
              <span className="font-semibold text-foreground/70">{vendor.rating.toFixed(1)}</span>
            </span>
          )}
          {vendor.total_sales != null && (
            <span className="flex items-center gap-1"><Package className="w-3 h-3"/>{vendor.total_sales} sales</span>
          )}
          {vendor.region && (
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{vendor.region}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
});

// ─── Deal Card ────────────────────────────────────────────────────────────────
const DealCard: React.FC<{ offer: any }> = ({ offer }) => {
  const navigate = useNavigate();
  const countdown = useCountdown(offer.end_date);
  const isFlash = offer.is_flash_sale;

  const badgeColor = offer.campaign_type === 'bogo'
    ? 'bg-indigo-500'
    : offer.campaign_type === 'shipping'
    ? 'bg-sky-500'
    : 'bg-rose-500';

  const icon = offer.campaign_type === 'bogo'
    ? <Gift className="w-4 h-4"/>
    : offer.campaign_type === 'shipping'
    ? <Package className="w-4 h-4"/>
    : <Zap className="w-4 h-4 fill-current"/>;

  const label = offer.type === 'percentage'
    ? `${offer.value}% OFF`
    : offer.campaign_type === 'bogo'
    ? `Buy ${offer.buy_quantity} Get ${offer.get_quantity}`
    : offer.campaign_type === 'shipping'
    ? 'Free Delivery'
    : formatTZS(offer.value) + ' OFF';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-3xl overflow-hidden border ${isFlash ? 'border-rose-200 dark:border-rose-900/50' : 'border-foreground/8'} bg-background group`}
    >
      {isFlash && (
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-orange-500/5 pointer-events-none"/>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className={`${badgeColor} text-white rounded-2xl px-3 py-1.5 flex items-center gap-1.5 text-xs font-black`}>
            {icon}
            {label}
          </div>
          {isFlash && countdown && countdown !== 'Ended' && (
            <div className="flex items-center gap-1.5 text-rose-500 text-[10px] font-black uppercase tracking-wider">
              <Clock className="w-3 h-3"/> {countdown}
            </div>
          )}
        </div>

        <h3 className="font-bold text-foreground text-sm mb-1">{offer.title || label}</h3>

        {offer.code && !offer.is_auto_apply && (
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-3 h-3 text-foreground/40"/>
            <span className="font-mono text-xs font-bold tracking-widest bg-foreground/[0.06] px-3 py-1 rounded-lg text-foreground/70 select-all">
              {offer.code}
            </span>
          </div>
        )}

        {offer.is_auto_apply && (
          <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-bold mb-3">
            <Sparkles className="w-3 h-3"/> Auto-applied at checkout
          </div>
        )}

        {offer.min_order_value && (
          <p className="text-[10px] text-foreground/40 mb-3">Min. order: {formatTZS(offer.min_order_value)}</p>
        )}

        {offer.end_date && (
          <p className="text-[10px] text-foreground/35">
            Ends {new Date(offer.end_date).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short' })}
          </p>
        )}

        <button
          onClick={() => navigate(offer.target_type === 'category' && offer.target_ids?.[0]
            ? `/shop?category=${encodeURIComponent(offer.target_ids[0])}`
            : '/shop')}
          className="mt-4 w-full h-9 rounded-xl bg-foreground text-background text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-80 transition-opacity active:scale-95"
        >
          Shop now <ArrowRight className="w-3.5 h-3.5"/>
        </button>
      </div>
    </motion.div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
type ExploreTab = 'categories' | 'stores' | 'trending' | 'deals';
type TrendSubTab = 'hot' | 'new' | 'rated';

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
  const [storeFilter, setStoreFilter] = useState<'all'|'verified'|'new'>('all');
  const [regionFilter, setRegionFilter] = useState('');
  const [trendSub, setTrendSub] = useState<TrendSubTab>('hot');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const [serverCounts, setServerCounts] = useState<Record<string, number> | null>(null);
  const [serverTrending, setServerTrending] = useState<any[] | null>(null);
  useEffect(() => {
    categoryCountsServer().then(setServerCounts);
    trendingProductsServer(16).then(setServerTrending);
  }, []);

  useEffect(() => {
    if (tab !== 'stores') return;
    setLoadingVendors(true);
    supabase
      .from('vendor_profiles')
      .select('*')
      .eq('is_active', true)
      .order('total_sales', { ascending: false })
      .limit(60)
      .then(({ data }) => { setVendors(data as VendorProfile[] || []); setLoadingVendors(false); });
  }, [tab]);

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
    // Merge with CATEGORY_HIERARCHY subcategories as fallback
    const result = top.map(p => ({ ...p, subcategories: children.filter(c => c.parent_id === p.id) }));
    if (result.length === 0) {
      return Object.keys(CATEGORY_HIERARCHY).map(k => ({
        id: k, name: k, image_url: CATEGORY_IMAGES[k],
        subcategories: CATEGORY_HIERARCHY[k].map((s, i) => ({ id: `${k}-${i}`, name: s })),
      }));
    }
    // Ensure subcategories from CATEGORY_HIERARCHY fill gaps
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

  // Trending sub-tabs
  const hotProducts = useMemo(() =>
    serverTrending?.length ? serverTrending :
    [...products].filter(p => p.status !== 'inactive')
      .sort((a, b) => (b.rating||0)*(b.review_count||1) - (a.rating||0)*(a.review_count||1))
      .slice(0, 16),
    [products, serverTrending]
  );
  const newArrivals = useMemo(() =>
    [...products].filter(p => p.status !== 'inactive')
      .sort((a, b) => new Date(b.created_at||0).getTime() - new Date(a.created_at||0).getTime())
      .slice(0, 16),
    [products]
  );
  const topRated = useMemo(() =>
    [...products].filter(p => p.status !== 'inactive' && (p.rating||0) >= 4)
      .sort((a, b) => (b.rating||0) - (a.rating||0))
      .slice(0, 16),
    [products]
  );
  const trendingProducts = trendSub === 'new' ? newArrivals : trendSub === 'rated' ? topRated : hotProducts;

  // Deals
  const activeDeals = useMemo(() =>
    offers.filter(o => o.status === 'active').sort((a, b) =>
      (b.is_flash_sale ? 1 : 0) - (a.is_flash_sale ? 1 : 0)
    ),
    [offers]
  );

  // Stores
  const storeRegions = useMemo(() =>
    ['', ...Array.from(new Set(vendors.map(v => v.region).filter(Boolean) as string[])).sort()],
    [vendors]
  );
  const filteredVendors = useMemo(() => {
    let v = vendors;
    if (searchQ) v = v.filter(x => x.store_name?.toLowerCase().includes(searchQ.toLowerCase()) || x.description?.toLowerCase().includes(searchQ.toLowerCase()));
    if (storeFilter === 'verified') v = v.filter(x => x.is_verified);
    if (storeFilter === 'new') v = v.filter(x => !x.is_verified && (x.total_sales||0) < 10);
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
      <div className="bg-foreground text-background px-5 md:px-8 pt-10 pb-0">
        <div className="container mx-auto max-w-7xl">
          <p className="text-[10px] uppercase tracking-[0.3em] text-background/40 font-bold mb-3">Explore MaliMart</p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-4">
            Discover Tanzania's<br/>
            <span className="text-emerald-400">Best Marketplace</span>
          </h1>

          {/* Stat bar */}
          <div className="flex items-center gap-6 text-xs text-background/50 mb-6">
            {totalProducts > 0 && (
              <span className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-400"/>
                <span className="font-bold text-background/80">{totalProducts.toLocaleString()}</span> products
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-emerald-400"/>
              <span className="font-bold text-background/80">{visibleCategories.length > 0 ? vendors.length || '—' : '—'}</span> sellers
            </span>
            <span className="flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5 text-emerald-400"/>
              <span className="font-bold text-background/80">{organizedCategories.length || Object.keys(CATEGORY_HIERARCHY).length}</span> categories
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-[60px] z-20 bg-background/95 backdrop-blur-xl border-b border-foreground/8">
        <div className="container mx-auto max-w-7xl px-4 md:px-8">
          <div className="flex gap-1 overflow-x-auto no-scrollbar py-2">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${tab === t.id ? 'bg-foreground text-background' : 'text-foreground/45 hover:text-foreground hover:bg-foreground/[0.05]'}`}>
                  <Icon className="w-3.5 h-3.5 stroke-[2]"/>
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

      <div className="container mx-auto max-w-7xl px-4 md:px-8 py-8">
        <AnimatePresence mode="wait">

          {/* ── CATEGORIES ──────────────────────────────────────── */}
          {tab === 'categories' && (
            <motion.div key="cats" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 stroke-[2]"/>
                <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search categories & styles…"
                  className="w-full h-11 pl-10 pr-10 rounded-xl bg-foreground/[0.04] text-foreground text-sm placeholder:text-foreground/35 focus:outline-none focus:bg-foreground/[0.07] transition-colors"/>
                {searchQ && (
                  <button onClick={()=>setSearchQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground">
                    <X className="w-4 h-4"/>
                  </button>
                )}
              </div>

              {visibleCategories.length === 0 ? (
                <div className="flex flex-col items-center py-16 border border-dashed border-foreground/15 rounded-3xl text-foreground/35">
                  <LayoutGrid className="w-10 h-10 mb-3 opacity-20"/>
                  <p className="font-semibold text-sm">No categories match "{searchQ}"</p>
                  <button onClick={()=>setSearchQ('')} className="mt-3 text-xs font-bold text-emerald-500">Clear search</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {visibleCategories.map((cat: any, i: number) => {
                    const img = CATEGORY_IMAGES[cat.name] || cat.image_url || `https://picsum.photos/seed/${encodeURIComponent(cat.name)}/400/500`;
                    const count = categoryCounts[cat.name];
                    const isExpanded = expandedCat === cat.id;
                    const subs: any[] = cat.subcategories || [];

                    return (
                      <div key={cat.id} className="flex flex-col gap-2">
                        <Link to={`/shop?category=${encodeURIComponent(cat.name)}`}
                          className="group relative aspect-[4/5] rounded-3xl overflow-hidden bg-foreground/[0.04] block">
                          <img src={img} alt={cat.name}
                            className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500" loading="lazy" decoding="async"/>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent"/>
                          <div className="absolute inset-x-0 bottom-0 p-4">
                            <div className="flex items-end justify-between gap-2">
                              <div>
                                <span className="text-base mb-0.5 block">{CATEGORY_EMOJIS[cat.name] || '🛍️'}</span>
                                <h3 className="text-white font-bold text-sm leading-tight">{cat.name}</h3>
                                <p className="text-white/55 text-[10px] mt-0.5">
                                  {count ? `${count} product${count===1?'':'s'}` : 'Browse'}
                                </p>
                              </div>
                              <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 group-hover:bg-white/30 transition-colors">
                                <ArrowRight className="w-3 h-3 text-white"/>
                              </div>
                            </div>
                          </div>
                        </Link>

                        {/* Subcategory quick-nav */}
                        {subs.length > 0 && (
                          <div>
                            <div className={`flex flex-wrap gap-1.5 overflow-hidden transition-all ${isExpanded ? 'max-h-40' : 'max-h-[2.2rem]'}`}>
                              {subs.map((s: any) => (
                                <Link key={s.id} to={`/shop?category=${encodeURIComponent(s.name)}`}
                                  className="flex-shrink-0 h-7 px-2.5 rounded-full bg-foreground/[0.05] text-foreground/60 text-[10px] font-semibold hover:bg-foreground/10 hover:text-foreground transition-colors whitespace-nowrap">
                                  {s.name}
                                </Link>
                              ))}
                            </div>
                            {subs.length > 3 && (
                              <button
                                onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                                className="mt-1 text-[10px] font-bold text-foreground/35 hover:text-emerald-500 transition-colors flex items-center gap-0.5"
                              >
                                {isExpanded ? 'Show less' : `+${subs.length - 3} more`}
                                <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}/>
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
                  <Package className="w-4 h-4"/> Browse All Products
                </Link>
                <button onClick={() => setTab('deals')} className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl border border-foreground/15 text-foreground text-sm font-semibold hover:bg-foreground/[0.04] transition-colors">
                  <Tag className="w-4 h-4"/> View Deals
                </button>
              </div>
            </motion.div>
          )}

          {/* ── STORES ──────────────────────────────────────────── */}
          {tab === 'stores' && (
            <motion.div key="stores" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-5">
              {/* Search + filter row */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 stroke-[2]"/>
                  <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search stores…"
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-foreground/[0.04] text-foreground text-sm placeholder:text-foreground/35 focus:outline-none focus:bg-foreground/[0.07] transition-colors"/>
                </div>
                <div className="flex p-1 bg-foreground/[0.04] rounded-xl gap-1">
                  {(['all','verified','new'] as const).map(f=>(
                    <button key={f} onClick={()=>setStoreFilter(f)}
                      className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${storeFilter===f?'bg-background text-foreground shadow-sm':'text-foreground/40 hover:text-foreground/65'}`}>
                      {f==='all'?'All':f==='verified'?'Verified ✓':'New'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Region filter pills */}
              {storeRegions.length > 2 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {storeRegions.map(r => (
                    <button key={r||'all-regions'} onClick={() => setRegionFilter(r)}
                      className={`flex-shrink-0 h-8 px-3 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${regionFilter===r ? 'bg-foreground text-background' : 'bg-foreground/[0.05] text-foreground/55 hover:bg-foreground/10 hover:text-foreground'}`}>
                      {r || '📍 All regions'}
                    </button>
                  ))}
                </div>
              )}

              {/* Top 3 */}
              {!searchQ && storeFilter==='all' && !regionFilter && filteredVendors.length >= 3 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Crown className="w-4 h-4 text-amber-500"/>
                    <h2 className="font-bold text-foreground text-sm">Top Sellers</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {filteredVendors.slice(0,3).map((v,i)=>(
                      <StoreCard key={v.seller_id} vendor={v} rank={i+1}
                        isFavorite={isFollowing(v.seller_id)}
                        onFavoriteToggle={()=>isFollowing(v.seller_id)?unfollowSeller(v.seller_id):followSeller(v.seller_id)}/>
                    ))}
                  </div>
                </div>
              )}

              {/* Grid */}
              <div>
                {!searchQ && storeFilter==='all' && !regionFilter && filteredVendors.length >= 3 && (
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-4 h-4 text-foreground/50"/>
                    <h2 className="font-bold text-foreground text-sm">
                      All Stores <span className="text-foreground/40 font-normal">({filteredVendors.length - 3})</span>
                    </h2>
                  </div>
                )}
                {loadingVendors ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({length:8}).map((_,i)=><div key={i} className="aspect-[3/4] shimmer rounded-3xl"/>)}
                  </div>
                ) : filteredVendors.length === 0 ? (
                  <div className="flex flex-col items-center py-16 border border-dashed border-foreground/15 rounded-3xl text-foreground/35">
                    <Store className="w-10 h-10 mb-3 opacity-20"/>
                    <p className="font-semibold text-sm">No stores found</p>
                    <button onClick={()=>{setSearchQ('');setStoreFilter('all');setRegionFilter('');}} className="mt-3 text-xs font-bold text-emerald-500">Clear filters</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {((!searchQ&&storeFilter==='all'&&!regionFilter) ? filteredVendors.slice(3) : filteredVendors).map(v=>(
                      <StoreCard key={v.seller_id} vendor={v}
                        isFavorite={isFollowing(v.seller_id)}
                        onFavoriteToggle={()=>isFollowing(v.seller_id)?unfollowSeller(v.seller_id):followSeller(v.seller_id)}/>
                    ))}
                  </div>
                )}
              </div>

              {!user && (
                <p className="text-center text-xs text-foreground/35 py-4">
                  <Link to="/login" className="text-emerald-500 font-semibold">Sign in</Link> to follow stores and get personalised updates
                </p>
              )}
            </motion.div>
          )}

          {/* ── TRENDING ─────────────────────────────────────────── */}
          {tab === 'trending' && (
            <motion.div key="trending" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-6">
              {/* Sub-tabs */}
              <div className="flex p-1 bg-foreground/[0.04] rounded-2xl gap-1 w-fit">
                {([
                  { id: 'hot',   label: '🔥 Hot',        },
                  { id: 'new',   label: '✨ New Arrivals' },
                  { id: 'rated', label: '⭐ Top Rated'   },
                ] as { id: TrendSubTab; label: string }[]).map(s => (
                  <button key={s.id} onClick={() => setTrendSub(s.id)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${trendSub===s.id ? 'bg-background text-foreground shadow-sm' : 'text-foreground/45 hover:text-foreground/70'}`}>
                    {s.label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={trendSub} initial={{opacity:0,x:8}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-8}}
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-8 md:gap-x-4">
                  {trendingProducts.map((p, i) => (
                    <motion.button key={p.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.03}}
                      onClick={() => navigate(`/product/${p.id}`)} className="text-left group">
                      <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-foreground/[0.04] mb-3">
                        {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" loading="lazy" decoding="async"/>}

                        {/* Rank / badge */}
                        <div className="absolute top-2 left-2">
                          {trendSub === 'hot' && (
                            <div className="flex items-center gap-1 bg-foreground text-background text-[10px] font-black px-2 py-1 rounded-full">
                              <Flame className="w-2.5 h-2.5 fill-current stroke-none text-orange-400"/> #{i+1}
                            </div>
                          )}
                          {trendSub === 'new' && (
                            <div className="bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded-full">NEW</div>
                          )}
                          {trendSub === 'rated' && p.rating && (
                            <div className="flex items-center gap-1 bg-amber-400 text-black text-[10px] font-black px-2 py-1 rounded-full">
                              <Star className="w-2.5 h-2.5 fill-current stroke-none"/> {p.rating.toFixed(1)}
                            </div>
                          )}
                        </div>

                        {trendSub !== 'rated' && p.rating && (
                          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/90 backdrop-blur-sm text-foreground text-[10px] font-bold px-2 py-1 rounded-full">
                            <Star className="w-2.5 h-2.5 text-amber-400 fill-current stroke-none"/> {p.rating.toFixed(1)}
                          </div>
                        )}
                      </div>
                      <p className="font-semibold text-foreground text-sm truncate">{p.name}</p>
                      <p className="text-xs text-emerald-600 font-bold mt-0.5">{formatTZS(p.price)}</p>
                      {trendSub === 'new' && p.created_at && (
                        <p className="text-[10px] text-foreground/35 mt-0.5">
                          {new Date(p.created_at).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                      {trendSub !== 'new' && p.review_count > 0 && (
                        <p className="text-[10px] text-foreground/35 mt-0.5">{p.review_count} reviews</p>
                      )}
                    </motion.button>
                  ))}
                </motion.div>
              </AnimatePresence>

              {/* Category quick-nav */}
              <div className="pt-6 border-t border-foreground/8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 mb-4">Browse by category</p>
                <div className="flex flex-wrap gap-2">
                  {organizedCategories.slice(0, 10).map((c: any) => (
                    <Link key={c.name} to={`/shop?category=${encodeURIComponent(c.name)}`}
                      className="flex items-center gap-1.5 h-9 px-4 rounded-full border border-foreground/12 text-foreground/60 text-xs font-semibold hover:border-foreground/30 hover:text-foreground hover:bg-foreground/[0.04] transition-all active:scale-95">
                      {CATEGORY_EMOJIS[c.name] || ''} {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── DEALS ────────────────────────────────────────────── */}
          {tab === 'deals' && (
            <motion.div key="deals" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-8">
              {activeDeals.length === 0 ? (
                <div className="flex flex-col items-center py-20 border border-dashed border-foreground/15 rounded-3xl text-foreground/35">
                  <Tag className="w-10 h-10 mb-3 opacity-20"/>
                  <p className="font-semibold text-sm">No active deals right now</p>
                  <p className="text-xs mt-1">Check back soon — new deals drop weekly.</p>
                  <Link to="/shop" className="mt-4 text-xs font-bold text-emerald-500">Browse all products</Link>
                </div>
              ) : (
                <>
                  {/* Flash sales first */}
                  {activeDeals.some(o => o.is_flash_sale) && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Zap className="w-4 h-4 text-rose-500 fill-current"/>
                        <h2 className="font-bold text-foreground">Flash Sales</h2>
                        <span className="text-[10px] text-foreground/35 font-medium">Limited time</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeDeals.filter(o => o.is_flash_sale).map(o => <DealCard key={o.id} offer={o}/>)}
                      </div>
                    </div>
                  )}

                  {/* Auto-apply discounts */}
                  {activeDeals.some(o => o.is_auto_apply && !o.is_flash_sale) && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-4 h-4 text-emerald-500"/>
                        <h2 className="font-bold text-foreground">Auto-Applied Savings</h2>
                        <span className="text-[10px] text-foreground/35 font-medium">No code needed</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeDeals.filter(o => o.is_auto_apply && !o.is_flash_sale).map(o => <DealCard key={o.id} offer={o}/>)}
                      </div>
                    </div>
                  )}

                  {/* Coupon codes */}
                  {activeDeals.some(o => !o.is_auto_apply && o.code) && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Tag className="w-4 h-4 text-foreground/50"/>
                        <h2 className="font-bold text-foreground">Coupon Codes</h2>
                        <span className="text-[10px] text-foreground/35 font-medium">Enter at checkout</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeDeals.filter(o => !o.is_auto_apply && o.code).map(o => <DealCard key={o.id} offer={o}/>)}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Discounted products teaser */}
              {products.some(p => p.base_price && p.price < p.base_price) && (
                <div className="pt-6 border-t border-foreground/8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-foreground/50"/>
                      <h2 className="font-bold text-foreground">On Sale Now</h2>
                    </div>
                    <Link to="/shop" className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                      See all <ArrowRight className="w-3 h-3"/>
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {products.filter(p => p.base_price && p.price < p.base_price).slice(0, 6).map(p => (
                      <button key={p.id} onClick={() => navigate(`/product/${p.id}`)} className="text-left group">
                        <div className="relative aspect-square rounded-2xl overflow-hidden bg-foreground/[0.04] mb-2">
                          {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500" loading="lazy" decoding="async"/>}
                          <div className="absolute top-1.5 left-1.5 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                            -{Math.round((1 - p.price / p.base_price!) * 100)}%
                          </div>
                        </div>
                        <p className="text-[11px] font-semibold text-foreground truncate">{p.name}</p>
                        <p className="text-[11px] font-bold text-emerald-600">{formatTZS(p.price)}</p>
                        <p className="text-[10px] text-foreground/35 line-through">{formatTZS(p.base_price!)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};
