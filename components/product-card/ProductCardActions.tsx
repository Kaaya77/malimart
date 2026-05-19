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
 * Card actions: wishlist (always visible top-right) + quick-view + add-to-cart.
 *
 * Quick-view appears on hover only — gives power users a fast preview without
 * leaving the grid. Add-to-cart is the green primary CTA, sized for thumbs.
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
                className={`absolute top-3 right-3 z-30 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md ring-1 transition-all duration-200 active:scale-90
                    ${isLiked
                        ? 'bg-rose-500/95 text-white ring-rose-500/30'
                        : 'bg-white/85 dark:bg-black/70 text-foreground/70 hover:text-foreground ring-foreground/10 hover:bg-white dark:hover:bg-black'}`}
            >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current stroke-none' : 'stroke-[2]'}`} />
            </button>

            {/* Hover-revealed quick-view + add CTA row (bottom of image) */}
            <div
                className={`absolute bottom-3 right-3 z-30 flex items-center gap-2 transition-all duration-300
                    ${layout === 'grid' && isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'}`}
            >
                {onQuickView && (
                    <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={handleQuickView}
                        aria-label="Quick view"
                        className="h-9 px-3 rounded-full bg-white/95 dark:bg-black/80 text-foreground text-[11px] font-semibold tracking-wide flex items-center gap-1.5 ring-1 ring-foreground/10 backdrop-blur-md hover:bg-white dark:hover:bg-black transition-colors"
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
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all
                        ${isAdding
                            ? 'bg-emerald-600 text-white'
                            : stats.isOut
                                ? 'bg-foreground/10 text-foreground/30 cursor-not-allowed'
                                : 'bg-foreground text-background hover:bg-primary hover:text-primary-foreground'}`}
                >
                    {isAdding ? <Check className="w-4 h-4 stroke-[3]" /> : <Plus className="w-4 h-4 stroke-[2.5]" />}
                </motion.button>
            </div>
        </>
    );
};
