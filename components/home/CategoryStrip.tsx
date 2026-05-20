import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useAppState } from '../../context/AppContext';

/**
 * Mobile-first category navigation.
 *
 * Mobile: horizontal snap-scroll, image cards 140px wide. No nav arrows —
 *   thumb-friendly, scroll-with-momentum feels native.
 * Desktop (md+): 5-column grid with taller image cards.
 *
 * Each card uses category-specific imagery from Unsplash so the page
 * looks alive even when products haven't loaded yet.
 */

const CATEGORIES: Array<{ name: string; img: string }> = [
  { name: 'Fashion & Beauty', img: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&q=80&w=500' },
  { name: 'Pantry & Spices', img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=500' },
  { name: 'Handicrafts', img: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&q=80&w=500' },
  { name: 'Electronics', img: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&q=80&w=500' },
  { name: 'Home & Living', img: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=500' },
  { name: 'Agriculture', img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=500' },
  { name: 'Construction', img: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=500' },
  { name: 'Kids & Toys', img: 'https://images.unsplash.com/photo-1558877385-8c1cee71006d?auto=format&fit=crop&q=80&w=500' },
  { name: 'Vehicles', img: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&q=80&w=500' },
  { name: 'Books & Stationery', img: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=500' },
];

export const CategoryStrip: React.FC = () => {
  const navigate = useNavigate();
  const { categories: liveCategories } = useAppState();

  // Merge live DB categories with our curated fallback images
  const displayCategories = React.useMemo(() => {
    if (liveCategories && liveCategories.length > 0) {
      return liveCategories
        .filter(c => c.is_active !== false)
        .slice(0, 10)
        .map(c => ({
          name: c.name,
          img: CATEGORIES.find(fc => fc.name === c.name)?.img ||
               c.image_url ||
               'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=500'
        }));
    }
    return CATEGORIES;
  }, [liveCategories]);

  return (
    <section className="pt-12 md:pt-20 pb-2">
      <div className="container mx-auto px-5 md:px-8 mb-5 md:mb-7 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-sans text-xl md:text-[28px] font-semibold tracking-tight text-foreground leading-tight">
            Browse by category
          </h2>
          <p className="hidden md:block mt-1 text-sm text-foreground/55 font-medium">
            10 ways to dig into the marketplace.
          </p>
        </div>
        <button
          onClick={() => navigate('/categories')}
          className="text-sm font-semibold text-foreground/70 hover:text-foreground flex items-center gap-1 group"
        >
          All
          <ArrowRight className="w-4 h-4 stroke-[2.2] group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Mobile: horizontal snap scroll */}
      <div className="md:hidden overflow-x-auto no-scrollbar pl-5 -mr-5">
        <div className="flex gap-3 pr-5 snap-x snap-mandatory">
          {displayCategories.map((c, i) => (
            <motion.button
              key={c.name}
              initial={{ opacity: 0, x: 12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
              onClick={() => navigate(`/shop?category=${encodeURIComponent(c.name)}`)}
              className="relative w-[140px] h-[180px] flex-shrink-0 rounded-2xl overflow-hidden snap-start active:scale-[0.97] transition-transform"
            >
              <img
                src={c.img}
                alt=""
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <span className="absolute bottom-3 left-3 right-3 text-left text-white text-[13px] font-semibold leading-tight">
                {c.name}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Desktop: grid */}
      <div className="hidden md:grid container mx-auto px-8 grid-cols-5 gap-4">
        {displayCategories.slice(0, 10).map((c, i) => (
          <motion.button
            key={c.name}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.35) }}
            onClick={() => navigate(`/shop?category=${encodeURIComponent(c.name)}`)}
            className="group relative aspect-[4/5] rounded-2xl overflow-hidden ring-1 ring-foreground/5 hover:ring-foreground/20 transition-all hover:-translate-y-0.5"
          >
            <img
              src={c.img}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <span className="absolute bottom-4 left-4 right-4 text-left text-white text-sm font-semibold leading-tight">
              {c.name}
            </span>
          </motion.button>
        ))}
      </div>
    </section>
  );
};
