import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../context/AppContext';
import { useHomePageData } from '../hooks/useHomePageData';
import { HeroSection } from '../components/home/HeroSection';
import { CategoryStrip } from '../components/home/CategoryStrip';
import { FeaturedProducts } from '../components/home/FeaturedProducts';
import { FeaturedStores } from '../components/home/FeaturedStores';
import { ProductGridSection } from '../components/home/ProductGridSection';
import { TrustStrip } from '../components/home/TrustStrip';
import { StoreModal } from '../components/StoreModal';
import { HomePageSkeleton } from '../components/skeletons/HomePageSkeleton';
import { Product, VendorProfile } from '../types';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, duration: 0.4 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

const SEARCH_PLACEHOLDERS = [
  'Search kangas, spices, crafts…',
  'Find Maasai jewelry…',
  'Browse Tanzanian coffee…',
  'Discover wooden carvings…',
];

const HomePage: React.FC = () => {
  const { products = [], isLoading, recentlyViewed = [] } = useAppState();
  const navigate = useNavigate();
  const homeData = useHomePageData();

  const [activeStore, setActiveStore] = useState<VendorProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/shop?q=${encodeURIComponent(searchQuery)}`);
  };

  const greeting = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good morning 🌅';
    if (hr < 18) return 'Good afternoon ☀️';
    return 'Good evening 🌙';
  }, []);

  // Boosted products for "Featured" section
  const boostedProducts = useMemo(
    () => products.filter(p => p.is_boosted && p.status !== 'inactive').slice(0, 8),
    [products]
  );

  // New arrivals — last 14 days
  const newArrivals = useMemo(
    () =>
      [...products]
        .filter(p => p.status !== 'inactive')
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 8),
    [products]
  );

  if (isLoading) return <HomePageSkeleton />;

  return (
    <div className="min-h-screen bg-background">
      {/* 1. Hero — real featured products */}
      <HeroSection
        heroRecommendation={homeData.heroRecommendation}
        heroFeaturedProducts={homeData.heroFeaturedProducts}
        heroSettings={homeData.heroSettings}
        greeting={greeting}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSearch={handleSearch}
        searchPlaceholders={SEARCH_PLACEHOLDERS}
        currentPlaceholderIdx={0}
        containerVariants={containerVariants}
        itemVariants={itemVariants}
      />

      {/* 2. Categories — real DB categories with real product counts */}
      <CategoryStrip />

      {/* 3. Featured / Boosted Products */}
      {boostedProducts.length > 0 && (
        <FeaturedProducts
          products={boostedProducts}
          navigate={navigate}
          setActiveProduct={(p) => navigate(`/product/${p.id}`)}
        />
      )}

      {/* 4. New Arrivals */}
      {newArrivals.length > 0 && (
        <ProductGridSection
          title="New arrivals"
          description="Fresh drops from Tanzania's best sellers."
          products={newArrivals}
          navigate={navigate}
          setActiveProduct={(p) => navigate(`/product/${p.id}`)}
        />
      )}

      {/* 5. Featured Sellers — only if data exists */}
      {homeData.topShops.length > 0 && (
        <FeaturedStores
          topShops={homeData.topShops}
          setActiveStore={setActiveStore}
          navigate={navigate}
        />
      )}

      {/* 6. Recently Viewed — only if meaningful (3+) */}
      {recentlyViewed.length >= 3 && (
        <ProductGridSection
          title="Recently viewed"
          description="Pick up where you left off."
          products={recentlyViewed.slice(0, 8)}
          navigate={navigate}
          setActiveProduct={(p) => navigate(`/product/${p.id}`)}
        />
      )}

      {/* 7. Trust signals */}
      <TrustStrip />

      {/* Modals */}
      <AnimatePresence>
      </AnimatePresence>

      <AnimatePresence>
        {activeStore && (
          <StoreModal
            store={activeStore}
            isOpen={!!activeStore}
            onClose={() => setActiveStore(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export { HomePage };
export default HomePage;
