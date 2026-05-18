
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppState } from '../context/AppContext';
import { ProductModal } from '../components/ProductModal';
import { StoreModal } from '../components/StoreModal';
import { Product, VendorProfile } from '../types';
import { useHomePageData } from '../hooks/useHomePageData';
import { HeroSection } from '../components/home/HeroSection';
import { SecondaryHeroElements } from '../components/home/SecondaryHeroElements';
import { FeaturedStores } from '../components/home/FeaturedStores';
import { QuickCategories } from '../components/home/QuickCategories';
import { ProductGridSection } from '../components/home/ProductGridSection';
import { CATEGORY_HIERARCHY } from '../constants';

export const HomePage = () => {
  const { products, user } = useAppState();
  const navigate = useNavigate();
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [activeStore, setActiveStore] = useState<VendorProfile | null>(null);
  
  const {
      topShops,
      userCount,
      recentUserAvatars,
      trendingCategories,
      tickerItems,
      weeklyOrderCount,
      heroSettings,
      heroRecommendation,
      loadingShops
  } = useHomePageData();

  const [searchQuery, setSearchQuery] = useState('');
  const [currentCarouselIdx, setCurrentCarouselIdx] = useState(0);
  const [currentPlaceholderIdx, setCurrentPlaceholderIdx] = useState(0);
  const [isCarouselHovered, setIsCarouselHovered] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);

  const searchPlaceholders = useMemo(() => {
    if (products && products.length > 0) {
        return [...products]
            .sort(() => 0.5 - Math.random())
            .slice(0, 4)
            .map(p => `Search for "${p.name}"...`);
    }
    return [];
  }, [products]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.8, staggerChildren: 0.2 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const trendingProducts = useMemo(() => {
      return [...products].sort((a, b) => {
          if (a.is_boosted && !b.is_boosted) return -1;
          if (!a.is_boosted && b.is_boosted) return 1;
          const scoreA = (a.rating || 0) * (a.review_count || 0);
          const scoreB = (b.rating || 0) * (b.review_count || 0);
          return scoreB - scoreA;
      }).slice(0, 8);
  }, [products]);

  const newArrivals = useMemo(() => {
      return [...products].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).slice(0, 8);
  }, [products]);

  // Animated Placeholder Logic
  useEffect(() => {
      const interval = setInterval(() => {
          setCurrentPlaceholderIdx((prev) => (prev + 1) % searchPlaceholders.length);
      }, 3000);
      return () => clearInterval(interval);
  }, [searchPlaceholders]);

  // Live Ticker Logic
  useEffect(() => {
      const interval = setInterval(() => {
          setTickerIndex((prev) => (prev + 1) % tickerItems.length);
      }, 6000);
      return () => clearInterval(interval);
  }, [tickerItems]);

  const handleSearch = (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim()) {
          navigate(`/shop?search=${encodeURIComponent(searchQuery)}`);
      }
  };

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0];
  const greeting = user ? `Welcome back, ${firstName}. ` : '';

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 selection:bg-primary selection:text-primary-foreground">
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

        <SecondaryHeroElements 
            tickerIndex={tickerIndex}
            tickerItems={tickerItems}
            trendingCategories={trendingCategories}
            userCount={userCount}
            recentUserAvatars={recentUserAvatars}
            weeklyOrderCount={weeklyOrderCount}
            user={user}
            navigate={navigate}
            containerVariants={containerVariants}
        />

        {!loadingShops && topShops.length > 0 && (
            <FeaturedStores 
                topShops={topShops}
                setActiveStore={setActiveStore}
                navigate={navigate}
            />
        )}

        <QuickCategories 
            categories={trendingCategories.map(c => ({ name: c.name, icon: c.icon, link: `/shop?category=${c.name}` }))}
            navigate={navigate}
        />

        <ProductGridSection 
            title="Trending Collection"
            description="Curated selections of our most sought-after products."
            products={trendingProducts}
            navigate={navigate}
            setActiveProduct={setActiveProduct}
        />

        <ProductGridSection 
            title="Latest Additions"
            description="The newest products to grace our collection."
            products={newArrivals}
            navigate={navigate}
            setActiveProduct={setActiveProduct}
        />

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


