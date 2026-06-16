import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Search, Store, Users, Crown } from 'lucide-react';
import { StoreCard } from './StoreCard';
import { VendorProfile } from '../../types';

interface StoresTabProps {
  filteredVendors: VendorProfile[];
  loadingVendors: boolean;
  searchQ: string;
  storeFilter: 'all' | 'verified' | 'new';
  regionFilter: string;
  storeRegions: string[];
  isFollowing: (id: string) => boolean;
  followSeller: (id: string) => void;
  unfollowSeller: (id: string) => void;
  user: any;
  onSearchChange: (q: string) => void;
  onStoreFilterChange: (f: 'all' | 'verified' | 'new') => void;
  onRegionChange: (r: string) => void;
}

export const StoresTab: React.FC<StoresTabProps> = ({
  filteredVendors, loadingVendors, searchQ, storeFilter, regionFilter, storeRegions,
  isFollowing, followSeller, unfollowSeller, user,
  onSearchChange, onStoreFilterChange, onRegionChange,
}) => {
  const showTopSellers = !searchQ && storeFilter === 'all' && !regionFilter && filteredVendors.length >= 3;
  const gridVendors = showTopSellers ? filteredVendors.slice(3) : filteredVendors;

  return (
    <motion.div key="stores" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 stroke-[2]" />
          <input
            value={searchQ}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search stores…"
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-foreground/[0.04] text-foreground text-sm placeholder:text-foreground/35 focus:outline-none focus:bg-foreground/[0.07] transition-colors"
          />
        </div>
        <div className="flex p-1 bg-foreground/[0.04] rounded-xl gap-1">
          {(['all', 'verified', 'new'] as const).map(f => (
            <button key={f} onClick={() => onStoreFilterChange(f)}
              className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${storeFilter === f ? 'bg-background text-foreground shadow-sm' : 'text-foreground/40 hover:text-foreground/65'}`}>
              {f === 'all' ? 'All' : f === 'verified' ? 'Verified ✓' : 'New'}
            </button>
          ))}
        </div>
      </div>

      {storeRegions.length > 2 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {storeRegions.map(r => (
            <button key={r || 'all-regions'} onClick={() => onRegionChange(r)}
              className={`flex-shrink-0 h-8 px-3 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${regionFilter === r ? 'bg-foreground text-background' : 'bg-foreground/[0.05] text-foreground/55 hover:bg-foreground/10 hover:text-foreground'}`}>
              {r || '📍 All regions'}
            </button>
          ))}
        </div>
      )}

      {showTopSellers && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-4 h-4 text-amber-500" />
            <h2 className="font-bold text-foreground text-sm">Top Sellers</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredVendors.slice(0, 3).map((v, i) => (
              <StoreCard key={v.seller_id} vendor={v} rank={i + 1}
                isFavorite={isFollowing(v.seller_id)}
                onFavoriteToggle={() => isFollowing(v.seller_id) ? unfollowSeller(v.seller_id) : followSeller(v.seller_id)} />
            ))}
          </div>
        </div>
      )}

      <div>
        {showTopSellers && gridVendors.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-foreground/50" />
            <h2 className="font-bold text-foreground text-sm">
              All Stores <span className="text-foreground/40 font-normal">({gridVendors.length})</span>
            </h2>
          </div>
        )}
        {loadingVendors ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] shimmer rounded-3xl" />)}
          </div>
        ) : gridVendors.length === 0 ? (
          <div className="flex flex-col items-center py-16 border border-dashed border-foreground/15 rounded-3xl text-foreground/35">
            <Store className="w-10 h-10 mb-3 opacity-20" />
            <p className="font-semibold text-sm">No stores found</p>
            <button onClick={() => { onSearchChange(''); onStoreFilterChange('all'); onRegionChange(''); }} className="mt-3 text-xs font-bold text-emerald-500">Clear filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {gridVendors.map(v => (
              <StoreCard key={v.seller_id} vendor={v}
                isFavorite={isFollowing(v.seller_id)}
                onFavoriteToggle={() => isFollowing(v.seller_id) ? unfollowSeller(v.seller_id) : followSeller(v.seller_id)} />
            ))}
          </div>
        )}
      </div>

      {!user && (
        <p className="text-center text-xs text-foreground/35 py-4">
          <Link to="/login" className="text-emerald-500 font-semibold">Sign in</Link> to follow stores and get personalised updates
        </p>
      )}
    </motion.div>
  );
};
