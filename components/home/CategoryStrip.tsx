import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { useAppState } from '../../context/AppContext';

/**
 * CategoryStrip — Magazine editorial layout.
 *
 * Desktop: Asymmetric 12-col grid. First category spans 5 cols tall (hero),
 * second spans 4 cols medium, rest fill a 3-col right rail as compact rows.
 * Hover: image zooms, category name slides up, accent color sweeps in.
 *
 * Mobile: horizontal pill-style chips with floating category images above.
 *
 * Images: carefully matched to real DB category names.
 * Counts: computed live from products[].
 */

// Matched to REAL DB category names
const CAT_META: Record<string, { img: string; color: string; textColor: string }> = {
  'Fashion':           { img: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&q=80&w=900', color: '#e879a0', textColor: '#fff' },
  'Beauty':            { img: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=900', color: '#f472b6', textColor: '#fff' },
  'Health & Beauty':   { img: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=900', color: '#fb7185', textColor: '#fff' },
  'Electronics':       { img: 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?auto=format&fit=crop&q=80&w=900', color: '#38bdf8', textColor: '#fff' },
  'Food & Groceries':  { img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=900', color: '#fb923c', textColor: '#fff' },
  'Food & Spices':     { img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=900', color: '#f59e0b', textColor: '#fff' },
  'Home & Living':     { img: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&q=80&w=900', color: '#34d399', textColor: '#fff' },
  'Crafts & Art':      { img: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&q=80&w=900', color: '#a78bfa', textColor: '#fff' },
  'Agriculture':       { img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=900', color: '#4ade80', textColor: '#fff' },
  'Books':             { img: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=900', color: '#60a5fa', textColor: '#fff' },
  'Books & Education': { img: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=900', color: '#818cf8', textColor: '#fff' },
  'Sports':            { img: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=900', color: '#f97316', textColor: '#fff' },
  'Sports & Outdoors': { img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=900', color: '#22d3ee', textColor: '#fff' },
  'Toys & Kids':       { img: 'https://images.unsplash.com/photo-1558877385-8c1cee71006d?auto=format&fit=crop&q=80&w=900', color: '#f43f5e', textColor: '#fff' },
  'Vehicles & Parts':  { img: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=900', color: '#64748b', textColor: '#fff' },
  'Services':          { img: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&q=80&w=900', color: '#0ea5e9', textColor: '#fff' },
  // legacy fallbacks
  'Fashion & Beauty':  { img: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&q=80&w=900', color: '#e879a0', textColor: '#fff' },
  'Handicrafts':       { img: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&q=80&w=900', color: '#a78bfa', textColor: '#fff' },
  'Pantry & Spices':   { img: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=900', color: '#f59e0b', textColor: '#fff' },
  // aliases matching constants.ts CATEGORY_HIERARCHY / geminiService.ts naming
  'Construction':          { img: 'https://images.unsplash.com/photo-1541976590-713941681591?auto=format&fit=crop&q=80&w=900', color: '#eab308', textColor: '#fff' },
  'Construction & Hardware': { img: 'https://images.unsplash.com/photo-1541976590-713941681591?auto=format&fit=crop&q=80&w=900', color: '#eab308', textColor: '#fff' },
  'Vehicles':              { img: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=900', color: '#64748b', textColor: '#fff' },
  'Kids & Toys':           { img: 'https://images.unsplash.com/photo-1558877385-8c1cee71006d?auto=format&fit=crop&q=80&w=900', color: '#f43f5e', textColor: '#fff' },
  'Books & Stationery':    { img: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=900', color: '#60a5fa', textColor: '#fff' },
  'Food & Pantry':         { img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=900', color: '#fb923c', textColor: '#fff' },
  'Handicrafts & Products': { img: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&q=80&w=900', color: '#a78bfa', textColor: '#fff' },
};

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=900';
const FALLBACK_COLOR = '#10b981';

// ─── Hero card (large, col-span-5) ──────────────────────────────────────────
const HeroCategoryCard: React.FC<{
  name: string; img: string; color: string; count?: number; onClick: () => void;
}> = ({ name, img, color, count, onClick }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 100, damping: 20 });
  const sy = useSpring(y, { stiffness: 100, damping: 20 });
  const rotateX = useTransform(sy, [-0.5, 0.5], [4, -4]);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-4, 4]);
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      ref={ref}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', minHeight: '380px' }}
      onMouseMove={e => {
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width - 0.5);
        y.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { x.set(0); y.set(0); setHovered(false); }}
      onClick={onClick}
      className="group relative w-full h-full rounded-3xl overflow-hidden text-left cursor-pointer"
    >
      {/* Image */}
      <motion.img
        src={img} alt={name}
        animate={{ scale: hovered ? 1.06 : 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy" decoding="async"
      />

      {/* Layered gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: hovered ? 0.35 : 0 }}
        transition={{ duration: 0.4 }}
        style={{ background: `linear-gradient(135deg, ${color}88 0%, transparent 60%)` }}
      />

      {/* Category label top-left */}
      <div className="absolute top-5 left-5">
        <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white/70 border border-white/20 backdrop-blur-sm">
          Category
        </span>
      </div>

      {/* Count top-right */}
      {count != null && count > 0 && (
        <div className="absolute top-5 right-5">
          <span className="text-[10px] font-bold text-white/75">{count} products</span>
        </div>
      )}

      {/* Bottom content */}
      <div className="absolute inset-x-0 bottom-0 p-6">
        <motion.h3
          animate={{ y: hovered ? -4 : 0 }}
          transition={{ duration: 0.35 }}
          className="font-bold text-white text-3xl leading-tight tracking-tight mb-3"
        >
          {name}
        </motion.h3>
        <motion.div
          animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 8 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2 text-sm font-bold text-white/80"
        >
          Shop now <ArrowRight className="w-4 h-4" />
        </motion.div>
      </div>

      {/* Corner arrow */}
      <motion.div
        animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1 : 0.7 }}
        transition={{ duration: 0.25 }}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"
      >
        <ArrowUpRight className="w-4 h-4 text-white" />
      </motion.div>
    </motion.button>
  );
};

// ─── Medium card (col-span-4) ────────────────────────────────────────────────
const MediumCategoryCard: React.FC<{
  name: string; img: string; color: string; count?: number; onClick: () => void;
}> = ({ name, img, color, count, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      className="group relative w-full h-full rounded-2xl overflow-hidden text-left cursor-pointer"
      style={{ minHeight: '180px' }}
    >
      <motion.img
        src={img} alt={name}
        animate={{ scale: hovered ? 1.07 : 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy" decoding="async"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: hovered ? 0.4 : 0 }}
        style={{ background: `linear-gradient(to top, ${color}99, transparent)` }}
      />
      <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between">
        <div>
          <motion.h3
            animate={{ y: hovered ? -2 : 0 }}
            className="font-bold text-white text-lg leading-tight tracking-tight"
          >
            {name}
          </motion.h3>
          {count != null && count > 0 && (
            <p className="text-[10px] text-white/75 mt-0.5">{count} products</p>
          )}
        </div>
        <motion.div
          animate={{ opacity: hovered ? 1 : 0, x: hovered ? 0 : 6 }}
          className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0"
        >
          <ArrowUpRight className="w-3.5 h-3.5 text-white" />
        </motion.div>
      </div>
    </motion.button>
  );
};

// ─── Compact row card (right rail) ───────────────────────────────────────────
const CompactCategoryCard: React.FC<{
  name: string; img: string; color: string; count?: number; onClick: () => void;
}> = ({ name, img, color, count, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      className="group relative w-full rounded-xl overflow-hidden text-left cursor-pointer flex items-center gap-0"
      style={{ height: '72px' }}
    >
      {/* Image strip */}
      <div className="relative w-20 h-full flex-shrink-0 overflow-hidden">
        <motion.img
          src={img} alt={name}
          animate={{ scale: hovered ? 1.1 : 1 }}
          transition={{ duration: 0.5 }}
          className="w-full h-full object-cover"
          loading="lazy" decoding="async"
        />
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: hovered ? 0.5 : 0.15 }}
          style={{ background: color }}
        />
      </div>

      {/* Label */}
      <div
        className="flex-1 h-full flex items-center justify-between px-3 transition-colors duration-300"
        style={{ background: hovered ? `${color}18` : 'rgba(0,0,0,0.02)' }}
      >
        <div>
          <p className="text-sm font-bold text-foreground leading-tight">{name}</p>
          {count != null && count > 0 && (
            <p className="text-[10px] text-foreground/55 mt-0.5">{count} items</p>
          )}
        </div>
        <motion.div
          animate={{ x: hovered ? 0 : 4, opacity: hovered ? 1 : 0.3 }}
          className="w-6 h-6 rounded-full border border-foreground/15 flex items-center justify-center flex-shrink-0"
        >
          <ArrowRight className="w-3 h-3 text-foreground/60" />
        </motion.div>
      </div>
    </motion.button>
  );
};

// ─── Mobile pill card ─────────────────────────────────────────────────────────
const MobileCategoryCard: React.FC<{
  name: string; img: string; color: string; count?: number; onClick: () => void; index: number;
}> = ({ name, img, color, count, onClick, index }) => (
  <motion.button
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.28) }}
    onClick={onClick}
    className="group flex-shrink-0 w-32 snap-start text-left"
  >
    <div className="relative w-32 h-40 rounded-2xl overflow-hidden">
      <img src={img} alt={name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-active:scale-105" loading="lazy" decoding="async" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
      <motion.div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${color}88, transparent)` }} />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="font-bold text-white text-xs leading-tight line-clamp-2">{name}</p>
        {count != null && count > 0 && <p className="text-[9px] text-white/75 mt-0.5">{count}</p>}
      </div>
    </div>
  </motion.button>
);

// ─── Main export ──────────────────────────────────────────────────────────────
export const CategoryStrip: React.FC = () => {
  const navigate = useNavigate();
  const { categories: liveCategories, products } = useAppState();

  const displayCategories = React.useMemo(() => {
    const base = (liveCategories?.filter(c => c.is_active !== false) || []);
    const names = base.length > 0 ? base.map(c => c.name) : Object.keys(CAT_META);
    return names.slice(0, 10).map(name => ({
      name,
      img: CAT_META[name]?.img || FALLBACK_IMG,
      color: CAT_META[name]?.color || FALLBACK_COLOR,
    }));
  }, [liveCategories]);

  const countByCategory = React.useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => {
      if ((p as any).status === 'inactive') return;
      const cat = (p as any).category;
      if (cat) map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  }, [products]);

  const go = (name: string) => navigate(`/shop?category=${encodeURIComponent(name)}`);

  const [hero, medium, ...rest] = displayCategories;
  const compact = rest.slice(0, 5);

  return (
    <section className="pt-14 md:pt-20 pb-2">
      {/* Header */}
      <div className="container mx-auto px-4 md:px-8 mb-6 md:mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/55 mb-2">Explore</p>
          <h2 className="font-sans text-2xl md:text-[2rem] font-bold tracking-tight text-foreground">
            Browse by category
          </h2>
        </div>
        <button onClick={() => navigate('/categories')}
          className="group flex items-center gap-1.5 text-sm font-bold text-foreground/50 hover:text-foreground transition-colors flex-shrink-0">
          All categories
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Mobile */}
      <div className="md:hidden overflow-x-auto no-scrollbar pl-4 -mr-4">
        <div className="flex gap-3 pr-4 snap-x snap-mandatory">
          {displayCategories.map((c, i) => (
            <MobileCategoryCard key={c.name} {...c} count={countByCategory[c.name]} onClick={() => go(c.name)} index={i} />
          ))}
        </div>
      </div>

      {/* Desktop: asymmetric bento */}
      <div className="hidden md:grid container mx-auto px-8 gap-3" style={{ gridTemplateColumns: '5fr 4fr 3fr', gridTemplateRows: 'auto', minHeight: '380px' }}>
        {/* Hero — left tall */}
        {hero && (
          <div style={{ gridRow: '1 / 3' }}>
            <HeroCategoryCard {...hero} count={countByCategory[hero.name]} onClick={() => go(hero.name)} />
          </div>
        )}

        {/* Medium — top centre */}
        {medium && (
          <div style={{ gridRow: '1 / 2' }}>
            <MediumCategoryCard {...medium} count={countByCategory[medium.name]} onClick={() => go(medium.name)} />
          </div>
        )}

        {/* Compact stack — right rail, all rows */}
        <div className="flex flex-col gap-2" style={{ gridRow: '1 / 3', gridColumn: '3' }}>
          {compact.map(c => (
            <CompactCategoryCard key={c.name} {...c} count={countByCategory[c.name]} onClick={() => go(c.name)} />
          ))}
        </div>

        {/* Third cat — bottom centre, spans below medium */}
        {displayCategories[2] && (
          <div style={{ gridRow: '2 / 3', gridColumn: '2' }}>
            <MediumCategoryCard
              {...displayCategories[2]}
              count={countByCategory[displayCategories[2].name]}
              onClick={() => go(displayCategories[2].name)}
            />
          </div>
        )}
      </div>
    </section>
  );
};
