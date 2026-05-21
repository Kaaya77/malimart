import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, MapPin, Star, BadgeCheck, MessageSquare, Share2,
  Search, Globe, Truck, ShieldCheck, Loader2, ArrowRight,
  Instagram, Twitter, Facebook, Info, Calendar, Package,
  Heart, Filter, LayoutGrid, Tag, Phone, TrendingUp, Clock
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { supabase } from '../services/supabaseClient';
import { VendorProfile, Product } from '../types';
import { ProductCard } from '../components/ProductCard';
import { ReviewSection } from '../components/ReviewSection';
import { useToast } from '../components/UI';
import { formatTZS } from '../constants';

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
  const { fetchVendorProfile, products, followSeller, unfollowSeller, isFollowing, user } = useAppState();

  const [vendor, setVendor]     = useState<VendorProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<Tab>('collection');
  const [search, setSearch]     = useState('');
  const [sortKey, setSortKey]   = useState<SortKey>('popular');
  const [showSort, setShowSort] = useState(false);
  const [msgOpen, setMsgOpen]   = useState(false);
  const [reviewProduct, setReviewProduct] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchVendorProfile(id).then(v => { setVendor(v); setLoading(false); });
  }, [id]);

  const storeProducts = useMemo(() => {
    if (!id) return [];
    let list = products.filter(p =>
      p.seller_id === id &&
      p.status === 'active' &&
      (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase()))
    );
    switch (sortKey) {
      case 'newest':     return list.sort((a,b) => new Date(b.created_at||0).getTime() - new Date(a.created_at||0).getTime());
      case 'price_asc':  return list.sort((a,b) => (a.price||0) - (b.price||0));
      case 'price_desc': return list.sort((a,b) => (b.price||0) - (a.price||0));
      case 'rating':     return list.sort((a,b) => (b.rating||0) - (a.rating||0));
      default:           return list.sort((a,b) => (b.review_count||0) - (a.review_count||0));
    }
  }, [products, id, search, sortKey]);

  // Use the first active product as the "store review" product ID
  const storeReviewProductId = useMemo(() =>
    storeProducts.find(p => (p.review_count || 0) > 0)?.id || storeProducts[0]?.id,
    [storeProducts]
  );

  const handleShare = async () => {
    const url = window.location.href;
    const text = `Check out ${vendor?.store_name} on MaliMart — ${storeProducts.length} products, authentic Tanzanian seller. ${url}`;
    if (navigator.share) {
      await navigator.share({ title: vendor?.store_name, text, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      addToast('Store link copied!', 'success');
    }
  };

  const handleMessage = () => {
    if (!user) { navigate('/login?redirect=' + encodeURIComponent(window.location.pathname)); return; }
    navigate(`/buyer?tab=inbox&sellerId=${id}`);
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
    { id: 'collection', label: `Products (${storeProducts.length})` },
    { id: 'about',      label: 'About' },
    { id: 'reviews',    label: 'Reviews' },
  ];

  return (
    <div className="min-h-screen bg-background font-sans pb-[calc(5rem+env(safe-area-inset-bottom))]">

      {/* ── Banner ─────────────────────────────────────────────────────── */}
      <div className="h-[40vh] md:h-[50vh] relative overflow-hidden bg-foreground/[0.04]">
        <img
          src={vendor.banner_url || 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=2070&auto=format&fit=crop'}
          className="w-full h-full object-cover transition-transform duration-[8s] ease-linear hover:scale-105"
          loading="lazy" decoding="async" alt="Store banner"/>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent"/>
      </div>

      <div className="container mx-auto px-4 md:px-8 max-w-7xl -mt-28 relative z-10">

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
              <button onClick={handleShare}
                className="w-10 h-10 rounded-2xl bg-foreground/[0.06] flex items-center justify-center text-foreground/50 hover:bg-foreground/10 transition-colors active:scale-90">
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
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-8 md:gap-x-4">
                    {storeProducts.map((p, i) => (
                      <ProductCard key={p.id} product={p} index={i} onClick={() => navigate(`/product/${p.id}`)}/>
                    ))}
                  </div>
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

export const StorePage = () => {
 const { id } = useParams();
 const navigate = useNavigate();
 const { fetchVendorProfile, products, followSeller, unfollowSeller, isFollowing } = useAppState();
 
 const [vendor, setVendor] = useState<VendorProfile | null>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState('');
 const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

 const [activeTab, setActiveTab] = useState<'collection' | 'info'>('collection');

 useEffect(() => {
 const load = async () => {
 if (!id) return;
 const v = await fetchVendorProfile(id);
 setVendor(v);
 setIsLoading(false);
 };
 load();
 }, [id]);

 const storeProducts = useMemo(() => {
 return products.filter(p => p.seller_id === id && p.name.toLowerCase().includes(searchQuery.toLowerCase()))
 .sort((a, b) => (b.is_verified ? 1 : 0) - (a.is_verified ? 1 : 0));
 }, [products, id, searchQuery]);

 // Shop mode: no seller ID — show all products
 if (!id) {
 return <ShopPage />;
 }

 if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin" /></div>;
 if (!vendor) return <div className="min-h-screen flex items-center justify-center font-black uppercase text-foreground/50">Store not found</div>;

 return (
 <div className="min-h-screen bg-background text-foreground font-sans pb-[calc(5rem+env(safe-area-inset-bottom))]">
 <SendMessageModal 
 isOpen={isMessageModalOpen} 
 onClose={() => setIsMessageModalOpen(false)} 
 sellerId={vendor.seller_id} 
 sellerName={vendor.store_name} 
 />
 {/* Immersive Banner */}
 <div className="h-[45vh] md:h-[55vh] relative overflow-hidden bg-foreground/[0.03]">
 <img 
 src={vendor.banner_url || 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=2070&auto=format&fit=crop'} 
 className="w-full h-full object-cover opacity-80 transition-transform duration-[20s] ease-linear hover:scale-105" loading="lazy" decoding="async" 
 />
 <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
 </div>

 <div className="container mx-auto px-4 md:px-8 -mt-32 relative z-10 max-w-7xl">
 {/* Store Profile Card */}
 <motion.div 
 initial={{ opacity: 0, y: 30 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true, margin: "-50px" }}
 transition={{ duration: 0.6 }}
 className="p-8 md:p-12 border border-foreground/10 relative overflow-hidden mb-12 bg-background/90 backdrop-blur-xl rounded-3xl"
 >
 <div className="flex flex-col lg:flex-row gap-12 items-start">
 <div className="w-32 h-32 md:w-48 md:h-48 bg-foreground/[0.04] overflow-hidden shrink-0 relative border border-foreground/10">
 <img src={vendor.logo_url || `https://ui-avatars.com/api/?name=${vendor.store_name}&background=1a1a1a&color=f5f2ed&size=400`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
 {vendor.is_verified && <div className="absolute bottom-2 right-2 bg-primary text-background dark:bg-background dark:text-foreground p-1.5 rounded-full"><ShieldCheck className="w-4 h-4 stroke-[1]" /></div>}
 </div>
 
 <div className="flex-1 space-y-6">
 <div>
 <div className="flex items-center gap-4 mb-4">
 <div className="flex items-center gap-1.5">
 <Star className="w-3.5 h-3.5 fill-current stroke-[1]" />
 <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">{vendor.trust_score || 98}% Trust</span>
 </div>
 {vendor.is_verified && <span className="text-[10px] uppercase tracking-[0.2em] font-semibold opacity-60">Verified Artisan</span>}
 </div>
 <h1 className="font-serif text-4xl md:text-6xl font-light tracking-tight leading-[1] uppercase">{vendor.store_name}</h1>
 </div>
 
 <p className="text-sm leading-relaxed opacity-80 font-light max-w-2xl italic border-l border-foreground/20 pl-6 py-2">"{vendor.description}"</p>
 
 <div className="flex flex-wrap gap-6 pt-4">
 <div className="flex items-center gap-2 opacity-60"><MapPin className="w-4 h-4 stroke-[1]" /> <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">{vendor.region}</span></div>
 <div className="flex items-center gap-2 opacity-60"><Clock className="w-4 h-4 stroke-[1]" /> <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">Fast Response</span></div>
 <div className="flex items-center gap-2 opacity-60"><Truck className="w-4 h-4 stroke-[1]" /> <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">Global Shipping</span></div>
 </div>
 </div>

 <div className="flex flex-row lg:flex-col gap-4 w-full lg:w-auto">
 <button 
 className={`h-12 px-8 text-[10px] uppercase tracking-[0.2em] font-semibold transition-colors flex-1 lg:flex-none border ${isFollowing(vendor.seller_id) ? 'border-foreground/20 hover:border-foreground' : 'border-foreground bg-primary text-background dark:border-background dark:bg-background dark:text-foreground hover:opacity-90'}`}
 onClick={() => isFollowing(vendor.seller_id) ? unfollowSeller(vendor.seller_id) : followSeller(vendor.seller_id)}
 >
 {isFollowing(vendor.seller_id) ? "Following" : "Follow Brand"}
 </button>
 <button className="h-12 px-8 border border-foreground/20 text-[10px] uppercase tracking-[0.2em] font-semibold hover:border-foreground transition-colors flex-1 lg:flex-none flex items-center justify-center gap-2" onClick={() => setIsMessageModalOpen(true)}>
 <MessageSquare className="w-4 h-4 stroke-[1]" /> Message
 </button>
 </div>
 </div>
 </motion.div>


 {/* Tabs Navigation */}
 <motion.div 
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true, margin: "-50px" }}
 transition={{ duration: 0.6, delay: 0.2 }}
 className="flex gap-12 border-b border-foreground/10 mb-16"
 >
 <button 
 onClick={() => setActiveTab('collection')}
 className={`pb-4 text-[10px] uppercase tracking-[0.2em] font-black transition-all relative ${activeTab === 'collection' ? 'text-foreground' : 'text-foreground/40 hover:text-foreground/65'}`}
 >
 Collection
 {activeTab === 'collection' && <motion.div layoutId="store-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 dark:bg-background" />}
 </button>
 <button 
 onClick={() => setActiveTab('info')}
 className={`pb-4 text-[10px] uppercase tracking-[0.2em] font-black transition-all relative ${activeTab === 'info' ? 'text-foreground' : 'text-foreground/40 hover:text-foreground/65'}`}
 >
 Store Info
 {activeTab === 'info' && <motion.div layoutId="store-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 dark:bg-background" />}
 </button>
 </motion.div>

 {activeTab === 'collection' ? (
 /* Products Grid */
 <div className="space-y-16">
 <div className="flex flex-col md:flex-row justify-between items-end gap-8 border-b border-foreground/10 pb-8">
 <div>
 <h2 className="font-serif text-4xl font-light mb-4">Collection</h2>
 <p className="text-[10px] uppercase tracking-[0.2em] font-semibold opacity-60 flex items-center gap-3">
 <span className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse"></span>
 {storeProducts.length} Products Available
 </p>
 </div>
 <div className="relative w-full md:w-[400px] group">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 group-focus-within:opacity-100 transition-opacity stroke-[1]" />
 <input 
 placeholder="Search collection..." 
 value={searchQuery} 
 onChange={(e: any) => setSearchQuery(e.target.value)} 
 className="w-full h-12 bg-transparent border-b border-foreground/20 focus:border-foreground outline-none text-sm font-light pl-12 placeholder:opacity-40 transition-colors" 
 />
 </div>
 </div>

 {storeProducts.length === 0 ? (
 <div className="py-32 text-center border border-foreground/10 border-dashed">
 <Search className="w-8 h-8 mx-auto mb-4 opacity-20 stroke-[1]" />
 <p className="text-[10px] uppercase tracking-[0.2em] font-semibold opacity-60">No matches found in this shop.</p>
 </div>
 ) : (
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
 {storeProducts.map((p, index) => (
 <ProductCard key={p.id} product={p} index={index} onClick={() => navigate(`/product/${p.id}`)} />
 ))}
 </div>
 )}
 </div>
 ) : (
 /* Store Info Section */
 <motion.div 
 initial={{ opacity: 0, y: 30 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true, margin: "-50px" }}
 transition={{ duration: 0.6 }}
 className="grid md:grid-cols-3 gap-12"
 >
 <div className="md:col-span-2 space-y-12">
 <section className="space-y-6">
 <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-foreground/40 flex items-center gap-3">
 <FileText className="w-4 h-4" /> Store Policy
 </h3>
 <div className="p-8 bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 rounded-[2rem] text-sm leading-relaxed opacity-80 font-light italic">
 {vendor.store_policy || "No specific store policy provided. Standard marketplace terms apply."}
 </div>
 </section>

 <section className="space-y-6">
 <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-foreground/40 flex items-center gap-3">
 <Tag className="w-4 h-4" /> Specialties
 </h3>
 <div className="flex flex-wrap gap-3">
 {vendor.tags && vendor.tags.length > 0 ? (
 vendor.tags.map((tag: string) => (
 <span key={tag} className="px-6 py-3 bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 rounded-full text-[10px] uppercase tracking-widest font-black">
 {tag}
 </span>
 ))
 ) : (
 <p className="text-xs opacity-40 italic">No tags listed</p>
 )}
 </div>
 </section>

 <section className="space-y-6">
 <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-foreground/40 flex items-center gap-3">
 <Globe className="w-4 h-4" /> Social Presence
 </h3>
 <div className="flex gap-4">
 {vendor.social_links?.find(l => l.platform === 'Instagram') && (
 <a href={vendor.social_links.find(l => l.platform === 'Instagram')?.url} target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-2xl bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 flex items-center justify-center hover:scale-110 transition-transform">
 <Instagram className="w-5 h-5" />
 </a>
 )}
 {vendor.social_links?.find(l => l.platform === 'Twitter' || l.platform === 'X') && (
 <a href={vendor.social_links.find(l => l.platform === 'Twitter' || l.platform === 'X')?.url} target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-2xl bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 flex items-center justify-center hover:scale-110 transition-transform">
 <Twitter className="w-5 h-5" />
 </a>
 )}
 {vendor.social_links?.find(l => l.platform === 'Facebook') && (
 <a href={vendor.social_links.find(l => l.platform === 'Facebook')?.url} target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-2xl bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 flex items-center justify-center hover:scale-110 transition-transform">
 <Facebook className="w-5 h-5" />
 </a>
 )}
 {vendor.social_links?.find(l => l.platform === 'WhatsApp') && (
 <a href={`https://wa.me/${vendor.social_links.find(l => l.platform === 'WhatsApp')?.url?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-2xl bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 flex items-center justify-center hover:scale-110 transition-transform">
 <Phone className="w-5 h-5" />
 </a>
 )}
 {(!vendor.social_links || vendor.social_links.length === 0) && <p className="text-xs opacity-40 italic">No social links connected</p>}
 </div>
 </section>
 </div>

 <div className="space-y-12">
 <section className="space-y-6">
 <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-foreground/40 flex items-center gap-3">
 <Clock className="w-4 h-4" /> Opening Hours
 </h3>
 <div className="p-8 bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 rounded-[2rem] space-y-4">
 {vendor.opening_hours ? (
 Object.entries(vendor.opening_hours).map(([day, hours]: [string, any]) => (
 <div key={day} className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
 <span className="opacity-40">{day}</span>
 <span>{hours}</span>
 </div>
 ))
 ) : (
 <p className="text-xs opacity-40 italic">Hours not specified</p>
 )}
 </div>
 </section>

 <section className="space-y-6">
 <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-foreground/40 flex items-center gap-3">
 <Star className="w-4 h-4" /> Performance
 </h3>
 <div className="grid grid-cols-2 gap-4">
 <div className="p-6 bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 rounded-3xl text-center">
 <p className="text-2xl font-display font-black leading-none mb-2">{vendor.total_sales || 0}</p>
 <p className="text-[8px] uppercase tracking-widest opacity-40 font-black">Total Sales</p>
 </div>
 <div className="p-6 bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 rounded-3xl text-center">
 <p className="text-2xl font-display font-black leading-none mb-2">{vendor.rating || '5.0'}</p>
 <p className="text-[8px] uppercase tracking-widest opacity-40 font-black">Rating</p>
 </div>
 </div>
 </section>
 </div>
 </motion.div>
 )}
 </div>
 </div>
 );
};
