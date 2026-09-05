import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BackendError } from '../components/UI';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../context/AppContext';
import { useHomePageData } from '../hooks/useHomePageData';
import { HeroSection } from '../components/home/HeroSection';
import { CategoryStrip } from '../components/home/CategoryStrip';
import { FeaturedProducts } from '../components/home/FeaturedProducts';
import { FeaturedStores } from '../components/home/FeaturedStores';
import { ProductGridSection } from '../components/home/ProductGridSection';
import { TrustStrip } from '../components/home/TrustStrip';
import { ExploreBanner } from '../components/home/ExploreBanner';
import { HomePageSkeleton } from '../components/skeletons/HomePageSkeleton';
import { Product } from '../types';
import { isNewArrival } from '../constants';

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
  const { products = [], isLoading, catalogError, refreshProducts, recentlyViewed = [] } = useAppState();
  const navigate = useNavigate();
  const homeData = useHomePageData();

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPlaceholderIdx, setCurrentPlaceholderIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setCurrentPlaceholderIdx(i => (i + 1) % SEARCH_PLACEHOLDERS.length),
      3000,
    );
    return () => clearInterval(id);
  }, []);

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

  // This comment used to claim "last 14 days" while the code filtered by
  // nothing at all — it sorted by created_at and took 8, so 182-day-old stock
  // sat under a "New arrivals" heading. Filter for real, and when nothing
  // qualifies fall back to the newest items under an honest heading rather
  // than either lying or leaving a hole in the feed.
  const newestFirst = useMemo(
    () =>
      [...products]
        .filter(p => p.status !== 'inactive')
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()),
    [products]
  );
  const trulyNew = useMemo(
    () => newestFirst.filter(p => isNewArrival(p.created_at)).slice(0, 8),
    [newestFirst]
  );
  const hasTrulyNew = trulyNew.length > 0;
  const newArrivals = hasTrulyNew ? trulyNew : newestFirst.slice(0, 8);

  // Top rated — proven products with at least one review
  const topRated = useMemo(
    () =>
      [...products]
        .filter(p => p.status !== 'inactive' && (p.rating || 0) >= 4 && (p.review_count || 0) > 0)
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 8),
    [products]
  );

  if (isLoading) return <HomePageSkeleton />;

  return (
    <div className="min-h-screen bg-background">
      {catalogError && products.length === 0 && (
        <BackendError message={catalogError} onRetry={refreshProducts} className="py-20" />
      )}
      {/* 1. Hero — real featured products */}
      <HeroSection
        heroRecommendation={homeData.heroRecommendation}
        heroFeaturedProducts={homeData.heroFeaturedProducts}
        heroLoading={homeData.loadingShops}
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

      {/* 2. Trust strip — moved directly under the hero. Nationwide delivery,
             buyer protection, easy returns and mobile money (M-Pesa / Tigo
             Pesa / Airtel Money) are precisely the reassurances a first-time
             buyer needs BEFORE deciding to browse, and it was buried at the
             very bottom of the feed where new buyers never scrolled. */}
      <TrustStrip />

      {/* 3. Categories — real DB categories with real product counts */}
      <CategoryStrip />

      {/* 3. Featured / Boosted Products */}
      {boostedProducts.length > 0 && (
        <FeaturedProducts
          products={boostedProducts}
          navigate={navigate}
        />
      )}

      {/* 4. New Arrivals */}
      {newArrivals.length > 0 && (
        <ProductGridSection
          title={hasTrulyNew ? 'New arrivals' : 'Latest listings'}
          description={hasTrulyNew
            ? "Fresh drops from Tanzania's best sellers."
            : 'The most recently listed products on MaliMart.'}
          products={newArrivals}
          navigate={navigate}
        />
      )}

      {/* 5. Featured Sellers — only if data exists */}
      {homeData.topShops.length > 0 && (
        <FeaturedStores
          topShops={homeData.topShops}
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
        />
      )}

      {/* 7. Top rated — only when there's real review signal */}
      {topRated.length >= 4 && (
        <ProductGridSection
          title="Top rated"
          description="Loved by buyers across Tanzania."
          products={topRated}
          navigate={navigate}
        />
      )}

      {/* 8. Routes into Explore & Stores */}
      <ExploreBanner />

      {/* 9. Empty catalog — invite action instead of a blank page */}
      {products.length === 0 && (
        <section className="container mx-auto px-4 md:px-8 pb-12">
          <div className="flex flex-col items-center text-center py-16 border border-dashed border-foreground/15 rounded-3xl">
            <p className="font-bold text-foreground mb-1">The marketplace is just getting started</p>
            <p className="text-sm text-foreground/45 mb-5 max-w-sm">New products land daily. Explore categories or become a seller and list yours first.</p>
            <div className="flex gap-3">
              <button onClick={() => navigate('/shop')} className="h-11 px-5 rounded-2xl bg-foreground text-background text-sm font-bold active:scale-95 transition-transform">Explore categories</button>
              <button onClick={() => navigate('/login?mode=signup&role=seller')} className="h-11 px-5 rounded-2xl border border-foreground/15 text-foreground text-sm font-semibold hover:bg-foreground/[0.04] transition-colors">Start selling</button>
            </div>
          </div>
        </section>
      )}

      {/* Trust signals now sit under the hero (see above) rather than here at
          the very bottom, so they are seen before the buying decision. */}
    </div>
  );
};

export { HomePage };
export default HomePage;
