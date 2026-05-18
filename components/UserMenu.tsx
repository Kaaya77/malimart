import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Settings, Heart, Store, Package, LogOut } from 'lucide-react';

interface UserMenuProps {
  user: any;
  handleLogout: () => void;
}

export const UserMenu = ({ user, handleLogout }: UserMenuProps) => {
  if (!user) return null;

  return (
    <div className="absolute top-full right-0 mt-6 w-64 bg-background/95 dark:bg-background/95 backdrop-blur-xl border border-foreground/5 dark:border-background/5 p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-500 transform translate-y-4 group-hover:translate-y-0 shadow-2xl z-50">
      <div className="flex flex-col gap-1">
        {user.role === 'admin' && (
          <Link to="/admin" className="flex items-center gap-4 px-4 py-3 hover:bg-primary/5 dark:hover:bg-background/5 text-[10px] uppercase tracking-[0.2em] text-foreground dark:text-background transition-colors">
            <ShieldCheck className="w-4 h-4 stroke-[1]" /> Admin Panel
          </Link>
        )}
        <Link to="/profile" className="flex items-center gap-4 px-4 py-3 hover:bg-primary/5 dark:hover:bg-background/5 text-[10px] uppercase tracking-[0.2em] text-foreground dark:text-background transition-colors">
          <Settings className="w-4 h-4 stroke-[1]" /> Settings
        </Link>
        <Link to="/buyer?tab=wishlist" className="flex items-center gap-4 px-4 py-3 hover:bg-primary/5 dark:hover:bg-background/5 text-[10px] uppercase tracking-[0.2em] text-foreground dark:text-background transition-colors">
          <Heart className="w-4 h-4 stroke-[1]" /> Wishlist
        </Link>
        <Link to="/buyer?tab=follows" className="flex items-center gap-4 px-4 py-3 hover:bg-primary/5 dark:hover:bg-background/5 text-[10px] uppercase tracking-[0.2em] text-foreground dark:text-background transition-colors">
          <Store className="w-4 h-4 stroke-[1]" /> Follows
        </Link>
        <Link to="/orders" className="flex items-center gap-4 px-4 py-3 hover:bg-primary/5 dark:hover:bg-background/5 text-[10px] uppercase tracking-[0.2em] text-foreground dark:text-background transition-colors">
          <Package className="w-4 h-4 stroke-[1]" /> Orders
        </Link>
        <div className="h-px w-full bg-primary/10 dark:bg-background/10 my-2" />
        <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-3 hover:bg-primary/5 dark:hover:bg-background/5 text-[10px] uppercase tracking-[0.2em] text-red-600 transition-colors">
          <LogOut className="w-4 h-4 stroke-[1]" /> Sign Out
        </button>
      </div>
    </div>
  );
};
