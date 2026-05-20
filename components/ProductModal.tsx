import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    X, Heart, Star, Shield, Truck, MapPin, Plus, Minus,
    ChevronLeft, ChevronRight, Share2, Package, ShoppingBag
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
 * Product detail modal — mobile-first.
 *
 * IMPORTANT — Rules of Hooks:
 * All hooks must be called unconditionally at the top of the component,
 * before any early return. useVariantSelection and useProductPricing now
 * accept null and return safe defaults, so this is safe.
 */
export const ProductModal: React.FC<ProductModalProps> = ({ product, isOpen, onClose }) => {
    const { addToCart, toggleWishlist, isInWishlist } = useAppState();
    const { addToast } = useToast();
    const navigate = useNavigate();

    // ── ALL hooks called unconditionally ──────────────────────────────────────
    const [selectedImg, setSelectedImg] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [isAdding, setIsAdding] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const imgScrollRef = useRef<HTMLDivElement>(null);

    // These hooks handle null product internally — no "!" assertion needed
    const { selectedOptions, setSelectedOptions, selectedVariant, variantStructure } = useVariantSelection(product);
    const stats = useProductPricing(product, selectedVariant);

    /* ── Swipe-to-dismiss (mobile) ── */
    const dragY = useMotionValue(0);
    const sheetOpacity = useTransform(dragY, [0, 300], [1, 0.2]);
    const backdropOpacity = useTransform(dragY, [0, 300], [1, 0]);

    const handleDragEnd = useCallback((_: any, info: PanInfo) => {
        if (info.offset.y > 120 || info.velocity.y > 500) onClose();
    }, [onClose]);

    const deliveryDate = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() + 3);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }, []);

    /* ── Lock body scroll ── */
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

    /* ── Reset on product change ── */
    useEffect(() => {
        setSelectedImg(0);
        setQuantity(1);
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, [product?.id]);

    /* ── Image list ── */
    const images = useMemo(() => {
        const base = product?.images || [];
        if (selectedVariant?.image_url) return [selectedVariant.image_url, ...base];
        return base.length ? base : ['https://via.placeholder.com/800x800?text=No+Image'];
    }, [product?.images, selectedVariant?.image_url]);

    /* ── Mobile scroll-snap image observer ── */
    useEffect(() => {
        const el = imgScrollRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const idx = Number(entry.target.getAttribute('data-idx'));
                        if (!isNaN(idx)) setSelectedImg(idx);
                    }
                });
            },
            { root: el, threshold: 0.6 }
        );
        el.querySelectorAll('[data-idx]').forEach(child => observer.observe(child));
        return () => observer.disconnect();
    }, [images, isOpen]);

    // ── Early return AFTER all hooks ─────────────────────────────────────────
    if (!product) return null;

    const isLiked = isInWishlist(product.id);
    const finalPrice = stats.price;
    const onSale = !!(stats.originalPrice && stats.originalPrice > stats.price);
    const savingsPct = onSale ? Math.round((1 - stats.price / (stats.originalPrice as number)) * 100) : 0;
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
            try { await navigator.share({ title: product.name, url }); } catch { /* cancelled */ }
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

                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ opacity: backdropOpacity }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
                    />

                    {/* ── MOBILE bottom sheet ── */}
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={product.name}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 32, stiffness: 300 }}
                        style={{ y: dragY, opacity: sheetOpacity }}
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.6 }}
                        onDragEnd={handleDragEnd}
                        className="relative z-50 w-full bg-background text-foreground
                            rounded-t-[20px] overflow-hidden shadow-2xl
                            flex flex-col h-[96dvh] md:hidden"
                    >
                        {/* Drag handle */}
                        <div className="flex-shrink-0 flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing">
                            <div className="w-10 h-1 rounded-full bg-foreground/20" />
                        </div>

                        {/* Top bar */}
                        <div className="flex-shrink-0 flex items-center justify-between px-4 pb-2">
                            <button
                                onClick={onClose}
                                aria-label="Close"
                                className="w-10 h-10 rounded-full bg-foreground/[0.06] flex items-center justify-center active:scale-90 transition-transform"
                            >
                                <X className="w-[18px] h-[18px] stroke-[2.2] text-foreground/80" />
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => toggleWishlist(product)}
                                    aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all
                                        ${isLiked
                                            ? 'bg-rose-500/10 text-rose-500'
                                            : 'bg-foreground/[0.06] text-foreground/70'}`}
                                >
                                    <Heart className={`w-[18px] h-[18px] ${isLiked ? 'fill-current stroke-none' : 'stroke-[2]'}`} />
                                </button>
                                <button
                                    onClick={handleShare}
                                    aria-label="Share"
                                    className="w-10 h-10 rounded-full bg-foreground/[0.06] flex items-center justify-center active:scale-90 transition-transform"
                                >
                                    <Share2 className="w-[18px] h-[18px] stroke-[2] text-foreground/70" />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable body */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-y-contain no-scrollbar">

                            {/* Image carousel */}
                            <div className="relative">
                                <div
                                    ref={imgScrollRef}
                                    className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
                                    style={{ WebkitOverflowScrolling: 'touch' }}
                                >
                                    {images.map((src, idx) => (
                                        <div
                                            key={`${src}-${idx}`}
                                            data-idx={idx}
                                            className="flex-shrink-0 w-full aspect-square snap-center"
                                        >
                                            <img
                                                src={src}
                                                alt={`${product.name} ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                                loading={idx === 0 ? 'eager' : 'lazy'}
                                            />
                                        </div>
                                    ))}
                                </div>

                                {onSale && (
                                    <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[11px] font-bold tracking-wide shadow-sm">
                                        −{savingsPct}%
                                    </div>
                                )}

                                {images.length > 1 && (
                                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                                        {images.map((_, idx) => (
                                            <button
                                                key={idx}
                                                aria-label={`Image ${idx + 1}`}
                                                onClick={() => {
                                                    setSelectedImg(idx);
                                                    const el = imgScrollRef.current;
                                                    if (el) el.children[idx]?.scrollIntoView({ behavior: 'smooth', inline: 'center' });
                                                }}
                                                className={`h-[5px] rounded-full transition-all duration-300
                                                    ${selectedImg === idx ? 'w-5 bg-foreground/80' : 'w-[5px] bg-foreground/25'}`}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Product info */}
                            <div className="px-5 pt-5 pb-4">
                                {/* Seller eyebrow */}
                                <div className="flex items-center gap-2 mb-2">
                                    <button
                                        onClick={() => { onClose(); navigate(`/store/${product.seller_id}`); }}
                                        className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/50 hover:text-foreground transition-colors"
                                    >
                                        {product.seller_name || 'Store'}
                                    </button>
                                    {product.is_verified && <VerifiedBadge className="scale-[0.7] origin-left -ml-1 opacity-80" />}
                                    {sellerLocation && (
                                        <span className="flex items-center gap-0.5 text-[11px] text-foreground/35">
                                            <MapPin className="w-3 h-3 stroke-[2.5]" />
                                            {sellerLocation}
                                        </span>
                                    )}
                                </div>

                                <h2 className="text-[22px] font-semibold tracking-tight leading-tight text-foreground mb-2">
                                    {product.name}
                                </h2>

                                {product.rating && (
                                    <div className="flex items-center gap-1.5 mb-4">
                                        <div className="flex">
                                            {[1, 2, 3, 4, 5].map(n => (
                                                <Star
                                                    key={n}
                                                    className={`w-3.5 h-3.5 ${n <= Math.round(product.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-foreground/15'}`}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-[13px] font-semibold text-foreground/75">{Number(product.rating).toFixed(1)}</span>
                                        {product.review_count ? (
                                            <span className="text-[13px] text-foreground/40">· {product.review_count} review{product.review_count === 1 ? '' : 's'}</span>
                                        ) : null}
                                    </div>
                                )}

                                {/* Price */}
                                <div className="flex items-baseline gap-2.5 mb-5">
                                    <span className="text-[28px] font-bold tracking-tight text-foreground">
                                        {CURRENCY} {finalPrice.toLocaleString()}
                                    </span>
                                    {onSale && (
                                        <span className="text-[15px] font-medium text-foreground/35 line-through">
                                            {CURRENCY} {Math.round(stats.originalPrice as number).toLocaleString()}
                                        </span>
                                    )}
                                    {onSale && (
                                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                            Save {savingsPct}%
                                        </span>
                                    )}
                                </div>

                                {/* Trust strip */}
                                <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1 mb-5">
                                    {[
                                        { icon: Truck, label: 'Delivery', value: `By ${deliveryDate}` },
                                        { icon: Shield, label: 'Protection', value: 'Refund guarantee' },
                                        { icon: Package, label: 'Stock', value: stats.isOut ? 'Out of stock' : (product.stock != null ? `${product.stock} available` : 'In stock') },
                                    ].map(item => (
                                        <div
                                            key={item.label}
                                            className="flex-shrink-0 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-foreground/[0.03] ring-1 ring-foreground/[0.04]"
                                        >
                                            <item.icon className="w-4 h-4 text-foreground/50 flex-shrink-0" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">{item.label}</span>
                                                <span className="text-[12px] font-medium text-foreground whitespace-nowrap">{item.value}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {product.description && (
                                    <p className="text-[14px] text-foreground/65 leading-relaxed mb-5 whitespace-pre-line">
                                        {product.description}
                                    </p>
                                )}

                                {/* Variants */}
                                {variantStructure.length > 0 && (
                                    <div className="space-y-4 mb-5">
                                        {variantStructure.map(attr => (
                                            <div key={attr.name}>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">{attr.name}</span>
                                                    <span className="text-[12px] font-semibold text-foreground">{selectedOptions[attr.name]}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {attr.values.map(val => {
                                                        const isSelected = selectedOptions[attr.name] === val;
                                                        return (
                                                            <button
                                                                key={val}
                                                                onClick={() => setSelectedOptions({ ...selectedOptions, [attr.name]: val })}
                                                                className={`px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-95 min-h-[44px]
                                                                    ${isSelected
                                                                        ? 'bg-foreground text-background ring-1 ring-foreground'
                                                                        : 'bg-transparent text-foreground/75 ring-1 ring-foreground/12 active:ring-foreground/30'}`}
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

                                <div className="pt-5 border-t border-foreground/8">
                                    <ReviewSection productId={product.id} />
                                </div>
                            </div>
                        </div>

                        {/* Mobile sticky CTA */}
                        <div
                            className="flex-shrink-0 px-4 pt-3 border-t border-foreground/8 bg-background/95 backdrop-blur-xl"
                            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="flex items-center bg-foreground/[0.04] rounded-xl ring-1 ring-foreground/10 h-[48px]">
                                    <button
                                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                        aria-label="Decrease quantity"
                                        className="w-10 h-full flex items-center justify-center text-foreground/60 active:bg-foreground/[0.06] rounded-l-xl transition-colors"
                                    >
                                        <Minus className="w-4 h-4 stroke-[2.2]" />
                                    </button>
                                    <span className="w-7 text-center text-[14px] font-bold tabular-nums select-none">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(q => q + 1)}
                                        aria-label="Increase quantity"
                                        className="w-10 h-full flex items-center justify-center text-foreground/60 active:bg-foreground/[0.06] rounded-r-xl transition-colors"
                                    >
                                        <Plus className="w-4 h-4 stroke-[2.2]" />
                                    </button>
                                </div>

                                <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => handleAddToCart(false)}
                                    disabled={isAdding || stats.isOut}
                                    className={`flex-1 h-[48px] rounded-xl flex items-center justify-center gap-2 text-[15px] font-semibold transition-all
                                        ${stats.isOut
                                            ? 'bg-foreground/10 text-foreground/40 cursor-not-allowed'
                                            : 'bg-foreground text-background active:bg-foreground/90'}`}
                                >
                                    {isAdding ? 'Adding…' : stats.isOut
                                        ? 'Out of stock'
                                        : <><ShoppingBag className="w-[18px] h-[18px] stroke-[2]" /> Add · {CURRENCY} {(finalPrice * quantity).toLocaleString()}</>}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>

                    {/* ── DESKTOP dialog ── */}
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={product.name}
                        initial={{ opacity: 0, y: 30, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 30, scale: 0.98 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                        className="relative z-50 w-full max-w-5xl bg-background text-foreground
                            rounded-3xl overflow-hidden shadow-2xl ring-1 ring-foreground/5
                            hidden md:flex flex-row max-h-[88vh]"
                    >
                        {/* Close + share */}
                        <div className="absolute top-5 right-5 z-[60] flex gap-2">
                            <button
                                onClick={handleShare}
                                aria-label="Share"
                                className="w-9 h-9 rounded-full bg-background/80 text-foreground ring-1 ring-foreground/10 backdrop-blur-md flex items-center justify-center hover:bg-background transition-colors"
                            >
                                <Share2 className="w-4 h-4 stroke-[2.2]" />
                            </button>
                            <button
                                onClick={onClose}
                                aria-label="Close"
                                className="w-9 h-9 rounded-full bg-background/80 text-foreground ring-1 ring-foreground/10 backdrop-blur-md flex items-center justify-center hover:bg-background transition-colors"
                            >
                                <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>

                        {/* Left: image gallery */}
                        <div className="relative w-3/5 flex-shrink-0 bg-foreground/[0.03]">
                            <div className="relative h-full w-full overflow-hidden">
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

                                {images.length > 1 && (
                                    <>
                                        <button onClick={prevImg} aria-label="Previous image"
                                            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 text-foreground ring-1 ring-foreground/10 backdrop-blur-md flex items-center justify-center hover:bg-background transition-colors">
                                            <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
                                        </button>
                                        <button onClick={nextImg} aria-label="Next image"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 text-foreground ring-1 ring-foreground/10 backdrop-blur-md flex items-center justify-center hover:bg-background transition-colors">
                                            <ChevronRight className="w-5 h-5 stroke-[2.2]" />
                                        </button>
                                    </>
                                )}

                                {onSale && (
                                    <div className="absolute top-4 left-4 z-10 px-2.5 py-1 rounded-md bg-emerald-500 text-white text-[11px] font-semibold tracking-wide shadow-sm">
                                        −{savingsPct}% off
                                    </div>
                                )}
                            </div>

                            {images.length > 1 && (
                                <div className="absolute bottom-4 left-4 right-4 gap-2 flex justify-center">
                                    {images.slice(0, 6).map((src, idx) => (
                                        <button
                                            key={`${src}-${idx}`}
                                            onClick={() => setSelectedImg(idx)}
                                            className={`w-12 h-12 rounded-lg overflow-hidden ring-2 transition-all
                                                ${selectedImg === idx ? 'ring-foreground' : 'ring-foreground/0 hover:ring-foreground/30'}`}
                                        >
                                            <img src={src} alt="" className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right: content + CTA */}
                        <div className="flex-1 w-2/5 flex flex-col min-h-0">
                            <div className="flex-1 overflow-y-auto no-scrollbar px-8 pt-10 pb-6">
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

                                <h2 className="font-sans text-[28px] font-semibold tracking-tight leading-tight text-foreground mb-3">
                                    {product.name}
                                </h2>

                                {product.rating && (
                                    <div className="flex items-center gap-1.5 mb-5 text-sm">
                                        <div className="flex">
                                            {[1, 2, 3, 4, 5].map(n => (
                                                <Star key={n}
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

                                <div className="flex items-baseline gap-3 mb-6">
                                    <span className="font-sans text-[34px] font-bold tracking-tight text-foreground">
                                        {CURRENCY} {finalPrice.toLocaleString()}
                                    </span>
                                    {onSale && (
                                        <span className="text-base font-medium text-foreground/40 line-through">
                                            {CURRENCY} {Math.round(stats.originalPrice as number).toLocaleString()}
                                        </span>
                                    )}
                                    {onSale && (
                                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                            Save {savingsPct}%
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-3 gap-3 mb-7">
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

                                {product.description && (
                                    <p className="text-[14px] text-foreground/70 leading-relaxed mb-7 whitespace-pre-line">
                                        {product.description}
                                    </p>
                                )}

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

                                <div className="pt-6 border-t border-foreground/8">
                                    <ReviewSection productId={product.id} />
                                </div>
                            </div>

                            {/* Desktop CTA */}
                            <div className="px-8 py-5 border-t border-foreground/8 bg-background/95 backdrop-blur-xl flex items-center gap-3">
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

                                <div className="flex items-center bg-foreground/[0.04] rounded-xl ring-1 ring-foreground/10 h-12">
                                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} aria-label="Decrease quantity"
                                        className="w-10 h-full flex items-center justify-center text-foreground/70 hover:text-foreground">
                                        <Minus className="w-4 h-4 stroke-[2.2]" />
                                    </button>
                                    <span className="w-7 text-center text-sm font-semibold tabular-nums">{quantity}</span>
                                    <button onClick={() => setQuantity(q => q + 1)} aria-label="Increase quantity"
                                        className="w-10 h-full flex items-center justify-center text-foreground/70 hover:text-foreground">
                                        <Plus className="w-4 h-4 stroke-[2.2]" />
                                    </button>
                                </div>

                                <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => handleAddToCart(false)}
                                    disabled={isAdding || stats.isOut}
                                    className={`flex-1 h-12 rounded-xl flex items-center justify-center gap-2 text-[15px] font-semibold transition-all
                                        ${stats.isOut
                                            ? 'bg-foreground/10 text-foreground/40 cursor-not-allowed'
                                            : 'bg-foreground text-background hover:bg-primary hover:text-primary-foreground'}`}
                                >
                                    {isAdding ? 'Adding…' : stats.isOut
                                        ? 'Out of stock'
                                        : <> Add to bag <span className="font-bold tabular-nums">· {CURRENCY} {(finalPrice * quantity).toLocaleString()}</span></>}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
