import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { Magnetic } from './Effects';
import { CATEGORY_HIERARCHY } from '../constants';

interface NavDesktopProps {
  isScrolled: boolean;
  isHome: boolean;
  categories: any[];
  cart: any[];
  user: any;
  isSearchOpen: boolean;
  setIsSearchOpen: (isOpen: boolean) => void;
}

export const NavDesktop = ({
  isScrolled,
  isHome,
  categories,
  cart,
  user,
  isSearchOpen,
  setIsSearchOpen
}: NavDesktopProps) => {
  // When hero is visible (home, not scrolled) links are white; otherwise use theme foreground.
  const textColor = isScrolled || !isHome ? 'text-foreground' : 'text-white';
  const opacityClass = 'opacity-80 hover:opacity-100 transition-all duration-300';

  return (
    <div className="hidden md:flex items-center gap-8">
      <Magnetic>
        <Link
          to="/shop"
          className={`text-[12px] font-medium uppercase tracking-widest ${textColor} ${opacityClass}`}
        >
          Shop
        </Link>
      </Magnetic>

      {/* Categories Dropdown */}
      <div className="relative group">
        <Magnetic>
          <Link
            to="/categories"
            className={`text-[12px] font-medium uppercase tracking-widest flex items-center gap-2 ${textColor} ${opacityClass}`}
          >
            Collections
            <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </Link>
        </Magnetic>

        {/* Mega Menu Dropdown — uses theme tokens so it adapts in dark mode */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-6 w-[800px] bg-background/95 backdrop-blur-3xl border border-foreground/10 p-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-500 transform translate-y-4 group-hover:translate-y-0 z-50 shadow-2xl rounded-3xl">
          <div className="grid grid-cols-4 gap-10">
            {Object.entries(CATEGORY_HIERARCHY).slice(0, 4).map(([category, subcategories]) => (
              <div key={category} className="flex flex-col gap-5">
                <h4 className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground">
                  {category}
                </h4>
                <div className="flex flex-col gap-3">
                  {Array.isArray(subcategories) ? subcategories.slice(0, 5).map(sub => (
                    <Link
                      key={sub}
                      to={`/shop?category=${encodeURIComponent(category)}&subcategory=${encodeURIComponent(sub)}`}
                      className="text-[13px] text-foreground/60 hover:text-foreground transition-colors"
                    >
                      {sub}
                    </Link>
                  )) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 pt-8 border-t border-foreground/10 flex justify-center">
            <Link
              to="/categories"
              className="flex items-center gap-3 text-[11px] uppercase tracking-widest font-bold text-foreground hover:opacity-60 transition-opacity"
            >
              Discover All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
