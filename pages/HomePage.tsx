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
