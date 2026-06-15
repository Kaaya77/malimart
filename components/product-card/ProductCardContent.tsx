import React from 'react';
import { Star, MapPin } from 'lucide-react';
import { Product } from '../../types';
import { VerifiedBadge } from '../UI';
import { formatTZS } from '../../constants';

interface ProductCardContentProps {
 product: Product;
 stats: any;
 layout: 'grid' | 'list';
 onStoreClick: (e: React.MouseEvent) => void;
}

/**
 * Product card text. Hierarchy:
 * 1. Eyebrow: SELLER · location (10px, semibold, tracking-wide, muted)
 * 2. Title: product name (15px, semibold, 2-line clamp, tight tracking)
 * 3. Meta row: rating · review count (13px, muted)
 * 4. Price block: large price, strikethrough original, percent saved
 */
export const ProductCardContent: React.FC<ProductCardContentProps> = ({
 product,
 stats,
 layout,
 onStoreClick,
}) => {
 const isGrid = layout === 'grid';
 const reviewCount = product.review_count || 0;
 const rating = product.rating ? Number(product.rating).toFixed(1) : null;
 const sellerLocation = (product as any).seller_location || product.location;

 return (
 <div className={`flex flex-col ${isGrid ? 'pt-3 gap-1' : 'pt-2 px-1 gap-1.5 flex-1'}`}>
 {/* Eyebrow: store + verified + location */}
 <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/50 truncate">
 <button
 onClick={onStoreClick}
 className="hover:text-foreground transition-colors truncate"
 >
 {product.seller_name || 'Store'}
 </button>
 {product.is_verified && (
 <VerifiedBadge className="scale-[0.65] origin-left -ml-0.5 -mr-1.5 opacity-90" />
 )}
 {sellerLocation && (
 <span className="flex items-center gap-0.5 text-foreground/40 truncate">
 <MapPin className="w-2.5 h-2.5 stroke-[2.5]" />
 <span className="truncate">{sellerLocation}</span>
 </span>
 )}
 </div>

 {/* Title */}
 <h3
 className={`font-sans font-semibold text-foreground leading-snug line-clamp-2 tracking-tight
 ${isGrid ? 'text-[14px]' : 'text-lg'}`}
 >
 {product.name}
 </h3>

 {/* Rating */}
 {rating && (
 <div className="flex items-center gap-1 text-[11px] text-foreground/55">
 <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
 <span className="font-semibold text-foreground/70">{rating}</span>
 {reviewCount > 0 && (
 <span className="text-foreground/40">({reviewCount})</span>
 )}
 </div>
 )}

 {/* Price block */}
 <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
 <span
 className={`font-sans font-bold text-foreground tracking-tight
 ${isGrid ? 'text-[17px]' : 'text-2xl'}`}
 >
 {formatTZS(Math.round(stats.price))}
 </span>
 {stats.originalPrice && stats.originalPrice > stats.price && (
 <>
 <span className="text-[12px] font-medium text-foreground/35 line-through">
 {formatTZS(Math.round(stats.originalPrice))}
 </span>
 <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
 Save {Math.round((1 - stats.price / stats.originalPrice) * 100)}%
 </span>
 </>
 )}
 </div>
 </div>
 );
};
