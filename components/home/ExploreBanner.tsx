import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Store, ArrowRight } from 'lucide-react';

/**
 * Editorial band that routes people from the homepage into Explore and Stores.
 * Pure links, theme-token driven, consistent with the dark Explore hero.
 */
export const ExploreBanner: React.FC = () => (
  <section className="container mx-auto px-4 md:px-8 py-10">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Link
        to="/shop"
        className="group relative overflow-hidden rounded-3xl bg-stone-900 text-stone-50 p-8 md:p-10 flex flex-col justify-between min-h-[200px] active:scale-[0.99] transition-transform"
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone-50/55 font-bold mb-3">Explore</p>
          <h3 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
            Every category,<br />one place
          </h3>
        </div>
        <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-emerald-400">
          Browse categories
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </span>
        <LayoutGrid className="absolute -right-4 -bottom-4 w-32 h-32 text-stone-50/[0.06] stroke-[1]" />
      </Link>

      <Link
        to="/shop?tab=stores"
        className="group relative overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.03] text-foreground p-8 md:p-10 flex flex-col justify-between min-h-[200px] hover:border-foreground/25 active:scale-[0.99] transition-all"
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/35 font-bold mb-3">Sellers</p>
          <h3 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
            Meet Tanzania's<br />best stores
          </h3>
        </div>
        <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-foreground">
          Discover stores
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </span>
        <Store className="absolute -right-4 -bottom-4 w-32 h-32 text-foreground/[0.05] stroke-[1]" />
      </Link>
    </div>
  </section>
);

export default ExploreBanner;
