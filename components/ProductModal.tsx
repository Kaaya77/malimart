import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
    X, Heart, Star, Shield, Truck, 
    ChevronLeft, ChevronRight, Share2, Info, 
    Repeat, CreditCard, MessageCircle, Ruler, Calendar
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
        if (product!.variants && product!.variants.length > 0) {
            const prices = product!.variants.map(v => v.base_price);
            return Math.min(...prices);
        }
        return product!.price;
    }, [product]);

    const deliveryDate = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() + 3);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }, []);
    const viewers = useMemo(() => Math.floor(Math.random() * 15) + 5, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]);

    if (!product) return null;

    const isLiked = isInWishlist(product.id);
    const images = selectedVariant?.image_url ? [selectedVariant.image_url, ...product.images] : product.images;
    
    const finalPrice = stats.price;
    const comparePrice = stats.originalPrice || stats.price;
    const variantDiscountPct = stats.variantDiscount;

    const handleAddToCart = (redirect: boolean = false) => {
        setIsAdding(true);
        addToCart(product, selectedVariant, quantity);
        addToast(`${product.name} added to bag`, 'success');
        setTimeout(() => {
            setIsAdding(false);
            onClose();
            if (redirect) navigate('/cart');
        }, 800);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[300] flex items-end justify-center p-0 md:p-6 md:items-center font-sans">
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm z-0"
                    />

                    {/* Modal Container */}
                    <motion.div 
                        initial={{ opacity: 0, y: 300, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 300, scale: 0.95 }}
                        transition={{ type: "spring", damping: 28, stiffness: 300 }}
                        className="relative z-50 w-full md:max-w-2xl bg-background text-foreground rounded-t-[2.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh]"
                    >
                        {/* Mobile Drag Indicator */}
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-foreground/20 rounded-full md:hidden z-[60]" />

                        {/* Close Button */}
                        <button 
                            onClick={onClose}
                            className="absolute top-4 right-4 md:top-6 md:right-6 z-[60] w-10 h-10 flex items-center justify-center text-white bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all"
                        >
                            <X className="w-5 h-5 stroke-[2.5]" />
                        </button>

                        <div className="flex-1 overflow-y-auto no-scrollbar relative">
                            {/* Main Image Banner */}
                            <div className="w-full aspect-square md:aspect-video relative bg-foreground/5">
                                <img 
                                    src={images[selectedImg]} 
                                    className="w-full h-full object-cover"
                                    alt={product.name}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-60 md:opacity-0" />
                                
                                {/* Image Navigation (if multiple) */}
                                {images.length > 1 && (
                                    <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 z-20">
                                        {images.map((_, idx) => (
                                            <div key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${selectedImg === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-6 md:p-8 -mt-6 relative z-10 bg-background rounded-t-[2rem] md:rounded-none md:-mt-0">
                                {/* Title & Price Row */}
                                <div className="flex justify-between items-start gap-4 mb-3">
                                    <h2 className="font-sans text-3xl md:text-4xl font-black leading-none tracking-tight text-foreground">
                                        {product.name}
                                    </h2>
                                    <div className="flex flex-col items-end shrink-0">
                                        <span className="font-sans text-3xl md:text-4xl font-black text-foreground tracking-tighter">
                                            {CURRENCY} {finalPrice.toLocaleString()}
                                        </span>
                                        {comparePrice > basePrice && (
                                            <span className="text-sm font-bold text-foreground/40 line-through">
                                                {CURRENCY} {comparePrice.toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Store & Rating Info */}
                                <div className="flex items-center gap-3 mb-8 text-sm font-bold text-foreground/60 w-fit px-4 py-2 bg-foreground/5 rounded-full">
                                    <button onClick={() => { onClose(); navigate(`/store/${product.seller_id}`); }} className="hover:text-primary transition-colors flex items-center gap-1">
                                        {product.seller_name || 'Store'}
                                        {product.is_verified && <VerifiedBadge className="scale-75 origin-left" />}
                                    </button>
                                    <span className="w-1 h-1 bg-foreground/20 rounded-full" />
                                    <div className="flex items-center gap-1">
                                        <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                                        <span>{product.rating?.toFixed(1) || '4.8'}</span>
                                    </div>
                                </div>

                                {/* Description */}
                                <p className="text-base text-foreground/70 font-medium mb-10 leading-relaxed max-w-xl">
                                    {product.description}
                                </p>

                                {/* Variants */}
                                {variantStructure.length > 0 && (
                                    <div className="space-y-6 mb-8">
                                        {variantStructure.map(attr => (
                                            <div key={attr.name}>
                                                <div className="flex justify-between items-center mb-3">
                                                    <span className="text-sm font-bold text-foreground">{attr.name}</span>
                                                    <span className="text-sm font-bold text-primary">{selectedOptions[attr.name]}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {attr.values.map(val => {
                                                        const isSelected = selectedOptions[attr.name] === val;
                                                        return (
                                                            <button 
                                                                key={val} 
                                                                onClick={() => setSelectedOptions({...selectedOptions, [attr.name]: val})} 
                                                                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${isSelected ? 'bg-primary text-primary-foreground border-2 border-primary' : 'bg-foreground/5 text-foreground border-2 border-transparent hover:bg-foreground/10'}`}
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

                                {/* Reviews Section */}
                                <div className="mt-8 pt-8 border-t border-foreground/10">
                                    <ReviewSection productId={product.id} />
                                </div>
                            </div>
                        </div>

                        {/* Sticky Bottom Action Bar */}
                        <div className="p-4 md:p-6 bg-background/80 backdrop-blur-xl border-t border-foreground/5 flex items-center gap-4 sticky bottom-0 z-20 layout-pb">
                            {/* Quantity Selector */}
                            <div className="flex items-center justify-between bg-foreground/5 rounded-full px-1.5 h-14 w-28 md:w-32 shrink-0 border border-foreground/5">
                                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-black transition-colors text-xl font-medium">-</button>
                                <span className="text-lg font-black">{quantity}</span>
                                <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-black transition-colors text-xl font-medium">+</button>
                            </div>
                            
                            {/* Add to Cart Button */}
                            <motion.button 
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleAddToCart(false)}
                                disabled={isAdding || stats.isOut}
                                className={`flex-1 h-14 rounded-full flex items-center justify-center gap-2 text-base md:text-lg font-black shadow-xl shadow-primary/20 transition-all active:scale-95 duration-200 ${stats.isOut ? 'bg-foreground/10 text-foreground/40 cursor-not-allowed shadow-none' : 'bg-primary text-primary-foreground hover:shadow-primary/40'}`}
                            >
                                {isAdding ? 'Adding...' : stats.isOut ? 'Out of Stock' : `Add to order — ${CURRENCY} ${(finalPrice * quantity).toLocaleString()}`}
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

