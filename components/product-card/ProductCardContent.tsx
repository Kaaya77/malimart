import React from 'react';
import { Star } from 'lucide-react';
import { Product } from '../../types';
import { VerifiedBadge } from '../UI';
import { CURRENCY } from '../../constants';

interface ProductCardContentProps {
    product: Product;
    stats: any;
    layout: 'grid' | 'list';
    onStoreClick: (e: React.MouseEvent) => void;
}

export const ProductCardContent: React.FC<ProductCardContentProps> = ({ 
    product, 
    stats, 
    layout,
    onStoreClick
}) => {
    return (
        <div className={`flex flex-col ${layout === 'grid' ? 'py-4 px-1 gap-1.5' : 'flex-1 py-3 px-2 gap-2'}`}>
            <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <button onClick={onStoreClick} className="text-[10px] font-black uppercase tracking-widest text-foreground/40 hover:text-primary transition-colors truncate">
                        {product.seller_name || 'Store'} {product.brand && `• ${product.brand}`}
                    </button>
                    {product.is_verified && (
                        <VerifiedBadge className="scale-75 origin-left opacity-80" />
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                    <span className="text-[11px] font-black">{product.rating || '4.8'}</span>
                </div>
            </div>
            
            <h3 className={`font-sans font-extrabold text-foreground leading-tight line-clamp-2 w-full pr-8 ${layout === 'grid' ? 'text-sm' : 'text-xl'}`}>
                {product.name}
            </h3>
            
            <div className={`flex items-end justify-between ${layout === 'grid' ? 'mt-0' : 'mt-auto'}`}>
                <div className="flex items-baseline gap-2">
                    <span className={`${layout === 'grid' ? 'text-[15px]' : 'text-xl'} font-black text-foreground tracking-tight`}>
                        {CURRENCY} {Math.round(stats.price).toLocaleString()}
                    </span>
                    {stats.originalPrice && stats.originalPrice > stats.price && (
                        <span className="text-[11px] font-bold text-foreground/30 line-through">
                            {CURRENCY} {Math.round(stats.originalPrice).toLocaleString()}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
