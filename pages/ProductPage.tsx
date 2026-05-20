
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
    const { products, addToCart, toggleWishlist, isInWishlist, getActiveOfferForProduct, addToRecentlyViewed } = useAppState();
    const { addToast } = useToast();
    
    const [product, setProduct] = useState<Product | null>(null);
    const [vendor, setVendor] = useState<VendorProfile | null>(null);
    const [activeImage, setActiveImage] = useState(0);
    const [qty, setQty] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    
    // Variant state
    const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});

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
        if (!product || !metrics) return;
        addToCart(product, selectedVariant || undefined, qty);
        addToast(`Added ${product.name} to bag`, 'success');
    };

    const handleMessageSeller = () => {
        if (!product) return;
        navigate(`/buyer?tab=inbox&sellerId=${product.seller_id}&productId=${product.id}`);
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Skeleton className="w-96 h-96 rounded-3xl"/></div>;
    if (!product || !metrics) return <div className="min-h-screen flex items-center justify-center">Product not found</div>;

    const images = selectedVariant?.image_url ? [selectedVariant.image_url, ...product.images] : product.images;

    return (
        <div className="min-h-screen bg-background dark:bg-background text-foreground dark:text-background pt-24 pb-[calc(5rem+env(safe-area-inset-bottom))] font-sans">
            <div className="container mx-auto px-4 md:px-8 max-w-7xl">
                {/* Breadcrumb / Back */}
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => navigate(-1)} className="p-3 bg-white/50 dark:bg-primary/50 backdrop-blur-md rounded-full hover:scale-110 transition-transform border border-foreground/10 dark:border-background/10"><ArrowLeft className="w-5 h-5 stroke-[1]"/></button>
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
                    <div className="lg:col-span-7 flex flex-col-reverse lg:flex-row gap-6">
                        {/* Thumbnails */}
                        <div className="flex lg:flex-col gap-4 overflow-x-auto lg:overflow-y-auto lg:max-h-[80vh] no-scrollbar shrink-0">
                            {images.map((img, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => setActiveImage(i)} 
                                    className={`w-20 h-24 lg:w-24 lg:h-32 overflow-hidden transition-all flex-shrink-0 ${i === activeImage ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}
                                >
                                    <img src={img} className="w-full h-full object-cover" />
                                    {i === activeImage && <div className="h-[1px] w-full bg-primary dark:bg-background mt-2" />}
                                </button>
                            ))}
                        </div>
                        
                        {/* Main Image */}
                        <div className="flex-1 aspect-[4/5] lg:aspect-auto lg:h-[80vh] bg-[#ebe8e3] dark:bg-[#0a0a0a] overflow-hidden relative group">
                            <img src={images[activeImage]} className="w-full h-full object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-105" alt={product.name} />
                            {product.is_boosted && <div className="absolute top-6 left-6 text-[10px] uppercase tracking-[0.3em] font-medium bg-background/80 dark:bg-background/80 backdrop-blur-md px-4 py-2 border border-foreground/10 dark:border-background/10">Elite Choice</div>}
                            
                            {/* Vertical Text Accent */}
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden md:block">
                                <span className="writing-vertical-rl rotate-180 text-[10px] uppercase tracking-[0.3em] font-medium opacity-50">
                                    Collection N° {product.id.slice(0, 4)}
                                </span>
                            </div>
                        </div>
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
                                                    <button key={val} onClick={() => setSelectedAttributes({...selectedAttributes, [attr.name]: val})} className={`px-6 py-3 text-xs tracking-wider transition-all border ${isSelected ? 'border-foreground bg-primary text-background dark:border-background dark:bg-background dark:text-foreground' : 'border-foreground/20 dark:border-background/20 hover:border-foreground dark:hover:border-background'}`}>{val}</button>
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
                                <div className="flex items-center justify-between border border-foreground/20 dark:border-background/20 px-2 w-32 shrink-0">
                                    <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity" disabled={qty <= 1}>-</button>
                                    <span className="text-sm font-medium">{qty}</span>
                                    <button onClick={() => setQty(Math.min(metrics.stock, qty + 1))} className="w-8 h-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity" disabled={qty >= metrics.stock}>+</button>
                                </div>
                                <motion.button 
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleAdd}
                                    disabled={metrics.isOut}
                                    className={`flex-1 border text-xs uppercase tracking-[0.2em] font-semibold transition-colors ${metrics.isOut ? 'border-foreground/20 text-foreground/40 dark:border-background/20 dark:text-background/40 cursor-not-allowed' : 'border-foreground dark:border-background hover:bg-primary hover:text-background dark:hover:bg-background dark:hover:text-foreground'}`}
                                >
                                    {metrics.isOut ? 'Out of Stock' : 'Add to Bag'}
                                </motion.button>
                            </div>
                            <motion.button 
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => { handleAdd(); navigate('/cart'); }}
                                disabled={metrics.isOut}
                                className={`w-full h-14 text-xs uppercase tracking-[0.2em] font-semibold transition-opacity ${metrics.isOut ? 'bg-primary/10 text-foreground/40 dark:bg-background/10 dark:text-background/40 cursor-not-allowed' : 'bg-primary text-background dark:bg-background dark:text-foreground hover:opacity-90'}`}
                            >
                                Purchase Now
                            </motion.button>
                        </div>

                        {/* Secondary Actions Grid */}
                        <div className="grid grid-cols-3 border-y border-foreground/10 dark:border-background/10 mb-12">
                            <button 
                                onClick={() => {
                                    toggleWishlist(product);
                                    addToast(isInWishlist(product.id) ? 'Removed from wishlist' : 'Added to wishlist', 'success');
                                }}
                                className="flex flex-col items-center justify-center gap-2 py-6 border-r border-foreground/10 dark:border-background/10 hover:bg-primary/5 dark:hover:bg-background/5 transition-colors"
                            >
                                <Heart className={`w-5 h-5 stroke-[1] ${isLiked ? 'fill-current' : ''}`} />
                                <span className="text-[9px] uppercase tracking-[0.2em]">{isLiked ? 'Saved' : 'Save'}</span>
                            </button>
                            <button 
                                onClick={handleMessageSeller}
                                className="flex flex-col items-center justify-center gap-2 py-6 border-r border-foreground/10 dark:border-background/10 hover:bg-primary/5 dark:hover:bg-background/5 transition-colors"
                            >
                                <MessageSquare className="w-5 h-5 stroke-[1]" />
                                <span className="text-[9px] uppercase tracking-[0.2em]">Concierge</span>
                            </button>
                            <button 
                                onClick={handleShare}
                                className="flex flex-col items-center justify-center gap-2 py-6 hover:bg-primary/5 dark:hover:bg-background/5 transition-colors"
                            >
                                <Share2 className="w-5 h-5 stroke-[1]" />
                                <span className="text-[9px] uppercase tracking-[0.2em]">Share</span>
                            </button>
                        </div>

                        {/* Trust HUD */}
                        <div className="space-y-8 mb-12">
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
                        <div className="space-y-4 border-t border-foreground/10 dark:border-background/10 pt-8">
                        </div>
                    </div>
                </motion.div>

                {/* Technical Specifications */}
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.6 }}
                    className="mt-24 border-t border-foreground/10 dark:border-background/10 pt-24"
                >
                    <h3 className="font-serif text-2xl font-light mb-8">Specifications</h3>
                    <div className="grid grid-cols-1 gap-y-0 border border-foreground/10 dark:border-background/10 rounded-sm overflow-hidden">
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
                        className="mt-24 border-t border-foreground/10 dark:border-background/10 pt-24"
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
                            <div className="aspect-square bg-[#ebe8e3] dark:bg-[#0a0a0a] rounded-sm overflow-hidden">
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
                    className="mt-24 border-t border-foreground/10 dark:border-background/10 pt-24"
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
                        className="mt-24 border-t border-foreground/10 dark:border-background/10 pt-24"
                    >
                        <h2 className="font-serif text-3xl font-light mb-12">You Might Also Like</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                            {relatedProducts.map((p, index) => (
                                <ProductCard key={p.id} product={p} index={index} onClick={() => navigate(`/product/${p.id}`)} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Sticky Mobile Add to Cart */}
            <AnimatePresence>
                <motion.div 
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    exit={{ y: 100 }}
                    className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-background/80 backdrop-blur-xl border-t border-foreground/10 dark:border-background/10 p-4 z-50 lg:hidden"
                >
                    <div className="flex items-center gap-4 max-w-md mx-auto">
                        <div className="flex-1">
                            <p className="text-[10px] uppercase tracking-widest opacity-60 truncate">{product.name}</p>
                            <p className="text-sm font-serif">{formatTZS(metrics.price)}</p>
                        </div>
                        <Button 
                            onClick={handleAdd}
                            disabled={metrics.isOut}
                            className="flex-1 h-12 rounded-full text-[10px] font-black uppercase tracking-widest"
                        >
                            {metrics.isOut ? 'Out of Stock' : 'Add to Bag'}
                        </Button>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
