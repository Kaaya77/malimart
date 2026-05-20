import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Search, ShoppingBag, Menu, Heart,
  Home, Store, LayoutGrid, UserCircle, User,
  Sun, Moon,
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { supabase } from '../services/supabaseClient';
import { NavDesktop } from './NavDesktop';
import { NavMobile } from './NavMobile';
import { SearchModal } from './SearchModal';
import { UserMenu } from './UserMenu';

/**
 * useDarkMode — reads/writes the `dark` class on <html> and persists
 * the preference in localStorage under the key `theme`.
 */
function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggle = () => setIsDark(prev => !prev);
  return { isDark, toggle };
}

/**
 * Top navbar.
 *
 * Logo: clean sans-serif wordmark.
 *
 * Behavior:
 *   - First 80px of scroll: transparent over the hero
 *   - After 80px: solid backdrop, shadow, compact 56px height
 *   - On non-home routes: solid by default
 *
 * Right cluster (mobile): search, dark-mode toggle, cart, hamburger.
 * Right cluster (desktop): search, dark-mode toggle, wishlist, cart, account chip.
 */
export const Navbar = () => {
  const { cart, user, setUser, notifications, unreadMessages, categories } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggle: toggleDark } = useDarkMode();

  const [scrolled, setScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isHome = location.pathname === '/';
  const isOnDark = isHome && !scrolled && !isMobileMenuOpen;
  const cartCount = cart.reduce((acc, item) => acc + (item.quantity || 1), 0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/shop?q=${encodeURIComponent(searchQuery)}`);
    setIsSearchOpen(false);
  };

  const navLinks = [
    { name: 'Shop', path: '/shop' },
    { name: 'Categories', path: '/categories' },
    { name: 'About', path: '/about' },
  ];

  const accountPath = user
    ? (user.role === 'admin' ? '/admin' : user.role === 'seller' ? '/seller' : '/buyer')
    : '/login';
  const initial = (user?.user_metadata?.full_name || user?.email || '?').trim()[0]?.toUpperCase();

  /* Shared icon-button classes */
  const iconBtn = `w-10 h-10 rounded-full flex items-center justify-center transition-colors
    ${isOnDark ? 'hover:bg-white/15' : 'hover:bg-foreground/[0.06]'}`;

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300
        ${isOnDark
          ? 'bg-transparent'
          : 'bg-background/85 backdrop-blur-xl border-b border-foreground/8'}
      `}
    >
      <div className={`container mx-auto px-5 md:px-8 flex items-center justify-between transition-[height] duration-300 ${scrolled ? 'h-14' : 'h-16 md:h-20'}`}>

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
          <span
            className={`font-sans text-[22px] md:text-2xl font-semibold tracking-[-0.025em] transition-colors
              ${isOnDark ? 'text-white' : 'text-foreground'}`}
          >
            MaliMart
          </span>
        </Link>

        {/* Desktop nav links */}
        <NavDesktop
          isScrolled={scrolled}
          isHome={isHome}
          categories={categories}
          cart={cart}
          user={user}
          isSearchOpen={isSearchOpen}
          setIsSearchOpen={setIsSearchOpen}
        />

        {/* Right cluster */}
        <div className={`flex items-center gap-1.5 md:gap-2 ${isOnDark ? 'text-white' : 'text-foreground'}`}>

          {/* Search */}
          <button
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search"
            className={iconBtn}
          >
            <Search className="w-[18px] h-[18px] stroke-[2]" />
          </button>

          {/* Dark / Light mode toggle */}
          <button
            onClick={toggleDark}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={iconBtn}
          >
            {isDark
              ? <Sun className="w-[18px] h-[18px] stroke-[2]" />
              : <Moon className="w-[18px] h-[18px] stroke-[2]" />}
          </button>

          {/* Wishlist (desktop only) */}
          <Link
            to="/wishlist"
            aria-label="Wishlist"
            className={`hidden md:flex ${iconBtn}`}
          >
            <Heart className="w-[18px] h-[18px] stroke-[2]" />
          </Link>

          {/* Cart */}
          <Link
            to="/cart"
            aria-label={`Cart (${cartCount} items)`}
            className={`relative ${iconBtn}`}
          >
            <ShoppingBag className="w-[18px] h-[18px] stroke-[2]" />
            {cartCount > 0 && (
              <span
                className={`absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center
                  ${isOnDark ? 'bg-white text-black' : 'bg-foreground text-background'}`}
              >
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </Link>

          {/* Account chip (desktop) */}
          <div className="hidden md:block relative group">
            {user ? (
              <Link
                to={accountPath}
                aria-label="Account"
                className={`flex items-center gap-2 h-10 pl-1 pr-3 rounded-full transition-colors
                  ${isOnDark ? 'hover:bg-white/15' : 'hover:bg-foreground/[0.06]'}`}
              >
                <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                  {initial}
                </span>
                <span className="text-sm font-semibold">Account</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className={`flex items-center gap-2 h-10 px-4 rounded-full text-sm font-semibold transition-colors
                  ${isOnDark
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'bg-foreground text-background hover:bg-primary hover:text-primary-foreground'}`}
              >
                <User className="w-4 h-4 stroke-[2.2]" />
                Sign in
              </Link>
            )}
            <UserMenu user={user} handleLogout={handleLogout} />
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open menu"
            className={`md:hidden ${iconBtn}`}
          >
            <Menu className="w-[18px] h-[18px] stroke-[2]" />
          </button>
        </div>
      </div>

      <SearchModal
        isSearchOpen={isSearchOpen}
        setIsSearchOpen={setIsSearchOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSearch={handleSearchSubmit}
        isSearching={false}
        searchResults={{ products: [], categories: [] }}
        searchInputRef={searchInputRef}
      />

      <NavMobile
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        user={user}
        handleLogout={handleLogout}
        navLinks={navLinks}
        notifications={notifications}
        unreadMessages={unreadMessages}
        isDark={isDark}
        toggleDark={toggleDark}
      />
    </header>
  );
};

// ─── Mobile bottom nav (separate export) ────────────────────────────
export const MobileBottomNav = () => {
  const { user, cart, notifications } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const cartCount = cart.reduce((acc, item) => acc + (item.quantity || 1), 0);
  const unreadNotifs = notifications?.filter((n: any) => !n.read).length || 0;

  const accountPath = user
    ? (user.role === 'admin' ? '/admin' : user.role === 'seller' ? '/seller' : '/buyer')
    : '/login';

  const tabs = [
    { id: 'home', label: 'Home', icon: Home, path: '/' },
    { id: 'shop', label: 'Shop', icon: Store, path: '/shop' },
    { id: 'cats', label: 'Explore', icon: LayoutGrid, path: '/categories' },
    { id: 'cart', label: 'Bag', icon: ShoppingBag, path: '/cart', count: cartCount },
    { id: 'me', label: user ? 'Account' : 'Sign in', icon: UserCircle, path: accountPath, count: unreadNotifs > 0 ? unreadNotifs : 0 },
  ];

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <nav
      role="navigation"
      aria-label="Primary mobile navigation"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-2 mb-2 rounded-2xl bg-background/96 backdrop-blur-2xl ring-1 ring-foreground/8 shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.1)]">
        <div className="grid grid-cols-5 h-[60px]">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = isActive(t.path);
            return (
              <button
                key={t.id}
                onClick={() => navigate(t.path)}
                aria-label={t.label}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-[3px] transition-colors active:scale-90
                  ${active ? 'text-foreground' : 'text-foreground/35 hover:text-foreground/60'}`}
              >
                {active && (
                  <span className="absolute top-1.5 w-6 h-0.5 rounded-full bg-emerald-500" />
                )}
                <span className="relative">
                  <Icon className={`w-[21px] h-[21px] transition-all ${active ? 'stroke-[2.2]' : 'stroke-[1.7]'}`} />
                  {t.count != null && t.count > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {t.count > 9 ? '9+' : t.count}
                    </span>
                  )}
                </span>
                <span className={`text-[9px] font-semibold tracking-wide transition-all ${active ? 'opacity-100' : 'opacity-80'}`}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
