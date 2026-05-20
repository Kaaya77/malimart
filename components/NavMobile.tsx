import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
 X, BellRing, MessageCircle, UserCircle, LogOut,
 Heart, ShoppingBag, Store, LayoutGrid, Info, ChevronRight,
 Sun, Moon,
} from 'lucide-react';

interface NavMobileProps {
 isMobileMenuOpen: boolean;
 setIsMobileMenuOpen: (isOpen: boolean) => void;
 user: any;
 handleLogout: () => void;
 navLinks: { name: string; path: string }[];
 notifications: any[];
 unreadMessages: number;
 /** Current dark-mode state, passed down from Navbar */
 isDark: boolean;
 /** Toggle dark/light mode */
 toggleDark: () => void;
}

/**
 * Mobile drawer (full-screen). Single-tap distance for every action.
 *
 * Structure:
 * - Header: title, dark-mode toggle, close button
 * - Hero strip: user profile card (or "Sign in" card)
 * - Primary navigation: Shop / Categories / Wishlist / Bag / Notifications / Messages
 * - Secondary: About, account areas
 * - Footer: Sign out (if logged in)
 *
 * Swipe left-to-right closes (via backdrop or X button).
 */
export const NavMobile = ({
 isMobileMenuOpen,
 setIsMobileMenuOpen,
 user,
 handleLogout,
 navLinks,
 notifications,
 unreadMessages,
 isDark,
 toggleDark,
}: NavMobileProps) => {
 const location = useLocation();

 // Close drawer on route change
 useEffect(() => {
 if (isMobileMenuOpen) setIsMobileMenuOpen(false);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [location.pathname]);

 // Body scroll lock + Esc close
 useEffect(() => {
 if (!isMobileMenuOpen) return;
 document.body.style.overflow = 'hidden';
 const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setIsMobileMenuOpen(false);
 window.addEventListener('keydown', onEsc);
 return () => {
 document.body.style.overflow = '';
 window.removeEventListener('keydown', onEsc);
 };
 }, [isMobileMenuOpen, setIsMobileMenuOpen]);

 const unreadNotifs = notifications?.filter((n: any) => !n.read).length || 0;

 const primary = [
 { name: 'Shop all', path: '/shop', icon: Store },
 { name: 'Categories', path: '/categories', icon: LayoutGrid },
 { name: 'Wishlist', path: '/wishlist', icon: Heart },
 { name: 'Bag', path: '/cart', icon: ShoppingBag },
 ];

 const accountPath = user
 ? (user.role === 'admin' ? '/admin' : user.role === 'seller' ? '/seller' : '/buyer')
 : '/login';

 return (
 <AnimatePresence>
 {isMobileMenuOpen && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.2 }}
 className="fixed inset-0 z-[110] md:hidden"
 >
 {/* Backdrop */}
 <div
 onClick={() => setIsMobileMenuOpen(false)}
 className="absolute inset-0 bg-black/55"
 />

 {/* Drawer */}
 <motion.div
 initial={{ x: '100%' }}
 animate={{ x: 0 }}
 exit={{ x: '100%' }}
 transition={{ type: 'spring', damping: 28, stiffness: 280 }}
 className="absolute top-0 right-0 bottom-0 w-[88%] max-w-sm bg-background flex flex-col"
 style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
 >
 {/* Header — title, dark-mode toggle, close */}
 <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/8">
 <span className="font-sans text-xl font-semibold tracking-tight text-foreground">
 Menu
 </span>

 <div className="flex items-center gap-1">
 {/* Dark / Light toggle */}
 <button
 onClick={toggleDark}
 aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
 className="w-10 h-10 rounded-full hover:bg-foreground/[0.06] flex items-center justify-center text-foreground transition-colors"
 >
 {isDark
 ? <Sun className="w-[18px] h-[18px] stroke-[2]" />
 : <Moon className="w-[18px] h-[18px] stroke-[2]" />}
 </button>

 {/* Close */}
 <button
 onClick={() => setIsMobileMenuOpen(false)}
 aria-label="Close menu"
 className="w-10 h-10 rounded-full hover:bg-foreground/[0.06] flex items-center justify-center text-foreground transition-colors"
 >
 <X className="w-5 h-5 stroke-[2]" />
 </button>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto p-5 space-y-5">
 {/* Profile card */}
 <Link
 to={accountPath}
 className="flex items-center gap-3 p-3.5 rounded-2xl bg-foreground/[0.04] hover:bg-foreground/[0.07] transition-colors"
 >
 {user ? (
 <>
 <img
 src={user.avatar_url || `https://api.dicebear.com/6.x/initials/svg?seed=${user.email}`}
 alt=""
 className="w-11 h-11 rounded-full object-cover ring-1 ring-foreground/10"
 />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold text-foreground truncate">
 {user.user_metadata?.full_name || user.email}
 </p>
 <p className="text-xs text-foreground/55 capitalize">{user.role || 'Buyer'}</p>
 </div>
 <ChevronRight className="w-4 h-4 text-foreground/40 flex-shrink-0" />
 </>
 ) : (
 <>
 <div className="w-11 h-11 rounded-full bg-foreground text-background flex items-center justify-center flex-shrink-0">
 <UserCircle className="w-5 h-5 stroke-[2]" />
 </div>
 <div className="flex-1">
 <p className="text-sm font-semibold text-foreground">Sign in</p>
 <p className="text-xs text-foreground/55">Track orders, save favorites</p>
 </div>
 <ChevronRight className="w-4 h-4 text-foreground/40 flex-shrink-0" />
 </>
 )}
 </Link>

 {/* Primary nav */}
 <nav className="space-y-1">
 {primary.map(item => {
 const Icon = item.icon;
 return (
 <Link
 key={item.path}
 to={item.path}
 className="flex items-center gap-3 p-3 rounded-xl hover:bg-foreground/[0.05] text-foreground transition-colors min-h-[48px]"
 >
 <Icon className="w-[18px] h-[18px] stroke-[2] text-foreground/70 flex-shrink-0" />
 <span className="text-[15px] font-semibold flex-1">{item.name}</span>
 <ChevronRight className="w-4 h-4 text-foreground/30" />
 </Link>
 );
 })}
 </nav>

 {/* Additional nav links passed from parent */}
 {navLinks?.length > 0 && (
 <div className="pt-2 border-t border-foreground/8">
 {navLinks.map(link => (
 <Link
 key={link.path}
 to={link.path}
 className="flex items-center gap-3 p-3 rounded-xl hover:bg-foreground/[0.05] text-foreground transition-colors min-h-[48px]"
 >
 <span className="text-[15px] font-medium flex-1">{link.name}</span>
 <ChevronRight className="w-4 h-4 text-foreground/30" />
 </Link>
 ))}
 </div>
 )}

 {/* User-only quick links */}
 {user && (
 <div className="space-y-1 pt-2 border-t border-foreground/8">
 <Link
 to="/notifications"
 className="flex items-center gap-3 p-3 rounded-xl hover:bg-foreground/[0.05] text-foreground transition-colors min-h-[48px]"
 >
 <BellRing className="w-[18px] h-[18px] stroke-[2] text-foreground/70 flex-shrink-0" />
 <span className="text-[15px] font-semibold flex-1">Notifications</span>
 {unreadNotifs > 0 && (
 <span className="px-1.5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center min-w-[20px]">
 {unreadNotifs}
 </span>
 )}
 </Link>
 <Link
 to="/messages"
 className="flex items-center gap-3 p-3 rounded-xl hover:bg-foreground/[0.05] text-foreground transition-colors min-h-[48px]"
 >
 <MessageCircle className="w-[18px] h-[18px] stroke-[2] text-foreground/70 flex-shrink-0" />
 <span className="text-[15px] font-semibold flex-1">Messages</span>
 {unreadMessages > 0 && (
 <span className="px-1.5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center min-w-[20px]">
 {unreadMessages}
 </span>
 )}
 </Link>
 </div>
 )}

 {/* Secondary nav */}
 <div className="pt-2 border-t border-foreground/8">
 <Link
 to="/about"
 className="flex items-center gap-3 p-3 rounded-xl hover:bg-foreground/[0.05] text-foreground transition-colors min-h-[48px]"
 >
 <Info className="w-[18px] h-[18px] stroke-[2] text-foreground/70 flex-shrink-0" />
 <span className="text-[15px] font-medium flex-1">About MaliMart</span>
 </Link>
 </div>
 </div>

 {/* Footer — sign out */}
 {user && (
 <div className="p-5 border-t border-foreground/8">
 <button
 onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
 className="flex items-center gap-3 w-full p-3 rounded-xl bg-rose-500/8 text-rose-600 dark:text-rose-400 hover:bg-rose-500/12 transition-colors min-h-[48px]"
 >
 <LogOut className="w-[18px] h-[18px] stroke-[2] flex-shrink-0" />
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
