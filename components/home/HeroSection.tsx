import { safeJsonParse } from '../../src/security';
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ShoppingBag, ChevronLeft, ChevronRight, Sparkles, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../../context/AppContext';
import { Product } from '../../types';
import { CURRENCY } from '../../constants';

interface HeroSectionProps {
 heroRecommendation: any;
 // NEW: array of normalised admin-featured products from useHomePageData
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

/**
 * PRODUCT-FIRST hero.
 *
 * Source of truth (in priority order):
 * 1. heroFeaturedProducts[] — admin-curated picks from hero_recommendations
 * (passed directly, already joined with vendor_profiles for seller_name)
 * 2. heroRecommendation.products — legacy single-rec shape (backward compat)
 * 3. top boosted product from catalog
 * 4. highest-rated product as last resort
 *
 * The first 4 products fill the carousel. Each slot shows:
 * - Admin badge / offer text from the recommendation
 * - Product image, name, price, store name
 * - "Shop this" CTA linking to the product page
 *
 * Mobile: 1 full-bleed product per slide, swipeable, snap-scroll.
 * Desktop: hero product (big card, 7 col) + 3 smaller cards on right (5 col).
 */
export const HeroSection = ({
 heroRecommendation,
 heroFeaturedProducts = [],
 heroSettings,
 greeting,
}: HeroSectionProps) => {
 const navigate = useNavigate();
 const { products } = useAppState();

 // Resolve featured products — admin picks first, then fill from catalog
 const featuredProducts = useMemo<Product[]>(() => {
 const list: Product[] = [];
 const seen = new Set<string>();
 const pushUnique = (p: any) => {
 if (!p?.id || seen.has(p.id)) return;
 seen.add(p.id);
 list.push(p as Product);
 };

 // 1. Admin's hero recommendations (new array path)
 heroFeaturedProducts.forEach(pushUnique);

 // 2. Legacy single heroRecommendation.products shape
 if (heroRecommendation?.products) {
 const p = heroRecommendation.products;
 pushUnique(Array.isArray(p) ? p[0] : p);
 }

 // 3. Top boosted from catalog
 const boosted = products
 .filter(p => p.is_boosted)
 .sort((a, b) => (b.rating || 0) - (a.rating || 0));
 boosted.forEach(pushUnique);

 // 4. Highest-rated to fill remaining slots
 const topRated = [...products]
 .sort((a, b) =>
 (b.rating || 0) * (b.review_count || 0) -
 (a.rating || 0) * (a.review_count || 0)
 );
 topRated.forEach(pushUnique);

 return list.slice(0, 4);
 }, [heroFeaturedProducts, heroRecommendation, products]);

 const [activeIdx, setActiveIdx] = useState(0);

 // Auto-advance every 7s
 useEffect(() => {
 if (featuredProducts.length <= 1) return;
 const t = setInterval(
 () => setActiveIdx(i => (i + 1) % featuredProducts.length),
 7000
 );
 return () => clearInterval(t);
 }, [featuredProducts.length]);

 // Reset index when featured list changes (e.g. admin updates)
 useEffect(() => {
 setActiveIdx(0);
 }, [heroFeaturedProducts.length]);

 // Resolve admin badge from the active product's _hero metadata or fallback
 const adminBadge = useMemo(() => {
 const active = featuredProducts[activeIdx];
 const heroMeta = (active as any)?._hero;
 if (heroMeta?.offer_text) {
 try {
 const offer = (safeJsonParse(heroMeta.offer_text, {}) as any);
 return offer?.text || null;
 } catch {
 return heroMeta.offer_text || null;
 }
 }
 // Legacy path
 if (heroRecommendation?.offer_text) {
 try {
 const offer = (safeJsonParse(heroRecommendation.offer_text, {}) as any);
 return offer?.text || null;
 } catch {
 return heroRecommendation.offer_text || null;
 }
 }
 return heroSettings.badgeText || null;
 }, [featuredProducts, activeIdx, heroRecommendation, heroSettings.badgeText]);

 const adminHeadline = useMemo(() => {
 const active = featuredProducts[activeIdx];
 const heroMeta = (active as any)?._hero;
 return heroMeta?.title || heroRecommendation?.title || heroSettings.headline;
 }, [featuredProducts, activeIdx, heroRecommendation, heroSettings.headline]);

 const adminTagline = useMemo(() => {
 const active = featuredProducts[activeIdx];
 const heroMeta = (active as any)?._hero;
 return heroMeta?.description || heroRecommendation?.description || heroSettings.subheadline;
 }, [featuredProducts, activeIdx, heroRecommendation, heroSettings.subheadline]);

 // ─── Empty / skeleton state ─────────────────────────────────────
 if (featuredProducts.length === 0) {
 return (
 <section className="pt-20 md:pt-28 pb-10 px-5 md:px-8">
 <div className="container mx-auto">
 <div className="aspect-[5/6] md:aspect-[16/9] rounded-3xl bg-foreground/5 animate-pulse" />
 </div>
 </section>
 );
 }

 const hero = featuredProducts[activeIdx];
 const others = featuredProducts.filter((_, i) => i !== activeIdx).slice(0, 3);

 return (
 <section className="relative w-full pt-20 md:pt-24 pb-2 md:pb-6">
 {/* Greeting eyebrow on desktop only */}
 {greeting && (
 <div className="hidden md:block container mx-auto px-8 mb-3">
 <p className="text-sm font-medium text-foreground/55">{greeting}</p>
 </div>
 )}

 {/* ───── MOBILE: swipeable carousel ───── */}
 <div className="md:hidden">
 <div className="px-5 mb-3 flex items-center justify-between">
 <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/55">
 <Sparkles className="w-3 h-3 text-emerald-500" />
 {adminBadge || 'Featured today'}
 </span>
 {featuredProducts.length > 1 && (
 <span className="text-[11px] font-medium text-foreground/45 tabular-nums">
 {activeIdx + 1} / {featuredProducts.length}
 </span>
 )}
 </div>

 <div className="relative overflow-hidden">
 <AnimatePresence mode="wait">
 <motion.button
 key={hero.id}
 initial={{ opacity: 0, x: 20 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: -20 }}
 transition={{ duration: 0.35 }}
 onClick={() => navigate(`/product/${hero.id}`)}
 className="block w-full text-left active:scale-[0.99] transition-transform"
 >
 <MobileHeroCard
 product={hero}
 headline={adminHeadline}
 tagline={adminTagline}
 />
 </motion.button>
 </AnimatePresence>

 {/* Dot indicators */}
 {featuredProducts.length > 1 && (
 <div className="flex justify-center gap-1.5 mt-3">
 {featuredProducts.map((p, i) => (
 <button
 key={p.id}
 onClick={() => setActiveIdx(i)}
 aria-label={`Show featured product ${i + 1}`}
 className={`h-1 rounded-full transition-all duration-300 ${
 i === activeIdx ? 'w-6 bg-foreground' : 'w-1 bg-foreground/30'
 }`}
 />
 ))}
 </div>
 )}
 </div>

 {/* Thumbnail row of remaining featured */}
 {others.length > 0 && (
 <div className="mt-5 px-5 overflow-x-auto no-scrollbar -mr-5">
 <div className="flex gap-2 pr-5">
 {others.map(p => (
 <button
 key={p.id}
 onClick={() =>
 setActiveIdx(featuredProducts.findIndex(x => x.id === p.id))
 }
 className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-foreground/5 ring-1 ring-foreground/8 hover:ring-foreground/30 transition-all"
 >
 <img
 src={p.images?.[0]}
 alt={p.name}
 className="w-full h-full object-cover"
 />
 </button>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* ───── DESKTOP: hero card + side rail ───── */}
 <div className="hidden md:block container mx-auto px-8">
 <div className="grid grid-cols-12 gap-5">
 {/* Hero card */}
 <div className="col-span-7">
 <AnimatePresence mode="wait">
 <motion.button
 key={hero.id}
 initial={{ opacity: 0, scale: 0.99 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0, scale: 0.99 }}
 transition={{ duration: 0.4 }}
 onClick={() => navigate(`/product/${hero.id}`)}
 className="group relative block w-full text-left rounded-3xl overflow-hidden bg-foreground/[0.03] aspect-[16/12] hover:ring-1 hover:ring-foreground/20 transition-all"
 >
 <img
 src={hero.images?.[0]}
 alt={hero.name}
 className="absolute inset-0 w-full h-full object-cover transition-transform duration-[700ms] ease-out group-hover:scale-[1.03]"
 />
 <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

 {/* Admin badge */}
 {adminBadge && (
 <div className="absolute top-5 left-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 text-black backdrop-blur-md text-[11px] font-semibold tracking-wide">
 <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
 {adminBadge}
 </div>
 )}

 {/* Content */}
 <div className="absolute inset-x-0 bottom-0 p-7 lg:p-9 text-white">
 <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65 mb-2">
 {(hero as any).seller_name || 'Featured store'}
 </p>
 <h2 className="font-sans text-3xl lg:text-4xl xl:text-5xl font-semibold leading-[1.02] tracking-[-0.03em] mb-3 max-w-xl">
 {adminHeadline && adminHeadline !== heroSettings.headline
 ? adminHeadline
 : hero.name}
 </h2>
 {adminTagline && (
 <p className="text-sm text-white/75 max-w-md mb-5 line-clamp-2">
 {adminTagline}
 </p>
 )}
 <div className="flex items-center gap-4">
 <span className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-white text-black font-semibold text-sm">
 <ShoppingBag className="w-4 h-4 stroke-[2.2]" />
 Shop {CURRENCY} {Math.round(hero.price).toLocaleString()}
 </span>
 {hero.rating != null && (
 <span className="inline-flex items-center gap-1 text-sm text-white/80">
 <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
 <span className="font-semibold">
 {Number(hero.rating).toFixed(1)}
 </span>
 </span>
 )}
 </div>
 </div>
 </motion.button>
 </AnimatePresence>

 {/* Carousel controls */}
 {featuredProducts.length > 1 && (
 <div className="flex items-center gap-2 mt-4">
 <button
 onClick={() =>
 setActiveIdx(
 i => (i - 1 + featuredProducts.length) % featuredProducts.length
 )
 }
 aria-label="Previous featured product"
 className="w-10 h-10 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08] flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors"
 >
 <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
 </button>
 <button
 onClick={() =>
 setActiveIdx(i => (i + 1) % featuredProducts.length)
 }
 aria-label="Next featured product"
 className="w-10 h-10 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08] flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors"
 >
 <ChevronRight className="w-4 h-4 stroke-[2.2]" />
 </button>
 <div className="flex gap-1.5 ml-2">
 {featuredProducts.map((p, i) => (
 <button
 key={p.id}
 onClick={() => setActiveIdx(i)}
 aria-label={`Show featured product ${i + 1}`}
 className={`h-1 rounded-full transition-all duration-300 ${
 i === activeIdx ? 'w-6 bg-foreground' : 'w-1 bg-foreground/25'
 }`}
 />
 ))}
 </div>
 </div>
 )}
 </div>

 {/* Side rail: 3 smaller featured */}
 <div className="col-span-5 flex flex-col gap-3">
 {others.map((p, i) => (
 <motion.button
 key={p.id}
 initial={{ opacity: 0, x: 12 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: 0.1 + i * 0.06 }}
 onClick={() => navigate(`/product/${p.id}`)}
 className="group relative flex-1 min-h-0 text-left rounded-2xl overflow-hidden bg-foreground/[0.03] hover:ring-1 hover:ring-foreground/20 transition-all"
 >
 <div className="absolute inset-0 grid grid-cols-2">
 <img
 src={p.images?.[0]}
 alt={p.name}
 className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
 />
 <div className="flex flex-col justify-center px-5">
 <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/55 mb-1.5 truncate">
 {(p as any).seller_name || 'Featured'}
 </p>
 <h3 className="font-sans text-base font-semibold tracking-tight text-foreground line-clamp-2 mb-2">
 {p.name}
 </h3>
 <p className="text-sm font-bold text-foreground tracking-tight">
 {CURRENCY} {Math.round(p.price).toLocaleString()}
 </p>
 <span className="inline-flex items-center gap-1 mt-3 text-[12px] font-semibold text-foreground/70 group-hover:text-emerald-500 transition-colors w-fit">
 Shop now
 <ArrowRight className="w-3.5 h-3.5 stroke-[2.2] transition-transform group-hover:translate-x-0.5" />
 </span>
 </div>
 </div>
 </motion.button>
 ))}
 </div>
 </div>
 </div>
 </section>
 );
};

// ─── Subcomponent: Mobile hero card ────────────────────────────────
const MobileHeroCard: React.FC<{
 product: Product;
 headline?: string;
 tagline?: string;
}> = ({ product }) => {
 return (
 <div className="mx-5 rounded-3xl overflow-hidden bg-foreground/[0.03] relative">
 <div className="aspect-[4/5] relative">
 <img
 src={product.images?.[0]}
 alt={product.name}
 className="absolute inset-0 w-full h-full object-cover"
 />
 <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

 {/* Top corner: rating */}
 {product.rating != null && (
 <div className="absolute top-4 right-4 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 text-black backdrop-blur-md text-xs font-semibold">
 <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
 {Number(product.rating).toFixed(1)}
 </div>
 )}

 {/* Content over image */}
 <div className="absolute inset-x-0 bottom-0 p-5 text-white">
 <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65 mb-1.5">
 {(product as any).seller_name || 'Featured store'}
 </p>
 <h2 className="font-sans text-2xl font-semibold leading-[1.05] tracking-[-0.025em] mb-4 line-clamp-2">
 {product.name}
 </h2>
 <div className="flex items-center justify-between gap-3">
 <span className="text-xl font-bold tabular-nums">
 {CURRENCY} {Math.round(product.price).toLocaleString()}
 </span>
 <span className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-white text-black text-sm font-semibold">
 Shop
 <ArrowRight className="w-3.5 h-3.5 stroke-[2.2]" />
 </span>
 </div>
 </div>
 </div>
 </div>
 );
};
