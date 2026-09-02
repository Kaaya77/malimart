import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Star, Flame } from 'lucide-react';
import { Product } from '../../types';
import { CATEGORY_EMOJIS, TrendSubTab } from './categoryConstants';
import { formatTZS, isNewArrival } from '../../constants';

interface TrendingTabProps {
  trendingProducts: Product[];
  trendSub: TrendSubTab;
  organizedCategories: any[];
  onTrendSubChange: (sub: TrendSubTab) => void;
}

const TREND_TABS: { id: TrendSubTab; label: string }[] = [
  { id: 'hot',   label: '🔥 Hot' },
  { id: 'new',   label: '✨ New Arrivals' },
  { id: 'rated', label: '⭐ Top Rated' },
];

export const TrendingTab: React.FC<TrendingTabProps> = ({
  trendingProducts, trendSub, organizedCategories, onTrendSubChange,
}) => {
  const navigate = useNavigate();

  return (
    <motion.div key="trending" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex p-1 bg-foreground/[0.04] rounded-2xl gap-1 w-fit">
        {TREND_TABS.map(s => (
          <button key={s.id} onClick={() => onTrendSubChange(s.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${trendSub === s.id ? 'bg-background text-foreground shadow-sm' : 'text-foreground/45 hover:text-foreground/70'}`}>
            {s.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={trendSub} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-8 md:gap-x-4">
          {trendingProducts.map((p, i) => (
            <motion.button key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              onClick={() => navigate(`/product/${p.id}`)} className="text-left group">
              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-foreground/[0.04] mb-3">
                {p.images?.[0] && (
                  <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" loading="lazy" decoding="async" />
                )}
                <div className="absolute top-2 left-2">
                  {trendSub === 'hot' && (
                    <div className="flex items-center gap-1 bg-foreground text-background text-[10px] font-black px-2 py-1 rounded-full">
                      <Flame className="w-2.5 h-2.5 fill-current stroke-none text-orange-400" /> #{i + 1}
                    </div>
                  )}
                  {/* Age-gated: this pill used to render on every card in the tab,
                      so months-old stock was labelled NEW. */}
                  {trendSub === 'new' && isNewArrival((p as any).created_at) && (
                    <div className="bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded-full">NEW</div>
                  )}
                  {trendSub === 'rated' && p.rating && (
                    <div className="flex items-center gap-1 bg-amber-400 text-black text-[10px] font-black px-2 py-1 rounded-full">
                      <Star className="w-2.5 h-2.5 fill-current stroke-none" /> {p.rating.toFixed(1)}
                    </div>
                  )}
                </div>
                {trendSub !== 'rated' && p.rating && (
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/90 backdrop-blur-sm text-foreground text-[10px] font-bold px-2 py-1 rounded-full">
                    <Star className="w-2.5 h-2.5 text-amber-400 fill-current stroke-none" /> {p.rating.toFixed(1)}
                  </div>
                )}
              </div>
              <p className="font-semibold text-foreground text-sm truncate">{p.name}</p>
              <p className="text-xs text-emerald-600 font-bold mt-0.5">{formatTZS(p.price)}</p>
              {trendSub === 'new' && p.created_at && (
                <p className="text-[10px] text-foreground/35 mt-0.5">
                  {new Date(p.created_at).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short' })}
                </p>
              )}
              {trendSub !== 'new' && (p as any).review_count > 0 && (
                <p className="text-[10px] text-foreground/35 mt-0.5">{(p as any).review_count} reviews</p>
              )}
            </motion.button>
          ))}
        </motion.div>
      </AnimatePresence>

      <div className="pt-6 border-t border-foreground/8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 mb-4">Browse by category</p>
        <div className="flex flex-wrap gap-2">
          {organizedCategories.slice(0, 10).map((c: any) => (
            <Link key={c.name} to={`/shop?category=${encodeURIComponent(c.name)}`}
              className="flex items-center gap-1.5 h-9 px-4 rounded-full border border-foreground/12 text-foreground/60 text-xs font-semibold hover:border-foreground/30 hover:text-foreground hover:bg-foreground/[0.04] transition-all active:scale-95">
              {CATEGORY_EMOJIS[c.name] || ''} {c.name}
            </Link>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
