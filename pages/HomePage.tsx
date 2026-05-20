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
import { ProductModal } from '../components/ProductModal';
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

  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [activeStore, setActiveStore] = useState<VendorProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPlaceholderIdx] = useState(0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/shop?q=${encodeURIComponent(searchQuery)}`);
  };

  // Smart greeting
  const greeting = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good morning 🌅';
    if (hr < 18) return 'Good afternoon ☀️';
    return 'Good evening 🌙';
  }, []);

  const boostedProducts = useMemo(
    () => products.filter(p => p.is_boosted && p.status !== 'inactive').slice(0, 8),
    [products]
  );

  const newArrivals = useMemo(
    () =>
      [...products]
        .filter(p => p.status !== 'inactive')
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 8),
    [products]
  );

  const topRated = useMemo(
    () =>
      [...products]
        .filter(p => p.status !== 'inactive' && (p.review_count || 0) >= 1)
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 8),
    [products]
  );

  if (isLoading) return <HomePageSkeleton />;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <HeroSection
        heroRecommendation={homeData.heroRecommendation}
        heroFeaturedProducts={homeData.heroFeaturedProducts}
        heroSettings={homeData.heroSettings}
        greeting={greeting}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSearch={handleSearch}
        searchPlaceholders={SEARCH_PLACEHOLDERS}
        currentPlaceholderIdx={currentPlaceholderIdx}
        containerVariants={containerVariants}
        itemVariants={itemVariants}
      />

      {/* Categories */}
      <CategoryStrip />

      {/* Featured / Boosted Products */}
      {boostedProducts.length > 0 && (
        <FeaturedProducts
          products={boostedProducts}
          navigate={navigate}
          setActiveProduct={setActiveProduct}
        />
      )}

      {/* Top Rated */}
      {topRated.length > 0 && (
        <ProductGridSection
          title="Top rated"
          description="Highest-rated products by verified buyers."
          products={topRated}
          navigate={navigate}
          setActiveProduct={setActiveProduct}
        />
      )}

      {/* Featured Sellers */}
      {homeData.topShops.length > 0 && (
        <FeaturedStores
          topShops={homeData.topShops}
          setActiveStore={setActiveStore}
          navigate={navigate}
        />
      )}

      {/* New Arrivals */}
      {newArrivals.length > 0 && (
        <ProductGridSection
          title="New arrivals"
          description="Fresh drops from Tanzania's best sellers."
          products={newArrivals}
          navigate={navigate}
          setActiveProduct={setActiveProduct}
        />
      )}

      {/* Recently Viewed */}
      {recentlyViewed.length >= 3 && (
        <ProductGridSection
          title="Recently viewed"
          description="Pick up where you left off."
          products={recentlyViewed.slice(0, 8)}
          navigate={navigate}
          setActiveProduct={setActiveProduct}
        />
      )}

      {/* Trust signals */}
      <TrustStrip />

      {/* Modals */}
      <AnimatePresence>
        {activeProduct && (
          <ProductModal
            product={activeProduct}
            isOpen={!!activeProduct}
            onClose={() => setActiveProduct(null)}
          />
        )}
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
