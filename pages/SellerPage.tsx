import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
 LayoutGrid, Package, MessageSquare, Settings, Wallet,
 Clock, Percent, ShoppingBag, RotateCcw, ExternalLink, Store,
 TrendingUp, AlertCircle, Plus, ChevronRight, Zap, Star, Eye
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { useSellerStats } from '../src/hooks/useSellerStats';
import { PremiumStatCard } from '../components/UI';
import { supabase } from '../services/supabaseClient';
import { VendorProfile } from '../types';
import { formatTZS } from '../constants';
import { SellerAnalytics } from '../components/SellerAnalytics';
import { AdvancedAnalytics } from '../components/AdvancedAnalytics';
import { SellerInventory } from '../components/SellerInventory';
import { SellerOffers } from '../components/SellerOffers';
import { SellerOrders } from '../components/SellerOrders';
import { SellerMessages } from '../components/SellerMessages';
import { SellerSettingsPage } from './SellerSettingsPage';
import { SellerReturns } from '../components/SellerReturns';

const TABS = [
 { id:'dashboard', label:'Overview', icon:LayoutGrid },
 { id:'products', label:'Inventory', icon:Package },
 { id:'orders', label:'Orders', icon:ShoppingBag },
 { id:'messages', label:'Inbox', icon:MessageSquare },
 { id:'offers', label:'Campaigns', icon:Percent },
 { id:'returns', label:'Returns', icon:RotateCcw },
 { id:'settings', label:'Settings', icon:Settings },
];

export const SellerPage = () => {
 const { user, products, refreshProducts, vendorProfile: contextVendor } = useAppState();
 const [searchParams] = useSearchParams();
 const [tab, setTab] = useState<string>(searchParams.get('tab')||'dashboard');
 const [preselectedProduct, setPreselectedProduct] = useState<any>(null);
 const [selectedChatUser, setSelectedChatUser] = useState<string|null>(searchParams.get('chat'));
 const [selectedProductId, setSelectedProductId] = useState<string|null>(searchParams.get('productId'));
 const [selectedOrderId, setSelectedOrderId] = useState<string|null>(searchParams.get('orderId'));
 const { stats, loading: loadingStats } = useSellerStats(user?.id);
 const [vendor, setVendor] = useState<VendorProfile|null>(null);

 const myProducts = products.filter(p=>p.seller_id===user?.id);
 const lowStock = myProducts.filter(p=>typeof p.stock==='number'&&p.stock>0&&p.stock<=5).length;
 const pendingOrders = stats.pending;

 // Vendor profile is already loaded in AppContext on sign-in — no extra fetch needed

 const switchToMessages = (buyerId: string, productId?: string|null, orderId?: string|null) => {
 setTab('messages');
 setSelectedChatUser(buyerId);
 setSelectedProductId(productId||null);
 setSelectedOrderId(orderId||null);
 };

 if (!user || user.role!=='seller') return null;

 return (
 <div className="min-h-screen bg-background font-sans pb-[calc(5rem+env(safe-area-inset-bottom))] pt-20 md:pt-24">
 <div className="container mx-auto max-w-7xl px-4 md:px-6">

 {/* ── Page header ────────────────────────────────────── */}
 <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:0.4}}
 className="flex items-center justify-between py-6 md:py-8">
 <div className="flex items-center gap-3.5 min-w-0">
 {vendor?.logo_url ? (
 <img src={vendor.logo_url} alt="" className="w-12 h-12 rounded-2xl object-cover ring-2 ring-foreground/10 shadow-md shrink-0" loading="lazy" decoding="async"/>
 ) : (
 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-foreground to-foreground/80 flex items-center justify-center shrink-0 shadow-md">
 <Store className="w-5 h-5 text-background"/>
 </div>
 )}
 <div className="min-w-0">
 <p className="text-[10px] text-foreground/35 uppercase tracking-[0.2em] font-bold">Merchant Console</p>
 <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight truncate">
 {vendor?.store_name||user.name}
 </h1>
 </div>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 {/* Alerts */}
 {(lowStock>0||pendingOrders>0) && (
 <div className="hidden sm:flex items-center gap-2">
 {pendingOrders>0 && (
 <button onClick={()=>setTab('orders')} className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-amber-500/10 text-amber-700 text-xs font-bold hover:bg-amber-500/15 transition-colors">
 <AlertCircle className="w-3.5 h-3.5"/> {pendingOrders} pending
 </button>
 )}
 {lowStock>0 && (
 <button onClick={()=>setTab('products')} className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-rose-500/10 text-rose-700 text-xs font-bold hover:bg-rose-500/15 transition-colors">
 <Package className="w-3.5 h-3.5"/> {lowStock} low stock
 </button>
 )}
 </div>
 )}
 <a href={`/store/${user.id}`} target="_blank" rel="noopener noreferrer"
 className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-foreground/[0.06] text-foreground/60 text-xs font-semibold hover:bg-foreground/10 hover:text-foreground transition-colors">
 <ExternalLink className="w-3.5 h-3.5 stroke-[2]"/>
 <span className="hidden sm:inline">View Store</span>
 </a>
 </div>
 </motion.div>

 {/* ── Tab strip ───────────────────────────────────────── */}
 <div className="flex gap-1 overflow-x-auto no-scrollbar bg-foreground/[0.04] p-1.5 rounded-2xl mb-6 sticky top-[60px] z-20 border border-foreground/8 backdrop-blur-xl">
 {TABS.map(t=>{
 const Icon=t.icon;
 const active=tab===t.id;
 const badge = t.id==='orders'&&pendingOrders>0 ? pendingOrders :
 t.id==='products'&&lowStock>0 ? lowStock : 0;
 return (
 <button key={t.id} onClick={()=>setTab(t.id)}
 className={`flex-shrink-0 flex items-center gap-2 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 whitespace-nowrap relative ${active?'bg-background text-foreground shadow-sm':'text-foreground/40 hover:text-foreground/65'}`}>
 <Icon className={`w-3.5 h-3.5 stroke-[2] ${active?'':'opacity-70'}`}/>
 {t.label}
 {badge>0 && (
 <span className="min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center">
 {badge}
 </span>
 )}
 </button>
 );
 })}
 </div>

 {/* ── Tab content ─────────────────────────────────────── */}
 <AnimatePresence mode="wait">
 <motion.div key={tab} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.2}}>

 {tab==='dashboard' && (
 <div className="space-y-6">
 {/* KPIs */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
 <PremiumStatCard title="Revenue" value={formatTZS(stats.revenue)} icon={Wallet} loading={loadingStats} trend={{value:'+8.2%',positive:true}}/>
 <PremiumStatCard title="Listings" value={stats.listings} icon={Package} loading={loadingStats}/>
 <PremiumStatCard title="Avg Order" value={formatTZS(stats.aov)} icon={ShoppingBag} loading={loadingStats}/>
 <PremiumStatCard title="Pending" value={stats.pending} icon={Clock} loading={loadingStats} trend={stats.pending>5?{value:'Action needed',positive:false}:undefined}/>
 </div>

 {/* Alert cards */}
 {(lowStock>0||pendingOrders>0) && (
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {pendingOrders>0 && (
 <button onClick={()=>setTab('orders')}
 className="flex items-center gap-4 p-4 rounded-2xl bg-amber-500/8 border border-amber-500/20 text-left hover:bg-amber-500/12 transition-colors active:scale-[0.98]">
 <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
 <ShoppingBag className="w-5 h-5 text-amber-600"/>
 </div>
 <div className="flex-1">
 <p className="text-sm font-bold text-amber-900 dark:text-amber-200">{pendingOrders} orders need attention</p>
 <p className="text-xs text-amber-600/70">Tap to review and confirm</p>
 </div>
 <ChevronRight className="w-4 h-4 text-amber-500/60"/>
 </button>
 )}
 {lowStock>0 && (
 <button onClick={()=>setTab('products')}
 className="flex items-center gap-4 p-4 rounded-2xl bg-rose-500/8 border border-rose-500/20 text-left hover:bg-rose-500/12 transition-colors active:scale-[0.98]">
 <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
 <Package className="w-5 h-5 text-rose-600"/>
 </div>
 <div className="flex-1">
 <p className="text-sm font-bold text-rose-900 dark:text-rose-200">{lowStock} products running low</p>
 <p className="text-xs text-rose-600/70">Update stock before selling out</p>
 </div>
 <ChevronRight className="w-4 h-4 text-rose-500/60"/>
 </button>
 )}
 </div>
 )}

 {/* Analytics */}
 <SellerAnalytics stats={stats}/>
 <AdvancedAnalytics stats={stats}/>

 {/* Quick actions */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 {[
 {label:'Add Product', icon:Plus, action:()=>setTab('products'), color:'bg-emerald-500/10 text-emerald-600'},
 {label:'View Orders', icon:ShoppingBag,action:()=>setTab('orders'), color:'bg-blue-500/10 text-blue-600'},
 {label:'Campaigns', icon:Zap, action:()=>setTab('offers'), color:'bg-amber-500/10 text-amber-600'},
 {label:'Messages', icon:MessageSquare,action:()=>setTab('messages'),color:'bg-purple-500/10 text-purple-600'},
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

 {tab==='products' && (
 <SellerInventory products={myProducts} userId={user.id} refresh={refreshProducts}
 onCreatePromo={(p)=>{ setPreselectedProduct(p); setTab('offers'); }}/>
 )}

 {tab==='orders' && (
 <SellerOrders sellerId={user.id} onContactBuyer={switchToMessages}/>
 )}

 {tab==='messages' && (
 <SellerMessages userId={user.id} selectedChatUser={selectedChatUser}
 setSelectedChatUser={setSelectedChatUser} products={products}
 initialProductId={selectedProductId} initialOrderId={selectedOrderId}
 initialChatUser={selectedChatUser}/>
 )}

 {tab==='offers' && (
 <SellerOffers sellerId={user.id} preselectedProduct={preselectedProduct}/>
 )}

 {tab==='returns' && (
 <SellerReturns userId={user.id}
 onContactBuyer={(buyerId,productId,orderId)=>switchToMessages(buyerId,productId,orderId)}/>
 )}

 {tab==='settings' && <SellerSettingsPage/>}
 </motion.div>
 </AnimatePresence>
 </div>
 </div>
 );
};
