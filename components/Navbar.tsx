import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, ShoppingBag, Menu, X, Home, Store, LayoutGrid, UserCircle
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { supabase } from '../services/supabaseClient';
import { NavDesktop } from './NavDesktop';
import { NavMobile } from './NavMobile';
import { SearchModal } from './SearchModal';
import { UserMenu } from './UserMenu';

export const Navbar = () => {
  const { cart, user, setUser, notifications, unreadMessages, categories } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ products: any[], categories: string[] }>({ products: [], categories: [] });
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/');
  };

  const navLinks = [
    { name: 'Shop', path: '/shop' },
    { name: 'About', path: '/about' },
  ];

  const isHome = location.pathname === '/';
  const navColor = isScrolled || isMobileMenuOpen || !isHome ? 'text-zinc-950 dark:text-zinc-100' : 'text-white';

  return (
    <nav 
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
          isScrolled || isMobileMenuOpen || !isHome
            ? 'bg-white/70 dark:bg-zinc-950/70 backdrop-blur-3xl border-b border-zinc-200 dark:border-zinc-800' 
            : 'bg-transparent'
        }`}
      >
        <div className="container mx-auto px-6 md:px-12 h-20 flex items-center justify-between">
          
          <Link to="/" className="relative z-50 group">
              <span className={`font-serif font-bold text-2xl tracking-tighter ${navColor}`}>
                Mali<span className="font-thin opacity-80">Mart</span>
              </span>
          </Link>

          <NavDesktop 
            isScrolled={isScrolled}
            isHome={isHome}
            categories={categories}
            cart={cart}
            user={user}
            isSearchOpen={isSearchOpen}
            setIsSearchOpen={setIsSearchOpen}
          />

          <div className={`flex items-center gap-6 ${navColor}`}>
            <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="opacity-80 hover:opacity-100 transition-all">
                <Search className="w-5 h-5 stroke-[1.5]" />
            </button>

            <Link to="/cart" className="relative opacity-80 hover:opacity-100 transition-all">
                <ShoppingBag className="w-5 h-5 stroke-[1.5]" />
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 w-4 h-4 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[9px] font-bold flex items-center justify-center rounded-full">
                    {cart.length}
                  </span>
                )}
            </Link>

            <div className="hidden md:block relative group">
                <Link to={user ? (user.role === 'admin' ? '/admin' : user.role === 'seller' ? '/seller' : '/buyer') : "/login"} 
                  className="opacity-80 hover:opacity-100 transition-all">
                  <UserCircle className="w-6 h-6 stroke-[1.5]" />
                </Link>
                <UserMenu user={user} handleLogout={handleLogout} />
            </div>

            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden opacity-80 hover:opacity-100"
            >
              <Menu className="w-6 h-6 stroke-[1.5]" />
            </button>
          </div>
        </div>

        <SearchModal 
          isSearchOpen={isSearchOpen}
          setIsSearchOpen={setIsSearchOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          handleSearch={(e) => { e.preventDefault(); navigate(`/shop?search=${encodeURIComponent(searchQuery)}`); setIsSearchOpen(false);}}
          isSearching={isSearching}
          searchResults={searchResults}
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
        />
      </nav>
  );
};

export const MobileBottomNav = ({ children }: { children?: React.ReactNode }) => {
    const { user, cart } = useAppState();
    const navigate = useNavigate();
    const totalCartItems = cart.reduce((acc, item) => acc + item.quantity, 0);
    
    const items = [
        { id: 'Home', icon: Home, path: '/' },
        { id: 'Shop', icon: Store, path: '/shop' },
        { id: 'Menu', icon: LayoutGrid, path: user ? (user.role === 'seller' ? '/seller' : '/buyer') : '/login' }
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/80 dark:bg-zinc-900/80 backdrop-blur-3xl border-t border-zinc-200 dark:border-zinc-800 pb-safe">
            <div className="flex justify-around items-center h-16">
                {items.map((tab) => {
                    const isActive = window.location.pathname === tab.path;
                    return (
                        <button 
                            key={tab.id} 
                            onClick={() => navigate(tab.path!)} 
                            className={`flex flex-col items-center justify-center gap-1 transition-all ${isActive ? 'text-zinc-950 dark:text-zinc-50' : 'text-zinc-400 dark:text-zinc-600'}`}
                        >
                            <tab.icon className="w-5 h-5 stroke-[1.5]" />
                            <span className="text-[9px] uppercase tracking-wider font-bold">{tab.id}</span>
                        </button>
                    );
                })}
                <button 
                    onClick={() => navigate('/cart')} 
                    className={`flex flex-col items-center justify-center gap-1 transition-all ${window.location.pathname === '/cart' ? 'text-zinc-950 dark:text-zinc-50' : 'text-zinc-400 dark:text-zinc-600'}`}
                >
                    <div className="relative">
                        <ShoppingBag className="w-5 h-5 stroke-[1.5]" />
                        {totalCartItems > 0 && (
                            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[8px] font-bold flex items-center justify-center rounded-full">
                                {totalCartItems}
                            </span>
                        )}
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold">Bag</span>
                </button>
            </div>
        </nav>
    );
};
