import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Product } from '../types';
import { useAppState } from '../context/AppContext';
import { useToast } from './UI';
import { ProductCardImage } from './product-card/ProductCardImage';
import { ProductCardContent } from './product-card/ProductCardContent';
import { ProductCardActions } from './product-card/ProductCardActions';
import { useProductPricing } from '../hooks/useProductPricing';

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

/**
 * Product card — used in grids on HomePage, ShopPage, StorePage, Wishlist.
 *
 * Hover behavior:
 *   - Image gently zooms (scale-1.04, 600ms ease-out)
 *   - Image cycles through additional images every 1500ms
 *   - Quick-view + add-to-cart pill appears at the bottom-right of the image
 *
 * Click behavior:
 *   - Whole card is clickable → onClick prop (defaults to navigate /product/:id)
 *   - Wishlist heart and action buttons stopPropagation
 *   - Add-to-cart: if variants exist, opens product detail page; otherwise inline add
 */
export const ProductCard: React.FC<ProductCardProps> = ({
    product,
    onClick,
    onQuickView,
    onCompare,
    isComparing = false,
    className = '',
    layout = 'grid',
    index = 0,
}) => {
    const { addToCart } = useAppState();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const { isInWishlist } = useAppState();
    const isLiked = isInWishlist(product.id);

    const [isHovered, setIsHovered] = useState(false);
    const [currentImgIdx, setCurrentImgIdx] = useState(0);
    const [isAdding, setIsAdding] = useState(false);
    const [activeVariantImage] = useState<string | null>(null);
    const [activeVariantId] = useState<string | null>(null);

    const activeVariant = useMemo(() => {
        if (!activeVariantId) return null;
        return product.variants?.find(v => v.id === activeVariantId) || null;
    }, [activeVariantId, product.variants]);

    const stats = useProductPricing(product, activeVariant);

    const isNew = useMemo(() => {
        if (!product.created_at) return false;
        const created = new Date(product.created_at).getTime();
        const days = (Date.now() - created) / (1000 * 60 * 60 * 24);
        return days <= 7;
    }, [product.created_at]);

    const images = useMemo(() => {
        const list = product.images?.length ? product.images : ['https://via.placeholder.com/600x800?text=No+Image'];
        return Array.from(new Set(list));
    }, [product]);

    // Auto-cycle images on hover (only when not pinned to a variant image)
    useEffect(() => {
        let timer: any;
        if (isHovered && images.length > 1 && !activeVariantImage) {
            timer = setInterval(() => {
                setCurrentImgIdx(prev => (prev + 1) % images.length);
            }, 1500);
        }
        return () => clearInterval(timer);
    }, [isHovered, images.length, activeVariantImage]);

    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (stats.isOut) return;

        // Variants present → route to product detail so user picks one
        if (stats.hasVariants) {
            if (onClick) onClick();
            else navigate(`/product/${product.id}`);
            return;
        }

        setIsAdding(true);
        addToCart(product);
        addToast(`${product.name} added to bag`, 'success');
        window.setTimeout(() => setIsAdding(false), 900);
    };

    const handleCardClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onClick) onClick();
        else navigate(`/product/${product.id}`);
    };

    const rootCls = `group relative flex select-none cursor-pointer
        ${layout === 'grid' ? 'flex-col' : 'flex-row gap-4 items-start py-3 border-b border-foreground/5 last:border-b-0'}
        ${className}`;

    return (
        <motion.article
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, delay: Math.min(index * 0.035, 0.4) }}
            className={rootCls}
            onClick={handleCardClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                setCurrentImgIdx(0);
            }}
        >
            {/* Image area — relative parent for absolutely-positioned actions */}
            <div className="relative w-full">
                <ProductCardImage
                    product={product}
                    images={images}
                    isNew={isNew}
                    stats={stats}
                    layout={layout}
                    isHovered={isHovered}
                    currentImgIdx={currentImgIdx}
                    activeVariantImage={activeVariantImage}
                />
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
                    isHovered={isHovered}
                />
            </div>

            <ProductCardContent
                product={product}
                stats={stats}
                layout={layout}
                onStoreClick={(e) => {
                    e.stopPropagation();
                    navigate(`/store/${product.seller_id}`);
                }}
            />
        </motion.article>
    );
};
