import { safeJsonParse } from '../../src/security';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, ShoppingBag, Star, Sparkles, TrendingUp, Users, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../../context/AppContext';
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

// ─── Animated live stat counter ───────────────────────────────────────────────
const LiveStat: React.FC<{ value: number; label: string; prefix?: string; suffix?: string }> = ({
  value, label, prefix = '', suffix = ''
}) => {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = value / 40;
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplayed(value); clearInterval(timer); }
      else setDisplayed(Math.floor(start));
    }, 30);
    return () => clearInterval(timer);
  }, [value]);
  return (
    <div className="flex flex-col items-center md:items-start">
      <span className="text-xl md:text-2xl font-bold text-white tabular-nums tracking-tight">
        {prefix}{displayed.toLocaleString()}{suffix}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50 mt-0.5">{label}</span>
    </div>
  );
};

// ─── Magnetic tilt card ────────────────────────────────────────────────────────
const MagneticCard: React.FC<{
  product: Product;
  badge?: string | null;
  headline?: string;
  tagline?: string;
  productCount: number;
  onClick: () => void;
}> = ({ product, badge, headline, tagline, productCount, onClick }) => {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 120, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 120, damping: 20 });
  const rotateX = useTransform(smoothY, [-0.5, 0.5], [3, -3]);
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-3, 3]);

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mouseX.set(((e.clientX - rect.left) / rect.width - 0.5));
    mouseY.set(((e.clientY - rect.top) / rect.height - 0.5));
  };
  const resetMouse = () => { mouseX.set(0); mouseY.set(0); };

  const img = product.images?.[0];

  return (
    <motion.div
      ref={ref}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 1000 }}
      onMouseMove={handleMouse}
      onMouseLeave={resetMouse}
      onClick={onClick}
      className="relative group cursor-pointer w-full rounded-[2rem] overflow-hidden bg-neutral-900 aspect-[4/5] md:aspect-auto md:h-full"
    >
      {/* Background image with parallax */}
      <motion.div
        className="absolute inset-0"
        style={{ scale: 1.08 }}
        whileHover={{ scale: 1.12 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        {img && (
          <img
            src={img}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
        )}
      </motion.div>

      {/* Gradient overlay — editorial feel */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />

      {/* Top badges */}
      <div className="absolute top-5 left-5 right-5 flex items-start justify-between z-10">
        {badge && (
          <motion.span
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/90 text-white backdrop-blur text-[11px] font-bold tracking-wide shadow-lg"
          >
            <Sparkles className="w-3 h-3" />
            {badge}
          </motion.span>
        )}
        {product.rating != null && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white text-xs font-semibold">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            {Number(product.rating).toFixed(1)}
          </span>
        )}
      </div>

      {/* Bottom content */}
      <div className="absolute inset-x-0 bottom-0 p-6 md:p-8 z-10">
        <motion.p
          className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/50 mb-2"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
        >
          {(product as any).seller_name || 'Featured store'}
        </motion.p>

        <motion.h2
          className="font-sans font-bold text-white leading-[1.0] tracking-[-0.035em] mb-3"
          style={{ fontSize: 'clamp(1.5rem, 3.5vw, 3rem)' }}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        >
          {headline && headline !== product.name ? headline : product.name}
        </motion.h2>

        {tagline && (
          <motion.p
            className="text-sm text-white/60 mb-5 line-clamp-2 max-w-md"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
          >
            {tagline}
          </motion.p>
        )}

        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        >
          <button className="group/btn inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-white text-black font-bold text-sm hover:bg-white/90 active:scale-95 transition-all shadow-xl">
            <ShoppingBag className="w-4 h-4 stroke-[2.2]" />
            <span>{CURRENCY} {Math.round(product.price).toLocaleString()}</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5] -mr-1 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>

          {/* Live stats */}
          <div className="hidden md:flex items-center gap-4 ml-2">
            <div className="flex items-center gap-1.5 text-xs text-white/50 font-medium">
              <Package className="w-3.5 h-3.5" />
              <span>{productCount}+ products</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Shimmer on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
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
      className="group relative w-full text-left rounded-2xl overflow-hidden bg-foreground/[0.03] border border-foreground/[0.06] hover:border-foreground/20 transition-all duration-300 flex"
      style={{ minHeight: '7rem' }}
    >
      {/* Image */}
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
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/20" />
      </div>

      {/* Content */}
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
          {product.rating != null && (
            <span className="inline-flex items-center gap-1 text-[10px] text-foreground/50">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
              {Number(product.rating).toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Hover arrow */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight className="w-4 h-4 stroke-[2.2] text-foreground/40" />
      </div>
    </motion.button>
  );
};

// ─── Main exported component ───────────────────────────────────────────────────
export const HeroSection = ({
  heroRecommendation,
  heroFeaturedProducts = [],
  heroSettings,
  greeting,
}: HeroSectionProps) => {
  const navigate = useNavigate();
  const { products } = useAppState();
  const [activeIdx, setActiveIdx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);

  const featuredProducts = useMemo<Product[]>(() => {
    const list: Product[] = [];
    const seen = new Set<string>();
    const pushUnique = (p: any) => {
      if (!p?.id || seen.has(p.id)) return;
      seen.add(p.id);
      list.push(p as Product);
    };
    heroFeaturedProducts.forEach(pushUnique);
    if (heroRecommendation?.products) {
      const p = heroRecommendation.products;
      pushUnique(Array.isArray(p) ? p[0] : p);
    }
    const boosted = products.filter(p => p.is_boosted).sort((a, b) => (b.rating || 0) - (a.rating || 0));
    boosted.forEach(pushUnique);
    const topRated = [...products].sort((a, b) =>
      (b.rating || 0) * (b.review_count || 0) - (a.rating || 0) * (a.review_count || 0)
    );
    topRated.forEach(pushUnique);
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
        try { const o = safeJsonParse(heroMeta.offer_text, {}) as any; return o?.text || null; } catch { return heroMeta.offer_text || null; }
      }
      if (heroRecommendation?.offer_text) {
        try { const o = safeJsonParse(heroRecommendation.offer_text, {}) as any; return o?.text || null; } catch { return heroRecommendation.offer_text || null; }
      }
      return heroSettings.badgeText || null;
    })();
    const headline = heroMeta?.title || heroRecommendation?.title || heroSettings.headline;
    const tagline = heroMeta?.description || heroRecommendation?.description || heroSettings.subheadline;
    return { badge, headline, tagline };
  }, [featuredProducts, heroRecommendation, heroSettings]);

  const { badge, headline, tagline } = getAdminMeta(activeIdx);
  const hero = featuredProducts[activeIdx];
  const sidePicks = featuredProducts.filter((_, i) => i !== activeIdx).slice(0, 3);

  // swipe on mobile
  const onTouchStart = (e: React.TouchEvent) => { dragStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const diff = dragStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) setActiveIdx(i => (i + 1) % featuredProducts.length);
      else setActiveIdx(i => (i - 1 + featuredProducts.length) % featuredProducts.length);
    }
  };

  if (featuredProducts.length === 0) {
    return (
      <section className="pt-20 md:pt-28 pb-10 px-5 md:px-8">
        <div className="container mx-auto">
          <div className="aspect-[5/6] md:aspect-[16/9] rounded-3xl bg-foreground/5 animate-pulse" />
        </div>
      </section>
    );
  }

  const activeCount = products.filter(p => p.status !== 'inactive').length;

  return (
    <section className="relative w-full pt-20 md:pt-24 pb-4 md:pb-8">
      {/* ─── Desktop greeting + live stats bar ─── */}
      <div className="hidden md:flex container mx-auto px-8 mb-5 items-center justify-between">
        <p className="text-sm font-medium text-foreground/50">{greeting}</p>
        <div className="flex items-center gap-6 bg-foreground/[0.04] rounded-full px-5 py-2 border border-foreground/[0.06]">
          <div className="flex items-center gap-1.5 text-xs text-foreground/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">{activeCount > 0 ? `${activeCount} products live` : 'Live marketplace'}</span>
          </div>
          <div className="w-px h-3 bg-foreground/15" />
          <div className="flex items-center gap-1 text-xs text-foreground/50">
            <TrendingUp className="w-3 h-3" />
            <span>Tanzania #1 marketplace</span>
          </div>
          <div className="w-px h-3 bg-foreground/15" />
          <div className="flex items-center gap-1 text-xs text-foreground/50">
            <Users className="w-3 h-3" />
            <span>27 regions covered</span>
          </div>
        </div>
      </div>

      {/* ─── MOBILE layout ─── */}
      <div
        className="md:hidden px-4"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Badge row */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/50">
              {badge || 'Featured today'}
            </span>
          </div>
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
            className="rounded-[1.75rem] overflow-hidden bg-neutral-900 relative"
            style={{ aspectRatio: '4/5' }}
            onClick={() => hero && navigate(`/product/${hero.id}`)}
          >
            {hero?.images?.[0] && (
              <img
                src={hero.images[0]}
                alt={hero.name}
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />

            {/* Badges */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
              {badge && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold tracking-wide">
                  <Sparkles className="w-2.5 h-2.5" />{badge}
                </span>
              )}
              {hero?.rating != null && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white text-[10px] font-semibold">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  {Number(hero.rating).toFixed(1)}
                </span>
              )}
            </div>

            {/* Bottom content */}
            <div className="absolute inset-x-0 bottom-0 p-5 z-10">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50 mb-1.5">
                {(hero as any)?.seller_name || 'Featured store'}
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

        {/* Dot indicators */}
        {featuredProducts.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-4">
            {featuredProducts.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setActiveIdx(i)}
                className={`h-1 rounded-full transition-all duration-400 ${
                  i === activeIdx ? 'w-7 bg-foreground' : 'w-1.5 bg-foreground/25'
                }`}
              />
            ))}
          </div>
        )}

        {/* Thumbnail strip */}
        {sidePicks.length > 0 && (
          <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar pb-1">
            {sidePicks.map(p => (
              <button
                key={p.id}
                onClick={() => setActiveIdx(featuredProducts.findIndex(x => x.id === p.id))}
                className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden ring-1 ring-foreground/10 hover:ring-foreground/30 transition-all"
              >
                <img src={p.images?.[0]} alt={p.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── DESKTOP layout ─── */}
      <div className="hidden md:block container mx-auto px-8">
        <div className="grid grid-cols-12 gap-4" style={{ minHeight: '520px' }}>

          {/* Hero main card */}
          <div className="col-span-7 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={hero?.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="h-full"
              >
                <MagneticCard
                  product={hero}
                  badge={badge}
                  headline={headline}
                  tagline={tagline}
                  productCount={activeCount}
                  onClick={() => hero && navigate(`/product/${hero.id}`)}
                />
              </motion.div>
            </AnimatePresence>

            {/* Carousel controls */}
            {featuredProducts.length > 1 && (
              <div className="absolute -bottom-10 left-0 flex items-center gap-2">
                {featuredProducts.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setActiveIdx(i)}
                    className={`h-1 rounded-full transition-all duration-400 ${
                      i === activeIdx ? 'w-8 bg-foreground' : 'w-2 bg-foreground/20 hover:bg-foreground/40'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Side picks rail */}
          <div className="col-span-5 flex flex-col gap-3 justify-between">
            {/* Live stats header */}
            <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.06]">
              <LiveStat value={activeCount || 248} label="Products" />
              <div className="w-px h-8 bg-foreground/10" />
              <LiveStat value={27} label="Regions" />
              <div className="w-px h-8 bg-foreground/10" />
              <LiveStat value={98} label="Satisfaction" suffix="%" />
            </div>

            {/* Side product pills */}
            <div className="flex flex-col gap-3 flex-1">
              {sidePicks.length === 0
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-28 rounded-2xl bg-foreground/[0.03] animate-pulse" />
                  ))
                : sidePicks.map((p, i) => (
                    <SideProductPill
                      key={p.id}
                      product={p}
                      onClick={() => navigate(`/product/${p.id}`)}
                      delay={0.1 + i * 0.07}
                    />
                  ))
              }
            </div>

            {/* Browse all CTA */}
            <button
              onClick={() => navigate('/shop')}
              className="group w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-foreground/10 hover:border-foreground/25 hover:bg-foreground/[0.03] text-sm font-semibold text-foreground/60 hover:text-foreground transition-all"
            >
              Browse all {activeCount > 0 ? `${activeCount} products` : 'products'}
              <ArrowRight className="w-4 h-4 stroke-[2.2] group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
