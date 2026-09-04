import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, ArrowUpRight, Tag, Shirt, Sparkles, HeartPulse, Cpu,
  ShoppingBasket, Soup, Sofa, Palette, Sprout, BookOpen, Dumbbell,
  ToyBrick, Car, Wrench, HardHat,
} from 'lucide-react';
import { useAppState } from '../../context/AppContext';

/**
 * CategoryStrip — Browse by category.
 *
 * Was a photographic magazine-bento (3D tilt hero card, medium cards, a
 * compact rail) with a hand-maintained map of Unsplash URLs per category name
 * — brittle (a renamed/new category silently falls through to a stock
 * fallback photo) and heavy (nine external images on every home load).
 *
 * Replaced with one flat, icon-led tile grid: solid colour, one glyph, name
 * and count. No network image at all, and — because it's one responsive grid
 * instead of a desktop bento plus a separate mobile rail — one render path
 * instead of two. The colour-per-category identity carries over from the old
 * map; only the photography is gone.
 */

const CAT_META: Record<string, { icon: React.ElementType; color: string }> = {
  'Fashion':                 { icon: Shirt, color: '#e879a0' },
  'Fashion & Beauty':        { icon: Shirt, color: '#e879a0' },
  'Beauty':                  { icon: Sparkles, color: '#f472b6' },
  'Health & Beauty':         { icon: HeartPulse, color: '#fb7185' },
  'Electronics':             { icon: Cpu, color: '#38bdf8' },
  'Food & Groceries':        { icon: ShoppingBasket, color: '#fb923c' },
  'Food & Pantry':           { icon: ShoppingBasket, color: '#fb923c' },
  'Pantry & Spices':         { icon: Soup, color: '#f59e0b' },
  'Food & Spices':           { icon: Soup, color: '#f59e0b' },
  'Home & Living':           { icon: Sofa, color: '#34d399' },
  'Crafts & Art':            { icon: Palette, color: '#a78bfa' },
  'Handicrafts':             { icon: Palette, color: '#a78bfa' },
  'Handicrafts & Products':  { icon: Palette, color: '#a78bfa' },
  'Agriculture':             { icon: Sprout, color: '#4ade80' },
  'Books':                   { icon: BookOpen, color: '#60a5fa' },
  'Books & Education':       { icon: BookOpen, color: '#818cf8' },
  'Books & Stationery':      { icon: BookOpen, color: '#60a5fa' },
  'Sports':                  { icon: Dumbbell, color: '#f97316' },
  'Sports & Outdoors':       { icon: Dumbbell, color: '#22d3ee' },
  'Toys & Kids':             { icon: ToyBrick, color: '#f43f5e' },
  'Kids & Toys':             { icon: ToyBrick, color: '#f43f5e' },
  'Vehicles & Parts':        { icon: Car, color: '#64748b' },
  'Vehicles':                { icon: Car, color: '#64748b' },
  'Services':                { icon: Wrench, color: '#0ea5e9' },
  'Construction':            { icon: HardHat, color: '#eab308' },
  'Construction & Hardware': { icon: HardHat, color: '#eab308' },
};

const FALLBACK = { icon: Tag, color: '#10b981' };

const CategoryTile: React.FC<{
  name: string; icon: React.ElementType; color: string; count?: number; onClick: () => void; index: number;
}> = ({ name, icon: Icon, color, count, onClick, index }) => (
  <motion.button
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.24) }}
    onClick={onClick}
    className="group relative flex flex-col justify-between text-left rounded-3xl p-4 md:p-5 aspect-square sm:aspect-[4/3] transition-colors overflow-hidden"
    style={{ background: `${color}14` }}
  >
    <span
      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      style={{ background: `${color}22` }}
      aria-hidden="true"
    />
    <span
      className="relative w-10 h-10 md:w-11 md:h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-105"
      style={{ background: color }}
    >
      <Icon className="w-5 h-5 md:w-[22px] md:h-[22px] text-white" strokeWidth={2} />
    </span>
    <span className="relative">
      <span className="flex items-center gap-1.5">
        <span className="font-bold text-foreground text-sm md:text-base leading-tight">{name}</span>
        <ArrowUpRight aria-hidden="true" className="w-3.5 h-3.5 text-foreground/0 group-hover:text-foreground/50 -translate-x-1 group-hover:translate-x-0 transition-all duration-300 shrink-0" />
      </span>
      {count != null && count > 0 && (
        <span className="block text-[11px] font-semibold text-foreground/45 mt-0.5">{count} products</span>
      )}
    </span>
  </motion.button>
);

export const CategoryStrip: React.FC = () => {
  const navigate = useNavigate();
  const { categories: liveCategories, products } = useAppState();

  const displayCategories = React.useMemo(() => {
    const base = (liveCategories?.filter(c => c.is_active !== false) || []);
    const names = base.length > 0 ? base.map(c => c.name) : Object.keys(CAT_META);
    return names.slice(0, 10).map(name => ({
      name,
      icon: CAT_META[name]?.icon || FALLBACK.icon,
      color: CAT_META[name]?.color || FALLBACK.color,
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

  return (
    <section className="pt-14 md:pt-20 pb-2">
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

      <div className="container mx-auto px-4 md:px-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
        {displayCategories.map((c, i) => (
          <CategoryTile
            key={c.name}
            name={c.name}
            icon={c.icon}
            color={c.color}
            count={countByCategory[c.name]}
            onClick={() => go(c.name)}
            index={i}
          />
        ))}
      </div>
    </section>
  );
};
