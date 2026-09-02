import { safeJsonParse } from '../../src/security';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, ShoppingBag, Star, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCatalog } from '../../context/AppContext';
import { Product } from '../../types';
import { CURRENCY } from '../../constants';

interface HeroSectionProps {
  heroRecommendation: any;
  heroFeaturedProducts?: any[];
  heroSettings: { badgeText: string; headline: string; subheadline: string };
  greeting: string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleSearch: (e: React.FormEvent) => void;
  searchPlaceholders: string[];
  currentPlaceholderIdx: number;
  containerVariants: any;
  itemVariants: any;
}

// ─── Magnetic tilt card (desktop hero) ────────────────────────────────────────
const MagneticCard: React.FC<{
  product: Product;
  badge?: string | null;
  headline?: string;
  tagline?: string;
  onClick: () => void;
}> = ({ product, badge, headline, tagline, onClick }) => {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 120, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 120, damping: 20 });
  const rotateX = useTransform(smoothY, [-0.5, 0.5], [3, -3]);
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-3, 3]);

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const img = product.images?.[0];

  return (
    <motion.div
      ref={ref}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 1000 }}
      onMouseMove={handleMouse}
      onMouseLeave={() => { mouseX.set(0); mouseY.set(0); }}
      onClick={onClick}
      className="relative group cursor-pointer w-full h-full rounded-[2rem] overflow-hidden bg-neutral-900"
    >
      <motion.div
        className="absolute inset-0"
        whileHover={{ scale: 1.04 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        {img && <img src={img} alt={product.name} className="w-full h-full object-cover" loading="eager" decoding="async" />}
      </motion.div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />

      <div className="absolute top-5 left-5 right-5 flex items-start justify-between z-10">
        {badge && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/90 text-white text-[11px] font-bold tracking-wide shadow-lg">
            <Sparkles className="w-3 h-3" />{badge}
          </span>
        )}
        {Number(product.rating) > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white text-xs font-semibold ml-auto">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            {Number(product.rating).toFixed(1)}
            {product.review_count ? <span className="text-white/50 text-[10px]">({product.review_count})</span> : null}
          </span>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-7 lg:p-9 z-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/50 mb-2">
          {(product as any).seller_name || 'Featured store'}
        </p>
        <h2 className="font-sans font-bold text-white leading-[1.0] tracking-[-0.035em] mb-3"
          style={{ fontSize: 'clamp(1.5rem, 3.5vw, 3rem)' }}>
          {headline && headline !== product.name ? headline : product.name}
        </h2>
        {tagline && (
          <p className="text-sm text-white/60 mb-5 line-clamp-2 max-w-md">{tagline}</p>
        )}
        <button className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-white text-black font-bold text-sm hover:bg-white/90 active:scale-95 transition-all shadow-xl">
          <ShoppingBag className="w-4 h-4 stroke-[2.2]" />
          {CURRENCY} {Math.round(product.price).toLocaleString()}
          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>
    </motion.div>
  );
};

// ─── Side product pill ─────────────────────────────────────────────────────────
const SideProductPill: React.FC<{
  product: Product;
  onClick: () => void;
  delay?: number;
}> = ({ product, onClick, delay = 0 }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="glass-surface group relative w-full text-left rounded-2xl overflow-hidden hover:border-foreground/25 transition-all duration-300 flex"
      style={{ minHeight: '7rem' }}
    >
      <div className="w-28 flex-shrink-0 relative overflow-hidden">
        <motion.img
          src={product.images?.[0]}
          alt={product.name}
          animate={{ scale: hovered ? 1.08 : 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="flex flex-col justify-center px-4 flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/40 mb-1 truncate">
          {(product as any).seller_name || 'Store'}
        </p>
        <h3 className="font-sans font-semibold text-sm text-foreground line-clamp-2 leading-snug tracking-tight mb-2">
          {product.name}
        </h3>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-foreground tabular-nums">
            {CURRENCY} {Math.round(product.price).toLocaleString()}
          </span>
          {Number(product.rating) > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-foreground/50">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
              {Number(product.rating).toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight className="w-4 h-4 stroke-[2.2] text-foreground/40" />
      </div>
    </motion.button>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────
export const HeroSection = ({
  heroRecommendation,
  heroFeaturedProducts = [],
  heroSettings,
  greeting,
}: HeroSectionProps) => {
  const navigate = useNavigate();
  const { products } = useCatalog();
  const [activeIdx, setActiveIdx] = useState(0);
  const dragStartX = useRef(0);

  const featuredProducts = useMemo<Product[]>(() => {
    const list: Product[] = [];
    const seen = new Set<string>();
    const pushUnique = (p: any) => {
      if (!p?.id || seen.has(p.id)) return;
      seen.add(p.id);
      list.push(p as Product);
    };
    // Only admin-approved hero recommendations populate the hero — the homepage
    // spotlight is curated, not "whatever was added most recently".
    heroFeaturedProducts.forEach(pushUnique);
    if (heroRecommendation?.products) {
      const p = heroRecommendation.products;
      pushUnique(Array.isArray(p) ? p[0] : p);
    }
    // Fallback ONLY when admins haven't curated anything yet, so a fresh
    // marketplace still shows a hero instead of an empty slot.
    if (list.length === 0) {
      products.filter(p => p.is_boosted).sort((a, b) => (b.rating || 0) - (a.rating || 0)).forEach(pushUnique);
      [...products].sort((a, b) =>
        (b.rating || 0) * (b.review_count || 0) - (a.rating || 0) * (a.review_count || 0)
      ).forEach(pushUnique);
    }
    return list.slice(0, 5);
  }, [heroFeaturedProducts, heroRecommendation, products]);

  useEffect(() => {
    if (featuredProducts.length <= 1) return;
    const t = setInterval(() => setActiveIdx(i => (i + 1) % featuredProducts.length), 7000);
    return () => clearInterval(t);
  }, [featuredProducts.length]);

  useEffect(() => { setActiveIdx(0); }, [heroFeaturedProducts.length]);

  const getAdminMeta = useCallback((idx: number) => {
    const active = featuredProducts[idx];
    const heroMeta = (active as any)?._hero;
    const badge = (() => {
      if (heroMeta?.offer_text) {
        try { return (safeJsonParse(heroMeta.offer_text, {}) as any)?.text || null; } catch { return heroMeta.offer_text || null; }
      }
      if (heroRecommendation?.offer_text) {
        try { return (safeJsonParse(heroRecommendation.offer_text, {}) as any)?.text || null; } catch { return heroRecommendation.offer_text || null; }
      }
      return heroSettings.badgeText || null;
    })();
    return {
      badge,
      headline: heroMeta?.title || heroRecommendation?.title || heroSettings.headline,
      tagline: heroMeta?.description || heroRecommendation?.description || heroSettings.subheadline,
    };
  }, [featuredProducts, heroRecommendation, heroSettings]);

  const { badge, headline, tagline } = getAdminMeta(activeIdx);
  const hero = featuredProducts[activeIdx];
  const sidePicks = featuredProducts.filter((_, i) => i !== activeIdx).slice(0, 3);
  const activeCount = products.filter(p => p.status !== 'inactive').length;

  if (featuredProducts.length === 0) {
    return (
      <section className="pt-20 md:pt-28 pb-10 px-4 md:px-8">
        <div className="container mx-auto">
          <div className="aspect-[5/6] md:aspect-[16/9] rounded-3xl bg-foreground/5 animate-pulse" />
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-full pt-20 md:pt-24 pb-4 md:pb-8 overflow-hidden isolate">
      {/* Ambient aurora backdrop (fades into the page) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="aurora aurora-1 w-[34rem] h-[34rem] -top-40 -left-24 bg-emerald-400/25 dark:bg-emerald-500/20" />
        <div className="aurora aurora-2 w-[28rem] h-[28rem] -top-20 right-0 bg-teal-300/20 dark:bg-teal-400/15" />
        <div className="aurora aurora-3 w-[24rem] h-[24rem] top-40 left-1/3 bg-violet-300/15 dark:bg-violet-500/12" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
      </div>

      {/* Desktop greeting */}
      {greeting && (
        <div className="hidden md:flex container mx-auto px-8 mb-5 items-center justify-between relative z-10">
          <p className="text-sm font-medium text-foreground/60">{greeting}</p>
          {activeCount > 0 && (
            <div className="glass-surface flex items-center gap-2 rounded-full px-4 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-foreground/65">{activeCount} products live</span>
            </div>
          )}
        </div>
      )}

      {/* MOBILE */}
      <div
        className="md:hidden px-4 relative z-10"
        onTouchStart={e => { dragStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const diff = dragStartX.current - e.changedTouches[0].clientX;
          if (Math.abs(diff) > 40) {
            if (diff > 0) setActiveIdx(i => (i + 1) % featuredProducts.length);
            else setActiveIdx(i => (i - 1 + featuredProducts.length) % featuredProducts.length);
          }
        }}
      >
        <div className="flex items-center justify-between mb-3 px-1">
          {badge ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600">
              <Sparkles className="w-3 h-3" />{badge}
            </span>
          ) : <span />}
          {featuredProducts.length > 1 && (
            <span className="text-[11px] font-medium text-foreground/40 tabular-nums">
              {activeIdx + 1}/{featuredProducts.length}
            </span>
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={hero?.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[1.75rem] overflow-hidden bg-neutral-900 relative cursor-pointer"
            style={{ aspectRatio: '4/5' }}
            onClick={() => hero && navigate(`/product/${hero.id}`)}
          >
            {hero?.images?.[0] && (
              <img src={hero.images[0]} alt={hero.name} className="absolute inset-0 w-full h-full object-cover" loading="eager" decoding="async" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
            <div className="absolute top-4 right-4 z-10">
              {Number(hero?.rating) > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white text-[10px] font-semibold">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  {Number(hero.rating).toFixed(1)}
                </span>
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 p-5 z-10">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50 mb-1.5">
                {(hero as any)?.seller_name}
              </p>
              <h2 className="font-sans font-bold text-white text-[1.6rem] leading-[1.05] tracking-[-0.03em] mb-3 line-clamp-2">
                {hero?.name}
              </h2>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-white tabular-nums">
                  {CURRENCY} {hero ? Math.round(hero.price).toLocaleString() : ''}
                </span>
                <span className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-white text-black text-sm font-bold">
                  Shop <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {featuredProducts.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-4">
            {featuredProducts.map((p, i) => (
              <button key={p.id} onClick={() => setActiveIdx(i)}
                className={`h-1 rounded-full transition-all duration-400 ${i === activeIdx ? 'w-7 bg-foreground' : 'w-1.5 bg-foreground/25'}`} />
            ))}
          </div>
        )}

        {sidePicks.length > 0 && (
          <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar pb-1">
            {sidePicks.map(p => (
              <button key={p.id} onClick={() => setActiveIdx(featuredProducts.findIndex(x => x.id === p.id))}
                className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden ring-1 ring-foreground/10 hover:ring-foreground/30 transition-all">
                <img src={p.images?.[0]} alt={p.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* DESKTOP */}
      <div className="hidden md:block container mx-auto px-8 relative z-10">
        <div className="grid grid-cols-12 gap-4" style={{ minHeight: '520px' }}>
          <div className="col-span-7 relative">
            <AnimatePresence mode="wait">
              <motion.div key={hero?.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="h-full">
                <MagneticCard product={hero} badge={badge} headline={headline} tagline={tagline} onClick={() => hero && navigate(`/product/${hero.id}`)} />
              </motion.div>
            </AnimatePresence>
            {featuredProducts.length > 1 && (
              <div className="absolute -bottom-9 left-0 flex items-center gap-2">
                {featuredProducts.map((p, i) => (
                  <button key={p.id} onClick={() => setActiveIdx(i)}
                    className={`h-1 rounded-full transition-all duration-400 ${i === activeIdx ? 'w-8 bg-foreground' : 'w-2 bg-foreground/20 hover:bg-foreground/40'}`} />
                ))}
              </div>
            )}
          </div>

          <div className="col-span-5 flex flex-col gap-3 justify-between">
            <div className="flex flex-col gap-3 flex-1">
              {sidePicks.length === 0
                ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-foreground/[0.03] animate-pulse" />)
                : sidePicks.map((p, i) => (
                    <SideProductPill key={p.id} product={p} onClick={() => navigate(`/product/${p.id}`)} delay={0.1 + i * 0.07} />
                  ))
              }
            </div>
            <button
              onClick={() => navigate('/shop')}
              className="glass-surface group w-full flex items-center justify-center gap-2 h-11 rounded-2xl hover:border-foreground/25 text-sm font-semibold text-foreground/65 hover:text-foreground transition-all"
            >
              {activeCount > 0 ? `Browse all ${activeCount} products` : 'Browse all products'}
              <ArrowRight className="w-4 h-4 stroke-[2.2] group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
