import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Search, ArrowUpRight } from 'lucide-react';

interface HeroSectionProps {
  heroRecommendation: any;
  heroSettings: { badgeText: string; headline: string; subheadline: string };
  greeting: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleSearch: (e: React.FormEvent) => void;
  searchPlaceholders: string[];
  currentPlaceholderIdx: number;
  containerVariants: any;
  itemVariants: any;
}

/**
 * Hero section — editorial, restrained.
 *
 * What changed vs. the previous hero:
 *  - Killed the giant primary/yellow blur blobs (felt SaaS-marketing-y)
 *  - Replaced single-color underline animation with a subtle ink-block accent
 *  - Headline weight reduced from font-black 900 → semibold 600 (premium feels lighter)
 *  - Search bar uses a quiet ring instead of a 4px border halo
 *  - "Recommended" pill is now a row with an inline sparkle that doesn't draw the eye
 */
export const HeroSection = ({
  heroRecommendation,
  heroSettings,
  greeting,
  searchQuery,
  setSearchQuery,
  handleSearch,
  searchPlaceholders,
  currentPlaceholderIdx,
  containerVariants,
  itemVariants,
}: HeroSectionProps) => {
  const badgeText = heroRecommendation
    ? (() => {
        try { return JSON.parse(heroRecommendation.offer_text).text; }
        catch { return heroRecommendation.offer_text; }
      })()
    : heroSettings.badgeText;

  const headline = heroRecommendation?.title || 'Tanzania, delivered.';
  const tagline = heroRecommendation?.description
    || 'Authentic local goods from verified sellers. Fashion, crafts, spices and more, shipped nationwide.';

  return (
    <motion.section
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative px-6 sm:px-8 pt-28 md:pt-36 pb-16 md:pb-24 bg-background overflow-hidden"
    >
      {/* Quiet ambient backdrop — tight to top, subtle */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-72 bg-primary/[0.06] blur-[120px] rounded-full"
      />

      <div className="relative container mx-auto max-w-5xl">
        {/* Eyebrow */}
        <motion.div variants={itemVariants} className="flex justify-center mb-7">
          <button className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.06] ring-1 ring-foreground/8 text-[11px] font-semibold tracking-wide text-foreground/75 transition-colors">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="truncate max-w-[260px]">{badgeText}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-foreground/40 group-hover:text-foreground transition-colors" />
          </button>
        </motion.div>

        {/* Headline — editorial, not shouty */}
        <motion.h1
          variants={itemVariants}
          className="text-center font-sans tracking-tight text-foreground"
        >
          {greeting && (
            <span className="block text-base sm:text-lg font-medium text-foreground/55 mb-3">
              {greeting}
            </span>
          )}
          <span className="block text-[44px] sm:text-6xl md:text-7xl font-semibold leading-[1.02] tracking-[-0.035em]">
            {headline}
          </span>
        </motion.h1>

        {/* Tagline */}
        <motion.p
          variants={itemVariants}
          className="mt-5 mx-auto max-w-xl text-center text-[15px] md:text-base font-medium text-foreground/55 leading-relaxed"
        >
          {tagline}
        </motion.p>

        {/* Search */}
        <motion.form
          variants={itemVariants}
          onSubmit={handleSearch}
          className="mt-9 mx-auto max-w-2xl"
        >
          <div className="relative group">
            <div className="absolute inset-0 rounded-2xl ring-1 ring-foreground/12 group-focus-within:ring-2 group-focus-within:ring-primary/40 transition-all pointer-events-none" />
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40 stroke-[2.2]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholders[currentPlaceholderIdx] || 'Search products, brands, sellers…'}
              className="w-full h-14 md:h-16 pl-14 pr-32 md:pr-36 bg-background rounded-2xl text-[15px] md:text-base font-medium text-foreground placeholder:text-foreground/35 focus:outline-none"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 md:h-12 px-5 md:px-6 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              Search
            </button>
          </div>
        </motion.form>
      </div>
    </motion.section>
  );
};
