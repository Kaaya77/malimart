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
 * 1. Header, always TWO fixed lines so every card in a grid aligns:
 *      line 1 — shop name (11.5px, bold, foreground/80) + verified shield
 *      line 2 — location (10px, muted), rendered even when absent
 *    The shop leads — buyers pick sellers they recognise, and the old
 *    uppercase 10px/50% treatment made the name the quietest thing in a row
 *    it was supposed to head. Stacking (rather than wrapping) is deliberate:
 *    a wrap-when-it-does-not-fit row made the layout depend on shop-name
 *    length, so adjacent cards showed the same data two different ways.
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
 <div className="flex flex-col gap-0.5 min-w-0">
 {/* Line 1 — shop name gets the full width, so it is never squeezed by a
 neighbour. The shield rides with it and cannot be orphaned. */}
 <span className="flex items-center gap-1.5 min-w-0">
 <button
 onClick={onStoreClick}
 className="text-[11.5px] font-bold tracking-tight text-foreground/80 hover:text-emerald-600 transition-colors truncate min-w-0"
 >
 {product.seller_name || 'Store'}
 </button>
 {product.is_verified && <VerifiedBadge iconOnly />}
 </span>

 {/* Line 2 — location, always on its own row.
 This was previously a wrap-if-it-does-not-fit flex item, which made the
 layout depend on how long the shop name happened to be: a long name
 pushed location onto its own line, a short one kept it inline. Two
 cards side by side then used two different layouts for identical data,
 and the inline variant truncated the shop name to make room.
 The row is always rendered, even with no location, so every card has an
 identical two-line header and the grid stays aligned. */}
 <span className="flex items-center gap-0.5 min-w-0 h-[13px] text-[10px] font-medium text-foreground/40">
 {sellerLocation && (
 <>
 <MapPin className="w-2.5 h-2.5 shrink-0 stroke-[2.5]" />
 <span className="truncate">{sellerLocation}</span>
 </>
 )}
 </span>
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
