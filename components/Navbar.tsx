import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
 Search, ShoppingBag, Menu, Heart, X,
 Home, Store, LayoutGrid, UserCircle, User,
 Sun, Moon, BellRing, MessageCircle, LogOut,
 ChevronRight, Info, ArrowRight, Zap,
 Package, Settings, ShieldAlert
} from 'lucide-react';
import { useAuth, useCart, useComms, useCatalog } from '../context/AppContext';
import { supabase } from '../services/supabaseClient';
import { SearchModal } from './SearchModal';
import { UserMenu } from './UserMenu';
import { NotificationsPanel } from './NotificationsPanel';
import { CATEGORY_HIERARCHY } from '../constants';

function useDarkMode() {
 const [isDark, setIsDark] = useState(() => {
 if (typeof window === 'undefined') return false;
 const stored = localStorage.getItem('theme');
 if (stored) return stored === 'dark';
 return window.matchMedia('(prefers-color-scheme: dark)').matches;
 });
 useEffect(() => {
 const root = document.documentElement;
 if (isDark) { root.classList.add('dark'); localStorage.setItem('theme','dark'); }
 else { root.classList.remove('dark'); localStorage.setItem('theme','light'); }
 }, [isDark]);
 return { isDark, toggle: () => setIsDark(p=>!p) };
}

// ─── Desktop mega menu ────────────────────────────────────────────────────────
// Driven by live DB categories when available; falls back to the static hierarchy.
const MegaMenu = ({ isHome, scrolled, categories }: { isHome: boolean; scrolled: boolean; categories?: any[] }) => {
 const textColor = (!scrolled && isHome) ? 'text-white' : 'text-foreground';
 const link = `text-[12px] font-semibold uppercase tracking-widest ${textColor} opacity-75 hover:opacity-100 transition-opacity`;

 // Build columns: top-level DB categories with their children, else static fallback.
 const columns: Array<{ name: string; subs: string[] }> = React.useMemo(() => {
 const top = (categories || []).filter((c: any) => !c.parent_id && c.is_active !== false);
 if (top.length >= 2) {
 const children = (categories || []).filter((c: any) => c.parent_id);
 return top.slice(0, 4).map((p: any) => ({
 name: p.name,
 subs: children.filter((c: any) => c.parent_id === p.id).slice(0, 5).map((c: any) => c.name),
 }));
 }
 return Object.entries(CATEGORY_HIERARCHY).slice(0, 4).map(([cat, subs]) => ({
 name: cat,
 subs: Array.isArray(subs) ? (subs as string[]).slice(0, 5) : [],
 }));
 }, [categories]);

 return (
 <nav className="hidden md:flex items-center gap-7">
 <Link to="/shop" className={link}>Shop</Link>
 <div className="relative group">
 <button className={`${link} flex items-center gap-1`} aria-haspopup="true">
 Collections <ChevronRight className="w-3 h-3 rotate-90 group-hover:rotate-[270deg] transition-transform duration-300"/>
 </button>
 {/* Mega dropdown */}
 <div className="absolute top-full left-1/2 -translate-x-1/2 mt-5 w-[720px] bg-background/98 backdrop-blur-2xl rounded-3xl border border-foreground/8 shadow-2xl p-8 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-50">
 <div className="grid grid-cols-4 gap-8">
 {columns.map(col=>(
 <div key={col.name}>
 <Link to={`/shop?category=${encodeURIComponent(col.name)}`}
 className="block text-[10px] font-black uppercase tracking-[0.2em] text-foreground/35 hover:text-foreground mb-3 transition-colors">{col.name}</Link>
 <div className="space-y-2">
 {col.subs.map(sub=>(
 <Link key={sub} to={`/shop?category=${encodeURIComponent(col.name)}&subcategory=${encodeURIComponent(sub)}`}
 className="block text-[13px] text-foreground/65 hover:text-foreground transition-colors py-0.5">{sub}</Link>
 ))}
 {col.subs.length===0 && (
 <Link to={`/shop?category=${encodeURIComponent(col.name)}`}
 className="block text-[13px] text-foreground/65 hover:text-foreground transition-colors py-0.5">Browse all</Link>
 )}
 </div>
 </div>
 ))}
 </div>
 <div className="mt-6 pt-5 border-t border-foreground/8 flex justify-between items-center">
 <p className="text-xs text-foreground/40">Discover Tanzania's finest products</p>
 <Link to="/categories" className="flex items-center gap-2 text-xs font-bold text-foreground hover:opacity-70 transition-opacity">
 View all <ArrowRight className="w-3.5 h-3.5"/>
 </Link>
 </div>
 </div>
 </div>
 <Link to="/categories" className={link}>Explore</Link>
 </nav>
 );
};

// ─── Mobile full-screen drawer ────────────────────────────────────────────────
const MobileDrawer = ({ open, onClose, user, logout, isDark, toggleDark, notifications, unreadMessages }: {
 open: boolean; onClose: () => void; user: any; logout: () => void;
 isDark: boolean; toggleDark: () => void; notifications: any[]; unreadMessages: number;
}) => {
 const location = useLocation();
 const unread = notifications?.filter((n:any)=>!n.read).length || 0;

 // Close on route change
 useEffect(()=>{ if(open) onClose(); },[location.pathname]);

 // Lock body scroll
 useEffect(()=>{
 if (!open) return;
 document.body.style.overflow='hidden';
 const onEsc=(e:KeyboardEvent)=>e.key==='Escape'&&onClose();
 window.addEventListener('keydown',onEsc);
 return ()=>{ document.body.style.overflow=''; window.removeEventListener('keydown',onEsc); };
 },[open,onClose]);

 const accountPath = user
 ? (user.role==='admin'?'/admin':user.role==='seller'?'/seller':'/buyer')
 : '/login';

 // Bottom bar owns: Home, Shop, Explore, Bag, Account.
 // Drawer owns secondary actions only.
 const navItems = [
 { label:'Wishlist', path:'/wishlist', icon:Heart, desc:'Your saved items' },
 ];

 const accountItems = user ? [
 { label:'Notifications', path:'/notifications', icon:BellRing, badge:unread },
 { label:'Messages', path:'/messages', icon:MessageCircle, badge:unreadMessages },
 { label:'My Account', path:accountPath, icon:user.role==='admin'?ShieldAlert:user.role==='seller'?Store:Package, badge:0 },
 { label:'Settings', path:accountPath+'?tab=settings', icon:Settings, badge:0 },
 ] : [];

 return (
 <AnimatePresence>
 {open && (
 <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.2}}
 className="fixed inset-0 z-[300] md:hidden">
 {/* Backdrop */}
 <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
 onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>

 {/* Drawer panel */}
 <motion.div
 initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}}
 transition={{type:'spring',damping:30,stiffness:300}}
 className="absolute inset-y-0 right-0 w-[88%] max-w-[360px] bg-background flex flex-col shadow-2xl"
 style={{paddingBottom:'env(safe-area-inset-bottom)'}}>

 {/* Header */}
 <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/8 shrink-0">
 <span className="font-bold text-lg text-foreground tracking-tight">Menu</span>
 <div className="flex items-center gap-1">
 <button onClick={onClose} aria-label="Close"
 className="w-11 h-11 rounded-2xl bg-foreground/[0.06] flex items-center justify-center text-foreground hover:bg-foreground/10 transition-colors">
 <X className="w-4 h-4 stroke-[2.5]"/>
 </button>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto p-5 space-y-4">
 {/* Profile card */}
 <Link to={accountPath}
 className="flex items-center gap-3.5 p-4 rounded-2xl bg-foreground/[0.04] hover:bg-foreground/[0.07] active:scale-[0.98] transition-all">
 {user ? (
 <>
 {user.avatar_url ? (
 <img src={user.avatar_url} alt="" className="w-12 h-12 rounded-2xl object-cover ring-2 ring-foreground/10" loading="lazy" decoding="async"/>
 ) : (
 <div className="w-12 h-12 rounded-2xl bg-foreground flex items-center justify-center shrink-0">
 <span className="text-background font-black text-base">{(user.name||user.email||'U')[0].toUpperCase()}</span>
 </div>
 )}
 <div className="flex-1 min-w-0">
 <p className="font-bold text-foreground truncate">{user.name||user.email}</p>
 <p className="text-xs text-foreground/45 capitalize mt-0.5 flex items-center gap-1">
 {user.role==='seller'?<Store className="w-3 h-3"/>:user.role==='admin'?<ShieldAlert className="w-3 h-3"/>:<User className="w-3 h-3"/>}
 {user.role||'Buyer'}
 </p>
 </div>
 <ChevronRight className="w-4 h-4 text-foreground/30 shrink-0"/>
 </>
 ) : (
 <>
 <div className="w-12 h-12 rounded-2xl bg-foreground flex items-center justify-center shrink-0">
 <UserCircle className="w-6 h-6 text-background stroke-[1.8]"/>
 </div>
 <div className="flex-1">
 <p className="font-bold text-foreground">Sign in</p>
 <p className="text-xs text-foreground/45 mt-0.5">Track orders & save favorites</p>
 </div>
 <ChevronRight className="w-4 h-4 text-foreground/30 shrink-0"/>
 </>
 )}
 </Link>

 {/* Main navigation */}
 <div>
 <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/30 px-1 mb-2">Browse</p>
 <div className="space-y-0.5">
 {navItems.map(item=>{
 const Icon=item.icon;
 return (
 <Link key={item.path} to={item.path}
 className="flex items-center gap-3.5 p-3.5 rounded-2xl hover:bg-foreground/[0.05] active:scale-[0.98] transition-all min-h-[52px]">
 <div className="w-9 h-9 rounded-xl bg-foreground/[0.06] flex items-center justify-center shrink-0">
 <Icon className="w-4 h-4 text-foreground/70 stroke-[2]"/>
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[15px] font-semibold text-foreground">{item.label}</p>
 <p className="text-xs text-foreground/40 mt-0.5">{item.desc}</p>
 </div>
 <ChevronRight className="w-3.5 h-3.5 text-foreground/25 shrink-0"/>
 </Link>
 );
 })}
 </div>
 </div>

 {/* Account section */}
 {accountItems.length>0 && (
 <div>
 <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/30 px-1 mb-2">Account</p>
 <div className="space-y-0.5">
 {accountItems.map(item=>{
 const Icon=item.icon;
 return (
 <Link key={item.path} to={item.path}
 className="flex items-center gap-3.5 p-3.5 rounded-2xl hover:bg-foreground/[0.05] active:scale-[0.98] transition-all min-h-[52px]">
 <div className="w-9 h-9 rounded-xl bg-foreground/[0.06] flex items-center justify-center shrink-0">
 <Icon className="w-4 h-4 text-foreground/70 stroke-[2]"/>
 </div>
 <span className="flex-1 text-[15px] font-semibold text-foreground">{item.label}</span>
 {item.badge>0 && (
 <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
 {item.badge>9?'9+':item.badge}
 </span>
 )}
 </Link>
 );
 })}
 </div>
 </div>
 )}

 {/* Sell CTA for non-sellers */}
 {(!user || user.role==='buyer') && (
 <Link to="/login?mode=signup&role=seller"
 className="flex items-center gap-3.5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 active:scale-[0.98] transition-all">
 <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
 <Zap className="w-4 h-4 text-emerald-600 stroke-[2.5]"/>
 </div>
 <div className="flex-1">
 <p className="text-sm font-bold text-foreground">Become a Seller</p>
 <p className="text-xs text-foreground/45 mt-0.5">Start selling on MaliMart</p>
 </div>
 <ChevronRight className="w-3.5 h-3.5 text-emerald-500/50 shrink-0"/>
 </Link>
 )}

 {/* Info */}
 <div className="space-y-0.5">
 {[{label:'About MaliMart',path:'/terms'},{label:'Privacy Policy',path:'/privacy'},{label:'Contact Us',path:'/contact'}].map(l=>(
 <Link key={l.path} to={l.path} className="flex items-center gap-3 p-3 rounded-xl hover:bg-foreground/[0.04] text-foreground/55 hover:text-foreground transition-colors min-h-[44px]">
 <span className="text-sm">{l.label}</span>
 </Link>
 ))}
 </div>
 </div>

 {/* Footer */}
 {user && (
 <div className="px-5 py-4 border-t border-foreground/8 shrink-0">
 <button onClick={()=>{onClose();logout();}}
 className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-rose-500/8 text-rose-600 hover:bg-rose-500/12 active:scale-[0.98] transition-all min-h-[52px]">
 <LogOut className="w-4.5 h-4.5 stroke-[2] shrink-0"/>
 <span className="text-[15px] font-semibold">Sign out</span>
 </button>
 </div>
 )}
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 );
};

// ─── Main Navbar ─────────────────────────────────────────────────────────────
export const Navbar = () => {
 const { user, setUser } = useAuth();
 const { cart } = useCart();
 const { notifications, unreadMessages } = useComms();
 const { categories } = useCatalog();
 const navigate = useNavigate();
 const location = useLocation();
 const { isDark, toggle: toggleDark } = useDarkMode();

 const [scrolled, setScrolled] = useState(false);
 const [menuOpen, setMenuOpen] = useState(false);
 const [searchOpen, setSearchOpen] = useState(false);
 const [notifOpen, setNotifOpen] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');
 const searchRef = useRef<HTMLInputElement>(null);

 const isHome = location.pathname === '/';
 const isOnDark = isHome && !scrolled && !menuOpen && isDark;
 const cartCount = cart.reduce((a,i)=>a+(i.quantity||1),0);
 const unread = notifications?.filter((n:any)=>!n.read).length||0;

 useEffect(()=>{
 let ticking=false;
 const fn=()=>{if(!ticking){requestAnimationFrame(()=>{setScrolled(window.scrollY>60);ticking=false;});ticking=true;}};
 fn(); window.addEventListener('scroll',fn,{passive:true});
 return ()=>window.removeEventListener('scroll',fn);
 },[]);

 useEffect(()=>{
 const onKey=(e:KeyboardEvent)=>{
 if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setSearchOpen(true);}
 };
 window.addEventListener('keydown',onKey);
 return ()=>window.removeEventListener('keydown',onKey);
 },[]);

 const handleLogout = async ()=>{ await supabase.auth.signOut(); setUser(null); navigate('/'); };
 // Persist theme to the profile so it follows the user across devices.
 const toggleTheme = () => {
   const next = isDark ? 'light' : 'dark';
   toggleDark();
   if (user) supabase.rpc('update_my_settings', { p: { theme_mode: next } }).then(()=>{}, ()=>{});
 };
 const handleSearchSubmit = (e: React.FormEvent)=>{ e.preventDefault(); navigate(`/shop?q=${encodeURIComponent(searchQuery)}`); setSearchOpen(false); };

 const accountPath = user
 ? (user.role==='admin'?'/admin':user.role==='seller'?'/seller':'/buyer') : '/login';
 const initial = (user?.user_metadata?.full_name||user?.email||'?').trim()[0]?.toUpperCase();

 const ibtn = `w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90
 ${isOnDark?'hover:bg-white/15':'hover:bg-foreground/[0.07]'}`;

 return (
 <>
 <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300
 ${isOnDark?'bg-transparent':'bg-background/70 backdrop-blur-2xl border-b border-foreground/8'}`}>

 <div className={`container mx-auto px-4 md:px-6 flex items-center justify-between transition-[height] duration-300
 ${scrolled?'h-14':'h-16 md:h-20'}`}>

 {/* Logo */}
 <Link to="/" className="flex-shrink-0">
 <span className={`font-sans text-xl md:text-[22px] font-bold tracking-[-0.02em] transition-colors
 ${isOnDark?'text-white':'text-foreground'}`}>
 MaliMart
 </span>
 </Link>

 {/* Desktop nav */}
 <MegaMenu isHome={isHome} scrolled={scrolled} categories={categories}/>

 {/* Right cluster */}
 <div className={`flex items-center gap-1 ${isOnDark?'text-white':'text-foreground'}`}>

 {/* Search */}
 <button onClick={()=>setSearchOpen(true)} aria-label="Search" className={`${ibtn} hidden md:flex gap-1.5 items-center`}>
 <Search className="w-[18px] h-[18px] stroke-[2]"/>
 <span className={`text-[10px] font-semibold tracking-wide hidden lg:inline ${isOnDark?'text-white/50':'text-foreground/35'}`}>⌘K</span>
 </button>
 <button onClick={()=>setSearchOpen(true)} aria-label="Search" className={`${ibtn} md:hidden`}>
 <Search className="w-[18px] h-[18px] stroke-[2]"/>
 </button>

 {/* Dark mode */}
 <button onClick={toggleTheme} aria-label="Toggle theme" className={ibtn}>
 {isDark?<Sun className="w-[18px] h-[18px] stroke-[2]"/>:<Moon className="w-[18px] h-[18px] stroke-[2]"/>}
 </button>

 {/* Wishlist (desktop) */}
 <Link to="/wishlist" aria-label="Wishlist" className={`hidden md:flex ${ibtn}`}>
 <Heart className="w-[18px] h-[18px] stroke-[2]"/>
 </Link>

 {/* Messages (desktop) */}
 {user && (
 <Link to="/messages" aria-label={`Messages${unreadMessages?` (${unreadMessages} unread)`:''}`} className={`hidden md:flex relative ${ibtn}`}>
 <MessageCircle className="w-[18px] h-[18px] stroke-[2]"/>
 {(unreadMessages||0)>0 && (
 <span className="absolute top-1.5 right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center">
 {unreadMessages>9?'9+':unreadMessages}
 </span>
 )}
 </Link>
 )}

 {/* Notifications (desktop) — inline popover, no page navigation */}
 {user && (
 <div className="hidden md:block relative">
 <button onClick={()=>setNotifOpen(o=>!o)} aria-label={`Notifications${unread?` (${unread} unread)`:''}`} aria-expanded={notifOpen} className={`relative ${ibtn}`}>
 <BellRing className="w-[18px] h-[18px] stroke-[2]"/>
 {unread>0 && (
 <span className="absolute top-1.5 right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center">
 {unread>9?'9+':unread}
 </span>
 )}
 </button>
 {notifOpen && (
 <>
 <div className="fixed inset-0 z-40" onClick={()=>setNotifOpen(false)}/>
 <div className="absolute top-full right-0 mt-3 z-50 text-foreground">
 <NotificationsPanel onClose={()=>setNotifOpen(false)}/>
 </div>
 </>
 )}
 </div>
 )}

 {/* Cart */}
 <Link to="/cart" aria-label={`Cart (${cartCount})`} className={`relative ${ibtn}`}>
 <motion.div
   key={cartCount}
   initial={cartCount > 0 ? { scale: 1.35, rotate: -12 } : false}
   animate={{ scale: 1, rotate: 0 }}
   transition={{ type: 'spring', stiffness: 500, damping: 18 }}
 >
   <ShoppingBag className="w-[18px] h-[18px] stroke-[2]"/>
 </motion.div>
 <AnimatePresence>
 {cartCount>0 && (
 <motion.span
   key={cartCount}
   initial={{ scale: 0, opacity: 0 }}
   animate={{ scale: 1, opacity: 1 }}
   exit={{ scale: 0, opacity: 0 }}
   transition={{ type: 'spring', stiffness: 500, damping: 20 }}
   className={`absolute top-1.5 right-1.5 min-w-[15px] h-[15px] px-0.5 rounded-full text-[9px] font-black flex items-center justify-center
 ${isOnDark?'bg-white text-black':'bg-foreground text-background'}`}>
 {cartCount>9?'9+':cartCount}
 </motion.span>
 )}
 </AnimatePresence>
 </Link>

 {/* Account chip (desktop) */}
 <div className="hidden md:block relative group">
 {user ? (
 <Link to={accountPath}
 className={`flex items-center gap-2 h-9 pl-1 pr-3 rounded-full transition-colors
 ${isOnDark?'hover:bg-white/15':'hover:bg-foreground/[0.06]'}`}>
 {user.avatar_url ? (
 <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover ring-1 ring-foreground/10" loading="lazy" decoding="async"/>
 ) : (
 <span className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold">{initial}</span>
 )}
 <span className="text-sm font-semibold">Account</span>
 </Link>
 ) : (
 <Link to="/login"
 className={`flex items-center gap-2 h-9 px-4 rounded-full text-sm font-semibold transition-colors
 ${isOnDark?'bg-white text-black hover:bg-white/90':'bg-foreground text-background hover:bg-foreground/85'}`}>
 <User className="w-3.5 h-3.5 stroke-[2.2]"/> Sign in
 </Link>
 )}
 <UserMenu user={user} handleLogout={handleLogout}/>
 </div>

 {/* Mobile hamburger */}
 <button onClick={()=>setMenuOpen(true)} aria-label="Open menu" className={`md:hidden ${ibtn}`}>
 <Menu className="w-[18px] h-[18px] stroke-[2]"/>
 </button>
 </div>
 </div>
 </header>

 {/* Portalled overlays — outside header stacking context */}
 {createPortal(
 <>
 <SearchModal
 isSearchOpen={searchOpen}
 setIsSearchOpen={setSearchOpen}
 searchQuery={searchQuery}
 setSearchQuery={setSearchQuery}
 handleSearch={handleSearchSubmit}
 isSearching={false}
 searchResults={{products:[],categories:[]}}
 searchInputRef={searchRef}
 />
 <MobileDrawer
 open={menuOpen}
 onClose={()=>setMenuOpen(false)}
 user={user}
 logout={handleLogout}
 isDark={isDark}
 toggleDark={toggleTheme}
 notifications={notifications||[]}
 unreadMessages={unreadMessages||0}
 />
 </>,
 document.body
 )}
 </>
 );
};

// ─── Mobile bottom nav ────────────────────────────────────────────────────────
export const MobileBottomNav = () => {
 const { user, isLoading } = useAuth();
 const { cart } = useCart();
 const { notifications } = useComms();
 const navigate = useNavigate();
 const location = useLocation();
 const cartCount = cart.reduce((a,i)=>a+(i.quantity||1),0);
 const unread = notifications?.filter((n:any)=>!n.read).length||0;

 // While the session is rehydrating, keep showing "Account" (pointing at
 // /profile, whose DashboardRedirect waits for auth) instead of flashing
 // "Sign in" at logged-in users on every hard refresh.
 const accountPath = user
 ? (user.role==='admin'?'/admin':user.role==='seller'?'/seller':'/buyer')
 : isLoading ? '/profile' : '/login';

 const tabs = [
 { id:'home', label:'Home', icon:Home, path:'/' },
 { id:'shop', label:'Shop', icon:Store, path:'/shop' },
 { id:'cats', label:'Explore', icon:LayoutGrid,path:'/categories' },
 { id:'cart', label:'Bag', icon:ShoppingBag,path:'/cart', badge:cartCount },
 { id:'me', label:(user||isLoading)?'Account':'Sign in', icon:UserCircle, path:accountPath, badge:unread },
 ];

 const active = (path: string) => path==='/' ? location.pathname==='/' : location.pathname.startsWith(path);
 const activeIdx = tabs.findIndex(t => active(t.path));

 // Hide the bottom tab bar on screens that own the bottom edge with their own
 // fixed bar (the whole seller dashboard has its purpose-built MobileTabBar,
 // the product form has an action bar, product detail has an Add-to-Bag bar)
 // so two bars never stack/overlap on mobile.
 const ownsBottomBar = location.pathname.startsWith('/seller')
   || /^\/product\//.test(location.pathname);
 if (ownsBottomBar) return null;

 return (
 <nav role="navigation" aria-label="Mobile navigation"
 className="fixed bottom-0 inset-x-0 z-40 md:hidden"
 style={{paddingBottom:'env(safe-area-inset-bottom)'}}>
 <div className="mx-2 mb-2 rounded-2xl bg-background/80 backdrop-blur-2xl ring-1 ring-foreground/12 shadow-[0_-2px_20px_-4px_rgba(0,0,0,0.12)] relative overflow-hidden">
 {/* Sliding pill indicator */}
 {activeIdx >= 0 && (
   <motion.div
     layout
     layoutId="bottomNavPill"
     transition={{ type: 'spring', stiffness: 500, damping: 40 }}
     className="absolute top-1.5 h-[calc(100%-12px)] bg-foreground/[0.06] rounded-xl pointer-events-none"
     style={{ width: `${100/tabs.length}%`, left: `${activeIdx * (100/tabs.length)}%` }}
   />
 )}
 <div className="grid grid-cols-5 h-[58px]">
 {tabs.map((t,i)=>{
 const Icon=t.icon;
 const on=active(t.path);
 return (
 <button key={t.id} onClick={()=>navigate(t.path)}
 aria-label={t.label} aria-current={on?'page':undefined}
 className={`relative z-10 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-[0.88]
 ${on?'text-foreground':'text-foreground/35'}`}>
 <span className="relative">
 <Icon className={`w-[19px] h-[19px] transition-all duration-200 ${on?'stroke-[2.3]':'stroke-[1.5]'}`}/>
 {t.badge!=null && t.badge>0 && (
 <motion.span
   initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }}
   className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center">
 {t.badge>9?'9+':t.badge}
 </motion.span>
 )}
 </span>
 <span className={`text-[9px] font-semibold leading-none transition-all duration-200 ${on?'opacity-100':'opacity-50'}`}>{t.label}</span>
 </button>
 );
 })}
 </div>
 </div>
 </nav>
 );
};
