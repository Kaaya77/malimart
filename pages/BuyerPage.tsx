import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
 Store, Star, BadgeCheck, MessageSquare, LayoutGrid, Package, Undo2, Wallet,
 ShoppingBag, Copy, ArrowDownLeft, ArrowUpRight, Heart, TrendingUp, Bell,
 Settings, RotateCcw, Ticket, Clock, Tag, Check, User, Plus, DollarSign,
 ChevronRight, Repeat, Sparkles, Search, ZapOff, Gift, Eye
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { Button, Card, Badge, Input, useToast, PremiumStatCard, ModernFollowCard, GraphicalTag } from '../components/UI';
import { supabase } from '../services/supabaseClient';
import { OrderTracking } from '../components/CheckoutComponents';
import { formatTZS, CURRENCY } from '../constants';
import { VendorProfile, Order, Offer, Product } from '../types';
import { BuyerOrders } from '../components/BuyerOrders';
import { BuyerDashboard } from '../components/BuyerDashboard';
import { MessagingHub } from '../components/messaging/MessagingHub';
import { ProductCard } from '../components/ProductCard';
import { BuyerSettingsPage } from './BuyerSettingsPage';
import { BuyerReturns } from '../components/BuyerReturns';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

// âââ Tooltip âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const ChartTip = ({ active, payload, label }: any) => {
 if (!active || !payload?.length) return null;
 return (
 <div className="bg-background border border-foreground/10 rounded-2xl px-4 py-3 shadow-xl text-xs">
 <p className="text-foreground/45 uppercase tracking-widest mb-0.5">{label||payload[0].name}</p>
 <p className="font-bold text-foreground">{formatTZS(payload[0].value)}</p>
 </div>
 );
};

// âââ Offers ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const BuyerOffers = () => {
 const { addToast } = useToast();
 const [offers, setOffers] = useState<(Offer & { vendor: VendorProfile })[]>([]);
 const [loading, setLoading] = useState(true);
 const [filter, setFilter] = useState<'all'|'expiring'|'high_value'>('all');
 const [copied, setCopied] = useState<string|null>(null);

 useEffect(() => {
 // Re-use offers already in AppContext â only fetch vendor info (not all offers again)
 const { offers: ctxOffers } = (window as any).__malimart_ctx__ || {};
 setLoading(true);
 const now = new Date().toISOString();
 supabase.from('offers').select('*, vendor:vendor_profiles!seller_id(seller_id,store_name,logo_url,is_verified)')
   .eq('status','active').or(`end_date.is.null,end_date.gte.${now}`)
   .order('created_at',{ascending:false}).limit(30)
   .then(({ data }) => {
     if (data) setOffers(data as any);
     setLoading(false);
   });
 },[]);

 const filtered = useMemo(()=>offers.filter(o=>{
 if (filter==='high_value') return o.type==='percentage'?o.value>=20:o.value>=10000;
 if (filter==='expiring') { if (!o.end_date) return false; return (new Date(o.end_date).getTime()-Date.now())/(86400000)<=3; }
 return true;
 }),[offers,filter]);

 const handleCopy = (code: string) => {
 navigator.clipboard.writeText(code);
 setCopied(code);
 addToast('Coupon copied!','success');
 setTimeout(()=>setCopied(null),2000);
 };

 const gradient = (o: Offer) => {
 if (o.type==='percentage'&&o.value>=25) return 'from-rose-500 to-pink-600';
 if (o.type==='fixed') return 'from-emerald-500 to-teal-600';
 return 'from-blue-600 to-indigo-700';
 };

 if (loading) return (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {[1,2,3].map(i=><div key={i} className="h-52 rounded-3xl shimmer"/>)}
 </div>
 );

 return (
 <div className="space-y-6">
 {/* Header + filter */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div>
 <h2 className="text-xl font-bold text-foreground">Rewards & Vouchers</h2>
 <p className="text-xs text-foreground/45 mt-0.5">Exclusive offers curated for you Â· {filtered.length} active</p>
 </div>
 <div className="flex p-1 bg-foreground/[0.05] rounded-xl gap-1 self-start sm:self-auto">
 {(['all','high_value','expiring'] as const).map(f=>(
 <button key={f} onClick={()=>setFilter(f)}
 className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filter===f?'bg-background text-foreground shadow-sm':'text-foreground/45 hover:text-foreground/70'}`}>
 {f==='high_value'?'Best Value':f==='expiring'?'Expiring Soon':'All'}
 </button>
 ))}
 </div>
 </div>

 {filtered.length===0 ? (
 <div className="flex flex-col items-center justify-center py-20 border border-dashed border-foreground/15 rounded-3xl text-foreground/35">
 <Ticket className="w-12 h-12 mb-3 opacity-20"/>
 <p className="text-sm font-semibold">No offers in this category</p>
 <p className="text-xs mt-1">Check back soon for new deals</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {filtered.map(offer=>(
 <div key={offer.id} className="bg-background rounded-3xl border border-foreground/8 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
 {/* Gradient header */}
 <div className={`h-20 bg-gradient-to-br ${gradient(offer)} p-4 relative overflow-hidden flex justify-between items-start`}>
 <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/10 rounded-full blur-xl"/>
 <div className="flex items-center gap-2">
 <div className="w-9 h-9 rounded-xl bg-background/90 overflow-hidden shrink-0 shadow">
 <img src={(offer as any).vendor?.logo_url||`https://ui-avatars.com/api/?name=${(offer as any).vendor?.store_name||'M'}&background=random`} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async"/>
 </div>
 <div>
 <p className="text-[10px] text-white/80 font-semibold leading-none">{(offer as any).vendor?.store_name}</p>
 {(offer as any).vendor?.is_verified && <p className="text-[8px] text-white/60 mt-0.5 flex items-center gap-0.5"><BadgeCheck className="w-2.5 h-2.5"/> Verified</p>}
 </div>
 </div>
 <div className="text-right">
 <p className="text-2xl font-black text-white leading-none">{offer.type==='percentage'?`${offer.value}%`:formatTZS(offer.value)}</p>
 <p className="text-[9px] text-white/70 uppercase font-bold">{offer.type==='percentage'?'off':'save'}</p>
 </div>
 </div>
 {/* Content */}
 <div className="p-4 flex-1 flex flex-col">
 <h3 className="font-semibold text-foreground text-sm mb-1">{offer.title}</h3>
 <p className="text-[10px] text-foreground/45 mb-3">{offer.min_order_value>0?`Min. spend ${formatTZS(offer.min_order_value)}`:'No minimum order'}</p>
 <div className="flex items-center justify-between text-[10px] text-foreground/40 mb-3">
 <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{offer.end_date?`Expires ${new Date(offer.end_date).toLocaleDateString()}`:'No expiry'}</span>
 <span className="flex items-center gap-1"><Tag className="w-3 h-3"/>Storewide</span>
 </div>
 {/* Copy button */}
 <button onClick={()=>handleCopy(offer.code)}
 className="mt-auto h-11 w-full rounded-2xl border-2 border-dashed border-foreground/15 flex items-center justify-between px-3 hover:border-foreground/35 hover:bg-foreground/[0.03] transition-all group cursor-copy active:scale-[0.98]">
 <span className="font-mono text-sm font-bold text-foreground tracking-wider">{offer.code}</span>
 <span className={`flex items-center gap-1 text-[10px] font-bold transition-all ${copied===offer.code?'text-emerald-500':'text-foreground/40 group-hover:text-foreground'}`}>
 {copied===offer.code?<><Check className="w-3.5 h-3.5 stroke-[3]"/>Copied!</>:<><Copy className="w-3.5 h-3.5"/>Copy</>}
 </span>
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
};

// âââ Follows âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const BuyerFollows = ({ followers, unfollowSeller, navigate }: { followers:any[], unfollowSeller:(id:string)=>void, navigate:(p:string)=>void }) => {
 const [vendors, setVendors] = useState<VendorProfile[]>([]);
 const [loading, setLoading] = useState(false);

 // Stable key prevents re-fetch when array reference changes but IDs are the same
 const stableIds = followers.map((f:any)=>f.seller_id).sort().join(',');
 useEffect(()=>{
 if (!followers.length) { setVendors([]); return; }
 setLoading(true);
 supabase.from('vendor_profiles')
 .select('seller_id,store_name,logo_url,is_verified,rating,trust_score,description,region')
 .in('seller_id',followers.map((f:any)=>f.seller_id))
 .then(({data})=>{ if(data) setVendors(data as any); setLoading(false); });
 },[stableIds]);

 if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="h-48 rounded-3xl shimmer"/>)}</div>;
 if (!vendors.length) return (
 <div className="flex flex-col items-center py-20 text-foreground/35 border border-dashed border-foreground/15 rounded-3xl">
 <Store className="w-12 h-12 mb-3 opacity-20"/>
 <p className="font-semibold text-sm">No followed stores yet</p>
 <p className="text-xs mt-1">Follow sellers to see their updates here</p>
 <button onClick={()=>navigate('/shop')} className="mt-4 h-10 px-5 rounded-full bg-foreground text-background text-xs font-bold">Browse Stores</button>
 </div>
 );

 return (
 <div className="space-y-4">
 <h2 className="text-xl font-bold text-foreground">Followed Stores <span className="text-foreground/35 font-normal">({vendors.length})</span></h2>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {vendors.map(v=>(
 <ModernFollowCard key={v.seller_id} vendor={v} onUnfollow={()=>unfollowSeller(v.seller_id)} onViewStore={()=>navigate(`/store/${v.seller_id}`)}/>
 ))}
 </div>
 </div>
 );
};

// âââ Main page ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const TABS = [
 { id:'dashboard',label:'Overview', icon:LayoutGrid },
 { id:'orders', label:'Orders', icon:ShoppingBag },
 { id:'wishlist', label:'Wishlist', icon:Heart },
 { id:'follows', label:'Following', icon:Store },
 { id:'inbox', label:'Messages', icon:MessageSquare },
 { id:'offers', label:'Rewards', icon:Ticket },
 { id:'returns', label:'Returns', icon:RotateCcw },
 { id:'settings', label:'Account', icon:Settings },
];

export const BuyerPage = () => {
 const { user, orders, cancelOrder, deleteOrder, addToCart, fetchVendorProfile, wishlist, followers, unfollowSeller } = useAppState();
 const [searchParams, setSearchParams] = useSearchParams();
 const navigate = useNavigate();
 const [tab, setTab] = useState<string>((searchParams.get('tab'))||'dashboard');

 useEffect(()=>{ const t=searchParams.get('tab'); if(t) setTab(t); },[searchParams]);

 const changeTab = (t: string) => {
 setTab(t);
 const p = new URLSearchParams(searchParams);
 p.set('tab',t);
 setSearchParams(p);
 };

 const handleContactSeller = (sellerId: string) => {
 const p = new URLSearchParams(searchParams);
 p.set('tab','inbox'); p.set('sellerId',sellerId);
 setSearchParams(p); setTab('inbox');
 };

 if (!user) return null;

 return (
 <div className="min-h-screen bg-background font-sans pb-[calc(5rem+env(safe-area-inset-bottom))] pt-20 md:pt-24">
 <div className="container mx-auto max-w-7xl px-4 md:px-6">

 {/* ââ Page header âââââââââââââââââââââââââââââââââââââââ */}
 <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:0.4}}
 className="flex items-center justify-between py-6 md:py-8">
 <div className="flex items-center gap-3.5">
 {user.avatar_url ? (
 <img src={user.avatar_url} alt="" className="w-12 h-12 rounded-2xl object-cover ring-2 ring-foreground/10 shadow-md" loading="lazy" decoding="async"/>
 ) : (
 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-foreground to-foreground/80 flex items-center justify-center shadow-md shrink-0">
 <span className="text-background font-black text-lg">{(user.name||user.email||'U')[0].toUpperCase()}</span>
 </div>
 )}
 <div>
 <p className="text-[10px] text-foreground/35 uppercase tracking-[0.2em] font-bold">Buyer Account</p>
 <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-tight">
 Hello, {user.name?.split(' ')[0]||'there'} ð
 </h1>
 </div>
 </div>
 <button onClick={()=>changeTab('settings')} className="w-10 h-10 rounded-2xl bg-foreground/[0.06] flex items-center justify-center hover:bg-foreground/10 transition-colors">
 <Settings className="w-4 h-4 text-foreground/60 stroke-[2]"/>
 </button>
 </motion.div>

 {/* ââ Tab strip âââââââââââââââââââââââââââââââââââââââââ */}
 <div className="flex gap-1 overflow-x-auto no-scrollbar bg-foreground/[0.04] p-1.5 rounded-2xl mb-6 sticky top-[60px] z-20 border border-foreground/8 backdrop-blur-xl">
 {TABS.map(t=>{
 const Icon=t.icon;
 const active=tab===t.id;
 return (
 <button key={t.id} onClick={()=>changeTab(t.id)}
 className={`flex-shrink-0 flex items-center gap-2 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 whitespace-nowrap ${active?'bg-background text-foreground shadow-sm':'text-foreground/40 hover:text-foreground/65'}`}>
 <Icon className={`w-3.5 h-3.5 stroke-[2] ${active?'':'opacity-70'}`}/>
 {t.label}
 </button>
 );
 })}
 </div>

 {/* ââ Tab content âââââââââââââââââââââââââââââââââââââââ */}
 <AnimatePresence mode="wait">
 <motion.div key={tab} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.2}}>

 {/* DASHBOARD âââââââââââââââââââââââââââââââââââââââ */}
        {tab==='dashboard' && (
          <BuyerDashboard
            orders={orders}
            wishlist={wishlist}
            user={user}
            onGoOrders={()=>setTab('orders')}
            onGoWishlist={()=>setTab('wishlist')}
            onGoOffers={()=>setTab('offers')}
          />
        )}

 {tab==='orders' && (
 <BuyerOrders orders={orders} onCancel={cancelOrder} onDelete={deleteOrder}
 onReorder={(o)=>{ o.items?.forEach((i:any)=>{ if(i.products) addToCart(i.products,undefined,i.quantity); }); navigate('/cart'); }}
 onContactSeller={handleContactSeller}
 onPrintReceipt={(o,s)=>navigate(`/order/${o.id}/receipt`, { state: { order:o, seller:s||{} } })}
 fetchVendorProfile={fetchVendorProfile}/>
 )}

 {tab==='wishlist' && (
 <div className="space-y-5">
 <div className="flex items-center justify-between">
 <h2 className="text-xl font-bold text-foreground">Wishlist <span className="text-foreground/35 font-normal">({wishlist.length})</span></h2>
 {wishlist.length>0 && <button onClick={()=>navigate('/shop')} className="text-xs font-bold text-foreground/45 hover:text-foreground">Add more</button>}
 </div>
 {wishlist.length===0 ? (
 <div className="flex flex-col items-center py-20 border border-dashed border-foreground/15 rounded-3xl text-foreground/35">
 <Heart className="w-12 h-12 mb-3 opacity-20"/>
 <p className="font-semibold text-sm">Your wishlist is empty</p>
 <p className="text-xs mt-1">Tap the heart on any product to save it</p>
 <button onClick={()=>navigate('/shop')} className="mt-5 h-10 px-5 rounded-full bg-foreground text-background text-xs font-bold">Browse Products</button>
 </div>
 ) : (
 <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-8 md:gap-x-4">
 {wishlist.map((p,i)=><ProductCard key={p.id} product={p} index={i} onClick={()=>navigate(`/product/${p.id}`)}/>)}
 </div>
 )}
 </div>
 )}

 {tab==='follows' && (
 <BuyerFollows followers={followers} unfollowSeller={unfollowSeller} navigate={navigate}/>
 )}

 {tab==='inbox' && (
 <MessagingHub userId={user.id} initialSellerId={searchParams.get('sellerId')} />
 )}

 {tab==='offers' && <BuyerOffers/>}

 {tab==='returns' && (
 <BuyerReturns userId={user.id} onContactSeller={handleContactSeller}/>
 )}

 {tab==='settings' && <BuyerSettingsPage/>}
 </motion.div>
 </AnimatePresence>
 </div>
 </div>
 );
};
