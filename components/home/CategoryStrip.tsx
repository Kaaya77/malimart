import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, animate } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useAppState } from '../../context/AppContext';

/**
 * REDESIGNED CategoryStrip — Magazine editorial grid.
 *
 * Desktop: asymmetric bento layout — 1 large hero category (2×2) + 4 medium + 4 small.
 * Mobile: horizontal snap-scroll with image cards that have a subtle parallax tilt.
 *
 * Each card has:
 *  - Bold serif category name
 *  - Product count badge (if available)
 *  - Hover: image scale + text slide up reveal
 *  - Gradient overlay that shifts accent color per category
 */

const CATEGORIES: Array<{ name: string; img: string; accent: string; emoji: string }> = [
  { name: 'Fashion & Beauty', img: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800', accent: '#ec4899', emoji: '👗' },
  { name: 'Pantry & Spices', img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=800', accent: '#f97316', emoji: '🌿' },
  { name: 'Handicrafts', img: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&q=80&w=800', accent: '#a855f7', emoji: '🏺' },
  { name: 'Electronics', img: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&q=80&w=800', accent: '#3b82f6', emoji: '⚡' },
  { name: 'Home & Living', img: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800', accent: '#10b981', emoji: '🏡' },
  { name: 'Agriculture', img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=800', accent: '#22c55e', emoji: '🌾' },
  { name: 'Construction', img: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=800', accent: '#f59e0b', emoji: '🏗️' },
  { name: 'Kids & Toys', img: 'https://images.unsplash.com/photo-1558877385-8c1cee71006d?auto=format&fit=crop&q=80&w=800', accent: '#ef4444', emoji: '🧸' },
  { name: 'Vehicles', img: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&q=80&w=800', accent: '#6366f1', emoji: '🚗' },
];

// Bento slot sizes for desktop:
// [0] = hero 2x2, [1,2] = tall 1x2, [3..8] = small 1x1
const BENTO_LAYOUT = [
  { col: 'col-span-2 row-span-2', aspect: 'aspect-square' },   // Hero
  { col: 'col-span-1 row-span-2', aspect: 'aspect-[3/4]' },   // Tall
  { col: 'col-span-1 row-span-2', aspect: 'aspect-[3/4]' },   // Tall
  { col: 'col-span-1 row-span-1', aspect: 'aspect-square' },  // Small
  { col: 'col-span-1 row-span-1', aspect: 'aspect-square' },
  { col: 'col-span-1 row-span-1', aspect: 'aspect-square' },
  { col: 'col-span-1 row-span-1', aspect: 'aspect-square' },
  { col: 'col-span-1 row-span-1', aspect: 'aspect-square' },
  { col: 'col-span-1 row-span-1', aspect: 'aspect-square' },
];

const CategoryCard: React.FC<{
  cat: { name: string; img: string; accent: string; emoji: string };
  isHero?: boolean;
  onClick: () => void;
  index: number;
}> = ({ cat, isHero = false, onClick, index }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.35), ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative overflow-hidden rounded-2xl bg-foreground/[0.04] w-full h-full text-left"
    >
      {/* Image */}
      <motion.img
        src={cat.img}
        alt={cat.name}
        animate={{ scale: hovered ? 1.07 : 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
        decoding="async"
      />

      {/* Gradient — dynamic accent color on hover */}
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{
          background: hovered
            ? `linear-gradient(to top, ${cat.accent}CC 0%, ${cat.accent}22 50%, transparent 100%)`
            : 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.1) 100%)',
        }}
      />

      {/* Content */}
      <div className="absolute inset-0 p-4 md:p-5 flex flex-col justify-end">
        {/* Emoji chip — hero only */}
        {isHero && (
          <motion.span
            animate={{ y: hovered ? -4 : 0 }}
            transition={{ duration: 0.35 }}
            className="mb-3 text-3xl select-none"
          >
            {cat.emoji}
          </motion.span>
        )}

        <motion.h3
          animate={{ y: hovered ? -2 : 0 }}
          transition={{ duration: 0.35 }}
          className={`font-sans font-bold text-white leading-tight tracking-tight ${
            isHero ? 'text-2xl md:text-3xl' : 'text-base md:text-lg'
          }`}
        >
          {cat.name}
        </motion.h3>

        {/* "Shop →" reveal on hover */}
        <motion.div
          animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 6 }}
          transition={{ duration: 0.25 }}
          className="flex items-center gap-1 mt-1.5 text-white/80 text-xs font-semibold"
        >
          Shop now <ArrowRight className="w-3 h-3 stroke-[2.5]" />
        </motion.div>
      </div>
    </motion.button>
  );
};

export const CategoryStrip: React.FC = () => {
  const navigate = useNavigate();
  const { categories: liveCategories } = useAppState();

  const displayCategories = React.useMemo(() => {
    const base = liveCategories?.filter(c => c.is_active !== false).slice(0, 9) || [];
    if (base.length > 0) {
      return base.map(c => ({
        name: c.name,
        img: CATEGORIES.find(fc => fc.name === c.name)?.img || c.image_url || CATEGORIES[0].img,
        accent: CATEGORIES.find(fc => fc.name === c.name)?.accent || '#10b981',
        emoji: CATEGORIES.find(fc => fc.name === c.name)?.emoji || '🛍️',
      }));
    }
    return CATEGORIES.slice(0, 9);
  }, [liveCategories]);

  return (
    <section className="pt-14 md:pt-20 pb-2">
      {/* Section header */}
      <div className="container mx-auto px-5 md:px-8 mb-6 md:mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/40 mb-2">
            Explore
          </p>
          <h2 className="font-sans text-2xl md:text-[2rem] font-bold tracking-tight text-foreground leading-tight">
            Browse by category
          </h2>
          <p className="hidden md:block mt-1.5 text-sm text-foreground/50 max-w-sm">
            From Tanzanian crafts to everyday essentials — curated collections.
          </p>
        </div>
        <button
          onClick={() => navigate('/categories')}
          className="group flex items-center gap-1.5 text-sm font-bold text-foreground/60 hover:text-foreground flex-shrink-0 transition-colors"
        >
          View all
          <ArrowRight className="w-4 h-4 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* MOBILE: horizontal snap scroll */}
      <div className="md:hidden overflow-x-auto no-scrollbar pl-5 -mr-5">
        <div className="flex gap-3 pr-5 snap-x snap-mandatory">
          {displayCategories.map((cat, i) => (
            <motion.button
              key={cat.name}
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3) }}
              onClick={() => navigate(`/shop?category=${encodeURIComponent(cat.name)}`)}
              className="group flex-shrink-0 w-[140px] snap-start"
            >
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-foreground/[0.04]">
                <img
                  src={cat.img}
                  alt={cat.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-active:scale-105"
                  loading="lazy"
                  decoding="async"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(to top, ${cat.accent}CC 0%, transparent 60%)` }}
                />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="text-xl mb-0.5 select-none">{cat.emoji}</p>
                  <h3 className="font-sans font-bold text-white text-sm leading-tight line-clamp-2">
                    {cat.name}
                  </h3>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* DESKTOP: Bento grid */}
      <div className="hidden md:grid container mx-auto px-8 gap-3" style={{
        gridTemplateColumns: 'repeat(5, 1fr)',
        gridTemplateRows: 'repeat(2, 200px)',
        gridAutoRows: '200px',
      }}>
        {displayCategories.slice(0, 9).map((cat, i) => {
          const slot = BENTO_LAYOUT[i] || BENTO_LAYOUT[BENTO_LAYOUT.length - 1];
          return (
            <div key={cat.name} className={slot.col}>
              <CategoryCard
                cat={cat}
                isHero={i === 0}
                onClick={() => navigate(`/shop?category=${encodeURIComponent(cat.name)}`)}
                index={i}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
};
