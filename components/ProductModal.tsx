import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    X, Heart, Star, Shield, Truck, MapPin, Plus, Minus,
    ChevronLeft, ChevronRight, Share2, Package
} from 'lucide-react';
import { Product } from '../types';
import { useAppState } from '../context/AppContext';
import { useToast, VerifiedBadge } from './UI';
import { CURRENCY } from '../constants';
import { ReviewSection } from './ReviewSection';
import { useProductPricing } from '../hooks/useProductPricing';
import { useVariantSelection } from '../hooks/useVariantSelection';

interface ProductModalProps {
    product: Product | null;
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Product detail modal.
 *
 * Layout:
 *   - Mobile (<md): full-screen bottom sheet. Image up top (square), scrolling content below, sticky add-to-cart bar.
 *   - Desktop (≥md): centered card, image left (60%) with thumbnail rail, content right (40%), sticky CTA in right column.
 *
 * Removes the previous mobile drag indicator + black/40 backdrop in favor of
 * a softer 60% backdrop and a sharper, smaller close button.
 */
export const ProductModal: React.FC<ProductModalProps> = ({ product, isOpen, onClose }) => {
    const { addToCart, toggleWishlist, isInWishlist } = useAppState();
    const { addToast } = useToast();
    const navigate = useNavigate();

    const [selectedImg, setSelectedImg] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [isAdding, setIsAdding] = useState(false);

    const { selectedOptions, setSelectedOptions, selectedVariant, variantStructure } = useVariantSelection(product!);
    const stats = useProductPricing(product!, selectedVariant);

    const basePrice = useMemo(() => {
        if (product?.variants && product.variants.length > 0) {
            return Math.min(...product.variants.map(v => v.base_price));
        }
        return product?.price ?? 0;
    }, [product]);

    const deliveryDate = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() + 3);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onEsc);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener('keydown', onEsc);
        };
    }, [isOpen, onClose]);

    useEffect(() => {
        setSelectedImg(0);
        setQuantity(1);
    }, [product?.id]);

    // Hooks MUST be declared before any early return.
    const images = useMemo(() => {
        const base = product?.images || [];
        if (selectedVariant?.image_url) return [selectedVariant.image_url, ...base];
        return base.length ? base : ['https://via.placeholder.com/800x800?text=No+Image'];
    }, [product?.images, selectedVariant?.image_url]);

    if (!product) return null;

    const isLiked = isInWishlist(product.id);

    const finalPrice = stats.price;
    const onSale = stats.originalPrice && stats.originalPrice > stats.price;
    const savingsPct = onSale ? Math.round((1 - stats.price / stats.originalPrice) * 100) : 0;
    const sellerLocation = (product as any).seller_location || product.location;

    const handleAddToCart = (redirect = false) => {
        setIsAdding(true);
        addToCart(product, selectedVariant, quantity);
        addToast(`${product.name} added to bag`, 'success');
        window.setTimeout(() => {
            setIsAdding(false);
            onClose();
            if (redirect) navigate('/cart');
        }, 700);
    };

    const handleShare = async () => {
        const url = `${window.location.origin}/product/${product.id}`;
        if (navigator.share) {
            try { await navigator.share({ title: product.name, url }); } catch { /* user cancelled */ }
        } else {
            await navigator.clipboard.writeText(url);
            addToast('Link copied', 'success');
        }
    };

    const nextImg = () => setSelectedImg(i => (i + 1) % images.length);
    const prevImg = () => setSelectedImg(i => (i - 1 + images.length) % images.length);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center p-0 md:p-6 font-sans">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
                    />

                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={product.name}
                        initial={{ opacity: 0, y: 40, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.98 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                        className="relative z-50 w-full md:max-w-5xl bg-background text-foreground
                            rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl ring-1 ring-foreground/5
                            flex flex-col md:flex-row max-h-[95vh] md:max-h-[88vh]"
                    >
                        {/* Mobile drag handle */}
                        <div className="md:hidden absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 bg-foreground/15 rounded-full z-[60]" />

                        {/* Close + share — top-right, available on all breakpoints */}
                        <div className="absolute top-4 right-4 md:top-5 md:right-5 z-[60] flex gap-2">
                            <button
                                onClick={handleShare}
                                aria-label="Share"
                                className="w-9 h-9 rounded-full bg-white/80 dark:bg-black/70 text-foreground ring-1 ring-foreground/10 backdrop-blur-md flex items-center justify-center hover:bg-white dark:hover:bg-black transition-colors"
                            >
                                <Share2 className="w-4 h-4 stroke-[2.2]" />
                            </button>
                            <button
                                onClick={onClose}
                                aria-label="Close"
                                className="w-9 h-9 rounded-full bg-white/80 dark:bg-black/70 text-foreground ring-1 ring-foreground/10 backdrop-blur-md flex items-center justify-center hover:bg-white dark:hover:bg-black transition-colors"
                            >
                                <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>

                        {/* ───── Left: Image gallery ───── */}
                        <div className="relative md:w-3/5 md:flex-shrink-0 bg-foreground/[0.03] dark:bg-white/[0.03]">
                            <div className="relative aspect-square md:aspect-auto md:h-full w-full overflow-hidden">
                                <AnimatePresence mode="wait">
                                    <motion.img
                                        key={images[selectedImg]}
                                        src={images[selectedImg]}
                                        alt={product.name}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="w-full h-full object-cover"
                                    />
                                </AnimatePresence>

                                {/* Prev / Next arrows */}
                                {images.length > 1 && (
                                    <>
                                        <button
                                            onClick={prevImg}
                                            aria-label="Previous image"
                                            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 dark:bg-black/60 text-foreground ring-1 ring-foreground/10 backdrop-blur-md flex items-center justify-center hover:bg-white dark:hover:bg-black transition-colors"
                                        >
                                            <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
                                        </button>
                                        <button
                                            onClick={nextImg}
                                            aria-label="Next image"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 dark:bg-black/60 text-foreground ring-1 ring-foreground/10 backdrop-blur-md flex items-center justify-center hover:bg-white dark:hover:bg-black transition-colors"
                                        >
                                            <ChevronRight className="w-5 h-5 stroke-[2.2]" />
                                        </button>
                                    </>
                                )}

                                {/* Sale badge */}
                                {onSale && (
                                    <div className="absolute top-4 left-4 z-10 px-2.5 py-1 rounded-md bg-emerald-500 text-white text-[11px] font-semibold tracking-wide shadow-sm">
                                        −{savingsPct}% off
                                    </div>
                                )}
                            </div>

                            {/* Thumbnail rail (desktop) */}
                            {images.length > 1 && (
                                <div className="hidden md:flex absolute bottom-4 left-4 right-4 gap-2 justify-center">
                                    {images.slice(0, 6).map((src, idx) => (
                                        <button
                                            key={`${src}-${idx}`}
                                            onClick={() => setSelectedImg(idx)}
                                            className={`w-12 h-12 rounded-lg overflow-hidden ring-2 transition-all
                                                ${selectedImg === idx ? 'ring-foreground' : 'ring-white/0 hover:ring-white/40'}`}
                                        >
                                            <img src={src} alt="" className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Mobile image pips */}
                            {images.length > 1 && (
                                <div className="md:hidden absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
                                    {images.map((_, idx) => (
                                        <span
                                            key={idx}
                                            className={`h-1.5 rounded-full transition-all duration-300
                                                ${selectedImg === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/55'}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ───── Right: Content + sticky CTA ───── */}
                        <div className="flex-1 md:w-2/5 flex flex-col min-h-0">
                            <div className="flex-1 overflow-y-auto no-scrollbar px-6 md:px-8 pt-6 md:pt-10 pb-6">
                                {/* Eyebrow row: seller + verified + location */}
                                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/55 mb-4">
                                    <button
                                        onClick={() => { onClose(); navigate(`/store/${product.seller_id}`); }}
                                        className="hover:text-foreground transition-colors"
                                    >
                                        {product.seller_name || 'Store'}
                                    </button>
                                    {product.is_verified && <VerifiedBadge className="scale-75 origin-left -ml-1 opacity-90" />}
                                    {sellerLocation && (
                                        <span className="flex items-center gap-0.5 text-foreground/40 normal-case tracking-normal font-medium">
                                            <MapPin className="w-3 h-3 stroke-[2.5]" />
                                            {sellerLocation}
                                        </span>
                                    )}
                                </div>

                                <h2 className="font-sans text-2xl md:text-[28px] font-semibold tracking-tight leading-tight text-foreground mb-3">
                                    {product.name}
                                </h2>

                                {/* Rating */}
                                {product.rating && (
                                    <div className="flex items-center gap-1.5 mb-5 text-sm">
                                        <div className="flex">
                                            {[1, 2, 3, 4, 5].map(n => (
                                                <Star
                                                    key={n}
                                                    className={`w-3.5 h-3.5 ${n <= Math.round(product.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-foreground/15'}`}
                                                />
                                            ))}
                                        </div>
                                        <span className="font-semibold text-foreground/80">{Number(product.rating).toFixed(1)}</span>
                                        {product.review_count ? (
                                            <span className="text-foreground/40">· {product.review_count} review{product.review_count === 1 ? '' : 's'}</span>
                                        ) : null}
                                    </div>
                                )}

                                {/* Price */}
                                <div className="flex items-baseline gap-3 mb-6">
                                    <span className="font-sans text-3xl md:text-[34px] font-bold tracking-tight text-foreground">
                                        {CURRENCY} {finalPrice.toLocaleString()}
                                    </span>
                                    {onSale && (
                                        <span className="text-base font-medium text-foreground/40 line-through">
                                            {CURRENCY} {Math.round(stats.originalPrice).toLocaleString()}
                                        </span>
                                    )}
                                    {onSale && (
                                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                            Save {savingsPct}%
                                        </span>
                                    )}
                                </div>

                                {/* Trust strip */}
                                <div className="grid grid-cols-3 gap-3 mb-7 -mx-1">
                                    <div className="flex flex-col gap-1 p-3 rounded-xl bg-foreground/[0.03]">
                                        <Truck className="w-4 h-4 text-foreground/60" />
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/45">Delivery</span>
                                        <span className="text-xs font-medium text-foreground">By {deliveryDate}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 p-3 rounded-xl bg-foreground/[0.03]">
                                        <Shield className="w-4 h-4 text-foreground/60" />
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/45">Buyer Protection</span>
                                        <span className="text-xs font-medium text-foreground">Refund if not as described</span>
                                    </div>
                                    <div className="flex flex-col gap-1 p-3 rounded-xl bg-foreground/[0.03]">
                                        <Package className="w-4 h-4 text-foreground/60" />
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground/45">Stock</span>
                                        <span className="text-xs font-medium text-foreground">
                                            {stats.isOut ? 'Out of stock' : (product.stock != null ? `${product.stock} available` : 'In stock')}
                                        </span>
                                    </div>
                                </div>

                                {/* Description */}
                                {product.description && (
                                    <p className="text-[14px] text-foreground/70 leading-relaxed mb-7 whitespace-pre-line">
                                        {product.description}
                                    </p>
                                )}

                                {/* Variants */}
                                {variantStructure.length > 0 && (
                                    <div className="space-y-5 mb-7">
                                        {variantStructure.map(attr => (
                                            <div key={attr.name}>
                                                <div className="flex justify-between items-center mb-2.5">
                                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55">{attr.name}</span>
                                                    <span className="text-xs font-semibold text-foreground">{selectedOptions[attr.name]}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {attr.values.map(val => {
                                                        const isSelected = selectedOptions[attr.name] === val;
                                                        return (
                                                            <button
                                                                key={val}
                                                                onClick={() => setSelectedOptions({ ...selectedOptions, [attr.name]: val })}
                                                                className={`px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all
                                                                    ${isSelected
                                                                        ? 'bg-foreground text-background ring-1 ring-foreground'
                                                                        : 'bg-transparent text-foreground/80 ring-1 ring-foreground/15 hover:ring-foreground/40 hover:text-foreground'}`}
                                                            >
                                                                {val}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Reviews */}
                                <div className="pt-6 border-t border-foreground/8">
                                    <ReviewSection productId={product.id} />
                                </div>
                            </div>

                            {/* ───── Sticky CTA bar ───── */}
                            <div className="px-6 md:px-8 py-4 md:py-5 border-t border-foreground/8 bg-background/95 backdrop-blur-xl flex items-center gap-3 layout-pb">
                                <button
                                    onClick={() => toggleWishlist(product)}
                                    aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
                                    className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors
                                        ${isLiked
                                            ? 'bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/30'
                                            : 'bg-foreground/[0.04] text-foreground/70 ring-1 ring-foreground/10 hover:text-foreground'}`}
                                >
                                    <Heart className={`w-5 h-5 ${isLiked ? 'fill-current stroke-none' : 'stroke-[2]'}`} />
                                </button>

                                {/* Quantity */}
                                <div className="flex items-center bg-foreground/[0.04] rounded-xl ring-1 ring-foreground/10 h-12">
                                    <button
                                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                        aria-label="Decrease quantity"
                                        className="w-10 h-full flex items-center justify-center text-foreground/70 hover:text-foreground"
                                    >
                                        <Minus className="w-4 h-4 stroke-[2.2]" />
                                    </button>
                                    <span className="w-7 text-center text-sm font-semibold tabular-nums">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(q => q + 1)}
                                        aria-label="Increase quantity"
                                        className="w-10 h-full flex items-center justify-center text-foreground/70 hover:text-foreground"
                                    >
                                        <Plus className="w-4 h-4 stroke-[2.2]" />
                                    </button>
                                </div>

                                <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => handleAddToCart(false)}
                                    disabled={isAdding || stats.isOut}
                                    className={`flex-1 h-12 rounded-xl flex items-center justify-center gap-2 text-sm md:text-[15px] font-semibold transition-all
                                        ${stats.isOut
                                            ? 'bg-foreground/10 text-foreground/40 cursor-not-allowed'
                                            : 'bg-foreground text-background hover:bg-primary hover:text-primary-foreground'}`}
                                >
                                    {isAdding ? 'Adding…' : stats.isOut
                                        ? 'Out of stock'
                                        : <>
                                            Add to bag
                                            <span className="font-bold tabular-nums">
                                                · {CURRENCY} {(finalPrice * quantity).toLocaleString()}
                                            </span>
                                        </>}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
