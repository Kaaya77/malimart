import React from 'react';

/**
 * HomePageSkeleton — uses CSS shimmer for better mobile perf (no Framer overhead).
 * Matches the real layout: hero 2-col on desktop, single card on mobile; 
 * horizontal category scroll; 2/4-col product grids.
 */
export const HomePageSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-background pt-16 md:pt-20">
      {/* Hero skeleton */}
      <div className="px-4 md:px-8 pt-6 pb-4 container mx-auto">
        {/* Mobile: single tall card */}
        <div className="md:hidden">
          <div className="shimmer aspect-[4/5] rounded-3xl mb-3" />
          <div className="flex gap-2">
            {[1,2,3].map(i => <div key={i} className="shimmer w-16 h-16 rounded-xl flex-shrink-0" />)}
          </div>
        </div>
        {/* Desktop: hero + side rail */}
        <div className="hidden md:grid grid-cols-12 gap-5">
          <div className="col-span-7 shimmer aspect-[16/12] rounded-3xl" />
          <div className="col-span-5 flex flex-col gap-3">
            {[1,2,3].map(i => <div key={i} className="shimmer flex-1 rounded-2xl" />)}
          </div>
        </div>
      </div>

      {/* Categories skeleton */}
      <div className="py-10 container mx-auto px-4 md:px-8">
        <div className="shimmer h-6 w-44 rounded-full mb-5" />
        <div className="flex gap-3 overflow-hidden">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="shimmer w-[140px] h-[180px] flex-shrink-0 rounded-2xl md:hidden" />
          ))}
          <div className="hidden md:grid grid-cols-5 gap-4 w-full">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="shimmer aspect-[4/5] rounded-2xl" />
            ))}
          </div>
        </div>
      </div>

      {/* Products grid skeleton */}
      <div className="py-10 container mx-auto px-4 md:px-8">
        <div className="shimmer h-6 w-36 rounded-full mb-5" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="space-y-2">
              <div className="shimmer aspect-[4/5] rounded-2xl" />
              <div className="shimmer h-3 w-3/4 rounded-full" />
              <div className="shimmer h-4 w-1/2 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Trust strip skeleton */}
      <div className="py-8 container mx-auto px-4 md:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="shimmer h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomePageSkeleton;
