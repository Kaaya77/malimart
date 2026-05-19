import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppState } from '../context/AppContext';
import { useHomePageData } from '../hooks/useHomePageData';
import { HeroSection } from '../components/home/HeroSection';
import { ProductGridSection } from '../components/home/ProductGridSection';
import { CategoryStrip } from '../components/home/CategoryStrip';
import { FeaturedStores } from '../components/home/FeaturedStores';
import { ProductModal } from '../components/ProductModal';
import { Product } from '../types';

/**
 * Home page — wires up:
 *   - HeroSection fed by admin hero_recommendations via useHomePageData
 *   - Featured product grid (admin-curated + boosted)
 *   - Category strip
 *   - Featured stores
 *   - Full product grid
 *
 * The heroFeaturedProducts array (up to 4) from useHomePageData is passed
 * directly to HeroSection so it drives the carousel with admin picks first,
 * topped up from the live catalog when fewer than 4 are featured.
 */
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { products } = useAppState();
  const {
    topShops,
    trendingCategories,
    heroSettings,
    heroRecommendation,
    heroFeaturedProducts,
    loadingShops,
  } = useHomePageData();

  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Search state (for HeroSection search bar)
  const [searchQuery, setSearchQuery] = useState('');
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/shop?search=${encodeURIComponent(searchQuery)}`);
  };

  // Placeholder cycling text for search bar
  const searchPlaceholders = ['Search for kanga fabric…', 'Search for ebony carvings…', 'Search for Zanzibar spices…', 'Search for beaded jewelry…'];
  const [currentPlaceholderIdx, setCurrentPlaceholderIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCurrentPlaceholderIdx(i => (i + 1) % searchPlaceholders.length), 3000);
    return () => clearInterval(t);
  }, []);

  // Featured products: admin-curated ids first, then boosted, then top-rated
  const featuredProducts = useMemo(() => {
    const adminIds = new Set(heroFeaturedProducts.map((p: any) => p.id));
    const boosted = products.filter(p => p.is_boosted && !adminIds.has(p.id))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const topRated = products
      .filter(p => !adminIds.has(p.id) && !p.is_boosted)
      .sort((a, b) => (b.rating || 0) * (b.review_count || 0) - (a.rating || 0) * (a.review_count || 0));
    return [...boosted, ...topRated].slice(0, 8);
  }, [products, heroFeaturedProducts]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero: admin-featured products carousel ── */}
      <HeroSection
        heroRecommendation={heroRecommendation}
        heroFeaturedProducts={heroFeaturedProducts}
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

      {/* ── Category strip ── */}
      {trendingCategories.length > 0 && (
        <CategoryStrip categories={trendingCategories} navigate={navigate} />
      )}

      {/* ── Featured / curated products grid ── */}
      {featuredProducts.length > 0 && (
        <ProductGridSection
          title="Featured Products"
          description="Handpicked items from verified sellers across Tanzania"
          products={featuredProducts}
          navigate={navigate}
          setActiveProduct={(p) => { setActiveProduct(p); setIsModalOpen(true); }}
        />
      )}

      {/* ── Featured stores ── */}
      {!loadingShops && topShops.length > 0 && (
        <FeaturedStores shops={topShops} navigate={navigate} />
      )}

      {/* ── All products grid ── */}
      {products.length > 0 && (
        <ProductGridSection
          title="All Products"
          description="Browse the full catalog from Tanzanian sellers"
          products={products.slice(0, 16)}
          navigate={navigate}
          setActiveProduct={(p) => { setActiveProduct(p); setIsModalOpen(true); }}
        />
      )}

      {/* ── Product modal ── */}
      <ProductModal
        product={activeProduct}
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setActiveProduct(null); }}
      />
    </div>
  );
};

export default HomePage;
