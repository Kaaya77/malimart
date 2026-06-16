import React from 'react';
import { Skeleton } from '../ui/FormPrimitives';

export const CategoriesSkeleton = () => (
  <div className="min-h-screen bg-background">
    {/* hero */}
    <Skeleton className="h-48 w-full rounded-none" />
    {/* tab bar */}
    <div className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-foreground/8 px-4">
      <div className="flex gap-6 py-4 max-w-7xl mx-auto">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-9 w-24 rounded-2xl" />)}
      </div>
    </div>
    {/* grid */}
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="rounded-3xl overflow-hidden border border-foreground/8">
            <Skeleton className="h-36 w-full rounded-none" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
