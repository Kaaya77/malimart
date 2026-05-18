import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Search, ShieldCheck, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HeroSectionProps {
  heroRecommendation: any;
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

/**
 * Mobile-first image-rich hero.
 *
 * MOBILE (default):
 *   Full-bleed hero image fills 70vh. Soft dark gradient at the bottom
 *   anchors the content (headline + 2 CTAs + search pill) without making
 *   the imagery feel buried. Edge-to-edge by design — no padding around
 *   the hero box, the page padding starts at the next section.
 *
 * DESKTOP (md+):
 *   12-column split. Left 5: editorial type, social proof line, CTAs.
 *   Right 7: large rounded image with a floating product-stat card.
 *   Search bar lives at the bottom of the left column, full-width.
 *
 * Image strategy: curated rotating set of Tanzanian-themed photos
 * (textiles, markets, coffee) preloaded so the FIRST PAINT has imagery
 * — fixes the previous text-only flash.
 */

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&q=80&w=1400', // African fabric folded, vibrant pattern
  'https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&q=80&w=1400',   // Market scene, used in meta tags
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=1400', // Coffee beans up close
];

export const HeroSection = ({
  heroRecommendation,
  heroSettings,
  greeting,
  searchQuery,
  setSearchQuery,
  handleSearch,
  searchPlaceholders,
  currentPlaceholderIdx,
  itemVariants,
}: HeroSectionProps) => {
  const navigate = useNavigate();
  const [imgIdx, setImgIdx] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Preload all hero images so transitions are instant
  useEffect(() => {
    HERO_IMAGES.forEach(src => {
      const i = new Image();
      i.src = src;
    });
  }, []);

  // Auto-rotate hero image every 6s
  useEffect(() => {
    const t = setInterval(() => setImgIdx(i => (i + 1) % HERO_IMAGES.length), 6000);
    return () => clearInterval(t);
  }, []);

  const headline = heroRecommendation?.title || 'Tanzania, in your basket.';
  const tagline = heroRecommendation?.description
    || 'Discover authentic local goods from verified Tanzanian sellers — fabric, coffee, crafts, electronics, and more.';

  return (
    <section className="relative w-full bg-background overflow-hidden">
      {/* ───── MOBILE (default, hidden md+) ───── */}
      <div className="md:hidden relative w-full h-[78vh] min-h-[560px] max-h-[760px] overflow-hidden">
        {HERO_IMAGES.map((src, i) => (
          <motion.img
            key={src}
            src={src}
            alt=""
            aria-hidden="true"
            onLoad={() => i === 0 && setImgLoaded(true)}
            animate={{ opacity: i === imgIdx ? 1 : 0 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ))}

        {/* Loading shimmer until first image lands */}
        {!imgLoaded && (
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/10 via-foreground/5 to-foreground/10 animate-pulse" />
        )}

        {/* Bottom gradient so text reads */}
        <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black via-black/80 to-transparent" />
        {/* Subtle top gradient for navbar legibility */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/40 to-transparent" />

        {/* Content stack — anchored to bottom */}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-8 z-10 text-white">
          {greeting && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-sm font-medium text-white/80 mb-2"
            >
              {greeting}
            </motion.p>
          )}

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70 mb-3"
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Tanzania marketplace
            </span>
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="font-sans text-[40px] leading-[0.98] tracking-[-0.035em] font-semibold mb-3"
          >
            {headline}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-sm leading-relaxed text-white/75 mb-6 max-w-md"
          >
            {tagline}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="flex gap-2.5 mb-4"
          >
            <button
              onClick={() => navigate('/shop')}
              className="flex-1 h-12 rounded-xl bg-white text-black text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
              Shop now
              <ArrowRight className="w-4 h-4 stroke-[2.2]" />
            </button>
            <button
              onClick={() => navigate('/categories')}
              className="h-12 px-5 rounded-xl bg-white/15 backdrop-blur-md text-white text-sm font-semibold ring-1 ring-white/20 active:scale-[0.98] transition-transform"
            >
              Explore
            </button>
          </motion.div>

          {/* Search pill */}
          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onSubmit={handleSearch}
            className="relative"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 stroke-[2.2]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholders[currentPlaceholderIdx] || 'Search products, brands, sellers…'}
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/12 backdrop-blur-md ring-1 ring-white/20 text-white text-sm placeholder:text-white/55 focus:outline-none focus:bg-white/18 focus:ring-white/40 transition-all"
            />
          </motion.form>

          {/* Indicator dots */}
          <div className="flex gap-1.5 mt-5 justify-center">
            {HERO_IMAGES.map((_, i) => (
              <button
                key={i}
                onClick={() => setImgIdx(i)}
                aria-label={`Show hero image ${i + 1}`}
                className={`h-1 rounded-full transition-all duration-300 ${i === imgIdx ? 'w-6 bg-white' : 'w-1 bg-white/50'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ───── DESKTOP (md+) ───── */}
      <div className="hidden md:grid grid-cols-12 gap-8 lg:gap-12 container mx-auto px-8 lg:px-12 pt-28 pb-20 lg:pt-32 lg:pb-24 items-center">
        {/* Left: copy */}
        <div className="col-span-5 max-w-xl">
          {greeting && (
            <motion.p
              variants={itemVariants}
              className="text-base font-medium text-foreground/55 mb-4"
            >
              {greeting}
            </motion.p>
          )}

          <motion.p
            variants={itemVariants}
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/55 mb-5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Tanzania marketplace
          </motion.p>

          <motion.h1
            variants={itemVariants}
            className="font-sans text-6xl lg:text-7xl xl:text-[80px] leading-[0.96] tracking-[-0.038em] font-semibold text-foreground mb-6"
          >
            {headline}
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-base lg:text-lg text-foreground/60 font-medium leading-relaxed mb-8 max-w-md"
          >
            {tagline}
          </motion.p>

          {/* Social proof line */}
          <motion.div
            variants={itemVariants}
            className="flex items-center gap-5 mb-8 text-sm text-foreground/55"
          >
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="font-medium">Verified sellers</span>
            </span>
            <span className="w-1 h-1 bg-foreground/20 rounded-full" />
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-foreground/40" />
              <span className="font-medium">Nationwide delivery</span>
            </span>
          </motion.div>

          {/* CTAs */}
          <motion.div variants={itemVariants} className="flex gap-3 mb-8">
            <button
              onClick={() => navigate('/shop')}
              className="h-13 px-7 rounded-xl bg-foreground text-background text-[15px] font-semibold flex items-center gap-2 hover:bg-primary hover:text-primary-foreground transition-colors h-12"
            >
              Shop now
              <ArrowRight className="w-4 h-4 stroke-[2.2]" />
            </button>
            <button
              onClick={() => navigate('/categories')}
              className="h-12 px-6 rounded-xl bg-foreground/[0.04] text-foreground text-[15px] font-semibold ring-1 ring-foreground/10 hover:bg-foreground/[0.07] transition-colors"
            >
              Explore categories
            </button>
          </motion.div>

          {/* Search */}
          <motion.form
            variants={itemVariants}
            onSubmit={handleSearch}
            className="relative max-w-md"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 stroke-[2.2]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholders[currentPlaceholderIdx] || 'Search products, brands, sellers…'}
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-background ring-1 ring-foreground/12 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-foreground/35"
            />
          </motion.form>
        </div>

        {/* Right: hero image with floating element */}
        <motion.div
          variants={itemVariants}
          className="col-span-7 relative aspect-[5/6] max-h-[640px] rounded-3xl overflow-hidden"
        >
          {/* Soft ambient blob behind */}
          <div className="absolute -inset-10 -z-10 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

          {HERO_IMAGES.map((src, i) => (
            <motion.img
              key={src}
              src={src}
              alt=""
              aria-hidden="true"
              onLoad={() => i === 0 && setImgLoaded(true)}
              animate={{ opacity: i === imgIdx ? 1 : 0, scale: i === imgIdx ? 1 : 1.05 }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ))}

          {!imgLoaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-foreground/10 to-foreground/5 animate-pulse" />
          )}

          {/* Floating product/stat card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="absolute bottom-5 left-5 right-5 lg:bottom-7 lg:left-7 lg:right-auto lg:max-w-xs"
          >
            <div className="bg-white/95 dark:bg-black/85 backdrop-blur-xl rounded-2xl p-4 ring-1 ring-black/5 dark:ring-white/10 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
                    Buyer protection
                  </p>
                  <p className="text-sm font-semibold text-foreground leading-tight mt-0.5">
                    Refund if not as described
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Image indicator dots */}
          <div className="absolute bottom-5 right-5 lg:top-5 lg:right-5 lg:bottom-auto flex gap-1.5">
            {HERO_IMAGES.map((_, i) => (
              <button
                key={i}
                onClick={() => setImgIdx(i)}
                aria-label={`Show hero image ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === imgIdx ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
