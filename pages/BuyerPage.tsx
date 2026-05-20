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
import { Button, Card, Badge, Input, useToast, PremiumStatCard, ModernFollowCard, GraphicalTag, ReceiptModal } from '../components/UI';
import { supabase } from '../services/supabaseClient';
import { OrderTracking } from '../components/CheckoutComponents';
import { formatTZS, CURRENCY } from '../constants';
import { VendorProfile, Order, Offer, Product } from '../types';
import { BuyerOrders } from '../components/BuyerOrders';
import { BuyerMessages } from '../components/BuyerMessages';
import { ProductCard } from '../components/ProductCard';
import { BuyerSettingsPage } from './BuyerSettingsPage';
import { BuyerReturns } from '../components/BuyerReturns';
import { useBuyerStats } from '../src/hooks/useBuyerStats';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }: any) => {
 if (!active || !payload?.length) return null;
 return (
 <div className="bg-background border border-foreground/10 rounded-2xl px-4 py-3 shadow-xl text-xs">
 <p className="text-foreground/45 uppercase tracking-widest mb-0.5">{label||payload[0].name}</p>
 <p className="font-bold text-foreground">{formatTZS(payload[0].value)}</p>
 </div>
 );
};

// ─── Offers ──────────────────────────────────────────────────────────────────
const BuyerOffers = () => {
 const { addToast } = useToast();
 const [offers, setOffers] = useState<(Offer & { vendor: VendorProfile })[]>([]);
 const [loading, setLoading] = useState(true);
 const [filter, setFilter] = useState<'all'|'expiring'|'high_value'>('all');
 const [copied, setCopied] = useState<string|null>(null);

 useEffect(() => {
 const fetch = async () => {
 setLoading(true);
 const now = new Date().toISOString();
 const { data: offersData } = await supabase.from('offers').select('*').eq('status','active')
 .or(`end_date.is.null,end_date.gte.${now}`).order('created_at',{ascending:false});
 if (!offersData) { setLoading(false); return; }
 const ids = [...new Set(offersData.map((o:any)=>o.seller_id))];
 const { data: vData } = await supabase.from('vendor_profiles').select('seller_id,store_name,logo_url,is_verified').in('seller_id',ids);
 const vMap = new Map((vData||[]).map((v:any)=>[v.seller_id,v]));
 setOffers(offersData.map((o:any)=>({...o, vendor: vMap.get(o.seller_id)})) as any);
 setLoading(false);
 };
 fetch();
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
 <p className="text-xs text-foreground/45 mt-0.5">Exclusive offers curated for you · {filtered.length} active</p>
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
 <img src={(offer as any).vendor?.logo_url||`https://ui-avatars.com/api/?name=${(offer as any).vendor?.store_name||'M'}&background=random`} className="w-full h-full object-cover" alt=""/>
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

// ─── Follows ─────────────────────────────────────────────────────────────────
const BuyerFollows = ({ followers, unfollowSeller, navigate }: { followers:any[], unfollowSeller:(id:string)=>void, navigate:(p:string)=>void }) => {
 const [vendors, setVendors] = useState<VendorProfile[]>([]);
 const [loading, setLoading] = useState(false);

 useEffect(()=>{
 if (!followers.length) { setVendors([]); return; }
 setLoading(true);
 supabase.from('vendor_profiles').select('*').in('seller_id',followers.map((f:any)=>f.seller_id))
 .then(({data})=>{ if(data) setVendors(data); setLoading(false); });
 },[followers]);

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

// ─── Main page ────────────────────────────────────────────────────────────────
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
 const stats = useBuyerStats();
 const [searchParams, setSearchParams] = useSearchParams();
 const navigate = useNavigate();
 const [tab, setTab] = useState<string>((searchParams.get('tab'))||'dashboard');
 const [receiptOrder, setReceiptOrder] = useState<{order:Order,seller:VendorProfile}|null>(null);

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

 const kpiStats = [
 { title:'Orders', value: stats.orderCount, icon: ShoppingBag, color:'text-blue-600' },
 { title:'Total Spent', value: formatTZS(stats.totalSpent), icon: DollarSign, color:'text-indigo-600' },
 { title:'Points', value: (user.points||0).toLocaleString(), icon: Star, color:'text-amber-500' },
 { title:'Wallet', value: formatTZS(user.wallet_balance||0), icon: Wallet, color:'text-emerald-500' },
 ];

 return (
 <div className="min-h-screen bg-background font-sans pb-[calc(5rem+env(safe-area-inset-bottom))] pt-20 md:pt-24">
 <div className="container mx-auto max-w-7xl px-4 md:px-6">

 {/* ── Page header ─────────────────────────────────────── */}
 <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:0.4}}
 className="flex items-center justify-between py-6 md:py-8">
 <div className="flex items-center gap-3.5">
 {user.avatar_url ? (
 <img src={user.avatar_url} alt="" className="w-12 h-12 rounded-2xl object-cover ring-2 ring-foreground/10 shadow-md"/>
 ) : (
 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-foreground to-foreground/80 flex items-center justify-center shadow-md shrink-0">
 <span className="text-background font-black text-lg">{(user.name||user.email||'U')[0].toUpperCase()}</span>
 </div>
 )}
 <div>
 <p className="text-[10px] text-foreground/35 uppercase tracking-[0.2em] font-bold">Buyer Account</p>
 <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight leading-tight">
 Hello, {user.name?.split(' ')[0]||'there'} 👋
 </h1>
 </div>
 </div>
 <button onClick={()=>changeTab('settings')} className="w-10 h-10 rounded-2xl bg-foreground/[0.06] flex items-center justify-center hover:bg-foreground/10 transition-colors">
 <Settings className="w-4 h-4 text-foreground/60 stroke-[2]"/>
 </button>
 </motion.div>

 {/* ── Tab strip ───────────────────────────────────────── */}
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

 {/* ── Tab content ─────────────────────────────────────── */}
 <AnimatePresence mode="wait">
 <motion.div key={tab} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.2}}>

 {/* DASHBOARD ─────────────────────────────────────── */}
 {tab==='dashboard' && (
 <div className="space-y-6">
 {/* KPI cards */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
 {kpiStats.map((s,i)=><PremiumStatCard key={i} title={s.title} value={s.value} icon={s.icon} trend={i===1?{value:'+12.5%',positive:true}:undefined}/>)}
 </div>

 {/* Charts row */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 <div className="lg:col-span-2 bg-card border border-foreground/8 rounded-3xl p-5 md:p-6">
 <p className="text-xs font-bold uppercase tracking-widest text-foreground/35 mb-4">Spending · Last 6 months</p>
 <div className="h-48">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={stats.spendingHistory} barSize={28}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-5"/>
 <XAxis dataKey="month" tick={{fontSize:10,fill:'currentColor',opacity:0.4}} tickLine={false} axisLine={false}/>
 <YAxis hide/>
 <Tooltip content={<ChartTip/>} cursor={{fill:'currentColor',opacity:0.04}}/>
 <Bar dataKey="amount" radius={[6,6,0,0]} fill="currentColor" className="text-foreground"/>
 </BarChart>
 </ResponsiveContainer>
 </div>
 </div>
 <div className="bg-card border border-foreground/8 rounded-3xl p-5 md:p-6">
 <p className="text-xs font-bold uppercase tracking-widest text-foreground/35 mb-4">Category split</p>
 {stats.categoryDistribution.length>0 ? (
 <>
 <div className="h-36">
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie data={stats.categoryDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4} dataKey="value" nameKey="name">
 {stats.categoryDistribution.map((_:any,i:number)=><Cell key={i} fillOpacity={1-(i*0.18)} fill="currentColor" className="text-foreground"/>)}
 </Pie>
 <Tooltip content={<ChartTip/>}/>
 </PieChart>
 </ResponsiveContainer>
 </div>
 <div className="space-y-1.5 mt-2">
 {stats.categoryDistribution.slice(0,3).map((c:any,i:number)=>(
 <div key={i} className="flex items-center justify-between text-xs">
 <span className="text-foreground/55 truncate">{c.name}</span>
 <span className="font-bold text-foreground shrink-0">{formatTZS(c.value)}</span>
 </div>
 ))}
 </div>
 </>
 ) : (
 <div className="flex items-center justify-center h-36 text-foreground/20 text-xs">No data yet</div>
 )}
 </div>
 </div>

 {/* Recent orders + Savings */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="bg-card border border-foreground/8 rounded-3xl p-5">
 <div className="flex items-center justify-between mb-4">
 <p className="text-xs font-bold uppercase tracking-widest text-foreground/35">Recent Orders</p>
 <button onClick={()=>changeTab('orders')} className="text-[10px] font-bold text-foreground/45 hover:text-foreground flex items-center gap-1">
 View all <ChevronRight className="w-3 h-3"/>
 </button>
 </div>
 {orders.length===0 ? (
 <div className="flex flex-col items-center py-8 text-foreground/25">
 <Package className="w-10 h-10 mb-2 opacity-30"/>
 <p className="text-xs">No orders yet</p>
 <button onClick={()=>navigate('/shop')} className="mt-3 h-9 px-4 rounded-xl bg-foreground text-background text-xs font-bold">Shop Now</button>
 </div>
 ) : (
 <div className="space-y-2">
 {orders.slice(0,4).map(o=>(
 <button key={o.id} onClick={()=>changeTab('orders')}
 className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-foreground/[0.04] transition-colors text-left">
 <div className="w-9 h-9 rounded-xl bg-foreground/[0.06] flex items-center justify-center shrink-0">
 <Package className="w-4 h-4 text-foreground/50 stroke-[2]"/>
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-xs font-bold text-foreground truncate">#{o.id.slice(0,8).toUpperCase()}</p>
 <p className="text-[10px] text-foreground/40 capitalize">{o.status}</p>
 </div>
 <div className="text-right shrink-0">
 <p className="text-xs font-bold text-foreground">{formatTZS(o.total||0)}</p>
 <p className="text-[10px] text-foreground/35">{new Date(o.created_at||'').toLocaleDateString()}</p>
 </div>
 </button>
 ))}
 </div>
 )}
 </div>

 {/* Savings card */}
 <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-5 md:p-6 relative overflow-hidden text-white">
 <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-xl"/>
 <div className="relative z-10">
 <p className="text-[10px] text-white/60 uppercase tracking-widest font-bold mb-1">Your Savings</p>
 <p className="text-3xl font-black mb-1">{formatTZS(stats.savings)}</p>
 <p className="text-white/70 text-xs mb-5">Saved this month using platform vouchers and promotions.</p>
 <button onClick={()=>changeTab('offers')}
 className="h-10 px-5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors flex items-center gap-2">
 <Ticket className="w-4 h-4"/> Explore Deals
 </button>
 </div>
 </div>
 </div>

 {/* Quick actions */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 {[
 {label:'Track Orders', icon:Package, action:()=>changeTab('orders'), color:'bg-blue-500/10 text-blue-600'},
 {label:'My Wishlist', icon:Heart, action:()=>changeTab('wishlist'), color:'bg-rose-500/10 text-rose-600'},
 {label:'Messages', icon:MessageSquare,action:()=>changeTab('inbox'), color:'bg-purple-500/10 text-purple-600'},
 {label:'Rewards', icon:Ticket, action:()=>changeTab('offers'), color:'bg-amber-500/10 text-amber-600'},
 ].map(({label,icon:Icon,action,color})=>(
 <button key={label} onClick={action}
 className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-foreground/[0.03] border border-foreground/8 hover:bg-foreground/[0.06] transition-all active:scale-[0.97]">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
 <Icon className="w-4.5 h-4.5 stroke-[2]"/>
 </div>
 <span className="text-xs font-semibold text-foreground/70">{label}</span>
 </button>
 ))}
 </div>
 </div>
 )}

 {tab==='orders' && (
 <BuyerOrders orders={orders} onCancel={cancelOrder} onDelete={deleteOrder}
 onReorder={(o)=>{ o.items?.forEach((i:any)=>{ if(i.products) addToCart(i.products,undefined,i.quantity); }); navigate('/cart'); }}
 onContactSeller={handleContactSeller}
 onPrintReceipt={(o,s)=>setReceiptOrder({order:o,seller:s||{} as VendorProfile})}
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
 <BuyerMessages userId={user.id} initialSellerId={searchParams.get('sellerId')}/>
 )}

 {tab==='offers' && <BuyerOffers/>}

 {tab==='returns' && (
 <BuyerReturns userId={user.id} onContactSeller={handleContactSeller}/>
 )}

 {tab==='settings' && <BuyerSettingsPage/>}
 </motion.div>
 </AnimatePresence>
 </div>

 {receiptOrder && (
 <ReceiptModal isOpen={!!receiptOrder} order={receiptOrder.order} seller={receiptOrder.seller} onClose={()=>setReceiptOrder(null)}/>
 )}
 </div>
 );
};
