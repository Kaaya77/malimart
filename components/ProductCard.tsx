
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Star, ShoppingBag, Plus, Check, Sparkles, Flame, Eye, ArrowUpRight, MapPin, Layers } from 'lucide-react';
import { Product } from '../types';
import { useAppState } from '../context/AppContext';
import { useToast, VerifiedBadge } from './UI';
import { ProductCardImage } from './product-card/ProductCardImage';
import { ProductCardContent } from './product-card/ProductCardContent';
import { ProductCardActions } from './product-card/ProductCardActions';
import { CURRENCY } from '../constants';
import { useProductPricing } from '../hooks/useProductPricing';
import { useVariantSelection } from '../hooks/useVariantSelection';

interface ProductCardProps {
    product: Product;
    onClick?: () => void;
    onQuickView?: (product: Product) => void;
    onCompare?: (product: Product) => void;
    isComparing?: boolean;
    className?: string;
    layout?: 'grid' | 'list';
    index?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({ 
    product, 
    onClick, 
    onQuickView, 
    onCompare,
    isComparing = false,
    className = '', 
    layout = 'grid', 
    index = 0 
}) => {
    const { addToCart, toggleWishlist, isInWishlist } = useAppState();
    const navigate = useNavigate();
    const { addToast } = useToast();
    
    const [isHovered, setIsHovered] = useState(false);
    const [currentImgIdx, setCurrentImgIdx] = useState(0);
    const [isAdding, setIsAdding] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);
    const [activeVariantImage, setActiveVariantImage] = useState<string | null>(null);
    const [activeVariantId, setActiveVariantId] = useState<string | null>(null);

    const activeVariant = useMemo(() => {
        if (!activeVariantId) return null;
        return product.variants?.find(v => v.id === activeVariantId) || null;
    }, [activeVariantId, product.variants]);

    const stats = useProductPricing(product, activeVariant);
    const isLiked = isInWishlist(product.id);

    const isNew = useMemo(() => {
        if (!product.created_at) return false;
        const createdDate = new Date(product.created_at);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - createdDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
    }, [product.created_at]);

    const images = useMemo(() => {
        const list = product.images?.length ? product.images : ['https://via.placeholder.com/600x800?text=No+Image'];
        return Array.from(new Set(list));
    }, [product]);

    // Auto-rotate images on hover
    useEffect(() => {
        let timer: any;
        if (isHovered && images.length > 1 && !activeVariantImage) {
            timer = setInterval(() => {
                setCurrentImgIdx(prev => (prev + 1) % images.length);
            }, 1500); 
        }
        return () => clearInterval(timer);
    }, [isHovered, images, activeVariantImage]);

    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (stats.isOut) return;
        
        if (stats.hasVariants) {
            if(onClick) onClick(); else navigate(`/product/${product.id}`);
            return;
        }
        
        setIsAdding(true);
        addToCart(product);
        setTimeout(() => setIsAdding(false), 800);
    };

    const displayImage = activeVariantImage || images[currentImgIdx];

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            className={`group relative flex transition-all duration-300 cursor-pointer select-none ${layout === 'grid' ? 'flex-col' : 'flex-row gap-4 items-center'} ${className}`}
            onClick={(e) => {
                e.stopPropagation();
                onClick ? onClick() : navigate(`/product/${product.id}`);
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                setCurrentImgIdx(0);
                setActiveVariantImage(null);
                setActiveVariantId(null);
            }}
        >
            {/* INSET MEDIA CONTAINER */}
            <ProductCardImage 
                product={product}
                images={images}
                isNew={isNew}
                stats={stats}
                layout={layout}
                isHovered={isHovered}
            />

            {/* CONTENT AREA */}
            <div className={`flex flex-col flex-1 w-full relative z-10 ${layout === 'grid' ? 'mt-1' : ''}`}>
                <ProductCardContent 
                    product={product}
                    stats={stats}
                    layout={layout}
                    onStoreClick={(e: any) => { e.stopPropagation(); navigate(`/store/${product.seller_id}`); }}
                />
            </div>
            
            <ProductCardActions 
                product={product}
                stats={stats}
                isLiked={isLiked}
                isComparing={isComparing}
                onCompare={onCompare}
                onQuickView={onQuickView}
                onAdd={handleAdd}
                isAdding={isAdding}
                layout={layout}
            />
        </motion.div>
    );
};

