import React from 'react';
import { Skeleton } from '../ui/FormPrimitives';

const CartItemSkeleton = () => (
  <div className="flex gap-4 p-4">
    <Skeleton className="w-20 h-20 rounded-2xl shrink-0" />
    <div className="flex-1 space-y-2.5">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-8 w-28 mt-2" />
    </div>
    <Skeleton className="h-5 w-16 shrink-0 rounded-xl" />
  </div>
);

export const CartSkeleton = () => (
  <div className="min-h-screen bg-background py-8">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <Skeleton className="h-8 w-40 mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {[0, 1].map(g => (
            <div key={g} className="rounded-3xl border border-foreground/8 overflow-hidden">
              <div className="px-4 py-3 border-b border-foreground/8 flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              {[0, 1, 2].map(i => <CartItemSkeleton key={i} />)}
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-3xl border border-foreground/8 p-6 space-y-4">
            <Skeleton className="h-5 w-28" />
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
            <Skeleton className="h-14 w-full mt-2 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  </div>
);
