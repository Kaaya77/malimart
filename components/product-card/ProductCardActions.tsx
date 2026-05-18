import React from 'react';
import { Heart, Plus, Check } from 'lucide-react';
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
}

export const ProductCardActions: React.FC<ProductCardActionsProps> = ({
    product,
    stats,
    isLiked,
    isComparing,
    onCompare,
    onQuickView,
    onAdd,
    isAdding,
    layout
}) => {
    const { toggleWishlist } = useAppState();
    const { addToast } = useToast();

    return (
        <div className={`absolute ${layout === 'grid' ? 'bottom-4 right-2' : 'bottom-3 right-3'} z-30 flex items-center gap-2 pointer-events-auto`}>
            
            <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                    e.stopPropagation();
                    toggleWishlist(product);
                    addToast(isLiked ? 'Removed from wishlist' : 'Added to wishlist', 'success');
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm
                    ${isLiked ? 'bg-primary/10 text-primary' : 'bg-white/90 dark:bg-black/90 text-foreground/40 hover:text-foreground backdrop-blur-md border border-white/20 dark:border-white/5'}
                `}
            >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-primary stroke-none' : 'stroke-[2]'}`} />
            </motion.button>

            <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onAdd}
                disabled={stats.isOut}
                className={`w-9 h-9 rounded-full flex items-center justify-center font-black transition-all shadow-md  ${
                    isAdding 
                        ? 'bg-emerald-500 text-white' 
                        : stats.isOut 
                            ? 'bg-foreground/10 text-foreground/40 cursor-not-allowed opacity-50'
                            : 'bg-primary text-primary-foreground hover:shadow-primary/30'
                }`}
            >
                {isAdding ? (
                    <Check className="w-4 h-4 stroke-[3]" />
                ) : (
                    <Plus className="w-5 h-5 stroke-[2.5]" />
                )}
            </motion.button>
        </div>
    );
};
