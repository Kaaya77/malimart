import { useDebounce } from '../src/hooks/useDebounce';
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, X, ArrowUpDown, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppState } from '../context/AppContext';
import { ProductCard } from '../components/ProductCard';
import { FilterSidebar } from '../components/FilterSidebar';
import { Product } from '../types';
import { searchProductsServer } from '../services/searchService';
import { shopProductsServer } from '../services/shopService';
import { MaliEmptyState } from '../components/MaliSoul';

const SORT_OPTIONS = [
 { value: 'relevance', label: 'Relevance' },
 { value: 'newest', label: 'Newest' },
 { value: 'price_asc', label: 'Price: Low → High' },
 { value: 'price_desc', label: 'Price: High → Low' },
 { value: 'rating', label: 'Top Rated' },
 { value: 'popular', label: 'Most Popular' },
];

const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
 <button
 onClick={onRemove}
 aria-label={`Remove filter ${label}`}
 className="flex-shrink-0 flex items-center gap-1.5 h-7 px-3 rounded-full bg-foreground text-background text-[11px] font-semibold active:scale-95 transition-transform"
 >
 {label}
 <X className="w-3 h-3 stroke-[3]" />
 </button>
);

export const ShopPage: React.FC = () => {
 const { products, categories, isLoading, catalogError, refreshProducts } = useAppState();
 const navigate = useNavigate();
 const [searchParams, setSearchParams] = useSearchParams();

 const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || searchParams.get('search') || '');
 const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'relevance');
 const [isFilterOpen, setIsFilterOpen] = useState(false);
 const [activeFilters, setActiveFilters] = useState<any>({
 priceRange: [0, 5000000],
 categories: searchParams.get('category') ? [searchParams.get('category')!] : [],
 materials: [],
 colors: [],
 sizes: [],
 location: '',
 rating: null,
 verified: false,
 stock: false,
 });

 // Sync URL search query
 useEffect(() => {
 const q = searchParams.get('q') || searchParams.get('search');
 if (q) setSearchQuery(q);
 const cat = searchParams.get('category');
 if (cat) setActiveFilters((prev: any) => ({ ...prev, categories: [cat] }));
 }, [searchParams]);

 const activeFilterCount = useMemo(() => {
 let count = 0;
 if (activeFilters.categories?.length) count++;
 if (activeFilters.materials?.length) count++;
 if (activeFilters.colors?.length) count++;
 if (activeFilters.location) count++;
 if (activeFilters.rating) count++;
 if (activeFilters.verified) count++;
 if (activeFilters.stock) count++;
 if (activeFilters.priceRange?.[0] > 0 || activeFilters.priceRange?.[1] < 5000000) count++;
 return count;
 }, [activeFilters]);

 // Server full-text search — searches the ENTIRE catalog, not just loaded products.
 // Falls back silently to client filtering if the RPC isn't available.
 const debouncedQuery = useDebounce(searchQuery, 350);
 const [serverResults, setServerResults] = useState<Product[] | null>(null);
 const [serverTotal, setServerTotal] = useState<number | null>(null);
 useEffect(() => {
   let cancelled = false;
   // Server-side filtering over the FULL catalog (shop_products RPC).
   shopProductsServer({
     query: debouncedQuery,
     category: activeFilters.categories?.[0],
     minPrice: activeFilters.priceRange?.[0],
     maxPrice: activeFilters.priceRange?.[1],
     minRating: activeFilters.rating,
     verified: activeFilters.verified,
     inStock: activeFilters.stock,
     region: activeFilters.location,
     sort: sortBy,
     limit: 48,
   }).then(res => {
     if (cancelled) return;
     if (res) { setServerResults(res.products); setServerTotal(res.totalCount); return; }
     setServerTotal(null);
     // Fallback chain: legacy FTS RPC, then pure client filtering.
     if (debouncedQuery.trim().length < 2) { setServerResults(null); return; }
     searchProductsServer(debouncedQuery).then(r2 => { if (!cancelled) setServerResults(r2); });
   });
   return () => { cancelled = true; };
 }, [debouncedQuery, activeFilters, sortBy]);

 const filteredProducts = useMemo(() => {
 // Base list: server search results when available (full catalog),
 // otherwise the in-memory products from context.
 const source = serverResults ?? products;
 let list = source.filter(p => p.status !== 'inactive');

 // Search query (client fallback / refinement when server results unavailable)
 if (searchQuery.trim() && !(serverResults?.length)) {
 const q = searchQuery.toLowerCase();
 list = list.filter(p =>
 p.name?.toLowerCase().includes(q) ||
 p.category?.toLowerCase().includes(q) ||
 p.description?.toLowerCase().includes(q) ||
 p.seller_name?.toLowerCase().includes(q)
 );
 }

 // Category filter
 if (activeFilters.categories?.length) {
 // Match by category name or ID
 list = list.filter(p =>
 activeFilters.categories.some((c: string) =>
 p.category === c || p.category?.toLowerCase() === c.toLowerCase()
 )
 );
 }

 // Price range
 if (activeFilters.priceRange) {
 list = list.filter(p =>
 p.price >= activeFilters.priceRange[0] &&
 p.price <= activeFilters.priceRange[1]
 );
 }

 // Rating
 if (activeFilters.rating) {
 list = list.filter(p => (p.rating || 0) >= activeFilters.rating);
 }

 // Verified sellers
 if (activeFilters.verified) {
 list = list.filter(p => p.is_verified);
 }

 // In stock
 if (activeFilters.stock) {
 list = list.filter(p => p.stock > 0);
 }

 // Location
 if (activeFilters.location?.trim()) {
 const loc = activeFilters.location.toLowerCase();
 list = list.filter(p => p.location?.toLowerCase().includes(loc));
 }

 // Sort
 switch (sortBy) {
 case 'newest':
 list = [...list].sort((a, b) =>
 new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
 );
 break;
 case 'price_asc':
 list = [...list].sort((a, b) => a.price - b.price);
 break;
 case 'price_desc':
 list = [...list].sort((a, b) => b.price - a.price);
 break;
 case 'rating':
 list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
 break;
 case 'popular':
 list = [...list].sort((a, b) =>
 (b.rating || 0) * (b.review_count || 0) - (a.rating || 0) * (a.review_count || 0)
 );
 break;
 }

 return list;
 }, [products, serverResults, searchQuery, activeFilters, sortBy]);

 const handleSearch = (e: React.FormEvent) => {
 e.preventDefault();
 if (searchQuery.trim()) {
 setSearchParams({ q: searchQuery });
 } else {
 setSearchParams({});
 }
 };

 return (
 <div className="min-h-screen bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] pt-16 md:pt-20">
 {/* Header */}
 <div className="sticky top-[64px] z-20 bg-background/95 backdrop-blur-xl border-b border-foreground/8">
 <div className="container mx-auto px-4 md:px-8 py-3 flex items-center gap-3">
 {/* Search */}
 <form onSubmit={handleSearch} className="flex-1 relative">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 stroke-[2]" />
 <input
 type="search"
 value={searchQuery}
 onChange={e => setSearchQuery(e.target.value)}
 placeholder="Search products, stores, categories…"
 className="w-full h-11 pl-10 pr-10 rounded-xl bg-foreground/[0.05] text-foreground text-sm placeholder:text-foreground/40 focus:outline-none focus:bg-foreground/[0.08] transition-colors"
 />
 {searchQuery && (
 <button
 type="button"
 onClick={() => { setSearchQuery(''); setSearchParams({}); }}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground"
 >
 <X className="w-3.5 h-3.5 stroke-[2.5]" />
 </button>
 )}
 </form>

 {/* Filter */}
 <button
 onClick={() => setIsFilterOpen(true)}
 className={`relative flex items-center gap-2 h-11 px-4 rounded-xl border text-sm font-semibold transition-colors active:scale-95 ${
 activeFilterCount > 0
 ? 'bg-foreground text-background border-foreground'
 : 'bg-foreground/[0.04] text-foreground border-foreground/10 hover:bg-foreground/[0.08]'
 }`}
 >
 <SlidersHorizontal className="w-4 h-4 stroke-[2]" />
 <span className="hidden sm:inline">Filter</span>
 {activeFilterCount > 0 && (
 <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
 {activeFilterCount}
 </span>
 )}
 </button>

 {/* Sort */}
 <div className="relative">
 <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/40 stroke-[2] pointer-events-none" />
 <select
 value={sortBy}
 onChange={e => {
 const v = e.target.value;
 setSortBy(v);
 setSearchParams(prev => {
 const next = new URLSearchParams(prev);
 if (v === 'relevance') next.delete('sort'); else next.set('sort', v);
 return next;
 }, { replace: true });
 }}
 className="h-11 pl-9 pr-3 rounded-xl bg-foreground/[0.04] border border-foreground/10 text-foreground text-sm font-semibold focus:outline-none appearance-none cursor-pointer hover:bg-foreground/[0.08] transition-colors sm:pr-4"
 aria-label="Sort products"
 >
 {SORT_OPTIONS.map(opt => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 </div>
 </div>

 {/* Active filter chips — every active filter, removable, with Clear all */}
 {(activeFilterCount > 0 || searchQuery.trim()) && (
 <div className="container mx-auto px-4 md:px-8 pb-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
 {searchQuery.trim() && (
 <FilterChip label={`"${searchQuery.trim()}"`} onRemove={() => { setSearchQuery(''); setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('q'); n.delete('search'); return n; }, { replace: true }); }} />
 )}
 {activeFilters.categories?.map((cat: string) => (
 <FilterChip key={cat} label={cat} onRemove={() => setActiveFilters((prev: any) => ({ ...prev, categories: prev.categories.filter((c: string) => c !== cat) }))} />
 ))}
 {(activeFilters.priceRange?.[0] > 0 || activeFilters.priceRange?.[1] < 5000000) && (
 <FilterChip label={`TZS ${activeFilters.priceRange[0].toLocaleString()} – ${activeFilters.priceRange[1].toLocaleString()}`}
 onRemove={() => setActiveFilters((prev: any) => ({ ...prev, priceRange: [0, 5000000] }))} />
 )}
 {activeFilters.rating && (
 <FilterChip label={`${activeFilters.rating}★ & up`} onRemove={() => setActiveFilters((prev: any) => ({ ...prev, rating: null }))} />
 )}
 {activeFilters.location?.trim() && (
 <FilterChip label={activeFilters.location} onRemove={() => setActiveFilters((prev: any) => ({ ...prev, location: '' }))} />
 )}
 {activeFilters.verified && (
 <FilterChip label="Verified sellers" onRemove={() => setActiveFilters((prev: any) => ({ ...prev, verified: false }))} />
 )}
 {activeFilters.stock && (
 <FilterChip label="In stock" onRemove={() => setActiveFilters((prev: any) => ({ ...prev, stock: false }))} />
 )}
 <button
 onClick={() => {
 setSearchQuery('');
 setActiveFilters({ priceRange: [0, 5000000], categories: [], materials: [], colors: [], sizes: [], location: '', rating: null, verified: false, stock: false });
 setSearchParams({}, { replace: true });
 }}
 className="flex-shrink-0 h-7 px-3 rounded-full text-[11px] font-semibold text-foreground/50 hover:text-foreground border border-foreground/12 hover:border-foreground/30 transition-colors active:scale-95"
 >
 Clear all
 </button>
 </div>
 )}
 </div>

 {/* Results count */}
 <div className="container mx-auto px-4 md:px-8 py-4">
 <p className="text-sm text-foreground/50">
 {isLoading ? (
 <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading products…</span>
 ) : (
 <><span className="font-semibold text-foreground">{filteredProducts.length}</span> products{searchQuery ? ` for "${searchQuery}"` : ''}</>
 )}
 </p>
 </div>

 {/* Product Grid */}
 <div className="container mx-auto px-4 md:px-8">
 {isLoading ? (
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-8 md:gap-x-5 md:gap-y-10">
 {Array.from({ length: 10 }).map((_, i) => (
 <div key={i} className="space-y-2">
 <div className="shimmer aspect-[4/5] rounded-2xl" />
 <div className="shimmer h-3 w-3/4 rounded-full" />
 <div className="shimmer h-4 w-1/2 rounded-full" />
 </div>
 ))}
 </div>
 ) : filteredProducts.length === 0 ? (
 <div className="py-16 text-center">
 {catalogError && products.length === 0 ? (
 <div className="flex flex-col items-center gap-4">
 <AlertTriangle className="w-10 h-10 text-amber-500" />
 <p className="text-foreground/70 text-sm font-medium max-w-xs">{catalogError}</p>
 <button
 onClick={refreshProducts}
 className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-xs font-bold uppercase tracking-widest hover:opacity-80 active:scale-95 transition-all"
 >
 <RefreshCw className="w-3.5 h-3.5" /> Retry
 </button>
 </div>
 ) : (
 <>
 <MaliEmptyState kind="search" />
 <div className="-mt-6">
 <button
 onClick={() => {
 setSearchQuery('');
 setActiveFilters({ priceRange: [0, 5000000], categories: [], materials: [], colors: [], sizes: [], location: '', rating: null, verified: false, stock: false });
 setSearchParams({});
 }}
 className="px-6 py-3 rounded-2xl bg-foreground text-background text-sm font-semibold active:scale-95 transition-transform"
 >
 Clear all filters
 </button>
 </div>
 </>
 )}
 </div>
 ) : (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-8 md:gap-x-5 md:gap-y-10"
 >
 {filteredProducts.map((p, i) => (
 <ProductCard
 key={p.id}
 product={p}
 index={i}
 onClick={() => navigate(`/product/${p.id}`)}
 onQuickView={() => navigate(`/product/${p.id}`)}
 />
 ))}
 </motion.div>
 )}
 </div>

 {/* Filter Sidebar */}
 <FilterSidebar
 isOpen={isFilterOpen}
 onClose={() => setIsFilterOpen(false)}
 categories={categories}
 onFilterChange={setActiveFilters}
 activeFilters={activeFilters}
 />

 {/* Quick view modal */}
 </div>
 );
};

export default ShopPage;
