import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Product } from '../../types';

interface ProductCardImageProps {
    product: Product;
    images: string[];
    isNew: boolean;
    stats: any;
    layout: 'grid' | 'list';
    isHovered: boolean;
    currentImgIdx?: number;
    activeVariantImage?: string | null;
}

export const ProductCardImage: React.FC<ProductCardImageProps> = ({
    product,
    images,
    isNew,
    stats,
    layout,
    isHovered,
    currentImgIdx = 0,
    activeVariantImage,
}) => {
    const [imgLoaded, setImgLoaded] = useState(false);
    const display = activeVariantImage || images[currentImgIdx] || images[0];
    const lowStock = !stats.isOut && typeof product.stock === 'number' && product.stock > 0 && product.stock <= 5;

    const containerCls = layout === 'grid'
        ? 'aspect-[4/5] w-full rounded-2xl'
        : 'aspect-square w-32 md:w-44 flex-shrink-0 rounded-xl';

    return (
        <div className={`relative overflow-hidden bg-foreground/[0.03] dark:bg-white/[0.03] ${containerCls}`}>
            {/* Skeleton shimmer */}
            {!imgLoaded && (
                <div className="absolute inset-0 shimmer" aria-hidden />
            )}

            <AnimatePresence mode="wait">
                <motion.img
                    key={display}
                    src={display}
                    alt={product.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: imgLoaded ? 1 : 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onLoad={() => setImgLoaded(true)}
                    loading="lazy"
                    decoding="async"
                    className={`w-full h-full object-cover transition-transform duration-500 ease-out
                        ${isHovered ? 'scale-[1.04]' : 'scale-100'}
                        ${stats.isOut ? 'grayscale opacity-55' : ''}`}
                />
            </AnimatePresence>

            {/* Top-left badge stack */}
            <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1 items-start">
                {stats.campaignDiscount > 0 && !stats.isOut && (
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[10px] font-bold tracking-wide shadow-sm">
                        −{stats.campaignDiscount}%
                    </span>
                )}
                {stats.isOut && (
                    <span className="px-2 py-0.5 rounded-lg bg-black/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                        Sold out
                    </span>
                )}
                {isNew && !stats.isOut && (
                    <span className="px-2 py-0.5 rounded-lg bg-white/95 dark:bg-black/90 text-foreground text-[10px] font-bold uppercase tracking-wider shadow-sm ring-1 ring-foreground/5">
                        New
                    </span>
                )}
                {lowStock && !stats.isOut && (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-400/95 text-amber-950 text-[10px] font-bold tracking-wide shadow-sm">
                        {product.stock} left
                    </span>
                )}
            </div>

            {/* Image dots (desktop hover only) */}
            {images.length > 1 && (
                <div
                    className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 hidden md:flex gap-1 transition-opacity duration-300
                        ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                >
                    {images.slice(0, 5).map((_, i) => (
                        <span
                            key={i}
                            className={`h-1 rounded-full transition-all duration-300
                                ${i === currentImgIdx ? 'w-4 bg-white' : 'w-1 bg-white/50'}`}
                        />
                    ))}
                </div>
            )}

            {/* Bottom gradient — always on mobile (for the add CTA), on hover desktop */}
            <div className={`absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none transition-opacity duration-200
                md:${isHovered ? 'opacity-100' : 'opacity-0'} opacity-100 md:opacity-0 ${isHovered ? 'md:opacity-100' : ''}`} />
        </div>
    );
};
