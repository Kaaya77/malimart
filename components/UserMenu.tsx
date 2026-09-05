import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Settings, Heart, Store, Package, LogOut } from 'lucide-react';

interface UserMenuProps {
 user: any;
 handleLogout: () => void;
}

export const UserMenu = ({ user, handleLogout }: UserMenuProps) => {
 if (!user) return null;

 // Shared classes — use theme tokens only so dark mode works automatically.
 const item =
 'flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-foreground/[0.05] text-[10px] uppercase tracking-[0.2em] text-foreground transition-colors w-full text-left';

 return (
 <div className="absolute top-full right-0 mt-6 w-64 bg-background/95 backdrop-blur-xl border border-foreground/10 p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-500 transform translate-y-4 group-hover:translate-y-0 shadow-2xl z-50 rounded-2xl">
 <div className="flex flex-col gap-1">
 {user.role === 'admin' && (
 <Link to="/admin" className={item}>
 <ShieldCheck className="w-4 h-4 stroke-[1.5] flex-shrink-0" /> Admin Panel
 </Link>
 )}
 <Link to="/profile" className={item}>
 <Settings className="w-4 h-4 stroke-[1.5] flex-shrink-0" /> Settings
 </Link>
 {user.role === 'seller' && (
 <div className="px-4 pt-2 pb-0.5 text-[9px] uppercase tracking-[0.2em] text-foreground/35">Your Purchases</div>
 )}
 <Link to="/buyer?tab=wishlist" className={item}>
 <Heart className="w-4 h-4 stroke-[1.5] flex-shrink-0" /> Wishlist
 </Link>
 <Link to="/buyer?tab=follows" className={item}>
 <Store className="w-4 h-4 stroke-[1.5] flex-shrink-0" /> Follows
 </Link>
 {/* Always /buyer?tab=orders (not the role-sniffing /orders redirect) —
     that redirect sent a seller to /seller?tab=orders, their SALES, so
     they had no way to see what they'd personally bought elsewhere. */}
 <Link to="/buyer?tab=orders" className={item}>
 <Package className="w-4 h-4 stroke-[1.5] flex-shrink-0" /> Orders
 </Link>
 <div className="h-px w-full bg-foreground/10 my-2" />
 <button
 onClick={handleLogout}
 className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-rose-500/10 text-[10px] uppercase tracking-[0.2em] text-rose-600 dark:text-rose-400 transition-colors w-full text-left"
 >
 <LogOut className="w-4 h-4 stroke-[1.5] flex-shrink-0" /> Sign Out
 </button>
 </div>
 </div>
 );
};
