import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  Store, MapPin, Star, BadgeCheck, MessageSquare, Share2,
  Search, Globe, Truck, ShieldCheck, Loader2, ArrowRight,
  Instagram, Twitter, Facebook, Info, Calendar, Package,
  Heart, Filter, LayoutGrid, Tag, Phone, TrendingUp, Clock, Eye
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { supabase } from '../services/supabaseClient';
import { VendorProfile, Product } from '../types';
import { ProductCard } from '../components/ProductCard';
import { ReviewSection } from '../components/ReviewSection';
import { ProductShare } from '../components/ProductShare';
import { useToast } from '../components/UI';
import { formatTZS, messageSellerPath } from '../constants';
import { usePresence } from '../hooks/usePresence';

type Tab = 'collection' | 'about' | 'reviews';
type SortKey = 'popular' | 'newest' | 'price_asc' | 'price_desc' | 'rating';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'popular',    label: 'Most popular' },
  { key: 'newest',     label: 'New arrivals' },
  { key: 'price_asc',  label: 'Price: low→high' },
  { key: 'price_desc', label: 'Price: high→low' },
  { key: 'rating',     label: 'Top rated' },
];

export const StorePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { addToast } = useToast();
  const { fetchVendorProfile, followSeller, unfollowSeller, isFollowing, user } = useAppState();

  // Live storefront presence: who's viewing this store right now + seller online.
  const presenceKey = useMemo(() => user?.id || `guest-${Math.random().toString(36).slice(2)}`, [user?.id]);
  const { count: storeViewers, others: storePresence } = usePresence({
    topic: id ? `store:${id}` : null,
    key: presenceKey,
    meta: { role: user?.role || 'guest' },
  });
  const sellerOnline = storePresence.some((p: any) => p?.role === 'seller');

  const bannerRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const bannerY = useTransform(scrollY, [0, 400], [0, 100]);

  const [vendor, setVendor]           = useState<VendorProfile | null>(null);
  const [loading, setLoading]         = useState(true);
  const [allStoreProducts, setAllStoreProducts] = useState<Product[]>([]);
  const [tab, setTab]                 = useState<Tab>('collection');
  const [search, setSearch]           = useState('');
  const [sortKey, setSortKey]         = useState<SortKey>('popular');
  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showSort, setShowSort]       = useState(false);
  const [msgOpen, setMsgOpen]         = useState(false);
  const [shareOpen, setShareOpen]     = useState(false);
  const [reviewProduct, setReviewProduct] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    // Fetch vendor profile and store products in parallel.
    // Don't rely on the global 60-product context cache — it may not include
    // this seller's products at all, leaving the storefront permanently empty.
    const run = async () => {
      const [v, res] = await Promise.all([
        fetchVendorProfile(id).catch(() => null),
        supabase
          .from('products')
          .select('id,seller_id,name,description,price,sale_price,images,category,tags,rating,review_count,stock,status,is_verified,is_boosted,created_at,updated_at,region')
          .eq('seller_id', id)
          .eq('status', 'active')
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
      ]);
      setVendor(v);
      setAllStoreProducts((res.data ?? []) as Product[]);
      setLoading(false);
    };
    run().catch(() => setLoading(false));
  }, [id]);

  const storeProducts = useMemo(() => {
    setVisibleCount(PAGE_SIZE);
    let list = allStoreProducts.filter(p =>
      !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase())
    );
    switch (sortKey) {
      case 'newest':     return list.sort((a,b) => new Date(b.created_at||0).getTime() - new Date(a.created_at||0).getTime());
      case 'price_asc':  return list.sort((a,b) => (a.price||0) - (b.price||0));
      case 'price_desc': return list.sort((a,b) => (b.price||0) - (a.price||0));
      case 'rating':     return list.sort((a,b) => (b.rating||0) - (a.rating||0));
      default:           return list.sort((a,b) => (b.review_count||0) - (a.review_count||0));
    }
  }, [allStoreProducts, search, sortKey]);

  // Use the first active product as the "store review" product ID
  const storeReviewProductId = useMemo(() =>
    storeProducts.find(p => (p.review_count || 0) > 0)?.id || storeProducts[0]?.id,
    [storeProducts]
  );

  // Unified share experience: open the shared bottom-sheet (channels + copy link).
  const handleShare = () => setShareOpen(true);

  const handleMessage = () => {
    if (!user) { navigate('/login?redirect=' + encodeURIComponent(window.location.pathname)); return; }
    if (user.id === id) { addToast("This is your own store", 'info'); return; }
    // Role-aware: sellers/admins can't enter /buyer (role guard bounces them)
    navigate(messageSellerPath(user.role, id!));
  };

  const following = id ? isFollowing(id) : false;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-foreground/30"/>
    </div>
  );

  if (!vendor) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6">
      <div className="w-16 h-16 rounded-3xl bg-foreground/[0.06] flex items-center justify-center">
        <Store className="w-7 h-7 text-foreground/30 stroke-[1.5]"/>
      </div>
      <div className="text-center">
        <h2 className="font-bold text-lg text-foreground">Store not found</h2>
        <p className="text-sm text-foreground/45 mt-1">This store may no longer be active.</p>
      </div>
      <button onClick={() => navigate('/categories?tab=stores')}
        className="h-10 px-5 rounded-2xl bg-foreground text-background text-sm font-bold">
        Browse Stores
      </button>
    </div>
  );

  const TAB_LIST: { id: Tab; label: string }[] = [
    { id: 'collection', label: `Products (${allStoreProducts.length})` },
    { id: 'about',      label: 'About' },
    { id: 'reviews',    label: 'Reviews' },
  ];

  return (
    <div className="min-h-screen bg-background font-sans pb-[calc(5rem+env(safe-area-inset-bottom))]">

      {/* ── Banner with parallax ───────────────────────────────────────── */}
      <div ref={bannerRef} className="h-[40vh] md:h-[50vh] relative overflow-hidden bg-foreground/[0.04]">
        <motion.img
          style={{ y: bannerY }}
          src={vendor.banner_url || 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=2070&auto=format&fit=crop'}
          className="w-full h-[115%] object-cover -mt-[7.5%]"
          loading="lazy" decoding="async" alt="Store banner"/>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent"/>
      </div>

      <div className="container mx-auto px-4 md:px-8 max-w-7xl -mt-28 relative z-10">

        {/* ── Vacation mode banner ────────────────────────────────────────── */}
      {(vendor as any).vacation_mode && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-3xl overflow-hidden bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-6 py-5 flex items-center gap-4"
        >
          <span className="text-4xl flex-shrink-0" role="img" aria-label="Palm tree">🌴</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-amber-800 dark:text-amber-300 text-sm">
              {vendor.store_name} is on vacation
            </p>
            <p className="text-amber-700/70 dark:text-amber-400/70 text-xs mt-0.5">
              Ordering is paused while the seller is away — you can still browse and save items to your wishlist.
              {(vendor as any).vacation_end_date && (
                <> Expected back <strong>{new Date((vendor as any).vacation_end_date).toLocaleDateString('en-TZ', { day: 'numeric', month: 'long' })}</strong>.</>
              )}
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Profile card ───────────────────────────────────────────────── */}
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
          className="bg-background/95 backdrop-blur-xl border border-foreground/8 rounded-3xl p-5 md:p-8 mb-6 shadow-xl">

          <div className="flex flex-col md:flex-row gap-5 items-start">
            {/* Logo */}
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden bg-foreground/[0.06] border border-foreground/10 flex items-center justify-center shrink-0 shadow-md">
              {vendor.logo_url
                ? <img src={vendor.logo_url} className="w-full h-full object-cover" alt="Store logo" loading="lazy" decoding="async"/>
                : <span className="text-2xl font-black text-foreground/25">{(vendor.store_name||'S')[0]}</span>
              }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{vendor.store_name}</h1>
                {vendor.is_verified && (
                  <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    <BadgeCheck className="w-3.5 h-3.5"/> Verified
                  </div>
                )}
                {sellerOnline && (
                  <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    </span>
                    Online now
                  </div>
                )}
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
                {vendor.region && (
                  <span className="flex items-center gap-1.5 text-xs text-foreground/45">
                    <MapPin className="w-3.5 h-3.5 stroke-[2]"/> {vendor.region}
                  </span>
                )}
                {vendor.rating && (
                  <span className="flex items-center gap-1.5 text-xs text-foreground/45">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 stroke-none"/> {vendor.rating.toFixed(1)} rating
                  </span>
                )}
                {vendor.total_sales != null && (
                  <span className="flex items-center gap-1.5 text-xs text-foreground/45">
                    <Package className="w-3.5 h-3.5 stroke-[2]"/> {vendor.total_sales.toLocaleString()} sales
                  </span>
                )}
                {storeViewers > 1 && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                    <Eye className="w-3.5 h-3.5 stroke-[2]"/> {storeViewers} viewing now
                  </span>
                )}
              </div>

              {vendor.description && (
                <p className="text-sm text-foreground/60 mt-2 leading-relaxed max-w-lg">{vendor.description}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap md:flex-col md:items-end shrink-0">
              <button onClick={() => id && (following ? unfollowSeller(id) : followSeller(id))}
                className={`flex items-center gap-2 h-10 px-4 rounded-2xl text-sm font-bold transition-all active:scale-95 ${following ? 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/15' : 'bg-foreground text-background hover:bg-foreground/85'}`}>
                <Heart className={`w-4 h-4 stroke-[2.5] ${following ? 'fill-current stroke-none' : ''}`}/>
                {following ? 'Following' : 'Follow'}
              </button>
              <button onClick={handleMessage}
                className="flex items-center gap-2 h-10 px-4 rounded-2xl bg-foreground/[0.06] text-foreground text-sm font-semibold hover:bg-foreground/10 transition-colors active:scale-95">
                <MessageSquare className="w-4 h-4 stroke-[2]"/> Message
              </button>
              <button onClick={handleShare} aria-label="Share this store"
                className="w-11 h-11 rounded-2xl bg-foreground/[0.06] flex items-center justify-center text-foreground/50 hover:bg-foreground/10 transition-colors active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">
                <Share2 className="w-4 h-4 stroke-[2]"/>
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Tab strip ──────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1.5 bg-foreground/[0.04] rounded-2xl mb-6 sticky top-[60px] z-20 border border-foreground/8 backdrop-blur-xl overflow-x-auto no-scrollbar">
          {TAB_LIST.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 flex items-center justify-center px-4 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200 whitespace-nowrap ${tab === t.id ? 'bg-background text-foreground shadow-sm' : 'text-foreground/40 hover:text-foreground/65'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            transition={{ duration:0.2 }}>

            {/* COLLECTION ─────────────────────────────────────────────── */}
            {tab === 'collection' && (
              <div className="space-y-5">
                {/* Search + sort bar */}
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 stroke-[2]"/>
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Search this store…"
                      className="w-full h-11 pl-10 pr-4 rounded-xl bg-foreground/[0.04] text-foreground text-sm placeholder:text-foreground/35 focus:outline-none focus:bg-foreground/[0.07] transition-colors"/>
                  </div>
                  <div className="relative">
                    <button onClick={() => setShowSort(v => !v)}
                      className="flex items-center gap-1.5 h-11 px-4 rounded-xl bg-foreground/[0.04] text-foreground/60 text-xs font-bold hover:bg-foreground/[0.07] transition-colors border border-foreground/8">
                      <Filter className="w-3.5 h-3.5 stroke-[2]"/>
                      {SORT_OPTIONS.find(s => s.key === sortKey)?.label.split(':')[0] || 'Sort'}
                    </button>
                    <AnimatePresence>
                      {showSort && (
                        <motion.div initial={{ opacity:0, scale:0.95, y:-4 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.95 }}
                          className="absolute right-0 top-full mt-2 w-44 bg-background border border-foreground/10 rounded-2xl shadow-xl overflow-hidden z-30">
                          {SORT_OPTIONS.map(s => (
                            <button key={s.key} onClick={() => { setSortKey(s.key); setShowSort(false); }}
                              className={`w-full text-left px-4 py-3 text-xs font-semibold transition-colors hover:bg-foreground/[0.04] ${sortKey===s.key ? 'text-foreground font-bold' : 'text-foreground/60'}`}>
                              {s.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Results count when filtering */}
                {search && (
                  <p className="text-[11px] text-foreground/40 font-semibold">
                    {storeProducts.length === 0
                      ? 'No matches'
                      : `${storeProducts.length} result${storeProducts.length === 1 ? '' : 's'} for "${search}"`}
                  </p>
                )}

                {/* Product grid */}
                {storeProducts.length === 0 ? (
                  <div className="flex flex-col items-center py-16 border border-dashed border-foreground/15 rounded-3xl text-foreground/35">
                    <Package className="w-10 h-10 mb-3 opacity-20"/>
                    <p className="text-sm font-semibold">{search ? 'No matches found' : 'No active products yet'}</p>
                    {search && (
                      <button onClick={() => setSearch('')} className="mt-2 text-xs text-emerald-500 font-semibold">Clear search</button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-8 md:gap-x-4">
                      {storeProducts.slice(0, visibleCount).map((p, i) => (
                        <ProductCard key={p.id} product={p} index={i} onClick={() => navigate(`/product/${p.id}`)}/>
                      ))}
                    </div>
                    {storeProducts.length > visibleCount && (
                      <div className="flex justify-center pt-4">
                        <button
                          onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                          className="h-11 px-8 rounded-2xl bg-foreground/[0.05] hover:bg-foreground/[0.09] border border-foreground/10 text-foreground text-sm font-semibold transition-colors active:scale-95"
                        >
                          Load more · {storeProducts.length - visibleCount} remaining
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ABOUT ──────────────────────────────────────────────────── */}
            {tab === 'about' && (
              <div className="max-w-2xl space-y-5">
                {/* Trust badges */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { icon: ShieldCheck, label: 'Verified Seller',   sub: vendor.is_verified ? 'Identity confirmed' : 'Pending review', ok: vendor.is_verified },
                    { icon: Truck,       label: 'Delivery',          sub: vendor.delivery_fee ? `TZS ${formatTZS(vendor.delivery_fee)} fee` : 'Negotiable', ok: true },
                    { icon: Clock,       label: 'Response Time',     sub: 'Usually within 24h', ok: true },
                  ].map(({ icon: Icon, label, sub, ok }) => (
                    <div key={label} className="flex items-center gap-3 p-4 bg-foreground/[0.02] border border-foreground/8 rounded-2xl">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ok ? 'bg-emerald-500/10' : 'bg-foreground/[0.06]'}`}>
                        <Icon className={`w-4.5 h-4.5 stroke-[2] ${ok ? 'text-emerald-600' : 'text-foreground/40'}`}/>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{label}</p>
                        <p className="text-[10px] text-foreground/40 mt-0.5">{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* About text */}
                {vendor.description && (
                  <div className="p-5 bg-foreground/[0.02] border border-foreground/8 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-foreground/35 mb-2">About this store</p>
                    <p className="text-sm text-foreground/65 leading-relaxed">{vendor.description}</p>
                  </div>
                )}

                {/* Location */}
                {(vendor.region || vendor.address) && (
                  <div className="flex items-start gap-3 p-4 bg-foreground/[0.02] border border-foreground/8 rounded-2xl">
                    <MapPin className="w-4.5 h-4.5 text-foreground/40 stroke-[2] mt-0.5 shrink-0"/>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{vendor.region || ''}</p>
                      {vendor.address && <p className="text-xs text-foreground/45 mt-0.5">{vendor.address}</p>}
                    </div>
                  </div>
                )}

                {/* Contact */}
                {(vendor.contact_phone || vendor.contact_email) && (
                  <div className="space-y-2">
                    {vendor.contact_phone && (
                      <a href={`tel:${vendor.contact_phone}`}
                        className="flex items-center gap-3 p-4 bg-foreground/[0.02] border border-foreground/8 rounded-2xl hover:bg-foreground/[0.04] transition-colors">
                        <Phone className="w-4 h-4 text-foreground/40 stroke-[2] shrink-0"/>
                        <span className="text-sm text-foreground/70">{vendor.contact_phone}</span>
                      </a>
                    )}
                    {vendor.contact_email && (
                      <a href={`mailto:${vendor.contact_email}`}
                        className="flex items-center gap-3 p-4 bg-foreground/[0.02] border border-foreground/8 rounded-2xl hover:bg-foreground/[0.04] transition-colors">
                        <Globe className="w-4 h-4 text-foreground/40 stroke-[2] shrink-0"/>
                        <span className="text-sm text-foreground/70">{vendor.contact_email}</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Tags */}
                {vendor.tags?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-foreground/35 mb-2">Specialties</p>
                    <div className="flex flex-wrap gap-2">
                      {vendor.tags.map((tag: string) => (
                        <span key={tag} className="px-3 py-1.5 bg-foreground/[0.05] border border-foreground/8 rounded-full text-[11px] font-semibold text-foreground/55">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <button onClick={handleMessage}
                  className="w-full h-12 rounded-2xl bg-foreground text-background font-bold text-sm flex items-center justify-center gap-2 hover:bg-foreground/85 transition-colors active:scale-[0.98]">
                  <MessageSquare className="w-4 h-4 stroke-[2.5]"/> Message {vendor.store_name}
                </button>
              </div>
            )}

            {/* REVIEWS ─────────────────────────────────────────────────── */}
            {tab === 'reviews' && (
              <div className="max-w-2xl">
                {storeReviewProductId ? (
                  <ReviewSection productId={storeReviewProductId}/>
                ) : (
                  <div className="flex flex-col items-center py-16 border border-dashed border-foreground/15 rounded-3xl text-foreground/35">
                    <Star className="w-10 h-10 mb-3 opacity-20"/>
                    <p className="text-sm font-semibold">No reviews yet</p>
                    <p className="text-xs mt-1">Purchase a product to leave a review</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Unified share sheet (store link — no poster) */}
      <ProductShare
        share={{
          title: vendor?.store_name || 'MaliMart store',
          url: window.location.href,
          text: `Check out ${vendor?.store_name} on MaliMart — ${storeProducts.length} products, authentic Tanzanian seller.`,
          image: vendor?.logo_url,
          subtitle: `${storeProducts.length} products`,
        }}
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
};
