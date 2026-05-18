import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, BellRing, MessageCircle, UserCircle, LogOut } from 'lucide-react';

interface NavMobileProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  user: any;
  handleLogout: () => void;
  navLinks: { name: string; path: string }[];
  notifications: any[];
  unreadMessages: number;
}

export const NavMobile = ({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  user,
  handleLogout,
  navLinks,
  notifications,
  unreadMessages
}: NavMobileProps) => {
  return (
    <div className={`fixed inset-0 z-50 transition-all duration-500 ${isMobileMenuOpen ? 'visible' : 'invisible'}`}>
      <div className={`absolute inset-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-3xl transition-opacity duration-500 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0'}`} />
      
      <div className="absolute top-6 right-6 z-50">
        <button onClick={() => setIsMobileMenuOpen(false)} className="p-3 text-zinc-950 dark:text-zinc-100">
            <X className="w-6 h-6 stroke-[1.5]" />
        </button>
      </div>

      <div className={`absolute inset-0 flex flex-col pt-32 px-10 pb-12 overflow-y-auto ${isMobileMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        {user && (
          <div className="flex items-center gap-5 mb-16">
            <div className="w-16 h-16 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-800">
              <img src={user.avatar_url || `https://api.dicebear.com/6.x/initials/svg?seed=${user.email}`} alt="User" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-serif text-xl text-zinc-950 dark:text-zinc-50">{user.full_name || 'My Profile'}</p>
              <p className="text-[10px] uppercase tracking-widest text-zinc-400 mt-1">
                {user.wallet_balance.toLocaleString()} TZS
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-8">
          {[...navLinks, { name: 'Collections', path: '/categories' }].map((link, i) => (
            <Link 
              key={link.name}
              to={link.path} 
              onClick={() => setIsMobileMenuOpen(false)}
              className="font-serif text-4xl text-zinc-950 dark:text-zinc-50 hover:opacity-50 transition-opacity"
            >
              {link.name}
            </Link>
          ))}
          
          <div className="border-t border-zinc-200 dark:border-zinc-800 my-8" />
          
          <div className="flex flex-col gap-6">
            <Link to="/notifications" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-4 text-[12px] uppercase tracking-widest text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 transition-colors">
              <BellRing className="w-5 h-5 stroke-[1.5]" />
              Notifications
            </Link>
            <Link to="/messages" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-4 text-[12px] uppercase tracking-widest text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 transition-colors">
              <MessageCircle className="w-5 h-5 stroke-[1.5]" />
              Messages
            </Link>
          </div>
        </div>

        <div className="mt-auto pt-16">
          {user ? (
            <div className="grid grid-cols-2 gap-4">
              <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-center h-14 border border-zinc-200 dark:border-zinc-800 text-[11px] uppercase tracking-widest text-zinc-950 dark:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all">
                Profile
              </Link>
              <button onClick={handleLogout} className="flex items-center justify-center gap-2 h-14 border border-zinc-200 dark:border-zinc-800 text-[11px] uppercase tracking-widest text-zinc-950 dark:text-zinc-50 hover:bg-red-50 hover:text-red-600 transition-all">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          ) : (
            <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-center h-16 bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 text-[12px] uppercase tracking-widest font-bold hover:opacity-90 transition-opacity">
              Sign In / Join
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
