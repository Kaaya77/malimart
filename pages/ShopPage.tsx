
import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { useInView } from 'react-intersection-observer';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search, Filter, ShoppingCart, Heart, ChevronRight, Shirt, Coffee, Palette, Smartphone, 
  Armchair, ArrowUpDown, X, Store, AlertTriangle, SlidersHorizontal, Check, Star, 
  ChevronDown, LayoutGrid, Banknote, PackageCheck, Sprout, Hammer, Baby, Car, Book, 
  Sparkles, Loader2, ArrowRight, Mic, MicOff, Copy, Layers, Plus, Zap, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../context/AppContext';
import { Button, Input, Badge, useToast, SpotlightCard, Card, Label, Switch, Skeleton } from '../components/UI';
import { ProductModal } from '../components/ProductModal';
import { ProductCard } from '../components/ProductCard';
import { FilterSidebar } from '../components/FilterSidebar';
import { Magnetic } from '../components/Effects';
import { Product } from '../types';
import { CURRENCY, CATEGORY_HIERARCHY, TANZANIA_REGIONS } from '../constants';
import { supabase } from '../services/supabaseClient';

const CATEGORY_ICONS: Record<string, any> = {
  'Fashion & Beauty': Shirt,
  'Pantry & Spices': Coffee,
  'Handicrafts': Palette,
  'Electronics': Smartphone,
  'Home & Living': Armchair,
  'Agriculture': Sprout,
  'Construction': Hammer,
  'Kids & Toys': Baby,
  'Vehicles': Car,
  'Books & Stationery': Book,
};

export const ShopPage = () => {
  const { products: allProducts, addToCart, toggleWishlist, isInWishlist, categories, recentlyViewed } = useAppState();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.get('category')?.split(',').filter(Boolean) || []
  );
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high' | 'rating' | 'distance'>('newest');
  const [userLocation, setUserLocation] = useState<{lat: number, lon: number} | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [comparisonList, setComparisonList] = useState<Product[]>([]);
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false,
  });
  
  // New Filter States
  const [priceRange, setPriceRange] = useState<{min: string, max: string}>({min: '', max: ''});
  const [minRating, setMinRating] = useState<number | null>(null);
  const [showOnlyVerified, setShowOnlyVerified] = useState(false);
  const [showOnlyInStock, setShowOnlyInStock] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  useEffect(() => {
    // Load more products when the trigger element is in view
    if (inView && !isSearching && results.length < totalCount) {
      const timer = setTimeout(() => {
        setVisibleCount(prev => prev + 12);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [inView, isSearching, results.length, totalCount]);

  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      setSelectedCategories([categoryParam]);
    } else {
      setSelectedCategories([]);
    }
  }, [searchParams]);

  useEffect(() => {
    setAvailableLocations(TANZANIA_REGIONS);
  }, []);

  useEffect(() => {
    const performSearch = async () => {
        setIsSearching(true);
        
        try {
            let query = supabase
                .from('products')
                .select(`
                    *,
                    variants:product_variants(*)
                `, { count: 'exact' })
                .is('deleted_at', null);

            // Category Filter
            if (selectedCategories.length > 0) {
                query = query.in('category', selectedCategories);
            }

            // Search Query
            if (deferredSearchQuery.trim()) {
                query = query.or(`name.ilike.%${deferredSearchQuery}%,description.ilike.%${deferredSearchQuery}%,brand.ilike.%${deferredSearchQuery}%`);
            }

            // Price Filter
            if (priceRange.min) query = query.gte('price', Number(priceRange.min));
            if (priceRange.max) query = query.lte('price', Number(priceRange.max));

            // Rating Filter
            if (minRating) query = query.gte('rating', minRating);

            // Stock Filter
            if (showOnlyInStock) query = query.gt('stock', 0);

            // Location Filter
            if (selectedLocation) query = query.ilike('location', `%${selectedLocation}%`);

            // Sorting
            if (sortBy === 'price_low') query = query.order('price', { ascending: true });
            else if (sortBy === 'price_high') query = query.order('price', { ascending: false });
            else if (sortBy === 'rating') query = query.order('rating', { ascending: false });
            else if (sortBy === 'newest') query = query.order('created_at', { ascending: false });

            // Limit for pagination
            query = query.limit(visibleCount);

            const { data, error, count } = await query;

            if (error) throw error;

            if (data) {
                setTotalCount(count || 0);
                
                const sellerIds = [...new Set(data.map(p => p.seller_id))];
                const { data: vendorsData } = await supabase.from('vendor_profiles')
                    .select('seller_id, is_verified, store_name')
                    .in('seller_id', sellerIds);
                
                const vendorMap = new Map(vendorsData?.map(v => [v.seller_id, v]));
                
                let processed = data.map((p: any) => ({
                    ...p,
                    is_verified: vendorMap.get(p.seller_id)?.is_verified || false,
                    seller_name: vendorMap.get(p.seller_id)?.store_name || 'Maison'
                })) as Product[];
                
                if (showOnlyVerified) {
                    processed = processed.filter(p => p.is_verified);
                }

                if (sortBy === 'distance' && userLocation) {
                    processed = [...processed].sort((a, b) => {
                        const getDist = (p: Product) => {
                            if (!p.latitude || !p.longitude) return Infinity;
                            const R = 6371;
                            const dLat = (p.latitude - userLocation.lat) * Math.PI / 180;
                            const dLon = (p.longitude - userLocation.lon) * Math.PI / 180;
                            const aDist = Math.sin(dLat/2) * Math.sin(dLat/2) +
                                      Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(p.latitude * Math.PI / 180) *
                                      Math.sin(dLon/2) * Math.sin(dLon/2);
                            return R * 2 * Math.atan2(Math.sqrt(aDist), Math.sqrt(1-aDist));
                        };
                        return getDist(a) - getDist(b);
                    });
                }

                setResults(processed);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
            addToast("Failed to fetch products", "error");
        } finally {
            setIsSearching(false);
        }
    };
    performSearch();
  }, [deferredSearchQuery, selectedCategories, sortBy, priceRange, minRating, showOnlyVerified, showOnlyInStock, selectedLocation, userLocation, visibleCount]);

  const handleCategoryChange = (category: string) => {
    const next = category === 'All' ? [] : [category];
    setSelectedCategories(next);
    
    const newParams = new URLSearchParams(searchParams);
    if (next.length === 0) newParams.delete('category');
    else newParams.set('category', next[0]);
    setSearchParams(newParams);
    setIsMobileFiltersOpen(false);
    setVisibleCount(12); 
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setPriceRange({min: '', max: ''});
    setMinRating(null);
    setShowOnlyVerified(false);
    setShowOnlyInStock(false);
    setSelectedLocation('');
    setSortBy('newest');
    setSearchParams({});
  };

  // Dynamic Counts Calculation
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allProducts.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [allProducts]);

  // Voice Search Logic
  const startVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
        addToast("Voice search not supported in this browser", "error");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        addToast(`Searching for: "${transcript}"`, "success");
    };

    recognition.start();
  };

  const toggleComparison = (product: Product) => {
    setComparisonList(prev => {
        if (prev.find(p => p.id === product.id)) {
            return prev.filter(p => p.id !== product.id);
        }
        if (prev.length >= 3) {
            addToast("You can only compare up to 3 items", "warning");
            return prev;
        }
        return [...prev, product];
    });
  };

  const activeFiltersCount = [
    selectedCategories.length > 0,
    priceRange.min !== '' || priceRange.max !== '',
    minRating !== null,
    showOnlyVerified,
    showOnlyInStock,
    searchQuery !== '',
    selectedLocation !== ''
  ].filter(Boolean).length;

    return (
    <div className="min-h-screen bg-background pt-16 md:pt-20 font-sans pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* Compact Shop Header */}
      <div className="bg-background border-b border-foreground/8 sticky top-16 md:top-20 z-40">
        <div className="container mx-auto max-w-7xl px-4 md:px-8 py-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            {/* Category Dropdown */}
            <div className="relative w-full md:w-64">
              <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 pointer-events-none" />
              <select 
                value={selectedCategories[0] || 'All'} 
                onChange={e => handleCategoryChange(e.target.value)}
                className="w-full h-12 pl-11 pr-10 bg-foreground/[0.04] border-none rounded-xl text-xs font-bold uppercase tracking-widest appearance-none focus:ring-2 focus:ring-foreground/10 transition-all cursor-pointer"
              >
                <option value="All">All Categories</option>
                {Object.keys(CATEGORY_HIERARCHY).map(catName => (
                  <option key={catName} value={catName}>
                    {catName}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 pointer-events-none" />
            </div>

            {/* Search Bar */}
            <div className="relative flex-1 w-full group">
              <Search className={`absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors z-10 ${isSearchFocused ? 'text-foreground' : 'text-foreground/40'}`} />
              <Input 
                placeholder="Search products, brands, or tags..." 
                className="pl-12 pr-12 h-12 bg-foreground/[0.04] border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-foreground/10 transition-all" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              />
              <button 
                onClick={startVoiceSearch}
                className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-foreground/40 hover:text-foreground'}`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              {isSearching && !isListening && <Loader2 className="absolute right-12 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-foreground/30" />}
              
              {/* Search Suggestions (Simplified) */}
              <AnimatePresence>
                {isSearchFocused && searchQuery && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-2 p-4 bg-background border border-foreground/10 rounded-2xl shadow-2xl z-50 backdrop-blur-xl max-h-[50vh] overflow-y-auto"
                  >
                    {results.slice(0, 5).length > 0 ? (
                      <div className="space-y-2">
                        {results.slice(0, 5).map(p => (
                          <button 
                            key={p.id}
                            onClick={() => navigate(`/product/${p.id}`)}
                            className="w-full flex items-center gap-3 p-2 hover:bg-foreground/[0.04] rounded-lg transition-colors text-left group"
                          >
                            <div className="w-10 h-10 rounded-md overflow-hidden shrink-0">
                              <img src={p.images[0]} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold truncate">{p.name}</p>
                              <p className="text-[9px] uppercase tracking-widest opacity-40">{p.category}</p>
                            </div>
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-center py-2 text-foreground/40 italic">No matches found</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* View Controls & Mobile Filter Toggle */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
              <div className="flex gap-1 p-1 bg-foreground/[0.04] rounded-xl">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-foreground/40 hover:text-foreground/70'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-foreground/40 hover:text-foreground/70'}`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
              </div>

              <Button 
                variant="outline"
                onClick={() => setIsMobileFiltersOpen(true)}
                className="lg:hidden flex items-center gap-2 px-4 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest"
              >
                <Filter className="w-3 h-3" />
                Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
              </Button>
            </div>
          </div>

          {/* Active Filters Bar (Compact) */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-foreground/8">
              {selectedCategories.map(cat => (
                <Badge key={cat} variant="secondary" className="gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[9px] uppercase tracking-wider">
                  {cat}
                  <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => handleCategoryChange(cat)} />
                </Badge>
              ))}
              {searchQuery && (
                <Badge variant="secondary" className="gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[9px] uppercase tracking-wider">
                  "{searchQuery}"
                  <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => setSearchQuery('')} />
                </Badge>
              )}
              {(priceRange.min || priceRange.max) && (
                <Badge variant="secondary" className="gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[9px] uppercase tracking-wider">
                  {priceRange.min || '0'} - {priceRange.max || '∞'}
                  <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => setPriceRange({min: '', max: ''})} />
                </Badge>
              )}
              <button onClick={clearFilters} className="text-[9px] font-bold uppercase tracking-widest text-red-500 hover:underline ml-1">Clear All</button>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 md:px-8 py-12 flex flex-col lg:flex-row gap-16">
        
        {/* Advanced Sidebar - Specialist Tool Aesthetic */}
        <motion.aside 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="hidden lg:block w-72 shrink-0 space-y-12 sticky top-32 h-fit border-r border-dashed border-foreground/10 pr-8"
        >
            <div className="space-y-10">
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground opacity-40">Categories</h3>
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    </div>
                    <div className="relative">
                        <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 opacity-30" />
                        <select 
                            value={selectedCategories[0] || 'All'} 
                            onChange={e => handleCategoryChange(e.target.value)}
                            className="w-full h-10 pl-9 pr-4 text-[10px] font-bold bg-foreground/[0.04] border border-foreground/10 rounded-xl appearance-none focus:outline-none focus:ring-1 focus:ring-foreground/10"
                        >
                            <option value="All">All Products</option>
                            {Object.keys(CATEGORY_HIERARCHY).map(catName => (
                                <option key={catName} value={catName}>
                                    {catName} ({categoryCounts[catName] || 0})
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 opacity-30 pointer-events-none" />
                    </div>
                </div>

                <div className="pt-8 border-t border-foreground/8">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-foreground opacity-40">Filters</h3>
                        <Layers className="w-3 h-3 opacity-20" />
                    </div>
                    
                    <div className="space-y-8">
                        <div className="space-y-3">
                            <Label className="text-[9px] uppercase tracking-widest opacity-40">Location</Label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 opacity-30" />
                                <select 
                                    value={selectedLocation} 
                                    onChange={e => setSelectedLocation(e.target.value)}
                                    className="w-full h-10 pl-9 pr-4 text-[10px] font-bold bg-foreground/[0.04] border border-foreground/10 rounded-xl appearance-none focus:outline-none focus:ring-1 focus:ring-foreground/10"
                                >
                                    <option value="">All Regions</option>
                                    {availableLocations.map(loc => (
                                        <option key={loc} value={loc}>{loc}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 opacity-30 pointer-events-none" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-[9px] uppercase tracking-widest opacity-40">Price Range (TZS)</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="relative">
                                    <Input 
                                        type="number" 
                                        placeholder="Min"
                                        value={priceRange.min} 
                                        onChange={e => setPriceRange({...priceRange, min: e.target.value})}
                                        className="h-10 text-[10px] bg-foreground/[0.04] border-foreground/10 rounded-xl"
                                    />
                                </div>
                                <div className="relative">
                                    <Input 
                                        type="number" 
                                        placeholder="Max"
                                        value={priceRange.max} 
                                        onChange={e => setPriceRange({...priceRange, max: e.target.value})}
                                        className="h-10 text-[10px] bg-foreground/[0.04] border-foreground/10 rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[9px] uppercase tracking-widest opacity-40">Options</Label>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 border border-foreground/8 rounded-xl">
                                    <span className="text-[10px] font-bold text-foreground/60">Verified Sellers</span>
                                    <Switch checked={showOnlyVerified} onCheckedChange={setShowOnlyVerified} />
                                </div>
                                <div className="flex items-center justify-between p-3 border border-foreground/8 rounded-xl">
                                    <span className="text-[10px] font-bold text-foreground/60">In Stock</span>
                                    <Switch checked={showOnlyInStock} onCheckedChange={setShowOnlyInStock} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-[9px] uppercase tracking-widest opacity-40">Minimum Rating</Label>
                            <div className="grid grid-cols-5 gap-1">
                                {[1, 2, 3, 4, 5].map(r => (
                                    <button 
                                        key={r} 
                                        onClick={() => setMinRating(r === minRating ? null : r)}
                                        className={`aspect-square flex items-center justify-center border transition-all rounded-lg ${minRating === r ? 'bg-foreground border-foreground text-background' : 'border-foreground/10 text-foreground/30 hover:border-foreground/40'}`}
                                    >
                                        <span className="text-[10px] font-bold">{r}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t border-foreground/8">
                    <Button 
                        variant="outline" 
                        onClick={clearFilters} 
                        className="w-full h-12 rounded-xl border-foreground/10 text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 transition-all"
                    >
                        Reset Filters
                    </Button>
                </div>
            </div>
        </motion.aside>

        {/* Mobile Filter Drawer */}
        <AnimatePresence>
            {isMobileFiltersOpen && (
                <div className="fixed inset-0 z-[100] lg:hidden">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                        onClick={() => setIsMobileFiltersOpen(false)}
                    ></motion.div>
                    <motion.div 
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="absolute inset-y-0 right-0 w-[85vw] max-w-sm bg-background shadow-2xl flex flex-col"
                    >
                        <div className="p-6 border-b border-foreground/8 flex justify-between items-center">
                            <h3 className="font-black text-lg uppercase tracking-tight">Filters</h3>
                            <button onClick={() => setIsMobileFiltersOpen(false)} className="p-2 bg-foreground/[0.06] rounded-full"><X className="w-5 h-5"/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-8 space-y-10">
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/40 mb-6">Sort Order</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {['newest', 'price_low', 'price_high', 'distance'].map(s => (
                                        <button key={s} onClick={() => {
                                            if (s === 'distance') {
                                                if (!navigator.geolocation) return addToast("Geolocation not supported", "error");
                                                navigator.geolocation.getCurrentPosition(
                                                    (pos) => {
                                                        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                                                        setSortBy(s as any);
                                                    },
                                                    (err) => addToast(err.message, "error")
                                                );
                                            } else {
                                                setSortBy(s as any);
                                            }
                                        }} className={`h-11 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${sortBy === s ? 'bg-foreground text-background border-transparent shadow-lg' : 'bg-background/50 text-foreground/50 border-foreground/8'}`}>{s.replace('_', ' ')}</button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/40 mb-6">Location</h4>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                                    <select 
                                        value={selectedLocation} 
                                        onChange={e => setSelectedLocation(e.target.value)}
                                        className="w-full h-12 pl-11 pr-4 text-xs font-bold bg-foreground/[0.04] border-none rounded-xl appearance-none focus:outline-none focus:ring-1 focus:ring-foreground/10"
                                    >
                                        <option value="">All Regions</option>
                                        {availableLocations.map(loc => (
                                            <option key={loc} value={loc}>{loc}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 pointer-events-none" />
                                </div>
                            </div>

                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/40 mb-6">Price Range</h4>
                                <div className="flex items-center gap-3">
                                    <Input 
                                        type="number" 
                                        placeholder="Min" 
                                        value={priceRange.min} 
                                        onChange={e => setPriceRange({...priceRange, min: e.target.value})}
                                        className="h-12 text-xs bg-foreground/[0.04] border-none rounded-xl"
                                    />
                                    <span className="text-foreground/30">-</span>
                                    <Input 
                                        type="number" 
                                        placeholder="Max" 
                                        value={priceRange.max} 
                                        onChange={e => setPriceRange({...priceRange, max: e.target.value})}
                                        className="h-12 text-xs bg-foreground/[0.04] border-none rounded-xl"
                                    />
                                </div>
                            </div>

                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/40 mb-6">Collections</h4>
                                <div className="relative">
                                    <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                                    <select 
                                        value={selectedCategories[0] || 'All'} 
                                        onChange={e => handleCategoryChange(e.target.value)}
                                        className="w-full h-12 pl-11 pr-4 text-xs font-bold bg-foreground/[0.04] border-none rounded-xl appearance-none focus:outline-none focus:ring-1 focus:ring-foreground/10"
                                    >
                                        <option value="All">All Products</option>
                                        {Object.keys(CATEGORY_HIERARCHY).map(catName => (
                                            <option key={catName} value={catName}>
                                                {catName} ({categoryCounts[catName] || 0})
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-foreground/8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                            <Button variant="primary" className="w-full h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl" onClick={() => setIsMobileFiltersOpen(false)}>Show {results.length} Products</Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        <main className="flex-1">
          {/* Desktop Toolbar */}
          <div className="hidden lg:flex items-center justify-between mb-12">
              <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-foreground/40 uppercase tracking-widest">
                    {results.length} Products Found
                  </span>
                  <span className="w-1 h-1 bg-foreground/20 rounded-full"></span>
                  <span className="text-xs font-bold text-foreground/40 uppercase tracking-widest">
                    Showing {Math.min(visibleCount, results.length)}
                  </span>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Sort:</span>
                    <div className="flex gap-1 p-1 bg-foreground/[0.05] rounded-xl">
                        {['newest', 'price_low', 'price_high', 'rating', 'distance'].map(s => (
                            <button 
                                key={s}
                                onClick={() => {
                                    if (s === 'distance') {
                                        if (!navigator.geolocation) return addToast("Geolocation not supported", "error");
                                        navigator.geolocation.getCurrentPosition(
                                            (pos) => {
                                                setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                                                setSortBy(s as any);
                                            },
                                            (err) => addToast(err.message, "error")
                                        );
                                    } else {
                                        setSortBy(s as any);
                                    }
                                }} 
                                className={`h-8 px-4 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${sortBy === s ? 'bg-background text-foreground shadow-sm' : 'text-foreground/40 hover:text-foreground/70'}`}
                            >
                                {s.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
              </div>
          </div>

          {isSearching ? (
             <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-3 md:gap-x-6 gap-y-8 md:gap-y-12">
                {[1,2,3,4,5,6,7,8].map(i => (
                    <div key={i} className="space-y-4">
                        <Skeleton className="aspect-[3/4] rounded-none" />
                        <div className="space-y-2">
                            <Skeleton className="h-3 w-1/3" />
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    </div>
                ))}
             </div>
          ) : results.length === 0 ? (
            <div className="space-y-20">
                <div className="text-center py-40 border border-dashed border-foreground/10 rounded-[3rem] flex flex-col items-center justify-center bg-foreground/[0.01]">
                    <div className="w-20 h-20 bg-foreground/[0.05] rounded-full flex items-center justify-center mb-8">
                        <Search className="w-8 h-8 text-foreground/20" />
                    </div>
                    <h3 className="text-2xl font-serif font-light mb-4">No products found</h3>
                    <p className="text-foreground/50 text-sm mb-10 max-w-xs mx-auto leading-relaxed">We couldn't find any products matching your current selection. Try broadening your search.</p>
                    <Button variant="outline" onClick={clearFilters} className="rounded-full">Reset All Filters</Button>
                </div>

                {/* Recommended for You (Smart Empty State) */}
                <section>
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-serif font-light">Recommended for You</h3>
                        <Button variant="ghost" className="text-xs uppercase tracking-widest opacity-50" onClick={clearFilters}>View All Collection</Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {allProducts
                            .filter(p => p.stock > 0)
                            .sort(() => 0.5 - Math.random())
                            .slice(0, 4)
                            .map((p, idx) => (
                                <ProductCard 
                                    key={`rec-${p.id}`} 
                                    product={p} 
                                    index={idx}
                                    onQuickView={(p) => setActiveProduct(p)}
                                    isComparing={comparisonList.some(cp => cp.id === p.id)}
                                    onCompare={() => toggleComparison(p)}
                                />
                            ))
                        }
                    </div>
                </section>
            </div>
          ) : (
            <>
                <div 
                    className={`grid ${viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-3 md:gap-x-6 gap-y-8 md:gap-y-12' : 'grid-cols-1 gap-8'} animate-in fade-in duration-1000`}
                >
                   {results.slice(0, visibleCount).map((product, index) => {
                       const isElite = product.is_boosted || (product.rating || 0) >= 4.8;
                       return (
                           <motion.div 
                                key={product.id}
                                className={isElite && viewMode === 'grid' ? 'md:col-span-2 md:row-span-1' : ''}
                                layout
                           >
                               <ProductCard 
                                    product={product} 
                                    index={index % 12}
                                    onQuickView={(p) => setActiveProduct(p)}
                                    layout={viewMode}
                                    isComparing={comparisonList.some(p => p.id === product.id)}
                                    onCompare={() => toggleComparison(product)}
                                    className={isElite && viewMode === 'grid' ? 'h-full' : ''}
                               />
                           </motion.div>
                       );
                   })}
                </div>
                
                {visibleCount < totalCount && !isSearching && (
                    <div ref={ref} className="mt-32 text-center pb-20 flex flex-col items-center gap-4">
                        <Loader2 className="w-6 h-6 animate-spin text-foreground/20" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/30">Loading more products</span>
                    </div>
                )}
            </>
          )}

          {/* Recently Viewed Section */}
          {recentlyViewed.length > 0 && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-32 pt-16 border-t border-foreground/8"
            >
              <div className="flex items-end justify-between mb-12">
                <div>
                  <h2 className="font-serif text-3xl md:text-4xl font-light mb-4">Recently Viewed</h2>
                  <p className="text-foreground/50 text-sm max-w-md">Pick up where you left off with these items you've explored recently.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {recentlyViewed.map((p, idx) => (
                  <ProductCard 
                    key={`recent-${p.id}`} 
                    product={p} 
                    index={idx} 
                    onClick={() => navigate(`/product/${p.id}`)}
                    isComparing={comparisonList.some(cp => cp.id === p.id)}
                    onCompare={() => toggleComparison(p)}
                  />
                ))}
              </div>
            </motion.section>
          )}
        </main>
      </div>

      {activeProduct && (
        <ProductModal 
            product={activeProduct} 
            isOpen={!!activeProduct} 
            onClose={() => setActiveProduct(null)} 
        />
      )}

      {/* Comparison Tray */}
      <AnimatePresence>
        {comparisonList.length > 0 && (
            <motion.div 
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                exit={{ y: 100 }}
                className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4"
            >
                <div className="bg-background/90 backdrop-blur-2xl border border-foreground/10 rounded-[2.5rem] p-4 shadow-2xl flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4 flex-1 overflow-x-auto no-scrollbar">
                        {comparisonList.map(p => (
                            <div key={p.id} className="relative group shrink-0">
                                <div className="w-16 h-20 rounded-2xl overflow-hidden border border-foreground/8">
                                    <img src={p.images[0]} className="w-full h-full object-cover" />
                                </div>
                                <button 
                                    onClick={() => toggleComparison(p)}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        {comparisonList.length < 3 && (
                            <div className="w-16 h-20 rounded-2xl border border-dashed border-foreground/10 flex items-center justify-center text-foreground/20">
                                <Plus className="w-4 h-4" />
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="primary" 
                            className="rounded-full px-8 h-12 text-[10px] font-black uppercase tracking-widest shadow-xl"
                            disabled={comparisonList.length < 2}
                            onClick={() => navigate(`/compare?ids=${comparisonList.map(p => p.id).join(',')}`)}
                        >
                            Compare Now
                        </Button>
                        <button 
                            onClick={() => setComparisonList([])}
                            className="p-3 hover:bg-foreground/[0.06] rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-foreground/30" />
                        </button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
