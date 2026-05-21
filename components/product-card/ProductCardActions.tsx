import React from 'react';
import { Heart, Plus, Check, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { Product } from '../../types';
import { useAppState } from '../../context/AppContext';
import { useToast } from '../UI';

interface ProductCardActionsProps {
 product: Product;
 stats: any;
 isLiked: boolean;
 isComparing: boolean;
 onCompare?: (product: Product) => void;
 onQuickView?: (product: Product) => void;
 onAdd: (e: React.MouseEvent) => void;
 isAdding: boolean;
 layout: 'grid' | 'list';
 isHovered?: boolean;
}

/**
 * Card actions: wishlist heart (always visible) + mobile-always-visible add CTA.
 *
 * MOBILE FIX: On touch devices, the hover state never fires, so the add-to-cart
 * button was invisible. Now we show a small pill "+Add" button at the bottom of
 * the content area on mobile, and keep the hover overlay for desktop only.
 */
export const ProductCardActions: React.FC<ProductCardActionsProps> = ({
 product,
 stats,
 isLiked,
 onQuickView,
 onAdd,
 isAdding,
 layout,
 isHovered = false,
}) => {
 const { toggleWishlist } = useAppState();
 const { addToast } = useToast();

 const handleWishlist = (e: React.MouseEvent) => {
 e.stopPropagation();
 toggleWishlist(product);
 addToast(isLiked ? 'Removed from wishlist' : 'Saved to wishlist', 'success');
 };

 const handleQuickView = (e: React.MouseEvent) => {
 e.stopPropagation();
 onQuickView?.(product);
 };

 return (
 <>
 {/* Always-visible wishlist heart (top-right of image area) */}
 <button
 onClick={handleWishlist}
 aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
 className={`absolute top-2.5 right-2.5 z-30 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md ring-1 transition-all duration-150 active:scale-90
 ${isLiked
 ? 'bg-rose-500/95 text-white ring-rose-400/30 shadow-sm shadow-rose-500/30'
 : 'bg-white/85 dark:bg-black/70 text-foreground/70 hover:text-rose-500 ring-foreground/10 hover:bg-white dark:hover:bg-black'}`}
 >
 <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current stroke-none' : 'stroke-[2.2]'}`} />
 </button>

 {/* DESKTOP: hover-revealed quick-view + add-to-cart row */}
 <div
 className={`absolute bottom-3 right-3 z-30 hidden md:flex items-center gap-2 transition-all duration-300
 ${layout === 'grid' && isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1.5 pointer-events-none'}`}
 >
 {onQuickView && (
 <motion.button
 whileTap={{ scale: 0.92 }}
 onClick={handleQuickView}
 aria-label="Quick view"
 className="h-9 px-3 rounded-full bg-white/95 dark:bg-black/80 text-foreground text-[11px] font-semibold tracking-wide flex items-center gap-1.5 ring-1 ring-foreground/10 backdrop-blur-md hover:bg-white dark:hover:bg-black transition-colors shadow-sm"
 >
 <Eye className="w-3.5 h-3.5 stroke-[2.2]" />
 Preview
 </motion.button>
 )}
 <motion.button
 whileTap={{ scale: 0.92 }}
 onClick={onAdd}
 disabled={stats.isOut}
 aria-label={stats.isOut ? 'Out of stock' : 'Add to cart'}
 className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm
 ${isAdding
 ? 'bg-emerald-600 text-white'
 : stats.isOut
 ? 'bg-foreground/10 text-foreground/30 cursor-not-allowed'
 : 'bg-foreground text-background hover:bg-emerald-600 hover:text-white'}`}
 >
 {isAdding ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Plus className="w-4 h-4 stroke-[2.5]" />}
 </motion.button>
 </div>

 {/* MOBILE: always-visible add-to-cart pill at bottom of card image */}
 {!stats.isOut && (
 <motion.button
 whileTap={{ scale: 0.95 }}
 onClick={onAdd}
 aria-label={stats.hasVariants ? 'Select options' : 'Add to cart'}
 className={`absolute bottom-2.5 left-2.5 z-30 md:hidden h-8 px-3 rounded-full flex items-center gap-1.5 text-[11px] font-bold tracking-wide shadow-md transition-all duration-150
 ${isAdding
 ? 'bg-emerald-600 text-white'
 : 'bg-white/95 dark:bg-black/85 text-foreground backdrop-blur-md ring-1 ring-foreground/10'}`}
 >
 {isAdding
 ? <><Check className="w-3.5 h-3.5 stroke-[2.5]" /> Added</>
 : <><Plus className="w-3.5 h-3.5 stroke-[2.5]" /> {stats.hasVariants ? 'Options' : 'Add'}</>
 }
 </motion.button>
 )}
 {stats.isOut && (
 <div className="absolute bottom-2.5 left-2.5 z-30 md:hidden h-7 px-2.5 rounded-full bg-black/50 text-white text-[10px] font-bold flex items-center backdrop-blur-sm">
 Out of stock
 </div>
 )}
 </>
 );
};
