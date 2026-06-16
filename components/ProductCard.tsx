import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Product } from '../types';
import { useCart, useCatalog } from '../context/AppContext';
import { useToast } from './UI';
import { ProductCardImage } from './product-card/ProductCardImage';
import { ProductCardContent } from './product-card/ProductCardContent';
import { ProductCardActions } from './product-card/ProductCardActions';
import { useProductPricing } from '../hooks/useProductPricing';
import { getCategoryEmoji, getActionMessage } from '../services/productExperience';

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
 * FIX: Image cycling interval now has a touch-device guard. On phones/tablets
 * the interval fired even though hover is a no-op on touch, causing
 * unnecessary re-renders and scroll jitter during fast flings.
 * The guard checks `ontouchstart in window` (primary) and
 * `navigator.maxTouchPoints > 0` (covers pointer-capable touch devices).
 */
const ProductCardInner: React.FC<ProductCardProps> = ({
 product,
 onClick,
 onQuickView,
 onCompare,
 isComparing = false,
 className = '',
 layout = 'grid',
 index = 0,
}) => {
 const { addToCart } = useCart();
 const navigate = useNavigate();
 const { addToast } = useToast();

 const { isInWishlist } = useCatalog();
 const isLiked = isInWishlist(product.id);

 const [isHovered, setIsHovered] = useState(false);
 const [currentImgIdx, setCurrentImgIdx] = useState(0);
 const [isAdding, setIsAdding] = useState(false);
 const [showBurst, setShowBurst] = useState(false);
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
 const list = product.images?.length ? product.images : ['data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 600 800%27%3E%3Crect width=%27600%27 height=%27800%27 fill=%27%23f1f0ec%27/%3E%3Cg fill=%27%23c8c5bc%27%3E%3Ccircle cx=%27300%27 cy=%27340%27 r=%2770%27/%3E%3Cpath d=%27M170 560 q60 -110 130 -40 q40 -70 130 30 l0 50 l-260 0 z%27/%3E%3C/g%3E%3Ctext x=%27300%27 y=%27660%27 font-family=%27sans-serif%27 font-size=%2728%27 fill=%27%23a8a59c%27 text-anchor=%27middle%27%3ENo image%3C/text%3E%3C/svg%3E'];
 return Array.from(new Set(list));
 }, [product]);

 // FIX: Guard against touch devices — hover cycling causes scroll jitter on mobile.
 // `ontouchstart in window` covers iOS/Android; maxTouchPoints covers hybrid devices.
 useEffect(() => {
 let timer: any;
 const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
 if (isHovered && images.length > 1 && !activeVariantImage && !isTouch) {
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
 setShowBurst(true);
 addToCart(product);
 const msg = getActionMessage('add_to_cart', product.category);
 addToast(`${getCategoryEmoji(product.category)} ${msg}`, 'success');
 window.setTimeout(() => setIsAdding(false), 900);
 window.setTimeout(() => setShowBurst(false), 900);
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
 {/* Emoji burst on add-to-cart */}
 <AnimatePresence>
   {showBurst && Array.from({ length: 5 }).map((_, i) => (
     <motion.span
       key={i}
       className="absolute pointer-events-none text-xl select-none z-50"
       style={{ left: `${20 + i * 15}%`, bottom: '20%' }}
       initial={{ opacity: 1, y: 0, scale: 0.5, rotate: 0 }}
       animate={{ opacity: 0, y: -60 - i * 15, scale: 1.2, rotate: (i - 2) * 30 }}
       exit={{ opacity: 0 }}
       transition={{ duration: 0.7, delay: i * 0.06, ease: 'easeOut' }}
     >
       {getCategoryEmoji(product.category)}
     </motion.span>
   ))}
 </AnimatePresence>
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

export const ProductCard = React.memo(ProductCardInner);
