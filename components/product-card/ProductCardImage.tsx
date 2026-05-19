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

/**
 * Product card hero image.
 *
 * Design notes:
 *  - rounded-2xl (16px) instead of the old rounded-[2rem] (32px) — feels less iOS-toy, more catalog
 *  - subtle zoom on hover (scale 1.04 max) — was 1.10 which felt jumpy
 *  - badges sit on a single column top-left, no scattering, with refined type
 *  - bottom-right gets an inline image-index pip *only* when there are >1 images
 *  - low-stock gets its own amber badge ("Only 3 left") to drive urgency without screaming
 */
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
            {/* Skeleton */}
            {!imgLoaded && (
                <div className="absolute inset-0 animate-pulse bg-foreground/5" aria-hidden />
            )}

            <AnimatePresence mode="wait">
                <motion.img
                    key={display}
                    src={display}
                    alt={product.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: imgLoaded ? 1 : 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    onLoad={() => setImgLoaded(true)}
                    className={`w-full h-full object-cover transition-transform duration-[600ms] ease-out
                        ${isHovered ? 'scale-[1.04]' : 'scale-100'}
                        ${stats.isOut ? 'grayscale opacity-60' : ''}`}
                />
            </AnimatePresence>

            {/* Top-left badge stack */}
            <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 items-start">
                {stats.campaignDiscount > 0 && !stats.isOut && (
                    <span className="px-2 py-1 rounded-md bg-emerald-500 text-white text-[10px] font-semibold tracking-wide shadow-sm">
                        −{stats.campaignDiscount}%
                    </span>
                )}
                {stats.isOut && (
                    <span className="px-2 py-1 rounded-md bg-black/90 text-white text-[10px] font-semibold uppercase tracking-wider shadow-sm">
                        Sold out
                    </span>
                )}
                {isNew && !stats.isOut && (
                    <span className="px-2 py-1 rounded-md bg-white/95 dark:bg-black/95 text-foreground text-[10px] font-semibold uppercase tracking-wider shadow-sm ring-1 ring-foreground/5">
                        New
                    </span>
                )}
                {lowStock && (
                    <span className="px-2 py-1 rounded-md bg-amber-500/95 text-amber-950 text-[10px] font-semibold tracking-wide shadow-sm">
                        Only {product.stock} left
                    </span>
                )}
            </div>

            {/* Image counter pip (bottom-left, only multi-image, only on hover) */}
            {images.length > 1 && (
                <div
                    className={`absolute bottom-3 left-3 z-20 flex gap-1 transition-opacity duration-300
                        ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                >
                    {images.map((_, i) => (
                        <span
                            key={i}
                            className={`h-1 rounded-full transition-all duration-300
                                ${i === currentImgIdx ? 'w-5 bg-white' : 'w-1 bg-white/60'}`}
                        />
                    ))}
                </div>
            )}

            {/* Subtle bottom gradient on hover (helps badges read on busy images) */}
            <div className={`absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent pointer-events-none transition-opacity duration-300
                ${isHovered ? 'opacity-100' : 'opacity-0'}`} />
        </div>
    );
};
