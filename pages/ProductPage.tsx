
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Star, Heart, ShoppingBag, Truck, ShieldCheck, 
    Minus, Plus, MessageSquare, ArrowLeft, Share2, Check, Copy,
    Shield, RotateCcw, CreditCard, Zap, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../context/AppContext';
import { Button, Badge, Skeleton, Accordion, useToast } from '../components/UI';
import { ReviewSection } from '../components/ReviewSection';
import { ProductCard } from '../components/ProductCard';
import { Magnetic } from '../components/Effects';
import { CURRENCY, formatTZS } from '../constants';
import { Product, VendorProfile } from '../types';
import { supabase } from '../services/supabaseClient';

export const ProductPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { products, addToCart, toggleWishlist, isInWishlist, getActiveOfferForProduct, addToRecentlyViewed, user } = useAppState();
    const { addToast } = useToast();
    
    const [product, setProduct] = useState<Product | null>(null);
    const [vendor, setVendor] = useState<VendorProfile | null>(null);
    const [activeImage, setActiveImage] = useState(0);
    const [qty, setQty] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    
    // Variant state
    const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        const found = products.find(p => p.id === id);
        if (found) {
            setProduct(found);
            addToRecentlyViewed(found);
            setIsLoading(false);
        } else if (id) {
            supabase.from('products').select('*, variants:product_variants(*)').eq('id', id).single()
                .then(({ data, error }) => {
                    if (data) {
                        const p = data as Product;
                        setProduct(p);
                        addToRecentlyViewed(p);
                    }
                    setIsLoading(false);
                });
        }
    }, [id, products, addToRecentlyViewed]);

    useEffect(() => {
        if (product?.seller_id) {
            supabase.from('vendor_profiles').select('*').eq('seller_id', product.seller_id).single()
                .then(({ data }) => {
                    if (data) setVendor(data as VendorProfile);
                });
        }
    }, [product]);

    const isLiked = product ? isInWishlist(product.id) : false;

    // Related Products Logic
    const relatedProducts = useMemo(() => {
        if (!product) return [];
        return products
            .filter(p => p.category === product.category && p.id !== product.id)
            .slice(0, 4);
    }, [product, products]);

    const handleShare = async () => {
        if (!product) return;
        const shareData = {
            title: product.name,
            text: `Check out ${product.name} on MaliMart!`,
            url: window.location.href
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.log('Error sharing:', err);
            }
        } else {
            navigator.clipboard.writeText(window.location.href);
            addToast('Link copied to clipboard', 'success');
        }
    };

    // --- Intelligent Variant Logic (Copied from Modal for consistency) ---
    const variantStructure = useMemo(() => {
        if (!product?.variants || product.variants.length === 0) return [];
        const mapping: Record<string, Set<string>> = {};
        product.variants.filter(v => v.is_active !== false).forEach(v => {
            Object.entries(v.attributes).forEach(([key, val]) => {
                if (!mapping[key]) mapping[key] = new Set();
                mapping[key].add(String(val));
            });
        });
        return Object.entries(mapping).map(([name, values]) => ({ name, values: Array.from(values).sort() }));
    }, [product]);

    useEffect(() => {
        if (variantStructure.length > 0 && Object.keys(selectedAttributes).length === 0) {
            const defaults: Record<string, string> = {};
            const validVariant = product?.variants?.find(v => v.is_active && v.stock > 0) || product?.variants?.[0];
            if (validVariant) {
                variantStructure.forEach(attr => defaults[attr.name] = validVariant.attributes[attr.name]);
                setSelectedAttributes(defaults);
            }
        }
    }, [variantStructure]);

    const selectedVariant = useMemo(() => {
        if (!product?.variants) return null;
        return product.variants.find(v => Object.entries(selectedAttributes).every(([k, val]) => v.attributes[k] === val));
    }, [product, selectedAttributes]);

    const metrics = useMemo(() => {
        if (!product) return null;
        const basePrice = selectedVariant ? (selectedVariant.sale_price || selectedVariant.base_price) : product.price;
        const currentStock = selectedVariant ? selectedVariant.stock : product.stock;
        
        return {
            price: basePrice,
            stock: currentStock,
            isOut: currentStock <= 0,
            sku: selectedVariant ? selectedVariant.sku : product.sku
        };
    }, [product, selectedVariant]);

    const handleAdd = () => {
        if (!product || !metrics || isAdding) return;
        setIsAdding(true);
        addToCart(product, selectedVariant || undefined, qty);
        addToast(`Added to bag`, 'success');
        setTimeout(() => setIsAdding(false), 1500);
    };

    const handleMessageSeller = () => {
        if (!product) return;
        if (!user) {
            navigate(`/login?redirect=${encodeURIComponent(`/buyer?tab=inbox&sellerId=${product.seller_id}&productId=${product.id}`)}`);
            return;
        }
        navigate(`/buyer?tab=inbox&sellerId=${product.seller_id}&productId=${product.id}`);
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Skeleton className="w-96 h-96 rounded-3xl"/></div>;
    if (!product || !metrics) return <div className="min-h-screen flex items-center justify-center">Product not found</div>;

    const images = selectedVariant?.image_url ? [selectedVariant.image_url, ...product.images] : product.images;

    return (
        <div className="min-h-screen bg-background text-foreground pt-24 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-20 font-sans">
            <div className="container mx-auto px-4 md:px-8 max-w-7xl">
                {/* Breadcrumb / Back */}
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => navigate(-1)} className="p-3 bg-background/80 backdrop-blur-md rounded-full active:scale-95 transition-transform border border-foreground/10 shadow-sm"><ArrowLeft className="w-5 h-5 stroke-[1]"/></button>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-60">
                        <span>{product.category}</span> <span className="mx-2 opacity-40">/</span> <span>{product.name}</span>
                    </div>
                </div>

                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="grid lg:grid-cols-12 gap-12 lg:gap-20"
                >
                    {/* Left: Gallery (7 cols) */}
                    <div className="lg:col-span-7 flex flex-col gap-4">
                        {/* Main Image */}
                        <div className="relative aspect-[4/5] lg:aspect-[3/4] bg-foreground/[0.03] overflow-hidden rounded-2xl group">
                            <AnimatePresence mode="wait">
                                <motion.img
                                    key={activeImage}
                                    src={images[activeImage]}
                                    alt={product.name}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                                />
                            </AnimatePresence>
                            {product.is_boosted && (
                                <div className="absolute top-4 left-4 text-[10px] uppercase tracking-[0.2em] font-semibold bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-foreground/10">
                                    ⚡ Featured
                                </div>
                            )}
                            {/* Prev/Next arrows (desktop) */}
                            {images.length > 1 && (
                                <>
                                    <button onClick={() => setActiveImage(i => (i - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-md border border-foreground/10 flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors hidden md:flex">
                                        <ArrowLeft className="w-4 h-4 stroke-[2]" />
                                    </button>
                                    <button onClick={() => setActiveImage(i => (i + 1) % images.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-md border border-foreground/10 flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors hidden md:flex">
                                        <ArrowLeft className="w-4 h-4 stroke-[2] rotate-180" />
                                    </button>
                                </>
                            )}
                            {/* Mobile dot indicators */}
                            {images.length > 1 && (
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 md:hidden">
                                    {images.map((_, i) => (
                                        <button key={i} onClick={() => setActiveImage(i)} className={`h-1.5 rounded-full transition-all ${i === activeImage ? 'w-5 bg-background' : 'w-1.5 bg-background/50'}`} />
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Thumbnails (desktop only) */}
                        {images.length > 1 && (
                            <div className="hidden md:flex gap-3 overflow-x-auto no-scrollbar">
                                {images.map((img, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setActiveImage(i)}
                                        className={`w-20 h-24 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${i === activeImage ? 'border-foreground opacity-100' : 'border-transparent opacity-40 hover:opacity-70'}`}
                                    >
                                        <img src={img} className="w-full h-full object-cover" alt="" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Info (5 cols) */}
                    <div className="lg:col-span-5 flex flex-col justify-center lg:sticky lg:top-32 h-fit">
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] uppercase tracking-[0.2em] font-semibold opacity-60">
                                        {product.brand || product.seller_name || 'Maison'}
                                    </span>
                                    {product.is_verified && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5 opacity-60">
                                        <Star className="w-3.5 h-3.5 fill-current stroke-[1]" />
                                        <span className="text-xs font-medium">{product.rating?.toFixed(1) || '4.8'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.1] mb-6">{product.name}</h1>
                            
                            <div className="flex flex-wrap items-center gap-4 text-[10px] uppercase tracking-[0.2em] opacity-60 mb-8">
                                <span>{product.review_count} Reviews</span>
                                <span className="w-1 h-1 bg-primary/20 dark:bg-background/20 rounded-full"></span>
                                <span>SKU: {metrics.sku || 'N/A'}</span>
                                {product.location && (
                                    <>
                                        <span className="w-1 h-1 bg-primary/20 dark:bg-background/20 rounded-full"></span>
                                        {product.latitude && product.longitude ? (
                                            <a href={`https://www.google.com/maps/search/?api=1&query=${product.latitude},${product.longitude}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline text-blue-600 dark:text-blue-400">
                                                <MapPin className="w-3 h-3" /> {product.location}
                                            </a>
                                        ) : (
                                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {product.location}</span>
                                        )}
                                    </>
                                )}
                                {product.condition && (
                                    <>
                                        <span className="w-1 h-1 bg-primary/20 dark:bg-background/20 rounded-full"></span>
                                        <span>{product.condition}</span>
                                    </>
                                )}
                                {product.warranty_period && (
                                    <>
                                        <span className="w-1 h-1 bg-primary/20 dark:bg-background/20 rounded-full"></span>
                                        <span>{product.warranty_period}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 mb-12">
                            <div className="flex items-baseline gap-4">
                                <span className="font-serif text-4xl">
                                    {formatTZS(metrics.price)}
                                </span>
                                {product.price > metrics.price && (
                                    <span className="text-xl opacity-40 line-through">
                                        {formatTZS(product.price)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Description */}
                        <div className="mb-12">
                            <p className="text-sm leading-relaxed opacity-80 font-light max-w-xl">
                                {product.description}
                            </p>
                        </div>

                        {/* Variants */}
                        {variantStructure.length > 0 && (
                            <div className="space-y-8 mb-12">
                                {variantStructure.map(attr => (
                                    <div key={attr.name}>
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold opacity-60">{attr.name}</span>
                                            <span className="text-[10px] uppercase tracking-[0.1em] opacity-60">{selectedAttributes[attr.name]}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            {attr.values.map(val => {
                                                const isSelected = selectedAttributes[attr.name] === val;
                                                const isColor = /color|shade/i.test(attr.name);
                                                if (isColor) return (
                                                    <button key={val} onClick={() => setSelectedAttributes({...selectedAttributes, [attr.name]: val})} className={`w-12 h-12 rounded-full border transition-all ${isSelected ? 'border-foreground dark:border-background scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`} style={{ backgroundColor: val.toLowerCase() }} />
                                                );
                                                return (
                                                    <button key={val} onClick={() => setSelectedAttributes({...selectedAttributes, [attr.name]: val})} className={`px-6 py-3 text-xs tracking-wider transition-all border ${isSelected ? 'border-foreground bg-primary text-background dark:border-background dark:bg-background dark:text-foreground' : 'border-foreground/20 hover:border-foreground dark:hover:border-background'}`}>{val}</button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col gap-4 mb-12">
                            <div className="flex gap-4 h-14">
                                <div className="flex items-center justify-between border border-foreground/20 px-2 w-32 shrink-0">
                                    <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity" disabled={qty <= 1}>-</button>
                                    <span className="text-sm font-medium">{qty}</span>
                                    <button onClick={() => setQty(Math.min(metrics.stock, qty + 1))} className="w-8 h-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity" disabled={qty >= metrics.stock}>+</button>
                                </div>
                                <motion.button 
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleAdd}
                                    disabled={metrics.isOut}
                                    className={`flex-1 border text-xs uppercase tracking-[0.2em] font-semibold transition-colors ${metrics.isOut ? 'border-foreground/20 text-foreground/40 cursor-not-allowed' : 'border-foreground dark:border-background hover:bg-primary hover:text-background dark:hover:bg-background dark:hover:text-foreground'}`}
                                >
                                    {metrics.isOut ? 'Out of Stock' : 'Add to Bag'}
                                </motion.button>
                            </div>
                            <motion.button 
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => { handleAdd(); navigate('/cart'); }}
                                disabled={metrics.isOut}
                                className={`w-full h-14 text-xs uppercase tracking-[0.2em] font-semibold transition-opacity ${metrics.isOut ? 'bg-primary/10 text-foreground/40 dark:bg-background/10 cursor-not-allowed' : 'bg-primary text-background dark:bg-background dark:text-foreground hover:opacity-90'}`}
                            >
                                Purchase Now
                            </motion.button>
                        </div>

                        {/* Secondary Actions Grid */}
                        <div className="grid grid-cols-3 border-y border-foreground/10 mb-8">
                            <button 
                                onClick={() => {
                                    toggleWishlist(product);
                                    addToast(isInWishlist(product.id) ? 'Removed from wishlist' : 'Added to wishlist', 'success');
                                }}
                                className="flex flex-col items-center justify-center gap-2 py-6 border-r border-foreground/10 hover:bg-foreground/[0.04] transition-colors"
                            >
                                <Heart className={`w-5 h-5 stroke-[1] ${isLiked ? 'fill-current' : ''}`} />
                                <span className="text-[9px] uppercase tracking-[0.2em]">{isLiked ? 'Saved' : 'Save'}</span>
                            </button>
                            <button 
                                onClick={handleMessageSeller}
                                className="flex flex-col items-center justify-center gap-2 py-6 border-r border-foreground/10 hover:bg-foreground/[0.04] transition-colors"
                            >
                                <MessageSquare className="w-5 h-5 stroke-[1]" />
                                <span className="text-[9px] uppercase tracking-[0.2em]">Concierge</span>
                            </button>
                            <button 
                                onClick={handleShare}
                                className="flex flex-col items-center justify-center gap-2 py-6 hover:bg-foreground/[0.04] transition-colors"
                            >
                                <Share2 className="w-5 h-5 stroke-[1]" />
                                <span className="text-[9px] uppercase tracking-[0.2em]">Share</span>
                            </button>
                        </div>

                        {/* Trust HUD */}
                        <div className="space-y-4 mb-8 p-4 rounded-2xl bg-foreground/[0.03] border border-foreground/8">
                            <div className="flex items-start gap-4">
                                <Shield className="w-5 h-5 stroke-[1] mt-0.5 opacity-50" />
                                <div>
                                    <h4 className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-1 opacity-60">Secure Payment</h4>
                                    <p className="text-sm font-light opacity-80">Encrypted & Safe transaction processing.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <RotateCcw className="w-5 h-5 stroke-[1] mt-0.5 opacity-50" />
                                <div>
                                    <h4 className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-1 opacity-60">Easy Returns</h4>
                                    <p className="text-sm font-light opacity-80">7-Day Guarantee on all orders.</p>
                                </div>
                            </div>
                        </div>

                        {/* Details Accordion */}
                        <div className="space-y-4 border-t border-foreground/10 pt-8">
                        </div>
                    </div>
                </motion.div>

                {/* Technical Specifications */}
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.6 }}
                    className="mt-12 md:mt-20 border-t border-foreground/10 pt-10 md:pt-16"
                >
                    <h3 className="font-serif text-2xl font-light mb-8">Specifications</h3>
                    <div className="grid grid-cols-1 gap-y-0 border border-foreground/10 rounded-sm overflow-hidden">
                        {Object.entries({
                            'Title': product.name,
                            'Brand': product.brand,
                            'SKU': product.sku,
                            'Weight': product.weight ? `${product.weight} kg` : null,
                            'Dimensions': product.dimensions ? `${product.dimensions.length}x${product.dimensions.width}x${product.dimensions.height} cm` : null,
                        }).filter(([_, value]) => value).map(([label, value], idx) => (
                            <div key={label} className={`flex justify-between items-center p-4 ${idx % 2 === 0 ? 'bg-primary/5 dark:bg-background/5' : ''}`}>
                                <span className="text-[10px] uppercase tracking-[0.2em] opacity-60">{label}</span>
                                <span className="text-sm font-light">{value?.toString() || 'N/A'}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Meet the Artisan */}
                {vendor && (
                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.6 }}
                        className="mt-12 md:mt-20 border-t border-foreground/10 pt-10 md:pt-16"
                    >
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div>
                                <h3 className="font-serif text-3xl font-light mb-6">Meet the Artisan: {vendor.store_name}</h3>
                                <p className="text-sm leading-relaxed opacity-80 font-light mb-8">{vendor.description}</p>
                                <div className="flex gap-4">
                                    {vendor.instagram_url && <a href={vendor.instagram_url} target="_blank" rel="noreferrer" className="text-xs uppercase tracking-[0.2em] font-semibold opacity-60 hover:opacity-100">Instagram</a>}
                                    {vendor.facebook_url && <a href={vendor.facebook_url} target="_blank" rel="noreferrer" className="text-xs uppercase tracking-[0.2em] font-semibold opacity-60 hover:opacity-100">Facebook</a>}
                                    {vendor.website_url && <a href={vendor.website_url} target="_blank" rel="noreferrer" className="text-xs uppercase tracking-[0.2em] font-semibold opacity-60 hover:opacity-100">Website</a>}
                                </div>
                            </div>
                            <div className="aspect-square bg-foreground/[0.03] rounded-xl overflow-hidden">
                                {vendor.logo_url ? <img src={vendor.logo_url} alt={vendor.store_name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl font-serif opacity-20">{vendor.store_name[0]}</div>}
                            </div>
                        </div>
                    </motion.div>
                )}

                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.6 }}
                    className="mt-12 md:mt-20 border-t border-foreground/10 pt-10 md:pt-16"
                >
                    <h3 className="font-serif text-3xl font-light mb-12">Client Reviews</h3>
                    <ReviewSection productId={product.id} />
                </motion.div>

                {/* Related Products */}
                {relatedProducts.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.6 }}
                        className="mt-12 md:mt-20 border-t border-foreground/10 pt-10 md:pt-16"
                    >
                        <h2 className="font-serif text-2xl font-semibold mb-6 md:mb-10">You might also like</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-8 md:gap-x-5 md:gap-y-10">
                            {relatedProducts.map((p, index) => (
                                <ProductCard key={p.id} product={p} index={index} onClick={() => navigate(`/product/${p.id}`)} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Sticky Mobile CTA Bar */}
            <div className="fixed bottom-0 inset-x-0 z-[60] lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div className="mx-3 mb-3 flex gap-2.5">
                    <button
                        onClick={() => { toggleWishlist(product); addToast(isLiked ? 'Removed from wishlist' : 'Saved to wishlist', 'success'); }}
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center border bg-background/96 backdrop-blur-xl transition-all active:scale-95 shadow-lg ${isLiked ? 'border-rose-400/50 text-rose-500' : 'border-foreground/12 text-foreground/60'}`}
                    >
                        <Heart className={`w-5 h-5 ${isLiked ? 'fill-current stroke-none' : 'stroke-[1.8]'}`} />
                    </button>
                    <button
                        onClick={handleAdd}
                        disabled={metrics.isOut}
                        className={`flex-1 h-14 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-lg ${metrics.isOut ? 'bg-foreground/10 text-foreground/35 cursor-not-allowed' : isAdding ? 'bg-emerald-600 text-white' : 'bg-foreground text-background'}`}
                    >
                        {isAdding ? (
                            <><Check className="w-4 h-4 stroke-[2.5]" /> Added to Bag</>
                        ) : metrics.isOut ? 'Out of Stock' : (
                            <><ShoppingBag className="w-4 h-4 stroke-[2.2]" /> Add to Bag · {formatTZS(metrics.price * qty)}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
