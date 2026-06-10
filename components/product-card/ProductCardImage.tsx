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
    ? 'aspect-[3/4] w-full rounded-2xl'
    : 'aspect-square w-32 md:w-44 flex-shrink-0 rounded-xl';

  return (
    <div className={`relative overflow-hidden bg-foreground/[0.03] dark:bg-white/[0.03] ${containerCls} group`}>
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
          transition={{ duration: 0.25 }}
          onLoad={() => setImgLoaded(true)}
          onError={(e) => {
            setImgLoaded(true);
            const img = e.currentTarget;
            if (!img.dataset.fellBack) {
              img.dataset.fellBack = '1';
              img.src = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 600 800%27%3E%3Crect width=%27600%27 height=%27800%27 fill=%27%23f1f0ec%27/%3E%3Cg fill=%27%23c8c5bc%27%3E%3Ccircle cx=%27300%27 cy=%27340%27 r=%2770%27/%3E%3Cpath d=%27M170 560 q60 -110 130 -40 q40 -70 130 30 l0 50 l-260 0 z%27/%3E%3C/g%3E%3C/svg%3E";
            }
          }}
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover transition-transform duration-700 ease-out
            ${isHovered ? 'scale-[1.06]' : 'scale-100'}
            ${stats.isOut ? 'grayscale opacity-50' : ''}`}
        />
      </AnimatePresence>

      {/* Bottom gradient — editorial sweep */}
      <div className={`absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent pointer-events-none transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0 md:opacity-0'}`} />

      {/* Sold-out overlay */}
      {stats.isOut && (
        <div className="absolute inset-0 bg-background/40 flex items-center justify-center">
          <span className="px-3 py-1.5 rounded-full bg-foreground/90 text-background text-[10px] font-bold uppercase tracking-widest">
            Sold out
          </span>
        </div>
      )}

      {/* Badge cluster — top left */}
      {!stats.isOut && (
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1 items-start">
          {stats.campaignDiscount > 0 && (
            <span className="px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[10px] font-bold tracking-wide shadow-sm">
              −{stats.campaignDiscount}%
            </span>
          )}
          {isNew && (
            <span className="px-2 py-0.5 rounded-lg bg-white/95 dark:bg-black/90 text-foreground text-[10px] font-bold uppercase tracking-wider shadow-sm ring-1 ring-foreground/5">
              New
            </span>
          )}
          {lowStock && (
            <span className="px-2 py-0.5 rounded-lg bg-amber-400/95 text-amber-950 text-[10px] font-bold tracking-wide shadow-sm">
              {product.stock} left
            </span>
          )}
        </div>
      )}

      {/* Image dot navigation */}
      {images.length > 1 && layout === 'grid' && (
        <div
          className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 hidden md:flex gap-1 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
        >
          {images.slice(0, 5).map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === currentImgIdx ? 'w-4 bg-white' : 'w-1 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
