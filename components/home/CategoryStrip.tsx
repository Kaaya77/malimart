import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useAppState } from '../../context/AppContext';

/**
 * CategoryStrip — image cards linking to /shop?category=X.
 *
 * Source: DB categories (is_active=true) → falls back to curated list.
 * Images: category-specific Unsplash photos matched by name, or DB image_url.
 * No fake product counts. No mock data.
 *
 * Desktop: 5-column grid, 2 rows (10 cats). Mobile: horizontal snap scroll.
 */

const CATEGORY_IMAGES: Record<string, string> = {
  'Fashion & Beauty': 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800',
  'Pantry & Spices': 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=800',
  'Handicrafts': 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&q=80&w=800',
  'Electronics': 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&q=80&w=800',
  'Home & Living': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800',
  'Agriculture': 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=800',
  'Construction': 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=800',
  'Kids & Toys': 'https://images.unsplash.com/photo-1558877385-8c1cee71006d?auto=format&fit=crop&q=80&w=800',
  'Vehicles': 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&q=80&w=800',
  'Books & Stationery': 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=800',
};

const FALLBACK_CATEGORIES = Object.keys(CATEGORY_IMAGES).map(name => ({ name, img: CATEGORY_IMAGES[name] }));

export const CategoryStrip: React.FC = () => {
  const navigate = useNavigate();
  const { categories: liveCategories, products } = useAppState();

  const displayCategories = React.useMemo(() => {
    const base = liveCategories?.filter(c => c.is_active !== false) || [];
    if (base.length > 0) {
      return base.slice(0, 10).map(c => ({
        name: c.name,
        img: CATEGORY_IMAGES[c.name] || c.image_url || FALLBACK_CATEGORIES[0].img,
      }));
    }
    return FALLBACK_CATEGORIES;
  }, [liveCategories]);

  // Real product count per category from live data
  const countByCategory = React.useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => {
      if (p.status === 'inactive') return;
      const cat = (p as any).category;
      if (cat) map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  }, [products]);

  return (
    <section className="pt-12 md:pt-20 pb-2">
      <div className="container mx-auto px-5 md:px-8 mb-5 md:mb-7 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-sans text-xl md:text-[28px] font-semibold tracking-tight text-foreground leading-tight">
            Browse by category
          </h2>
          <p className="hidden md:block mt-1 text-sm text-foreground/55 font-medium">
            {displayCategories.length} categories across the marketplace.
          </p>
        </div>
        <button
          onClick={() => navigate('/categories')}
          className="text-sm font-semibold text-foreground/70 hover:text-foreground flex items-center gap-1 group"
        >
          All <ArrowRight className="w-4 h-4 stroke-[2.2] group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Mobile: horizontal snap scroll */}
      <div className="md:hidden overflow-x-auto no-scrollbar pl-5 -mr-5">
        <div className="flex gap-3 pr-5 snap-x snap-mandatory">
          {displayCategories.map((c, i) => {
            const count = countByCategory[c.name];
            return (
              <motion.button
                key={c.name}
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
                onClick={() => navigate(`/shop?category=${encodeURIComponent(c.name)}`)}
                className="group flex-shrink-0 w-[140px] snap-start text-left"
              >
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-foreground/[0.04]">
                  <img src={c.img} alt={c.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-active:scale-105" loading="lazy" decoding="async" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="font-sans font-bold text-white text-sm leading-tight line-clamp-2">{c.name}</p>
                    {count != null && <p className="text-[10px] text-white/55 mt-0.5">{count} items</p>}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Desktop: 5-col grid */}
      <div className="hidden md:grid container mx-auto px-8 grid-cols-5 gap-4">
        {displayCategories.map((c, i) => {
          const count = countByCategory[c.name];
          return (
            <motion.button
              key={c.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.35) }}
              onClick={() => navigate(`/shop?category=${encodeURIComponent(c.name)}`)}
              className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-foreground/[0.04] text-left"
            >
              <img
                src={c.img}
                alt={c.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="font-sans font-semibold text-white text-sm leading-tight">{c.name}</p>
                {count != null && (
                  <p className="text-[11px] text-white/55 mt-0.5">{count} products</p>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
};
