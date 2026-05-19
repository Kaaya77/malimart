import React from 'react';
import { motion } from 'framer-motion';

/**
 * HomePageSkeleton — full-page loading skeleton.
 *
 * Shown while useHomePageData fetches shops and recommendations from Supabase.
 * Matches the HomePage layout structure with shimmer animation.
 */
export const HomePageSkeleton: React.FC = () => {
  const shimmer = {
    opacity: [0.6, 1, 0.6],
    transition: { duration: 1.5, repeat: Infinity },
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Skeleton */}
      <motion.div
        animate={shimmer}
        className="h-[85vh] md:h-[95vh] bg-foreground/5 flex items-center justify-center"
      >
        <div className="text-center space-y-4 w-full max-w-2xl px-4">
          <div className="h-4 bg-foreground/10 rounded w-32 mx-auto" />
          <div className="h-12 bg-foreground/10 rounded w-64 mx-auto" />
          <div className="h-4 bg-foreground/10 rounded w-48 mx-auto" />
          <div className="flex gap-3 justify-center pt-4">
            <div className="h-12 bg-foreground/10 rounded-full w-32" />
            <div className="h-12 bg-foreground/10 rounded-full w-32" />
          </div>
        </div>
      </motion.div>

      {/* Categories Skeleton */}
      <motion.div
        animate={shimmer}
        className="py-8 md:py-12 border-b border-foreground/10"
      >
        <div className="container mx-auto px-5 md:px-8">
          <div className="h-6 bg-foreground/10 rounded w-40 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-foreground/10 rounded-2xl" />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Featured Products Skeleton */}
      <motion.div
        animate={shimmer}
        className="py-12 md:py-16 border-b border-foreground/10"
      >
        <div className="container mx-auto px-5 md:px-8">
          <div className="h-6 bg-foreground/10 rounded w-40 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="h-48 bg-foreground/10 rounded-lg" />
                <div className="h-4 bg-foreground/10 rounded w-24" />
                <div className="h-4 bg-foreground/10 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Trending Skeleton */}
      <motion.div
        animate={shimmer}
        className="py-12 md:py-16 border-b border-foreground/10"
      >
        <div className="container mx-auto px-5 md:px-8">
          <div className="h-6 bg-foreground/10 rounded w-40 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="h-48 bg-foreground/10 rounded-lg" />
                <div className="h-4 bg-foreground/10 rounded w-24" />
                <div className="h-4 bg-foreground/10 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Featured Stores Skeleton */}
      <motion.div
        animate={shimmer}
        className="py-12 md:py-16 border-b border-foreground/10"
      >
        <div className="container mx-auto px-5 md:px-8">
          <div className="h-6 bg-foreground/10 rounded w-40 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="h-40 bg-foreground/10 rounded-lg" />
                <div className="h-4 bg-foreground/10 rounded w-24" />
                <div className="h-3 bg-foreground/10 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Trust Strip Skeleton */}
      <motion.div
        animate={shimmer}
        className="py-10 md:py-16"
      >
        <div className="container mx-auto px-5 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-foreground/10 rounded-2xl" />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default HomePageSkeleton;
