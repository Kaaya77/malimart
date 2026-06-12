import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAppState } from '../context/AppContext';
import { supabase } from '../services/supabaseClient';
import { formatTZS } from '../constants';
import { VendorProfile } from '../types';
import {
  LayoutGrid, ArrowRight, Sparkles, Star, Zap, Store, BadgeCheck,
  Heart, Search, TrendingUp, Users, Package, MapPin, ChevronRight,
  Flame, Crown, Clock
} from 'lucide-react';

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
      {/* Banner */}
      <div className="aspect-[16/7] relative overflow-hidden bg-foreground/[0.04]">
        {vendor.banner_url ? (
          <img src={vendor.banner_url} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" loading="lazy" decoding="async"/>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-foreground/5 to-foreground/10"/>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"/>

        {/* Rank badge */}
        {rank && rank <= 3 && (
          <div className="absolute top-3 left-3">
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black text-white ${rank===1?'bg-amber-500':rank===2?'bg-gray-400':'bg-amber-700'}`}>
              <Crown className="w-3 h-3"/> #{rank}
            </div>
          </div>
        )}

        {/* Favorite */}
        <button
          onClick={e => { e.stopPropagation(); onFavoriteToggle(); }}
          className={`absolute top-3 right-3 w-8 h-8 rounded-full backdrop-blur-md flex items-center justify-center transition-all active:scale-90 ${isFavorite ? 'bg-rose-500 text-white' : 'bg-white/80 text-foreground/60 hover:text-rose-500'}`}
        >
          <Heart className={`w-3.5 h-3.5 stroke-[2.5] ${isFavorite ? 'fill-current stroke-none' : ''}`}/>
        </button>
      </div>

      {/* Info */}
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
            <p className="text-xs text-foreground/45 truncate">{vendor.description || vendor.description?.slice(0, 40) || 'Tanzanian Seller'}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-foreground/45">
          {vendor.rating && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-current stroke-none"/>
              <span className="font-semibold text-foreground/70">{vendor.rating.toFixed(1)}</span>
            </span>
          )}
          {vendor.total_sales != null && (
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3"/>
              {vendor.total_sales} sales
            </span>
          )}
          {vendor.region && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3"/>
              {vendor.region}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
});

// ─── Main Explore/Categories page ────────────────────────────────────────────
const CATEGORY_IMAGES: Record<string, string> = {
  'Fashion & Beauty':    'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&q=80&w=800',
  'Pantry & Spices':     'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=800',
  'Handicrafts':         'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&q=80&w=800',
  'Electronics':         'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&q=80&w=800',
  'Home & Living':       'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800',
  'Agriculture':         'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=800',
  'Kids & Toys':         'https://images.unsplash.com/photo-1558877385-8c1cee71006d?auto=format&fit=crop&q=80&w=800',
  'Vehicles':            'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&q=80&w=800',
  'Books & Stationery':  'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=800',
};

type ExploreTab = 'categories' | 'stores' | 'trending';

export const CategoriesPage = () => {
  const { categories, products, followSeller, unfollowSeller, isFollowing, user } = useAppState();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as ExploreTab | null;
  const [tab, setTabState] = useState<ExploreTab>(
    urlTab === 'stores' || urlTab === 'trending' ? urlTab : 'categories'
  );
  const setTab = (t: ExploreTab) => {
    setTabState(t);
    setSearchParams(t === 'categories' ? {} : { tab: t }, { replace: true });
  };
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [storeFilter, setStoreFilter] = useState<'all'|'verified'|'new'>('all');

  // Load vendors
  useEffect(() => {
    if (tab !== 'stores') return;
    setLoadingVendors(true);
    supabase
      .from('vendor_profiles')
      .select('*')
      .eq('is_active', true)
      .order('total_sales', { ascending: false })
      .limit(40)
      .then(({ data }) => {
        setVendors(data as VendorProfile[] || []);
        setLoadingVendors(false);
      });
  }, [tab]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      if (p.status === 'inactive' || !p.category) continue;
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts;
  }, [products]);

  const organizedCategories = useMemo(() => {
    const top = categories.filter(c => !c.parent_id);
    const children = categories.filter(c => c.parent_id);
    return top.map(p => ({ ...p, subcategories: children.filter(c => c.parent_id === p.id) }));
  }, [categories]);

  const visibleCategories = useMemo(() => {
    const base = organizedCategories.length > 0
      ? organizedCategories
      : Object.keys(CATEGORY_IMAGES).map(k => ({ id: k, name: k, subcategories: [] as any[], image_url: CATEGORY_IMAGES[k] }));
    if (!searchQ.trim()) return base;
    const q = searchQ.toLowerCase();
    return base.filter((c: any) =>
      c.name?.toLowerCase().includes(q) ||
      c.subcategories?.some((s: any) => s.name?.toLowerCase().includes(q))
    );
  }, [organizedCategories, searchQ]);

  const trendingProducts = useMemo(() =>
    [...products]
      .filter(p => p.status !== 'inactive')
      .sort((a, b) => (b.rating || 0) * (b.review_count || 1) - (a.rating || 0) * (a.review_count || 1))
      .slice(0, 12),
    [products]
  );

  const filteredVendors = useMemo(() => {
    let v = vendors;
    if (searchQ) v = v.filter(x => x.store_name?.toLowerCase().includes(searchQ.toLowerCase()) || x.description?.toLowerCase().includes(searchQ.toLowerCase()));
    if (storeFilter === 'verified') v = v.filter(x => x.is_verified);
    if (storeFilter === 'new') v = v.filter(x => !x.is_verified && (x.total_sales || 0) < 10);
    return v;
  }, [vendors, searchQ, storeFilter]);

  const TABS: { id: ExploreTab; label: string; icon: React.ElementType }[] = [
    { id: 'categories', label: 'Categories', icon: LayoutGrid },
    { id: 'stores',     label: 'Stores',     icon: Store },
    { id: 'trending',   label: 'Trending',   icon: Flame },
  ];

  return (
    <div className="min-h-screen bg-background pt-16 md:pt-20 pb-[calc(5rem+env(safe-area-inset-bottom))]">

      {/* Hero */}
      <div className="bg-foreground text-background px-5 md:px-8 pt-10 pb-8">
        <div className="container mx-auto max-w-7xl">
          <p className="text-[10px] uppercase tracking-[0.3em] text-background/40 font-bold mb-3">Explore MaliMart</p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-2">
            Discover Tanzania's<br/>
            <span className="text-emerald-400">Best Marketplace</span>
          </h1>
          <p className="text-sm text-background/55 max-w-md">Browse categories, find your favourite stores, and discover what's trending right now.</p>
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
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${tab === t.id ? 'bg-foreground text-background' : 'text-foreground/45 hover:text-foreground hover:bg-foreground/[0.05]'}`}>
                  <Icon className="w-3.5 h-3.5 stroke-[2]"/>{t.label}
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
            <motion.div key="cats" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-8">
              {/* Search categories */}
              <div className="relative max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 stroke-[2]"/>
                <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search categories…"
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-foreground/[0.04] text-foreground text-sm placeholder:text-foreground/35 focus:outline-none focus:bg-foreground/[0.07] transition-colors"/>
              </div>

              {visibleCategories.length === 0 ? (
                <div className="flex flex-col items-center py-16 border border-dashed border-foreground/15 rounded-3xl text-foreground/35">
                  <LayoutGrid className="w-10 h-10 mb-3 opacity-20"/>
                  <p className="font-semibold text-sm">No categories match "{searchQ}"</p>
                  <button onClick={()=>setSearchQ('')} className="mt-3 text-xs font-bold text-emerald-500">Clear search</button>
                </div>
              ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {visibleCategories.map((cat: any, i: number) => (
                  <Link key={cat.id} to={`/shop?category=${encodeURIComponent(cat.name)}`}
                    className="group relative aspect-[4/5] rounded-3xl overflow-hidden bg-foreground/[0.04] block">
                    <img
                      src={cat.image_url || CATEGORY_IMAGES[cat.name] || `https://picsum.photos/seed/${cat.name}/400/500`}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500 grayscale-[0.3] group-hover:grayscale-0" loading="lazy" decoding="async"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"/>
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <h3 className="text-white font-bold text-sm leading-tight">{cat.name}</h3>
                      <p className="text-white/60 text-[10px] mt-0.5">
                        {categoryCounts[cat.name] ? `${categoryCounts[cat.name]} product${categoryCounts[cat.name] === 1 ? '' : 's'}` : 'Browse'}
                        {cat.subcategories?.length > 0 ? ` · ${cat.subcategories.length} styles` : ''}
                      </p>
                    </div>
                    <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="w-3.5 h-3.5 text-white"/>
                    </div>
                  </Link>
                ))}
              </div>
              )}

              {/* Bottom CTA */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-foreground/8">
                <Link to="/shop" className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-foreground text-background text-sm font-bold hover:bg-foreground/85 transition-colors">
                  <Package className="w-4 h-4"/> Browse All Products
                </Link>
                <button onClick={() => setTab('stores')} className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl border border-foreground/15 text-foreground text-sm font-semibold hover:bg-foreground/[0.04] transition-colors">
                  <Store className="w-4 h-4"/> Explore Stores
                </button>
              </div>
            </motion.div>
          )}

          {/* ── STORES ──────────────────────────────────────────── */}
          {tab === 'stores' && (
            <motion.div key="stores" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-5">
              {/* Controls */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 stroke-[2]"/>
                  <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search stores…"
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-foreground/[0.04] text-foreground text-sm placeholder:text-foreground/35 focus:outline-none focus:bg-foreground/[0.07] transition-colors"/>
                </div>
                <div className="flex p-1 bg-foreground/[0.04] rounded-xl gap-1">
                  {(['all','verified','new'] as const).map(f=>(
                    <button key={f} onClick={()=>setStoreFilter(f)}
                      className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all capitalize ${storeFilter===f?'bg-background text-foreground shadow-sm':'text-foreground/40 hover:text-foreground/65'}`}>
                      {f==='all'?'All':f==='verified'?'Verified ✓':'New'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Featured (top 3) */}
              {!searchQ && storeFilter==='all' && filteredVendors.length >= 3 && (
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

              {/* All stores grid */}
              <div>
                {!searchQ && storeFilter==='all' && filteredVendors.length>=3 && (
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-4 h-4 text-foreground/50"/>
                    <h2 className="font-bold text-foreground text-sm">All Stores <span className="text-foreground/40 font-normal">({filteredVendors.length - 3})</span></h2>
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
                    <button onClick={()=>{setSearchQ('');setStoreFilter('all');}} className="mt-3 text-xs font-bold text-emerald-500">Clear filters</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {((!searchQ&&storeFilter==='all') ? filteredVendors.slice(3) : filteredVendors).map(v=>(
                      <StoreCard key={v.seller_id} vendor={v}
                        isFavorite={isFollowing(v.seller_id)}
                        onFavoriteToggle={()=>isFollowing(v.seller_id)?unfollowSeller(v.seller_id):followSeller(v.seller_id)}/>
                    ))}
                  </div>
                )}
              </div>

              {!user && (
                <p className="text-center text-xs text-foreground/35 py-4">
                  <Link to="/login" className="text-emerald-500 font-semibold">Sign in</Link> to follow stores and get personalized updates
                </p>
              )}
            </motion.div>
          )}

          {/* ── TRENDING ─────────────────────────────────────────── */}
          {tab === 'trending' && (
            <motion.div key="trending" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <TrendingUp className="w-4 h-4 text-foreground/50"/>
                  <h2 className="font-bold text-foreground">Trending Now</h2>
                  <span className="text-[10px] text-foreground/35 font-medium">Based on ratings & reviews</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-8 md:gap-x-4">
                  {trendingProducts.map((p, i) => (
                    <motion.button
                      key={p.id}
                      initial={{ opacity:0, y:8 }}
                      animate={{ opacity:1, y:0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => navigate(`/product/${p.id}`)}
                      className="text-left group"
                    >
                      <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-foreground/[0.04] mb-3">
                        {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" loading="lazy" decoding="async"/>}
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-foreground text-background text-[10px] font-black px-2 py-1 rounded-full">
                          <Flame className="w-2.5 h-2.5 fill-current stroke-none text-orange-400"/> #{i+1}
                        </div>
                        {p.rating && (
                          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/90 backdrop-blur-sm text-foreground text-[10px] font-bold px-2 py-1 rounded-full">
                            <Star className="w-2.5 h-2.5 text-amber-400 fill-current stroke-none"/> {p.rating.toFixed(1)}
                          </div>
                        )}
                      </div>
                      <p className="font-semibold text-foreground text-sm truncate">{p.name}</p>
                      <p className="text-xs text-emerald-600 font-bold mt-0.5">{formatTZS(p.price)}</p>
                      {p.review_count > 0 && (
                        <p className="text-[10px] text-foreground/35 mt-0.5">{p.review_count} reviews</p>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Categories quick nav at bottom */}
              <div className="pt-6 border-t border-foreground/8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 mb-4">Browse by category</p>
                <div className="flex flex-wrap gap-2">
                  {(organizedCategories.length > 0 ? organizedCategories : Object.keys(CATEGORY_IMAGES).map(k=>({name:k}))).slice(0,10).map((c:any)=>(
                    <Link key={c.name} to={`/shop?category=${encodeURIComponent(c.name)}`}
                      className="flex items-center gap-1.5 h-9 px-4 rounded-full border border-foreground/12 text-foreground/60 text-xs font-semibold hover:border-foreground/30 hover:text-foreground hover:bg-foreground/[0.04] transition-all active:scale-95">
                      {c.name} <ArrowRight className="w-3 h-3"/>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
