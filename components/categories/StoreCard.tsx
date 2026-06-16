import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Star, BadgeCheck, Heart, Package, MapPin, Crown } from 'lucide-react';
import { VendorProfile } from '../../types';

interface StoreCardProps {
  vendor: VendorProfile;
  isFavorite: boolean;
  onFavoriteToggle: () => void;
  rank?: number;
}

export const StoreCard: React.FC<StoreCardProps> = React.memo(({ vendor, isFavorite, onFavoriteToggle, rank }) => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-background border border-foreground/8 rounded-3xl overflow-hidden hover:border-foreground/20 hover:shadow-lg transition-all group cursor-pointer"
      onClick={() => navigate(`/store/${vendor.seller_id}`)}
    >
      <div className="aspect-[16/7] relative overflow-hidden bg-foreground/[0.04]">
        {vendor.banner_url
          ? <img src={vendor.banner_url} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" loading="lazy" decoding="async" />
          : <div className="w-full h-full bg-gradient-to-br from-emerald-500/10 to-foreground/10" />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        {rank && rank <= 3 && (
          <div className="absolute top-3 left-3">
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black text-white ${rank === 1 ? 'bg-amber-500' : rank === 2 ? 'bg-gray-400' : 'bg-amber-700'}`}>
              <Crown className="w-3 h-3" /> #{rank}
            </div>
          </div>
        )}
        <button
          onClick={e => { e.stopPropagation(); onFavoriteToggle(); }}
          className={`absolute top-3 right-3 w-8 h-8 rounded-full backdrop-blur-md flex items-center justify-center transition-all active:scale-90 ${isFavorite ? 'bg-rose-500 text-white' : 'bg-white/80 text-foreground/60 hover:text-rose-500'}`}
        >
          <Heart className={`w-3.5 h-3.5 stroke-[2.5] ${isFavorite ? 'fill-current stroke-none' : ''}`} />
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-foreground/[0.06] border-2 border-background -mt-8 shrink-0 shadow-md">
            {vendor.logo_url
              ? <img src={vendor.logo_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              : <div className="w-full h-full flex items-center justify-center font-black text-lg text-foreground/40">{(vendor.store_name || '?')[0]}</div>
            }
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-foreground text-sm truncate">{vendor.store_name}</h3>
              {vendor.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
            </div>
            <p className="text-xs text-foreground/45 truncate">{vendor.description?.slice(0, 40) || 'Tanzanian Seller'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-foreground/45">
          {vendor.rating && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-current stroke-none" />
              <span className="font-semibold text-foreground/70">{vendor.rating.toFixed(1)}</span>
            </span>
          )}
          {vendor.total_sales != null && (
            <span className="flex items-center gap-1"><Package className="w-3 h-3" />{vendor.total_sales} sales</span>
          )}
          {vendor.region && (
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{vendor.region}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
});
