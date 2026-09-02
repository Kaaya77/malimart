import React, { useState, useEffect, useMemo } from 'react';
import { useBottomObstruction } from '../hooks/useBottomObstruction';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
 Store, Star, BadgeCheck, MessageSquare, LayoutGrid, Package, Undo2, Wallet,
 ShoppingBag, Copy, ArrowDownLeft, ArrowUpRight, Heart, TrendingUp, Bell,
 Settings, RotateCcw, Ticket, Clock, Tag, Check, User, Plus, DollarSign,
 ChevronRight, Repeat, Sparkles, Search, ZapOff, Gift, Eye, AlertTriangle, RefreshCw
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { Button, Card, Badge, Input, useToast, PremiumStatCard, ModernFollowCard, GraphicalTag, EmptyState, CountBadge, VerifiedBadge } from '../components/UI';
import { listActiveOffersWithVendors, getVendorCardsBySellerIds } from '../services/accountApi';
import { OrderTracking } from '../components/CheckoutComponents';
import { formatTZS, CURRENCY } from '../constants';
import { VendorProfile, Order, Offer, Product } from '../types';
import { BuyerOrders } from '../components/BuyerOrders';
import { BuyerDashboard } from '../components/BuyerDashboard';
import { MessagingHub } from '../components/messaging/MessagingHub';
import { ProductCard } from '../components/ProductCard';
import { BuyerSettingsPage } from './BuyerSettingsPage';
import { BuyerReturns } from '../components/BuyerReturns';
import { ProductShare } from '../components/ProductShare';
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
// Shared inline error state for buyer dashboard sections — friendly copy + retry.
const DashboardError = ({ message, onRetry }: { message?: string; onRetry: () => void }) => (
 <Card className="p-10 text-center">
 <div className="w-14 h-14 rounded-3xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
 <AlertTriangle className="w-6 h-6 text-red-500 stroke-[1.5]" />
 </div>
 <p className="text-sm font-bold text-foreground">Something went wrong</p>
 <p className="text-xs font-medium text-foreground/45 mt-1 max-w-xs mx-auto leading-relaxed">{message || 'We couldn\'t load this right now. Check your connection and try again.'}</p>
 <Button variant="primary" size="sm" onClick={onRetry} className="mt-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">
 <RefreshCw className="w-3.5 h-3.5 mr-2 stroke-[2.5]" /> Try again
 </Button>
 </Card>
);

const BuyerOffers = () => {
 const { addToast } = useToast();
 const [offers, setOffers] = useState<(Offer & { vendor: VendorProfile })[]>([]);
 const [loading, setLoading] = useState(true);
 const [loadError, setLoadError] = useState(false);
 const [filter, setFilter] = useState<'all'|'expiring'|'high_value'>('all');
 const [copied, setCopied] = useState<string|null>(null);

 const loadOffers = () => {
 setLoading(true);
 setLoadError(false);
 const now = new Date().toISOString();
 listActiveOffersWithVendors(now)
   .then(({ data, error }) => {
     if (error) { console.error('Offers fetch error:', error); setLoadError(true); }
     else if (data) setOffers(data as any);
     setLoading(false);
   });
 };

 useEffect(() => { loadOffers(); }, []);

 // Client-side filtering of the already-loaded offers.
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

 if (loadError) return <DashboardError message="We couldn't load rewards & vouchers right now." onRetry={loadOffers} />;

 return (
 <div className="space-y-6">
 {/* Header + filter */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div>
 <h2 className="text-xl font-bold text-foreground">Rewards & Vouchers</h2>
 <p className="text-xs text-foreground/45 mt-0.5">Exclusive offers curated for you Â· {filtered.length} active</p>
 </div>
 <div className="flex gap-1.5 self-start sm:self-auto">
 {(['all','high_value','expiring'] as const).map(f=>(
 <button key={f} onClick={()=>setFilter(f)} aria-pressed={filter===f}
 className={`h-11 px-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${filter===f?'bg-foreground text-background shadow-sm':'bg-foreground/[0.05] text-foreground/60 hover:text-foreground'}`}>
 {f==='high_value'?'Best Value':f==='expiring'?'Expiring Soon':'All'}
 </button>
 ))}
 </div>
 </div>

 {filtered.length===0 ? (
 <EmptyState icon={Ticket} title="No offers in this category" subtitle="Check back soon for new deals" className="rounded-3xl border border-foreground/8 bg-foreground/[0.02]"/>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {filtered.map(offer=>(
 <div key={offer.id} className="bg-foreground/[0.02] rounded-3xl border border-foreground/8 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
 {/* Gradient header */}
 <div className={`h-20 bg-gradient-to-br ${gradient(offer)} p-5 relative overflow-hidden flex justify-between items-start`}>
 <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-white/10 rounded-full blur-xl"/>
 <div className="flex items-center gap-2">
 <div className="w-9 h-9 rounded-xl bg-background/90 overflow-hidden shrink-0 shadow">
 <img src={(offer as any).vendor?.logo_url||`https://ui-avatars.com/api/?name=${(offer as any).vendor?.store_name||'M'}&background=random`} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async"/>
 </div>
 <div>
 <p className="text-[10px] text-white/80 font-semibold leading-none">{(offer as any).vendor?.store_name}</p>
 {(offer as any).vendor?.is_verified && <p className="text-[10px] text-white/60 mt-0.5 flex items-center gap-0.5"><VerifiedBadge iconOnly size="w-3 h-3" /> Verified</p>}
 </div>
 </div>
 <div className="text-right">
 <p className="text-2xl font-black text-white leading-none">{offer.type==='percentage'?`${offer.value}%`:formatTZS(offer.value)}</p>
 <p className="text-[10px] text-white/70 uppercase tracking-widest font-bold">{offer.type==='percentage'?'off':'save'}</p>
 </div>
 </div>
 {/* Content */}
 <div className="p-5 flex-1 flex flex-col">
 <h3 className="font-semibold text-foreground text-sm mb-1">{offer.title}</h3>
 <p className="text-[10px] text-foreground/45 mb-3">{offer.min_order_value>0?`Min. spend ${formatTZS(offer.min_order_value)}`:'No minimum order'}</p>
 <div className="flex items-center justify-between text-[10px] text-foreground/40 mb-3">
 <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{offer.end_date?`Expires ${new Date(offer.end_date).toLocaleDateString()}`:'No expiry'}</span>
 <span className="flex items-center gap-1"><Tag className="w-3 h-3"/>Storewide</span>
 </div>
 {/* Copy button */}
 <button onClick={()=>handleCopy(offer.code)} aria-label="Copy code"
 className="mt-auto h-11 w-full rounded-2xl border border-foreground/8 bg-foreground/[0.04] flex items-center justify-between px-3.5 hover:bg-foreground/[0.08] transition-all group cursor-copy active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">
 <span className="font-mono text-sm font-bold text-foreground tracking-wider">{offer.code}</span>
 <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-all ${copied===offer.code?'text-emerald-500':'text-foreground/40 group-hover:text-foreground'}`}>
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
 const [loadError, setLoadError] = useState(false);

 // Stable key prevents re-fetch when array reference changes but IDs are the same
 const stableIds = followers.map((f:any)=>f.seller_id).sort().join(',');
 const loadVendors = () => {
 if (!followers.length) { setVendors([]); return; }
 setLoading(true);
 setLoadError(false);
 getVendorCardsBySellerIds(followers.map((f:any)=>f.seller_id))
 .then(({data, error})=>{
   if (error) { console.error('Followed stores fetch error:', error); setLoadError(true); }
   else if(data) setVendors(data as any);
   setLoading(false);
 });
 };
 useEffect(()=>{ loadVendors(); },[stableIds]);

 if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="h-48 rounded-3xl shimmer"/>)}</div>;
 if (loadError) return <DashboardError message="We couldn't load your followed stores right now." onRetry={loadVendors} />;
 if (!vendors.length) return (
 <EmptyState icon={Store} title="No followed stores yet" subtitle="Follow sellers to see their updates here"
 className="rounded-3xl border border-foreground/8 bg-foreground/[0.02]"
 action={<Button size="sm" onClick={()=>navigate('/shop')} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">Browse Stores</Button>}/>
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
// Same dashboard shell as SellerPage: desktop sidebar + mobile bottom tab bar.
// One name per tab, used everywhere. First five feed the mobile bar; the rest
// live in the More sheet.
const TABS = [
 { id:'dashboard',label:'Overview', icon:LayoutGrid, desc:'Your activity at a glance' },
 { id:'orders', label:'Orders', icon:ShoppingBag, desc:'Track & manage purchases' },
 { id:'inbox', label:'Messages', icon:MessageSquare, desc:'Chat with sellers' },
 { id:'wishlist', label:'Wishlist', icon:Heart, desc:'Products you saved' },
 { id:'offers', label:'Rewards', icon:Ticket, desc:'Vouchers & deals for you' },
 { id:'follows', label:'Following', icon:Store, desc:'Stores you follow' },
 { id:'returns', label:'Returns', icon:RotateCcw, desc:'Refunds & disputes' },
 { id:'settings', label:'Account', icon:Settings, desc:'Profile & preferences' },
];

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40';

const tabBadge = (tabId: string, unread: number): { count: number; urgent: boolean } => {
 if (tabId === 'inbox') return { count: unread, urgent: false };
 return { count: 0, urgent: false };
};

// Vertical sidebar nav (desktop) — mirrors SellerPage's SideNav.
const SideNav = ({ tab, setTab, unread, user, onShop }: any) => (
 <aside className="hidden lg:flex flex-col w-[220px] shrink-0 sticky top-[80px] self-start max-h-[calc(100vh-100px)] overflow-y-auto pr-2">
 {/* Account identity */}
 <div className="flex items-center gap-3 px-3 py-3 mb-4 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.06]">
 {user.avatar_url ? (
 <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-xl object-cover ring-1 ring-foreground/10" />
 ) : (
 <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shrink-0">
 <span className="text-white font-black text-sm">{(user.name||user.email||'U')[0].toUpperCase()}</span>
 </div>
 )}
 <div className="min-w-0">
 <p className="text-[10px] font-black uppercase tracking-widest text-foreground/30">Account</p>
 <p className="text-xs font-bold text-foreground truncate">{user.name?.split(' ')[0] || 'My account'}</p>
 </div>
 </div>

 {/* Nav items */}
 <nav aria-label="Buyer account sections" className="flex flex-col gap-0.5">
 {TABS.map((t: any) => {
 const Icon = t.icon;
 const active = tab === t.id;
 const { count, urgent } = tabBadge(t.id, unread);
 return (
 <button key={t.id} onClick={() => setTab(t.id)}
 aria-current={active ? 'page' : undefined}
 className={`group relative flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-2xl text-left transition-all duration-200 ${FOCUS_RING} ${
 active ? 'bg-foreground/[0.06] text-foreground' : 'text-foreground/50 hover:text-foreground hover:bg-foreground/[0.04]'
 }`}
 >
 {active && (
 <motion.span layoutId="buyer-sidebar-pill"
 className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-emerald-500"
 />
 )}
 <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
 active ? 'bg-emerald-500 text-white' : 'bg-foreground/[0.04] text-foreground/50 group-hover:text-foreground'
 }`}>
 <Icon className="w-3.5 h-3.5" strokeWidth={2} />
 </span>
 <span className="flex-1 text-[11px] font-bold tracking-wide">{t.label}</span>
 <CountBadge count={count} urgent={urgent} />
 </button>
 );
 })}
 </nav>

 {/* Footer links */}
 <div className="mt-auto pt-6 border-t border-foreground/[0.06] flex flex-col gap-1">
 <button onClick={onShop}
 className={`flex items-center gap-2.5 px-3 py-2 min-h-11 rounded-2xl text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.04] transition-all text-[11px] font-semibold text-left ${FOCUS_RING}`}>
 <Search className="w-3.5 h-3.5" />
 Continue shopping
 </button>
 <div className="flex items-center gap-2.5 px-3 py-2 text-foreground/25 text-[10px] font-semibold">
 <BadgeCheck className="w-3 h-3" />
 Secured by MaliMart
 </div>
 </div>
 </aside>
);

// Bottom tab bar (mobile) — mirrors SellerPage's MobileTabBar.
const MobileTabBar = ({ tab, setTab, unread }: any) => {
 const bottomBarRef = useBottomObstruction<HTMLDivElement>();
 const primary = TABS.slice(0, 5);
 return (
 <div ref={bottomBarRef} className="lg:hidden fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]
 bg-background/80 backdrop-blur-2xl border-t border-foreground/[0.08]">
 <nav aria-label="Buyer account sections" className="flex">
 {primary.map((t: any) => {
 const Icon = t.icon;
 const active = tab === t.id;
 const { count, urgent } = tabBadge(t.id, unread);
 return (
 <button key={t.id} onClick={() => setTab(t.id)}
 aria-current={active ? 'page' : undefined}
 className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] relative transition-colors ${FOCUS_RING}`}>
 {active && (
 <motion.span layoutId="buyer-mobile-indicator"
 className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-emerald-500"
 />
 )}
 <span className="relative">
 <Icon className={`w-5 h-5 transition-colors ${active ? 'text-foreground' : 'text-foreground/50'}`}
 strokeWidth={active ? 2.5 : 1.5} />
 <CountBadge count={count} urgent={urgent} className="absolute -top-2.5 -right-3 scale-[0.8] origin-bottom-left" />
 </span>
 <span className={`text-[10px] font-bold tracking-wide transition-colors ${active ? 'text-foreground' : 'text-foreground/50'}`}>
 {t.label}
 </span>
 </button>
 );
 })}
 <MobileMore tab={tab} setTab={setTab} tabs={TABS.slice(5)} />
 </nav>
 </div>
 );
};

const MobileMore = ({ tab, setTab, tabs }: any) => {
 const [open, setOpen] = useState(false);
 const hasActive = tabs.some((t: any) => t.id === tab);
 return (
 <>
 <button onClick={() => setOpen(true)}
 aria-label="More sections" aria-haspopup="dialog" aria-expanded={open}
 aria-current={hasActive ? 'page' : undefined}
 className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] ${FOCUS_RING}`}>
 <Plus className={`w-5 h-5 ${hasActive ? 'text-foreground' : 'text-foreground/50'}`} strokeWidth={hasActive ? 2.5 : 1.5} />
 <span className={`text-[10px] font-bold tracking-wide ${hasActive ? 'text-foreground' : 'text-foreground/50'}`}>More</span>
 </button>
 <AnimatePresence>
 {open && (
 <>
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
 className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
 <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
 transition={{ type: 'spring', damping: 28, stiffness: 300 }}
 className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-foreground/10 rounded-t-3xl pb-[env(safe-area-inset-bottom)]">
 <div className="w-10 h-1 bg-foreground/15 rounded-full mx-auto mt-3 mb-4" />
 <div className="px-4 pb-6 grid grid-cols-3 gap-3">
 {tabs.map((t: any) => {
 const Icon = t.icon;
 const active = tab === t.id;
 return (
 <button key={t.id} onClick={() => { setTab(t.id); setOpen(false); }}
 aria-current={active ? 'page' : undefined}
 className={`flex flex-col items-center gap-2 p-4 min-h-11 rounded-2xl border transition-all ${FOCUS_RING} ${
 active ? 'border-emerald-500/40 bg-emerald-500/[0.06]' : 'border-foreground/[0.07] bg-foreground/[0.02]'
 }`}>
 <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${
 active ? 'bg-emerald-500 text-white' : 'bg-foreground/[0.05] text-foreground/60'
 }`}>
 <Icon className="w-5 h-5" />
 </span>
 <span className={`text-[10px] font-bold ${active ? 'text-foreground' : 'text-foreground/60'}`}>{t.label}</span>
 </button>
 );
 })}
 </div>
 </motion.div>
 </>
 )}
 </AnimatePresence>
 </>
 );
};

// Page header — matches SellerPage's PageHeader treatment.
const PageHeader = ({ activeTab }: { activeTab: any }) => {
 const Icon = activeTab.icon;
 return (
 <motion.div key={activeTab.id}
 initial={{ opacity: 0, x: -8 }}
 animate={{ opacity: 1, x: 0 }}
 className="flex items-center gap-3 mb-6 lg:mb-8">
 <span className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
 <Icon className="w-4 h-4" strokeWidth={2} />
 </span>
 <div>
 <h1 className="text-lg font-black text-foreground tracking-tight leading-none">{activeTab.label}</h1>
 <p className="text-xs text-foreground/40 mt-0.5 font-medium">{activeTab.desc}</p>
 </div>
 </motion.div>
 );
};

export const BuyerPage = () => {
 const { user, orders, cancelOrder, deleteOrder, addToCart, fetchVendorProfile, wishlist, toggleWishlist, followers, unfollowSeller, unreadMessages } = useAppState();
 const { addToast } = useToast();
 const [searchParams, setSearchParams] = useSearchParams();
 const navigate = useNavigate();
 const [tab, setTab] = useState<string>((searchParams.get('tab'))||'dashboard');
 const [giftShareOpen, setGiftShareOpen] = useState(false);

 useEffect(()=>{ const t=searchParams.get('tab'); if(t) setTab(t); },[searchParams]);
 useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, [tab]);

 const changeTab = (t: string) => {
 setTab(t);
 const p = new URLSearchParams(searchParams);
 p.set('tab',t);
 setSearchParams(p);
 };

 const handleContactSeller = (sellerId: string, context?: { type: string; id: string; label?: string }) => {
 const p = new URLSearchParams(searchParams);
 p.set('tab','inbox'); p.set('sellerId',sellerId);
 ['productId','orderId','contextType','contextId','contextLabel'].forEach(k => p.delete(k));
 if (context?.id) {
  if (context.type === 'product') p.set('productId', context.id);
  else { p.set('contextType', context.type); p.set('contextId', context.id); if (context.label) p.set('contextLabel', context.label); }
 }
 setSearchParams(p); setTab('inbox');
 };

 if (!user) return (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4 pb-20 pt-24">
    <div className="text-center space-y-2">
      <p className="text-2xl font-bold text-foreground">Sign in to continue</p>
      <p className="text-foreground/50 text-sm">Your wishlist, orders, and account details are waiting for you.</p>
    </div>
    <button
      onClick={() => navigate('/login?redirect=%2Fbuyer')}
      className="min-h-[44px] px-8 py-3 rounded-2xl bg-foreground text-background text-sm font-semibold active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
    >
      Sign In
    </button>
  </div>
 );

 const activeTabDef = TABS.find(t => t.id === tab) || TABS[0];

 return (
 <div className="min-h-screen bg-background font-sans pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8 pt-[72px] lg:pt-[80px]">
 <div className="container mx-auto max-w-7xl px-4 md:px-8">
 <div className="flex gap-8 pt-6">

 {/* Desktop sidebar */}
 <SideNav tab={tab} setTab={changeTab} unread={unreadMessages} user={user} onShop={() => navigate('/shop')} />

 {/* Main content */}
 <main className="flex-1 min-w-0">

 {/* Mobile header */}
 <div className="lg:hidden">
 <PageHeader activeTab={activeTabDef} />
 </div>

 {/* Desktop header — active section + shop shortcut */}
 <div className="hidden lg:flex items-center justify-between gap-4 mb-8">
 <div className="flex items-center gap-3 min-w-0">
 <span className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
 <activeTabDef.icon className="w-4 h-4" strokeWidth={2} />
 </span>
 <div className="min-w-0">
 <h1 className="text-xl font-black text-foreground tracking-tight leading-none truncate">{activeTabDef.label}</h1>
 <p className="text-xs text-foreground/40 mt-0.5 font-medium truncate">{activeTabDef.desc}</p>
 </div>
 </div>
 <button onClick={() => navigate('/shop')}
 className={`flex items-center gap-1.5 h-9 px-4 shrink-0 rounded-2xl bg-foreground/[0.05] text-foreground/50 text-[10px] font-black uppercase tracking-widest hover:bg-foreground/[0.09] hover:text-foreground transition-all ${FOCUS_RING}`}>
 <Search className="w-3 h-3" /> Shop
 </button>
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
            onCancelOrder={(id, reason) => cancelOrder(id, reason)}
            onRemoveWishlist={(productId) => {
              const product = wishlist.find(p => p.id === productId);
              if (product) toggleWishlist(product);
            }}
            onAddToCart={(product) => addToCart(product)}
            onReorder={(o) => {
              o.items?.forEach((i: any) => { if (i.products) addToCart(i.products, undefined, i.quantity); });
              navigate('/cart');
            }}
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
 {wishlist.length > 0 && (
   <div className="flex items-center gap-2">
     <Button
       variant="ghost" size="sm"
       onClick={() => setGiftShareOpen(true)}
       aria-label="Share your gift list"
       className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
     >
       <Gift className="w-3.5 h-3.5 mr-1.5" /> Share list
     </Button>
     {/* Unified share sheet for the gift list (no poster) */}
     <ProductShare
       share={{
         title: 'My MaliMart gift list 🎁',
         url: `${window.location.origin}/shop?giftlist=${encodeURIComponent(wishlist.map(p => p.id).join(','))}`,
         text: `My MaliMart gift list 🎁 — ${wishlist.length} item${wishlist.length > 1 ? 's' : ''} I'd love. Take a look!`,
         image: wishlist[0]?.images?.[0],
         subtitle: `${wishlist.length} item${wishlist.length > 1 ? 's' : ''}`,
       }}
       isOpen={giftShareOpen}
       onClose={() => setGiftShareOpen(false)}
     />
     <Button variant="ghost" size="sm" onClick={() => navigate('/shop')} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">Add more</Button>
     <Button
       variant="primary" size="sm"
       onClick={() => {
         const canAdd = wishlist.filter(p => !p.variants?.length);
         canAdd.forEach(p => addToCart(p));
         if (canAdd.length) addToast(`${canAdd.length} item${canAdd.length > 1 ? 's' : ''} added to bag`, 'success');
       }}
       className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
     >
       Add all to bag
     </Button>
   </div>
 )}
 </div>
 {wishlist.length===0 ? (
 <EmptyState icon={Heart} title="Your wishlist is empty" subtitle="Tap the heart on any product to save it"
 className="rounded-3xl border border-foreground/8 bg-foreground/[0.02]"
 action={<Button size="sm" onClick={()=>navigate('/shop')} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">Browse Products</Button>}/>
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
 <MessagingHub userId={user.id} initialSellerId={searchParams.get('sellerId')}
 initialProductId={searchParams.get('productId')} initialOrderId={searchParams.get('orderId')} />
 )}

 {tab==='offers' && <BuyerOffers/>}

 {tab==='returns' && (
 <BuyerReturns userId={user.id} onContactSeller={handleContactSeller}/>
 )}

 {tab==='settings' && <BuyerSettingsPage/>}
 </motion.div>
 </AnimatePresence>
 </main>
 </div>
 </div>

 {/* Mobile bottom nav */}
 <MobileTabBar tab={tab} setTab={changeTab} unread={unreadMessages} />
 </div>
 );
};
