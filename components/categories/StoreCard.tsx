import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Star, Heart, Package, MapPin, Crown } from 'lucide-react';
import { VerifiedBadge } from '../UI';
import { VendorProfile } from '../../types';

/**
 * Deterministic identity for stores with no banner/logo.
 *
 * Most sellers have uploaded neither, and the old fallback was
 * `from-emerald-500/10 to-foreground/10` — a near-invisible wash that read as
 * a broken/blank image on the feed, which is corrosive on a marketplace.
 * FeaturedStores' now-deleted bespoke cards had exactly this treatment; it was
 * lost when both surfaces were consolidated onto this component.
 *
 * Hashed from the store name so a given store always gets the same colours.
 */
const STORE_GRADIENTS: [string, string][] = [
  ['#10b981', '#059669'], ['#6366f1', '#4f46e5'], ['#f59e0b', '#d97706'],
  ['#ec4899', '#db2777'], ['#14b8a6', '#0d9488'], ['#8b5cf6', '#7c3aed'],
  ['#f97316', '#ea580c'], ['#06b6d4', '#0891b2'],
];

const gradientFor = (name: string): [string, string] => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return STORE_GRADIENTS[Math.abs(hash) % STORE_GRADIENTS.length];
};

const initialsFor = (name: string) =>
  name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';

interface StoreCardProps {
  vendor: VendorProfile;
  isFavorite: boolean;
  onFavoriteToggle: () => void;
  rank?: number;
  /**
   * Overrides the default navigation to /store/:id.
   *
   * The categories tab wants a full page navigation; the homepage opens a
   * store preview modal instead (HomePage's setActiveStore). Without this the
   * two surfaces could not share one card without one of them changing
   * behaviour — which is the whole reason home had its own bespoke variants.
   */
  onClick?: () => void;
}

export const StoreCard: React.FC<StoreCardProps> = React.memo(({ vendor, isFavorite, onFavoriteToggle, rank, onClick }) => {
  const navigate = useNavigate();
  const name = vendor.store_name || 'Store';
  const [g1, g2] = gradientFor(name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-background border border-foreground/8 rounded-3xl overflow-hidden hover:border-foreground/20 hover:shadow-lg transition-all group cursor-pointer"
      onClick={() => (onClick ? onClick() : navigate(`/store/${vendor.seller_id}`))}
    >
      <div className="aspect-[16/7] relative overflow-hidden bg-foreground/[0.04]">
        {vendor.banner_url
          ? <img src={vendor.banner_url} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" loading="lazy" decoding="async" />
          : (
            <div
              className="w-full h-full flex items-center justify-center relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${g1} 0%, ${g2} 100%)` }}
            >
              {/* Subtle dot texture so the panel reads as designed rather than
                  as an image that failed to load. */}
              <div
                className="absolute inset-0 opacity-[0.12]"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
                  backgroundSize: '36px 36px, 52px 52px',
                }}
              />
              <span className="relative text-2xl font-black tracking-tight text-white/90">
                {initialsFor(name)}
              </span>
            </div>
          )
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
          aria-label={isFavorite ? `Unfollow ${vendor.store_name}` : `Follow ${vendor.store_name}`}
          // TOUCH TARGET: 32px circle, 44px real tap area via a transparent
          // ::before ring. Matters more now this card is also on the homepage.
          className={`absolute top-3 right-3 w-8 h-8 rounded-full backdrop-blur-md flex items-center justify-center transition-all active:scale-90
            before:absolute before:-inset-1.5 before:content-[''] before:rounded-full ${isFavorite
              ? 'bg-rose-500 text-white'
              // Was `bg-white/80 text-foreground/60`. The --foreground token
              // INVERTS between themes, so in dark mode that painted a
              // near-white icon onto a near-white chip. Pin both ends of this
              // pair instead of mixing a fixed surface with a themed ink.
              : 'bg-black/45 text-white hover:text-rose-400'}`}
        >
          <Heart className={`w-3.5 h-3.5 stroke-[2.5] ${isFavorite ? 'fill-current stroke-none' : ''}`} />
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-foreground/[0.06] border-2 border-background -mt-8 shrink-0 shadow-md">
            {vendor.logo_url
              ? <img src={vendor.logo_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              : <div className="w-full h-full flex items-center justify-center font-black text-sm text-white" style={{ background: `linear-gradient(135deg, ${g1} 0%, ${g2} 100%)` }}>{initialsFor(name)}</div>
            }
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-foreground text-sm truncate">{vendor.store_name}</h3>
              {vendor.is_verified && <VerifiedBadge iconOnly />}
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
