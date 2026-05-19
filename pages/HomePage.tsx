import React from 'react';
import { motion } from 'framer-motion';
import { ProductCard } from '../components/ProductCard';
import { useAppState } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

const HomePage: React.FC = () => {
  const { products = [] } = useAppState();
  const navigate = useNavigate();

  const featuredProducts = products.slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section - Mobile First */}
      <section className="relative h-[85vh] md:h-[95vh] flex items-center justify-center overflow-hidden bg-black text-white">
        <div className="absolute inset-0 bg-[url('https://picsum.photos/id/1015/2000/1200')] bg-cover bg-center opacity-75" />
        
        <div className="relative z-10 text-center px-5 max-w-lg sm:max-w-2xl mx-auto">
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-7xl font-bold tracking-tighter leading-none mb-6"
          >
            Malimart
          </motion.h1>
          
          <p className="text-lg md:text-xl opacity-90 mb-10">
            Discover unique products from Tanzanian sellers and creators
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => navigate('/shop')}
              className="bg-white text-black px-10 py-4 rounded-2xl font-semibold text-lg active:scale-95 transition-all"
            >
              Shop Now
            </button>
            <button 
              onClick={() => navigate('/sell')}
              className="border border-white/70 hover:bg-white/10 px-10 py-4 rounded-2xl font-semibold text-lg transition-all"
            >
              Sell on Malimart
            </button>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="px-4 sm:px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-semibold">Featured Products</h2>
          <a href="/shop" className="text-primary hover:underline text-sm">View all →</a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {featuredProducts.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
};

export { HomePage };
export default HomePage;
