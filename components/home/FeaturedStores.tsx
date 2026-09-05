import React from 'react';
import { ArrowRight } from 'lucide-react';
import { VendorProfile } from '../../types';
import { StoreCard } from '../categories/StoreCard';
import { useAppState } from '../../context/AppContext';

interface FeaturedStoresProps {
  topShops: VendorProfile[];
  navigate: (p: string) => void;
}

/**
 * FeaturedStores — the "Featured stores" strip on the homepage.
 *
 * Was a static 1/2/3-column grid — fine, but it gave every store equal
 * visual weight and left an awkward gap in the last row whenever `topShops`
 * wasn't a multiple of 3. Now a horizontal spotlight rail: the #1 store gets
 * a wider card to lead the eye, the rest scroll past at a uniform size — the
 * same snap-scroll affordance CategoryStrip already uses on mobile, here
 * carried to desktop too, since a rail of sellers is something you skim
 * past rather than scan as a grid.
 *
 * Clicking a card now goes straight to /store/:id — StoreCard's own default
 * navigation (see its docstring). This used to override that with a preview
 * MODAL instead, which added an extra click for no real benefit; the modal
 * is gone, along with the activeStore state it needed in HomePage.
 */
export const FeaturedStores: React.FC<FeaturedStoresProps> = ({ topShops, navigate }) => {
  const { followSeller, unfollowSeller, isFollowing } = useAppState();

  if (!topShops || topShops.length === 0) return null;

  const shops = topShops.slice(0, 8);

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
          onClick={() => navigate('/shop?tab=stores')}
          className="group flex items-center gap-1.5 text-sm font-bold text-foreground/50 hover:text-foreground transition-colors flex-shrink-0"
        >
          Browse all <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Same scroll-fade affordance as CategoryStrip's mobile rail, carried
          to every breakpoint here — a spotlight rail should read as
          scrollable everywhere, not just on phones. */}
      <div className="relative">
        <div className="overflow-x-auto no-scrollbar pl-4 md:pl-8 -mr-4 md:-mr-8">
          <div className="flex gap-4 pr-4 md:pr-8 snap-x snap-mandatory">
            {shops.map((s, i) => (
              <div
                key={s.seller_id}
                className={`shrink-0 snap-start ${i === 0 ? 'w-[280px] sm:w-[340px]' : 'w-[260px] sm:w-[300px]'}`}
              >
                <StoreCard
                  vendor={s}
                  rank={i < 3 ? i + 1 : undefined}
                  isFavorite={isFollowing(s.seller_id)}
                  onFavoriteToggle={() =>
                    isFollowing(s.seller_id) ? unfollowSeller(s.seller_id) : followSeller(s.seller_id)
                  }
                />
              </div>
            ))}
          </div>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent"
        />
      </div>
    </section>
  );
};
