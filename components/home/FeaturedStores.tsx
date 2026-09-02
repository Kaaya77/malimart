import React from 'react';
import { ArrowRight } from 'lucide-react';
import { VendorProfile } from '../../types';
import { StoreCard } from '../categories/StoreCard';
import { useAppState } from '../../context/AppContext';

interface FeaturedStoresProps {
  topShops: VendorProfile[];
  setActiveStore: (s: VendorProfile) => void;
  navigate: (p: string) => void;
}

/**
 * FeaturedStores — the "Featured stores" strip on the homepage.
 *
 * Renders the SHARED components/categories/StoreCard, the same component the
 * Stores tab uses. This file previously carried three bespoke card variants of
 * its own (a 340x420 hero, a 220x280 desktop card, and a compact mobile row)
 * plus its own gradient/initials helpers. That duplication is why the verified
 * badge, the follow button's touch target and the section's gutters kept
 * drifting away from the rest of the app and had to be fixed separately here
 * every time.
 *
 * Two behaviours are preserved through props rather than a fork:
 *  - `onClick` keeps home's store PREVIEW MODAL (setActiveStore) instead of
 *    the card's default /store/:id navigation.
 *  - `rank` reuses the card's existing crown badge for the top 3 sellers.
 */
export const FeaturedStores: React.FC<FeaturedStoresProps> = ({ topShops, setActiveStore, navigate }) => {
  const { followSeller, unfollowSeller, isFollowing } = useAppState();

  if (!topShops || topShops.length === 0) return null;

  return (
    <section className="py-10 md:py-16">
      <div className="container mx-auto px-4 md:px-8 mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/35 mb-2">Sellers</p>
          <h2 className="font-sans text-2xl md:text-[2rem] font-bold tracking-tight text-foreground">
            Featured stores
          </h2>
        </div>
        <button
          onClick={() => navigate('/shop')}
          className="group flex items-center gap-1.5 text-sm font-bold text-foreground/50 hover:text-foreground transition-colors flex-shrink-0"
        >
          Browse all <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      <div className="container mx-auto px-4 md:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {topShops.slice(0, 6).map((s, i) => (
          <StoreCard
            key={s.seller_id}
            vendor={s}
            rank={i < 3 ? i + 1 : undefined}
            onClick={() => setActiveStore(s)}
            isFavorite={isFollowing(s.seller_id)}
            onFavoriteToggle={() =>
              isFollowing(s.seller_id) ? unfollowSeller(s.seller_id) : followSeller(s.seller_id)
            }
          />
        ))}
      </div>
    </section>
  );
};
