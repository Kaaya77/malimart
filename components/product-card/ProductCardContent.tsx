import React from 'react';
import { Link } from 'react-router-dom';
import { Star, MapPin } from 'lucide-react';
import { Product } from '../../types';
import { VerifiedBadge } from '../UI';
import { formatTZS, formatLocation } from '../../constants';

interface ProductCardContentProps {
 product: Product;
 stats: any;
 layout: 'grid' | 'list';
 onStoreClick: (e: React.MouseEvent) => void;
}

/**
 * Product card text. Hierarchy:
 * 1. Eyebrow: shop name (11.5px, bold, foreground/80) · verified shield ·
 *    location (10px, muted). The shop leads the row — buyers pick sellers
 *    they recognise, and the old uppercase 10px/50% treatment made the name
 *    the quietest thing in a row it was supposed to head.
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
 const sellerLocation = formatLocation((product as any).seller_location || product.location);

 return (
 <div className={`flex flex-col ${isGrid ? 'pt-3 gap-1' : 'pt-2 px-1 gap-1.5 flex-1'}`}>
 {/* Eyebrow: store + verified + location.
 The shop is the point of this row, so it carries the weight and contrast.
 Verified is a bare shield — the full pill out-shouted the name it was
 meant to endorse. Location drops back to a quiet trailing detail.
 min-w-0 on the row lets the two truncating children actually truncate
 instead of overflowing the card. */}
 <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
 {/* Shop + shield travel together as ONE flex item so the badge can never
 be orphaned onto the next line by a long shop name. */}
 <span className="flex items-center gap-1.5 min-w-0 max-w-full">
 <button
 onClick={onStoreClick}
 className="text-[11.5px] font-bold tracking-tight text-foreground/80 hover:text-emerald-600 transition-colors truncate min-w-0"
 >
 {product.seller_name || 'Store'}
 </button>
 {product.is_verified && <VerifiedBadge iconOnly />}
 </span>

 {/* `shrink-0` is deliberate: in a 2-up mobile grid the card is only
 ~138px at 320px wide, and letting location shrink meant it collapsed
 to an orphaned pin icon. Refusing to shrink makes it WRAP to its own
 line when the shop name has taken the first — and it stays inline
 the moment there is room, so no breakpoint guessing. */}
 {sellerLocation && (
 <span className="flex items-center gap-0.5 shrink-0 max-w-full text-[10px] font-medium text-foreground/40">
 <MapPin className="w-2.5 h-2.5 shrink-0 stroke-[2.5]" />
 <span className="truncate">{sellerLocation}</span>
 </span>
 )}
 </div>

 {/* Title — a real link so keyboard users can open the product and crawlers
 can follow to the detail page (the card's mouse onClick stays a convenience).
 stopPropagation avoids a redundant double-navigate. */}
 <h3
 className={`font-sans font-semibold text-foreground leading-snug line-clamp-2 tracking-tight
 ${isGrid ? 'text-[14px]' : 'text-lg'}`}
 >
 <Link
 to={`/product/${product.id}`}
 onClick={(e) => e.stopPropagation()}
 className="outline-none hover:text-emerald-600 focus-visible:underline transition-colors"
 >
 {product.name}
 </Link>
 </h3>

 {/* Rating */}
 {/* A bare "★ 5.0 (1)" reads as an established rating when it is one
 person's opinion. Below a handful of reviews, spell the count out so the
 sample size is unmistakable rather than looking inflated. */}
 {rating && (
 <div className="flex items-center gap-1 text-[11px] text-foreground/55">
 <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
 <span className="font-semibold text-foreground/70">{rating}</span>
 {reviewCount > 0 && (
 <span className="text-foreground/40">
 {reviewCount < 5
 ? `(${reviewCount} review${reviewCount === 1 ? '' : 's'})`
 : `(${reviewCount})`}
 </span>
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
