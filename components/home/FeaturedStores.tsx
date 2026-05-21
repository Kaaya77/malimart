import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Star } from 'lucide-react';
import { VerifiedBadge } from '../UI';
import { VendorProfile } from '../../types';

interface FeaturedStoresProps {
  topShops: VendorProfile[];
  setActiveStore: (s: VendorProfile) => void;
  navigate: (p: string) => void;
}

/**
 * Featured stores.
 *
 * Mobile: horizontal snap-scroll, store cards 220px wide.
 * Desktop: 4-column grid.
 *
 * Each card: vendor avatar + name + verified pill + region + rating + product count.
 * Tap = open the StoreModal (passed down from HomePage).
 */
export const FeaturedStores: React.FC<FeaturedStoresProps> = ({
  topShops,
  setActiveStore,
  navigate,
}) => {
  if (!topShops || topShops.length === 0) return null;

  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-5 md:px-8 mb-5 md:mb-7 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-sans text-xl md:text-[28px] font-semibold tracking-tight text-foreground leading-tight">
            Featured sellers
          </h2>
          <p className="hidden md:block mt-1 text-sm text-foreground/55 font-medium">
            Verified shops trusted by buyers across Tanzania.
          </p>
        </div>
        <button
          onClick={() => navigate('/shop')}
          className="text-sm font-semibold text-foreground/70 hover:text-foreground flex items-center gap-1 group"
        >
          All
          <ArrowRight className="w-4 h-4 stroke-[2.2] group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Mobile: horizontal snap scroll */}
      <div className="md:hidden overflow-x-auto no-scrollbar pl-5 -mr-5">
        <div className="flex gap-3 pr-5 snap-x snap-mandatory">
          {topShops.slice(0, 8).map((s, i) => (
            <StoreCard
              key={s.seller_id}
              shop={s}
              i={i}
              onClick={() => setActiveStore(s)}
              wide
            />
          ))}
        </div>
      </div>

      {/* Desktop: 4-col grid */}
      <div className="hidden md:grid container mx-auto px-8 grid-cols-4 gap-4">
        {topShops.slice(0, 4).map((s, i) => (
          <StoreCard key={s.seller_id} shop={s} i={i} onClick={() => setActiveStore(s)} />
        ))}
      </div>
    </section>
  );
};

const StoreCard: React.FC<{
  shop: VendorProfile;
  i: number;
  onClick: () => void;
  wide?: boolean;
}> = ({ shop, i, onClick, wide }) => {
  const avatar = (shop as any).avatar_url || (shop as any).logo_url;
  const cover = (shop as any).cover_url || (shop as any).banner_url;
  const region = (shop as any).region || (shop as any).location;
  const rating = (shop as any).rating;
  const productCount = (shop as any).product_count;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3) }}
      onClick={onClick}
      className={`group relative text-left rounded-2xl overflow-hidden ring-1 ring-foreground/8 bg-foreground/[0.02] hover:ring-foreground/20 transition-all active:scale-[0.98] flex-shrink-0 ${
        wide ? 'w-[220px] snap-start' : 'w-full'
      }`}
    >
      {/* Cover */}
      <div className="relative aspect-[16/9] bg-foreground/5 overflow-hidden">
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/15 via-foreground/5 to-foreground/[0.03]" />
        )}
      </div>

      {/* Body */}
      <div className="p-4 pt-5 relative">
        {/* Avatar overlapping cover */}
        <div className="absolute -top-7 left-4 w-12 h-12 rounded-full overflow-hidden ring-3 ring-background bg-foreground/5 flex items-center justify-center">
          {avatar ? (
            <img src={avatar} alt={shop.store_name || 'Store'} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-foreground/60">
              {(shop.store_name || 'S').slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mb-1 mt-5">
          <h3 className="font-sans text-[15px] font-semibold text-foreground tracking-tight truncate">
            {shop.store_name || 'Untitled store'}
          </h3>
          {(shop as any).is_verified && (
            <VerifiedBadge className="scale-75 origin-left opacity-90 flex-shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-2.5 text-[11px] text-foreground/55">
          {rating != null && (
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-foreground/70">{Number(rating).toFixed(1)}</span>
            </span>
          )}
          {region && (
            <span className="flex items-center gap-0.5 truncate">
              <MapPin className="w-2.5 h-2.5 stroke-[2.5]" />
              <span className="truncate">{region}</span>
            </span>
          )}
          {productCount != null && (
            <span className="font-medium text-foreground/40">· {productCount} items</span>
          )}
        </div>
      </div>
    </motion.button>
  );
};
