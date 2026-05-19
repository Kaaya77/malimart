import React from 'react';
import { motion } from 'framer-motion';
import { ProductCard } from '../components/ProductCard';
import { useAppState } from '../context/AppContext';

const HomePage: React.FC = () => {
  const { products } = useAppState();

  const featuredProducts = products.slice(0, 8);
  const trendingProducts = products.slice(4, 12);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section - Mobile First */}
      <section className="relative h-[85vh] md:h-[90vh] flex items-center justify-center overflow-hidden bg-black text-white">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1556742049-0cfed4f6a45d')] bg-cover bg-center opacity-70" />
        
        <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
          >
            Shop Local.<br />Grow Together.
          </motion.h1>
          
          <p className="text-lg md:text-xl opacity-90 mb-10 max-w-md mx-auto">
            Discover unique products from Tanzanian sellers. Support local businesses.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/shop" className="bg-white text-black px-10 py-4 rounded-full font-semibold hover:bg-white/90 transition-all active:scale-95">
              Shop Now
            </a>
            <a href="/sell" className="border border-white/70 hover:bg-white/10 px-10 py-4 rounded-full font-semibold transition-all">
              Become a Seller
            </a>
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          ↓ Scroll
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 px-6">
        <h2 className="text-2xl font-semibold mb-8">Shop by Category</h2>
        {/* Add your category cards here */}
      </section>

      {/* Featured Products */}
      <section className="py-12 px-6 bg-muted/30">
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-2xl font-semibold">Featured Products</h2>
          <a href="/shop" className="text-sm underline">View all</a>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {featuredProducts.map((product, idx) => (
            <ProductCard key={product.id} product={product} index={idx} />
          ))}
        </div>
      </section>

      {/* Trending */}
      <section className="py-12 px-6">
        <h2 className="text-2xl font-semibold mb-8">Trending Now</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {trendingProducts.map((product, idx) => (
            <ProductCard key={product.id} product={product} index={idx} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../context/AppContext';
import { ProductModal } from '../components/ProductModal';
import { StoreModal } from '../components/StoreModal';
import { Product, VendorProfile } from '../types';
import { useHomePageData } from '../hooks/useHomePageData';
import { HeroSection } from '../components/home/HeroSection';
import { CategoryStrip } from '../components/home/CategoryStrip';
import { FeaturedProducts } from '../components/home/FeaturedProducts';
import { FeaturedStores } from '../components/home/FeaturedStores';
import { ProductGridSection } from '../components/home/ProductGridSection';
import { TrustStrip } from '../components/home/TrustStrip';

/**
 * HomePage — product-first redesign v3.
 *
 * Section order (top → bottom):
 *   1. HeroSection         — admin-curated featured product(s), swipeable on mobile
 *   2. CategoryStrip       — image-driven category navigation
 *   3. FeaturedProducts    — admin-curated is_boosted products
 *   4. ProductGrid Trending
 *   5. FeaturedStores      — verified sellers
 *   6. ProductGrid Just arrived
 *   7. TrustStrip          — buyer reassurance
 *
 * Everything that ranks/curates from data is computed below and passed
 * down. The hero pulls from heroRecommendation (admin) and falls back
 * gracefully to the boosted/top-rated lists.
 */
export const HomePage = () => {
  const { products, user } = useAppState();
  const navigate = useNavigate();
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [activeStore, setActiveStore] = useState<VendorProfile | null>(null);

  const {
    topShops,
    heroSettings,
    heroRecommendation,
  } = useHomePageData();

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPlaceholderIdx, setCurrentPlaceholderIdx] = useState(0);

  const searchPlaceholders = useMemo(() => {
    if (products && products.length > 0) {
      return [...products]
        .sort(() => 0.5 - Math.random())
        .slice(0, 4)
        .map(p => `Search for "${p.name}"…`);
    }
    return [
      'Search products, brands, sellers…',
      'Try "kanga fabric"',
      'Try "Tanzanian coffee"',
    ];
  }, [products]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.6, staggerChildren: 0.12 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  // Admin-curated featured (is_boosted)
  const featuredProducts = useMemo(() => {
    return products
      .filter(p => p.is_boosted)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 8);
  }, [products]);

  // Trending: rating × reviews (boosted always wins ties)
  const trendingProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      if (a.is_boosted && !b.is_boosted) return -1;
      if (!a.is_boosted && b.is_boosted) return 1;
      const scoreA = (a.rating || 0) * (a.review_count || 0);
      const scoreB = (b.rating || 0) * (b.review_count || 0);
      return scoreB - scoreA;
    }).slice(0, 8);
  }, [products]);

  // Newest first
  const newArrivals = useMemo(() => {
    return [...products]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 8);
  }, [products]);

  useEffect(() => {
    if (searchPlaceholders.length === 0) return;
    const t = setInterval(() => {
      setCurrentPlaceholderIdx(prev => (prev + 1) % searchPlaceholders.length);
    }, 3000);
    return () => clearInterval(t);
  }, [searchPlaceholders]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0];
  const greeting = user ? `Welcome back, ${firstName}.` : '';

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground pb-24 md:pb-0">
      <HeroSection
        heroRecommendation={heroRecommendation}
        heroSettings={heroSettings}
        greeting={greeting}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSearch={handleSearch}
        searchPlaceholders={searchPlaceholders}
        currentPlaceholderIdx={currentPlaceholderIdx}
        containerVariants={containerVariants}
        itemVariants={itemVariants}
      />

      <CategoryStrip />

      <FeaturedProducts
        products={featuredProducts}
        navigate={navigate}
        setActiveProduct={setActiveProduct}
      />

      <ProductGridSection
        title="Trending now"
        description="The most-loved goods on MaliMart this week."
        products={trendingProducts}
        navigate={navigate}
        setActiveProduct={setActiveProduct}
      />

      <FeaturedStores
        topShops={topShops}
        setActiveStore={setActiveStore}
        navigate={navigate}
      />

      <ProductGridSection
        title="Just arrived"
        description="The newest listings from sellers across Tanzania."
        products={newArrivals}
        navigate={navigate}
        setActiveProduct={setActiveProduct}
      />

      <TrustStrip />

      {activeProduct && (
        <ProductModal
          product={activeProduct}
          isOpen={!!activeProduct}
          onClose={() => setActiveProduct(null)}
        />
      )}
      {activeStore && (
        <StoreModal
          store={activeStore}
          isOpen={!!activeStore}
          onClose={() => setActiveStore(null)}
        />
      )}
    </div>
  );
};
