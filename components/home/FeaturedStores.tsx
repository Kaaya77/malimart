import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, MapPin, Star, ShieldCheck, Package, Heart } from 'lucide-react';
import { VendorProfile } from '../../types';
import { VerifiedBadge } from '../UI';
import { useAppState } from '../../context/AppContext';

interface FeaturedStoresProps {
  topShops: VendorProfile[];
  setActiveStore: (s: VendorProfile) => void;
  navigate: (p: string) => void;
}

/**
 * FeaturedStores — Redesigned.
 *
 * Works beautifully even when sellers have no banner/logo images.
 *
 * Desktop: Horizontal scroll of tall store "cards" — each one is a
 *   full editorial panel with a generated gradient identity (based on store name),
 *   avatar initials, store stats, and a "Visit Store →" CTA.
 *   First card is a wide hero. Rest are uniform.
 *
 * Mobile: Vertical list of compact horizontal cards.
 *
 * No fake data. Every field shown only if it exists on the vendor profile.
 */

// Deterministic gradient per store name
const STORE_GRADIENTS = [
  ['#10b981', '#059669'],
  ['#6366f1', '#4f46e5'],
  ['#f59e0b', '#d97706'],
  ['#ec4899', '#db2777'],
  ['#14b8a6', '#0d9488'],
  ['#8b5cf6', '#7c3aed'],
  ['#f97316', '#ea580c'],
  ['#06b6d4', '#0891b2'],
];

function getGradient(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const pair = STORE_GRADIENTS[Math.abs(hash) % STORE_GRADIENTS.length];
  return [pair[0], pair[1]];
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Large hero store card ────────────────────────────────────────────────────
const HeroStoreCard: React.FC<{
  shop: VendorProfile; productCount: number; onClick: () => void;
}> = ({ shop, productCount, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const name = shop.store_name || 'Store';
  const [c1, c2] = getGradient(name);
  const hasBanner = !!(shop as any).banner_url;
  const hasLogo = !!(shop as any).logo_url;
  const region = (shop as any).region;
  const rating = (shop as any).rating;
  const description = (shop as any).description;

  return (
    <motion.button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      className="group relative flex-shrink-0 text-left rounded-3xl overflow-hidden cursor-pointer"
      style={{ width: '340px', height: '420px' }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Background: banner or gradient */}
      {hasBanner ? (
        <>
          <motion.img
            src={(shop as any).banner_url}
            alt=""
            animate={{ scale: hovered ? 1.05 : 1 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}
        />
      )}

      {/* Decorative pattern when no banner */}
      {!hasBanner && (
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `radial-gradient(circle at 20% 80%, white 1px, transparent 1px),
                           radial-gradient(circle at 80% 20%, white 1px, transparent 1px),
                           radial-gradient(circle at 50% 50%, white 0.5px, transparent 0.5px)`,
          backgroundSize: '40px 40px, 60px 60px, 20px 20px',
        }} />
      )}

      {/* Verified badge */}
      {(shop as any).is_verified && (
        <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
          <ShieldCheck className="w-3 h-3 text-white" />
          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white">Verified</span>
        </div>
      )}

      {/* Content */}
      <div className="absolute inset-x-0 bottom-0 p-6">
        {/* Logo / initials */}
        <div className="w-14 h-14 rounded-2xl overflow-hidden mb-4 ring-2 ring-white/30 flex items-center justify-center"
          style={{ background: hasBanner ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)' }}>
          {hasLogo ? (
            <img src={(shop as any).logo_url} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl font-black text-white">{getInitials(name)}</span>
          )}
        </div>

        <h3 className="font-bold text-white text-xl leading-tight tracking-tight mb-1">{name}</h3>

        {description && (
          <p className="text-sm text-white/60 line-clamp-2 mb-3">{description}</p>
        )}

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {region && (
            <span className="flex items-center gap-1 text-[11px] text-white/60">
              <MapPin className="w-3 h-3" />{region}
            </span>
          )}
          {rating != null && (
            <span className="flex items-center gap-1 text-[11px] text-white/70 font-semibold">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {Number(rating).toFixed(1)}
            </span>
          )}
          {productCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-white/60">
              <Package className="w-3 h-3" />{productCount} products
            </span>
          )}
        </div>

        <motion.div
          animate={{ opacity: hovered ? 1 : 0.7, x: hovered ? 4 : 0 }}
          className="flex items-center gap-2 text-sm font-bold text-white"
        >
          Visit store <ArrowRight className="w-4 h-4" />
        </motion.div>
      </div>
    </motion.button>
  );
};

// ─── Standard store card ──────────────────────────────────────────────────────
const StoreCard: React.FC<{
  shop: VendorProfile; productCount: number; onClick: () => void; index: number;
  isFollowed: boolean; onFollow: (e: React.MouseEvent) => void;
}> = ({ shop, productCount, onClick, index, isFollowed, onFollow }) => {
  const [hovered, setHovered] = useState(false);
  const name = shop.store_name || 'Store';
  const [c1, c2] = getGradient(name);
  const hasLogo = !!(shop as any).logo_url;
  const region = (shop as any).region;
  const rating = (shop as any).rating;

  return (
    <motion.div
      role="button"
      tabIndex={0}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      whileHover={{ y: -3 }}
      className="group flex-shrink-0 relative text-left rounded-2xl overflow-hidden cursor-pointer border border-foreground/8 hover:border-foreground/20 transition-all"
      style={{ width: '220px', height: '280px' }}
    >
      {/* Top: gradient identity panel */}
      <div className="relative h-28 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}>
        {/* Pattern */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)`,
          backgroundSize: '12px 12px',
        }} />
        {(shop as any).banner_url && (
          <img src={(shop as any).banner_url} alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-40" />
        )}
        {(shop as any).is_verified && (
          <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-white/30 flex items-center justify-center">
            <ShieldCheck className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 bg-background relative">
        {/* Logo overlapping */}
        <div className="absolute -top-7 left-4 w-12 h-12 rounded-xl overflow-hidden ring-2 ring-background flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
          {hasLogo ? (
            <img src={(shop as any).logo_url} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-black text-white">{getInitials(name)}</span>
          )}
        </div>

        <div className="mt-6">
          <h3 className="font-bold text-foreground text-sm leading-tight truncate">{name}</h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {region && (
              <span className="flex items-center gap-0.5 text-[10px] text-foreground/45 truncate">
                <MapPin className="w-2.5 h-2.5" />{region}
              </span>
            )}
            {rating != null && (
              <span className="flex items-center gap-0.5 text-[10px] text-foreground/60 font-semibold">
                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                {Number(rating).toFixed(1)}
              </span>
            )}
          </div>
          {productCount > 0 && (
            <p className="text-[10px] text-foreground/40 mt-1">{productCount} products</p>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <motion.div
            animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 4 }}
            className="flex items-center gap-1 text-[11px] font-bold text-foreground/60"
          >
            Visit <ArrowUpRight className="w-3 h-3" />
          </motion.div>
          <button
            onClick={onFollow}
            // TOUCH TARGET: 28px visually; `relative` + a transparent 8px
            // ::before ring takes the real tap area to 44px. `relative` is
            // required here (unlike the product card) because this button is
            // a static flex child, so it is not otherwise a containing block.
            className={`relative w-7 h-7 rounded-full flex items-center justify-center transition-colors active:scale-90
            before:absolute before:-inset-2 before:content-[''] before:rounded-full
            ${isFollowed ? 'bg-rose-500/10 text-rose-500' : 'bg-foreground/[0.06] text-foreground/35 hover:text-rose-400'}`}
            aria-label={isFollowed ? 'Unfollow' : 'Follow'}
          >
            <Heart className={`w-3.5 h-3.5 stroke-[2.5] ${isFollowed ? 'fill-current stroke-none' : ''}`} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Mobile compact card ──────────────────────────────────────────────────────
const MobileStoreCard: React.FC<{
  shop: VendorProfile; productCount: number; onClick: () => void; index: number; isHero?: boolean;
  isFollowed: boolean; onFollow: (e: React.MouseEvent) => void;
}> = ({ shop, productCount, onClick, index, isHero, isFollowed, onFollow }) => {
  const name = shop.store_name || 'Store';
  const [c1, c2] = getGradient(name);
  const hasLogo = !!(shop as any).logo_url;
  const region = (shop as any).region;
  const rating = (shop as any).rating;

  return (
    <motion.div
      role="button"
      tabIndex={0}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="flex items-center gap-3 p-3 rounded-2xl bg-foreground/[0.03] border border-foreground/8 active:scale-[0.98] transition-all text-left w-full cursor-pointer"
    >
      {/* Logo */}
      <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
        {hasLogo ? (
          <img src={(shop as any).logo_url} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-base font-black text-white">{getInitials(name)}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-bold text-sm text-foreground truncate">{name}</p>
          {(shop as any).is_verified && <VerifiedBadge iconOnly className="w-3 h-3" />}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {region && <span className="text-[10px] text-foreground/45">{region}</span>}
          {rating != null && (
            <span className="flex items-center gap-0.5 text-[10px] text-foreground/60">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
              {Number(rating).toFixed(1)}
            </span>
          )}
          {productCount > 0 && <span className="text-[10px] text-foreground/35">{productCount} products</span>}
        </div>
      </div>

      <button
        onClick={onFollow}
        // TOUCH TARGET: 32px visually -> 44px tap area. See the note above.
        className={`relative w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors active:scale-90
        before:absolute before:-inset-1.5 before:content-[''] before:rounded-full
        ${isFollowed ? 'bg-rose-500/10 text-rose-500' : 'text-foreground/25 hover:text-rose-400'}`}
        aria-label={isFollowed ? 'Unfollow' : 'Follow'}
      >
        <Heart className={`w-4 h-4 stroke-[2.5] ${isFollowed ? 'fill-current stroke-none' : ''}`} />
      </button>
    </motion.div>
  );
};

// ─── Main export ──────────────────────────────────────────────────────────────
export const FeaturedStores: React.FC<FeaturedStoresProps> = ({ topShops, setActiveStore, navigate }) => {
  const { products, followSeller, unfollowSeller, isFollowing } = useAppState();

  const productCountByseller = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => {
      if ((p as any).status === 'inactive') return;
      const sid = (p as any).seller_id;
      if (sid) map[sid] = (map[sid] || 0) + 1;
    });
    return map;
  }, [products]);

  if (!topShops || topShops.length === 0) return null;

  const [hero, ...rest] = topShops.slice(0, 7);

  return (
    <section className="py-10 md:py-16">
      <div className="container mx-auto px-4 md:px-8 mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/35 mb-2">Sellers</p>
          <h2 className="font-sans text-2xl md:text-[2rem] font-bold tracking-tight text-foreground">
            Featured stores
          </h2>
        </div>
        <button onClick={() => navigate('/shop')}
          className="group flex items-center gap-1.5 text-sm font-bold text-foreground/50 hover:text-foreground transition-colors flex-shrink-0">
          Browse all <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Mobile: vertical list */}
      <div className="md:hidden px-4 space-y-2">
        {topShops.slice(0, 5).map((s, i) => (
          <MobileStoreCard
            key={s.seller_id}
            shop={s}
            productCount={productCountByseller[s.seller_id] || 0}
            onClick={() => setActiveStore(s)}
            index={i}
            isFollowed={isFollowing(s.seller_id)}
            onFollow={(e) => { e.stopPropagation(); isFollowing(s.seller_id) ? unfollowSeller(s.seller_id) : followSeller(s.seller_id); }}
          />
        ))}
      </div>

      {/* Desktop: horizontal scroll with hero first */}
      <div className="hidden md:flex gap-4 overflow-x-auto no-scrollbar pl-8 pr-8">
        {hero && (
          <HeroStoreCard
            shop={hero}
            productCount={productCountByseller[hero.seller_id] || 0}
            onClick={() => setActiveStore(hero)}
          />
        )}
        {rest.map((s, i) => (
          <StoreCard
            key={s.seller_id}
            shop={s}
            productCount={productCountByseller[s.seller_id] || 0}
            onClick={() => setActiveStore(s)}
            index={i}
            isFollowed={isFollowing(s.seller_id)}
            onFollow={(e) => { e.stopPropagation(); isFollowing(s.seller_id) ? unfollowSeller(s.seller_id) : followSeller(s.seller_id); }}
          />
        ))}
      </div>
    </section>
  );
};
