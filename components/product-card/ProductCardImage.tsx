import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Product } from '../../types';

interface ProductCardImageProps {
    product: Product;
    images: string[];
    isNew: boolean;
    stats: any;
    layout: 'grid' | 'list';
    isHovered: boolean;
}

export const ProductCardImage: React.FC<ProductCardImageProps> = ({ 
    product, 
    images, 
    isNew, 
    stats, 
    layout,
    isHovered
}) => {
    const [imgLoaded, setImgLoaded] = useState(false);
    
    return (
        <div className={`relative overflow-hidden bg-foreground/5 group-hover:shadow-2xl transition-all duration-500 ${layout === 'grid' ? 'aspect-square w-full rounded-[2rem]' : 'aspect-square w-32 md:w-48 flex-shrink-0 rounded-[2rem]'}`}>
            <img 
                src={images[0]} 
                alt={product.name}
                onLoad={() => setImgLoaded(true)}
                className={`w-full h-full object-cover transition-transform duration-700 ease-out ${isHovered ? 'scale-110' : 'scale-100'} ${stats.isOut ? 'grayscale opacity-50' : ''} ${!imgLoaded ? 'opacity-0 scale-95' : 'opacity-100'}`}
            />
            
            {/* OVERLAYS - Sleek minimal badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-2 z-20">
                {stats.campaignDiscount > 0 && (
                    <div className="bg-primary/95 backdrop-blur-md text-primary-foreground px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg transform transition-transform">
                        -{stats.campaignDiscount}% OFF
                    </div>
                )}
                {stats.isOut && (
                    <div className="bg-black/80 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                        Sold Out
                    </div>
                )}
                {isNew && !stats.isOut && (
                    <div className="bg-amber-400 text-amber-950 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                        New
                    </div>
                )}
            </div>
            
            {/* Subtle Gradient Overlay */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none`} />
        </div>
    );
};
