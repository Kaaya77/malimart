import React from 'react';
import { Link } from 'react-router-dom';
import { Search, X, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface SearchModalProps {
  isSearchOpen: boolean;
  setIsSearchOpen: (isOpen: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleSearch: (e: React.FormEvent) => void;
  isSearching: boolean;
  searchResults: { products: any[], categories: string[] };
  searchInputRef: React.RefObject<HTMLInputElement>;
}

export const SearchModal = ({
  isSearchOpen,
  setIsSearchOpen,
  searchQuery,
  setSearchQuery,
  handleSearch,
  isSearching,
  searchResults,
  searchInputRef
}: SearchModalProps) => {
  if (!isSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-32 px-4 overflow-y-auto no-scrollbar">
      <div className="fixed inset-0 bg-background/95 dark:bg-background/95 backdrop-blur-xl" onClick={() => setIsSearchOpen(false)} />
      <div className="relative w-full max-w-5xl animate-in fade-in slide-in-from-top-8 duration-700 pb-20">
        <button onClick={() => setIsSearchOpen(false)} className="absolute -top-16 right-0 p-2 hover:opacity-50 transition-opacity flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-foreground dark:text-background">
          Close <X className="w-4 h-4 stroke-[1]" />
        </button>
        <form onSubmit={handleSearch} className="w-full">
          <div className="flex items-end gap-4 border-b border-foreground/20 dark:border-background/20 pb-4">
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="What are you looking for?" 
              className="w-full bg-transparent text-4xl md:text-7xl font-sans font-black tracking-tighter outline-none placeholder:text-foreground/20 dark:placeholder:text-background/20 text-foreground dark:text-background"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="mb-2 hover:opacity-50 transition-opacity">
              {isSearching ? (
                <Loader2 className="w-8 h-8 md:w-10 md:h-10 animate-spin text-foreground dark:text-background" />
              ) : (
                <Search className="w-8 h-8 md:w-10 md:h-10 stroke-[1] text-foreground dark:text-background" />
              )}
            </button>
          </div>

          <div className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-4 space-y-12">
              {searchResults.categories.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-[0.3em] opacity-40 text-foreground dark:text-background block mb-6">Suggested Categories</span>
                  <div className="flex flex-col gap-2">
                    {searchResults.categories.map(cat => (
                      <Link 
                        key={cat} 
                        to={`/shop?category=${encodeURIComponent(cat)}`}
                        onClick={() => setIsSearchOpen(false)}
                        className="group flex items-center justify-between py-3 border-b border-foreground/5 dark:border-background/5 text-sm font-medium text-foreground dark:text-background hover:pl-2 transition-all"
                      >
                        {cat}
                        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="text-[10px] uppercase tracking-[0.3em] opacity-40 text-foreground dark:text-background block mb-6">Trending Collections</span>
                <div className="flex flex-wrap gap-3">
                  {['Artisan Pottery', 'Summer Linen', 'Organic Coffee', 'Tech Gear', 'Elite Selection'].map(tag => (
                    <button 
                      key={tag} 
                      type="button" 
                      onClick={() => { setSearchQuery(tag); }} 
                      className="px-5 py-2.5 rounded-full border border-foreground/10 dark:border-background/10 text-[10px] uppercase tracking-[0.15em] font-bold text-foreground dark:text-background hover:bg-primary hover:text-background dark:hover:bg-background dark:hover:text-foreground transition-all duration-500"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-[0.3em] opacity-40 text-foreground dark:text-background block mb-6">Quick Links</span>
                <div className="grid grid-cols-2 gap-4">
                  <Link to="/shop" onClick={() => setIsSearchOpen(false)} className="text-[11px] uppercase tracking-widest text-foreground/60 dark:text-background/60 hover:text-foreground dark:hover:text-background transition-colors">All Products</Link>
                  <Link to="/categories" onClick={() => setIsSearchOpen(false)} className="text-[11px] uppercase tracking-widest text-foreground/60 dark:text-background/60 hover:text-foreground dark:hover:text-background transition-colors">Categories</Link>
                  <Link to="/about" onClick={() => setIsSearchOpen(false)} className="text-[11px] uppercase tracking-widest text-foreground/60 dark:text-background/60 hover:text-foreground dark:hover:text-background transition-colors">Our Story</Link>
                  <Link to="/seller" onClick={() => setIsSearchOpen(false)} className="text-[11px] uppercase tracking-widest text-foreground/60 dark:text-background/60 hover:text-foreground dark:hover:text-background transition-colors">Sell on MaliMart</Link>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-40 text-foreground dark:text-background block mb-8">
                {searchQuery.length > 1 ? `Top Results for "${searchQuery}"` : 'Featured Products'}
              </span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {searchResults.products.length > 0 ? (
                  searchResults.products.map((product, i) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Link 
                        to={`/product/${product.id}`}
                        onClick={() => setIsSearchOpen(false)}
                        className="group flex gap-6 items-center"
                      >
                        <div className="w-24 h-32 overflow-hidden bg-primary/5 dark:bg-background/5 rounded-2xl">
                          <img 
                            src={product.images?.[0]} 
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-[9px] uppercase tracking-widest opacity-50 mb-1">{product.brand}</p>
                          <h4 className="font-sans font-black text-lg text-foreground dark:text-background mb-2 group-hover:opacity-60 transition-opacity">{product.name}</h4>
                          <p className="text-sm font-medium text-foreground dark:text-background">{product.price.toLocaleString()} TZS</p>
                        </div>
                      </Link>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-2 py-12 text-center border border-dashed border-foreground/10 dark:border-background/10">
                    <p className="text-[11px] uppercase tracking-[0.2em] opacity-40">
                      {searchQuery.length > 1 ? 'No products found matching your search' : 'Start typing to see results'}
                    </p>
                  </div>
                )}
              </div>

              {searchResults.products.length > 0 && (
                <button 
                  onClick={handleSearch}
                  className="mt-12 w-full py-4 border border-foreground dark:border-background text-[10px] uppercase tracking-[0.3em] text-foreground dark:text-background hover:bg-primary hover:text-background dark:hover:bg-background dark:hover:text-foreground transition-all duration-500"
                >
                  View All Results
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
