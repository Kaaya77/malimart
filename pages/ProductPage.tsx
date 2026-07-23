import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
 Star, Heart, ShoppingBag, Truck, ShieldCheck, Shield, RotateCcw,
 MessageSquare, ArrowLeft, Share2, Check, Zap, MapPin, X, Store, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../context/AppContext';
import { Button, Badge, Skeleton, VerifiedBadge, useToast } from '../components/UI';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { ReviewSection } from '../components/ReviewSection';
import { ProductCard } from '../components/ProductCard';
import { ProductShare } from '../components/ProductShare';
import { formatTZS } from '../constants';
import { Product, VendorProfile } from '../types';
import { fetchProductById, fetchVendorProfile } from '../services/shopService';
import { usePresence } from '../hooks/usePresence';

const StarRating = ({ rating, className = '' }: { rating: number; className?: string }) => (
 <div className={`flex items-center gap-0.5 ${className}`} aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
 {[1, 2, 3, 4, 5].map(i => (
 <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-foreground/10 text-foreground/10'}`} />
 ))}
 </div>
);

type TabId = 'description' | 'specs' | 'shipping';

// /product/:id accepts either a raw UUID or a readable "name-slug-<uuid>" link —
// pull the UUID out of the tail so pretty share links and legacy raw-id links both resolve.
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const extractProductId = (param?: string) => {
 if (!param) return param;
 const match = param.match(UUID_RE);
 return match ? match[0] : param;
};

export const ProductPage = () => {
 const { id: rawId } = useParams();
 const id = extractProductId(rawId);
 const navigate = useNavigate();
 const { products, addToCart, toggleWishlist, isInWishlist, getActiveOfferForProduct, addToRecentlyViewed, recentlyViewed = [], user } = useAppState();
 const { addToast } = useToast();

 const [product, setProduct] = useState<Product | null>(null);
 const [vendor, setVendor] = useState<VendorProfile | null>(null);
 const [activeImage, setActiveImage] = useState(0);
 const [lightboxOpen, setLightboxOpen] = useState(false);
 const [shareOpen, setShareOpen] = useState(false);
 const [qty, setQty] = useState(1);
 const [isLoading, setIsLoading] = useState(true);
 const [activeTab, setActiveTab] = useState<TabId>('description');
 const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
 const [isAdding, setIsAdding] = useState(false);

 // Live presence: how many people are viewing this product right now.
 // Per-product topic keeps the audience naturally small, so it scales fine.
 const presenceKey = useMemo(
   () => user?.id || `guest-${Math.random().toString(36).slice(2)}`,
   [user?.id]
 );
 const { count: viewers } = usePresence({
   topic: product ? `product:${product.id}` : null,
   key: presenceKey,
   meta: { role: user?.role || 'guest' },
 });

 useEffect(() => {
 const found = products.find(p => p.id === id);
 if (found) {
 setProduct(found);
 addToRecentlyViewed(found);
 setIsLoading(false);
 } else if (id) {
 fetchProductById(id).then(p => {
 if (p) {
 setProduct(p);
 addToRecentlyViewed(p);
 }
 setIsLoading(false);
 });
 }
 }, [id, products, addToRecentlyViewed]);

 useEffect(() => {
 if (product) {
   document.title = `${product.name} | MaliMart`;
   return () => { document.title = 'MaliMart — Tanzania\'s Marketplace'; };
 }
 }, [product]);

 useEffect(() => {
 if (product?.seller_id) {
 fetchVendorProfile(product.seller_id).then(v => { if (v) setVendor(v); });
 }
 }, [product]);

 const isLiked = product ? isInWishlist(product.id) : false;

 const relatedProducts = useMemo(() => {
 if (!product) return [];
 return products
 .filter(p => p.category === product.category && p.id !== product.id)
 .slice(0, 4);
 }, [product, products]);

 // --- Variant logic (same behaviour as the quick-view modal) ---
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
 const rawPrice = selectedVariant ? (selectedVariant.sale_price || selectedVariant.base_price) : product.price;
 const currentStock = selectedVariant ? selectedVariant.stock : product.stock;

 // Apply auto-apply campaign discount (same logic as useProductPricing / ProductCard)
 const activeOffer = getActiveOfferForProduct(product.id);
 let price = rawPrice;
 if (activeOffer && activeOffer.is_auto_apply && activeOffer.campaign_type !== 'bogo') {
   if (activeOffer.type === 'percentage') {
     price = rawPrice - (rawPrice * activeOffer.value / 100);
   } else if (activeOffer.type === 'fixed') {
     price = Math.max(0, rawPrice - activeOffer.value);
   }
 }

 const comparePrice = selectedVariant
   ? selectedVariant.base_price
   : (product.base_price ?? product.price);
 const originalPrice = comparePrice > price ? comparePrice : null;
 const discountPct = originalPrice ? Math.round((1 - price / originalPrice) * 100) : 0;

 return {
   price,
   originalPrice,
   discountPct,
   stock: currentStock,
   isOut: currentStock <= 0,
   sku: selectedVariant ? selectedVariant.sku : product.sku
 };
 }, [product, selectedVariant, getActiveOfferForProduct]);

 // Store on vacation → ordering is paused (server enforces this too).
 const onVacation = !!(vendor as any)?.vacation_mode;
 // Sellers can shop other stores, but not their own — server (place_order_atomic)
 // enforces this too; this just gives a clear message instead of a checkout error.
 const isOwnProduct = !!user && !!product && user.id === product.seller_id;

 const handleAdd = () => {
 if (!product || !metrics || isAdding) return;
 if (isOwnProduct) { addToast("You can't buy your own product", 'error'); return; }
 if (onVacation) { addToast(`${vendor?.store_name || 'This store'} is on vacation — not accepting orders right now`, 'error'); return; }
 setIsAdding(true);
 addToCart(product, selectedVariant || undefined, qty);
 addToast('Added to cart', 'success');
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

 if (isLoading) return (
 <div className="min-h-screen bg-background pt-24 pb-20">
 <div className="container mx-auto px-4 md:px-8 max-w-7xl">
 <Skeleton className="h-4 w-64 mb-8" />
 <div className="grid lg:grid-cols-2 gap-8">
 <Skeleton className="aspect-square rounded-3xl" />
 <div className="space-y-4">
 <Skeleton className="h-6 w-40" />
 <Skeleton className="h-10 w-3/4" />
 <Skeleton className="h-28 w-full rounded-3xl" />
 <Skeleton className="h-14 w-full rounded-2xl" />
 </div>
 </div>
 </div>
 </div>
 );

 if (!product || !metrics) return (
 <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6">
 <div className="w-16 h-16 rounded-3xl bg-foreground/[0.06] flex items-center justify-center"><ShoppingBag className="w-7 h-7 text-foreground/30 stroke-[1.5]"/></div>
 <div className="text-center">
 <h2 className="font-bold text-lg text-foreground">Product not found</h2>
 <p className="text-sm text-foreground/45 mt-1">This product may have been removed or is no longer available.</p>
 </div>
 <Button asChild><Link to="/shop">Browse Products</Link></Button>
 </div>
 );

 const images = selectedVariant?.image_url ? [selectedVariant.image_url, ...product.images] : product.images;
 const rating = Number(product.rating) || 0;

 const specs = Object.entries({
 'Brand': product.brand,
 'SKU': metrics.sku,
 'Condition': product.condition,
 'Warranty': product.warranty_period,
 'Weight': product.weight ? `${product.weight} kg` : null,
 'Dimensions': product.dimensions ? `${product.dimensions.length} × ${product.dimensions.width} × ${product.dimensions.height} cm` : null,
 'Category': product.category,
 }).filter(([, v]) => v);

 const tabs: { id: TabId; label: string }[] = [
 { id: 'description', label: 'Description' },
 { id: 'specs', label: 'Specifications' },
 { id: 'shipping', label: 'Shipping & Returns' },
 ];

 return (
 <div className="min-h-screen bg-background text-foreground pt-24 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-20">
 <div className="container mx-auto px-4 md:px-8 max-w-7xl">

 {/* Breadcrumb / Back */}
 <div className="flex items-center gap-3 mb-6">
 <button onClick={() => navigate(-1)} aria-label="Go back" className="w-11 h-11 rounded-2xl bg-foreground/[0.05] hover:bg-foreground/[0.1] flex items-center justify-center transition-colors active:scale-95 shrink-0">
 <ArrowLeft className="w-4 h-4 stroke-[2]" />
 </button>
 <Breadcrumb items={[
   { label: 'Home', href: '/' },
   { label: 'Shop', href: '/shop' },
   { label: product.category, href: `/shop?category=${encodeURIComponent(product.category)}` },
   { label: product.name },
 ]} />
 </div>

 <motion.div
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.5, ease: 'easeOut' }}
 className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 min-w-0"
 >
 {/* ── Gallery ─────────────────────────────────────────────── */}
 <div className="flex flex-col gap-3 lg:sticky lg:top-28 h-fit">
 <div className="relative aspect-square bg-foreground/[0.03] rounded-3xl overflow-hidden border border-foreground/8 group cursor-zoom-in" onClick={() => setLightboxOpen(true)}>
 <AnimatePresence mode="wait">
 <motion.img
 key={activeImage}
 src={images[activeImage]}
 alt={product.name}
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.2 }}
 className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
 />
 </AnimatePresence>

 {/* Badges */}
 <div className="absolute top-4 left-4 flex flex-col gap-2 items-start">
 {metrics.discountPct > 0 && (
 <span className="px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-black shadow-sm">-{metrics.discountPct}%</span>
 )}
 {product.is_boosted && (
 <span className="px-3 py-1.5 rounded-xl bg-amber-400 text-amber-950 text-xs font-black shadow-sm inline-flex items-center gap-1"><Zap className="w-3 h-3 fill-current" /> Featured</span>
 )}
 </div>

 {/* Overlay actions */}
 <div className="absolute top-4 right-4 flex flex-col gap-2">
 <button
 aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
 onClick={e => { e.stopPropagation(); toggleWishlist(product); addToast(isLiked ? 'Removed from wishlist' : 'Saved to wishlist', 'success'); }}
 className={`w-11 h-11 rounded-2xl backdrop-blur-md flex items-center justify-center shadow-sm transition-all active:scale-90 ${isLiked ? 'bg-rose-500 text-white' : 'bg-background/85 text-foreground/70 hover:text-rose-500'}`}
 >
 <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : 'stroke-[2]'}`} />
 </button>
 <button
 aria-label="Share product"
 onClick={e => { e.stopPropagation(); setShareOpen(true); }}
 className="w-11 h-11 rounded-2xl bg-background/85 backdrop-blur-md flex items-center justify-center shadow-sm text-foreground/70 hover:text-foreground transition-all active:scale-90"
 >
 <Share2 className="w-5 h-5 stroke-[2]" />
 </button>
 </div>

 {/* Prev/Next (desktop) */}
 {images.length > 1 && (
 <>
 <button aria-label="Previous image" onClick={e => { e.stopPropagation(); setActiveImage(i => (i - 1 + images.length) % images.length); }} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/85 backdrop-blur-md shadow-sm hidden md:flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors">
 <ArrowLeft className="w-4 h-4 stroke-[2]" />
 </button>
 <button aria-label="Next image" onClick={e => { e.stopPropagation(); setActiveImage(i => (i + 1) % images.length); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/85 backdrop-blur-md shadow-sm hidden md:flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors">
 <ArrowLeft className="w-4 h-4 stroke-[2] rotate-180" />
 </button>
 </>
 )}

 {/* Mobile dots */}
 {images.length > 1 && (
 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 md:hidden">
 {images.map((_, i) => (
 <button key={i} aria-label={`Image ${i + 1}`} onClick={e => { e.stopPropagation(); setActiveImage(i); }} className={`h-1.5 rounded-full transition-all ${i === activeImage ? 'w-5 bg-foreground' : 'w-1.5 bg-foreground/30'}`} />
 ))}
 </div>
 )}
 </div>

 {/* Thumbnails */}
 {images.length > 1 && (
 <div className="hidden md:flex gap-2.5 overflow-x-auto no-scrollbar">
 {images.map((img, i) => (
 <button
 key={i}
 onClick={() => setActiveImage(i)}
 aria-label={`View image ${i + 1}`}
 className={`w-20 h-20 flex-shrink-0 rounded-2xl overflow-hidden border-2 transition-all ${i === activeImage ? 'border-emerald-500' : 'border-transparent opacity-50 hover:opacity-100'}`}
 >
 <img src={img} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" />
 </button>
 ))}
 </div>
 )}
 </div>

 {/* ── Buy panel ────────────────────────────────────────────── */}
 <div className="flex flex-col gap-5">

 {/* Brand + rating */}
 <div>
 <div className="flex items-center justify-between gap-3 mb-3">
 <div className="flex items-center gap-2 min-w-0">
 <span className="text-xs font-bold uppercase tracking-widest text-foreground/50 truncate">{product.brand || product.seller_name || 'MaliMart'}</span>
 {product.is_verified && <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />}
 </div>
 {viewers > 1 && (
 <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
 <span className="relative flex h-1.5 w-1.5">
 <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
 <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
 </span>
 {viewers} viewing now
 </span>
 )}
 </div>

 <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight mb-3">{product.name}</h1>

 <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-foreground/50">
 {rating > 0 ? (
 <span className="flex items-center gap-1.5">
 <StarRating rating={rating} />
 <span className="text-foreground/70">{rating.toFixed(1)}</span>
 {(product.review_count ?? 0) > 0 && <a href="#reviews" className="text-emerald-600 hover:underline">({product.review_count} reviews)</a>}
 </span>
 ) : (
 <Badge variant="success" className="text-[10px] px-2 py-0.5">New arrival</Badge>
 )}
 {product.location && (
 product.latitude && product.longitude ? (
 <a href={`https://www.google.com/maps/search/?api=1&query=${product.latitude},${product.longitude}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
 <MapPin className="w-3.5 h-3.5" /> {product.location}
 </a>
 ) : (
 <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {product.location}</span>
 )
 )}
 {metrics.sku && <span>SKU: {metrics.sku}</span>}
 </div>
 </div>

 {/* Price block */}
 <div className="rounded-3xl border border-foreground/8 bg-foreground/[0.02] p-5">
 <div className="flex items-end flex-wrap gap-x-3 gap-y-1">
 <span className="text-3xl md:text-4xl font-black tracking-tight text-foreground">{formatTZS(metrics.price)}</span>
 {metrics.originalPrice && (
 <>
 <span className="text-base font-semibold text-foreground/35 line-through mb-1">{formatTZS(metrics.originalPrice)}</span>
 <Badge variant="danger" className="mb-1 text-[10px] px-2 py-0.5">Save {metrics.discountPct}%</Badge>
 </>
 )}
 </div>
 <div className="mt-2 text-xs font-bold" aria-live="polite">
 {metrics.isOut ? (
 <span className="text-red-500">Out of stock</span>
 ) : metrics.stock <= 5 ? (
 <span className="text-amber-600 dark:text-amber-400">Low stock — only {metrics.stock} left</span>
 ) : (
 <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5 stroke-[3]" /> In stock</span>
 )}
 </div>
 </div>

 {/* Variants */}
 {variantStructure.length > 0 && (
 <div className="space-y-4">
 {variantStructure.map(attr => (
 <div key={attr.name}>
 <div className="flex justify-between items-center mb-2">
 <span className="text-xs font-bold uppercase tracking-widest text-foreground/50">{attr.name}</span>
 <span className="text-xs font-bold text-foreground/70">{selectedAttributes[attr.name]}</span>
 </div>
 <div className="flex flex-wrap gap-2">
 {attr.values.map(val => {
 const isSelected = selectedAttributes[attr.name] === val;
 const isColor = /color|shade/i.test(attr.name);
 if (isColor) return (
 <button key={val} title={val} aria-label={`${attr.name}: ${val}`} onClick={() => setSelectedAttributes({ ...selectedAttributes, [attr.name]: val })} className={`w-10 h-10 rounded-full border-2 transition-all ${isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/25 scale-110' : 'border-foreground/15 hover:border-foreground/40'}`} style={{ backgroundColor: val.toLowerCase() }} />
 );
 return (
 <button key={val} onClick={() => setSelectedAttributes({ ...selectedAttributes, [attr.name]: val })} className={`px-4 h-10 rounded-xl text-xs font-bold transition-all border-2 ${isSelected ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-foreground/10 text-foreground/60 hover:border-foreground/30'}`}>{val}</button>
 );
 })}
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Vacation notice */}
 {onVacation && (
 <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 flex items-center gap-3">
 <span className="text-xl flex-shrink-0" role="img" aria-label="Palm tree">🌴</span>
 <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold leading-relaxed">
 {vendor?.store_name || 'This store'} is on vacation and not accepting orders right now. Save this item to your wishlist and check back soon.
 </p>
 </div>
 )}

 {/* Quantity + CTAs */}
 <div className="flex flex-col gap-3">
 <div className="flex gap-3">
 <div className="flex items-center h-14 rounded-2xl border-2 border-foreground/10 px-1 shrink-0">
 <button aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} className="w-10 h-10 rounded-xl flex items-center justify-center text-foreground/50 hover:bg-foreground/[0.06] hover:text-foreground transition-colors disabled:opacity-30 font-bold">−</button>
 <span className="w-8 text-center text-sm font-black tabular-nums" aria-live="polite">{qty}</span>
 <button aria-label="Increase quantity" onClick={() => setQty(Math.min(metrics.stock, qty + 1))} disabled={qty >= metrics.stock} className="w-10 h-10 rounded-xl flex items-center justify-center text-foreground/50 hover:bg-foreground/[0.06] hover:text-foreground transition-colors disabled:opacity-30 font-bold">+</button>
 </div>
 <Button size="lg" className="flex-1" onClick={handleAdd} disabled={metrics.isOut || onVacation || isOwnProduct}>
 {isAdding ? (<><Check className="w-4 h-4 mr-2 stroke-[3]" /> Added</>) : isOwnProduct ? 'Your Own Listing' : metrics.isOut ? 'Out of Stock' : onVacation ? 'Store on Vacation' : (<><ShoppingBag className="w-4 h-4 mr-2 stroke-[2.2]" /> Add to Cart</>)}
 </Button>
 </div>
 <Button size="lg" variant="secondary" className="w-full" onClick={() => { handleAdd(); navigate('/cart'); }} disabled={metrics.isOut || onVacation || isOwnProduct}>
 Buy Now
 </Button>
 </div>

 {/* Trust strip */}
 <div className="grid grid-cols-3 gap-2">
 {[
 { icon: Shield, title: 'Secure payment', sub: 'M-Pesa · Tigo · Airtel' },
 { icon: RotateCcw, title: '7-day returns', sub: 'Money-back guarantee' },
 { icon: Truck, title: 'Fast delivery', sub: '2–5 days nationwide' },
 ].map(({ icon: Icon, title, sub }) => (
 <div key={title} className="rounded-2xl bg-foreground/[0.03] border border-foreground/8 p-3 text-center">
 <Icon className="w-4 h-4 mx-auto mb-1.5 text-emerald-600 dark:text-emerald-400 stroke-[2]" />
 <p className="text-[11px] font-bold leading-tight">{title}</p>
 <p className="text-[10px] font-medium text-foreground/45 mt-0.5 leading-tight">{sub}</p>
 </div>
 ))}
 </div>

 {/* Seller card */}
 {vendor && (
 <div className="rounded-3xl border border-foreground/8 bg-foreground/[0.02] p-4 flex items-center gap-4">
 <div className="w-14 h-14 rounded-2xl bg-foreground/[0.06] overflow-hidden shrink-0 flex items-center justify-center">
 {vendor.logo_url
 ? <img src={vendor.logo_url} alt={vendor.store_name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
 : <Store className="w-6 h-6 text-foreground/30 stroke-[1.5]" />}
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2">
 <p className="text-sm font-black truncate">{vendor.store_name}</p>
 {vendor.is_verified && <VerifiedBadge className="shrink-0" />}
 </div>
 <p className="text-[11px] font-semibold text-foreground/45 mt-0.5">
 {vendor.region ? `${vendor.region} · ` : ''}{vendor.trust_score ? `${vendor.trust_score}% trust score` : 'Seller on MaliMart'}
 </p>
 </div>
 <div className="flex gap-2 shrink-0">
 <Button size="sm" variant="secondary" onClick={handleMessageSeller} aria-label="Chat with seller">
 <MessageSquare className="w-4 h-4 stroke-[2]" />
 </Button>
 <Button size="sm" variant="outline" asChild>
 <Link to={`/store/${vendor.seller_id}`}>Visit store <ChevronRight className="w-3.5 h-3.5 ml-0.5" /></Link>
 </Button>
 </div>
 </div>
 )}
 </div>
 </motion.div>

 {/* ── Details tabs ─────────────────────────────────────────── */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true, margin: '-50px' }}
 transition={{ duration: 0.5 }}
 className="mt-12 md:mt-16"
 >
 <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5" role="tablist" aria-label="Product details">
 {tabs.map(t => (
 <button
 key={t.id}
 role="tab"
 id={`tab-${t.id}`}
 aria-selected={activeTab === t.id}
 aria-controls={`panel-${t.id}`}
 onClick={() => setActiveTab(t.id)}
 className={`h-11 px-5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all ${activeTab === t.id ? 'bg-foreground text-background' : 'bg-foreground/[0.05] text-foreground/60 hover:bg-foreground/[0.1]'}`}
 >
 {t.label}
 </button>
 ))}
 </div>

 <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} className="rounded-3xl border border-foreground/8 bg-foreground/[0.02] p-6 md:p-8">
 {activeTab === 'description' && (
 <div className="max-w-3xl">
 <p className="text-sm leading-relaxed text-foreground/70 whitespace-pre-line">{product.description || 'No description provided.'}</p>
 {vendor?.description && (
 <div className="mt-6 pt-6 border-t border-foreground/8">
 <p className="text-xs font-bold uppercase tracking-widest text-foreground/40 mb-2">About {vendor.store_name}</p>
 <p className="text-sm leading-relaxed text-foreground/60">{vendor.description}</p>
 </div>
 )}
 </div>
 )}

 {activeTab === 'specs' && (
 specs.length > 0 ? (
 <dl className="grid md:grid-cols-2 gap-x-10">
 {specs.map(([label, value]) => (
 <div key={label} className="flex justify-between items-center gap-4 py-3 border-b border-foreground/6">
 <dt className="text-xs font-bold uppercase tracking-widest text-foreground/40">{label}</dt>
 <dd className="text-sm font-semibold text-right">{value?.toString()}</dd>
 </div>
 ))}
 </dl>
 ) : (
 <p className="text-sm text-foreground/50">No specifications listed for this product.</p>
 )
 )}

 {activeTab === 'shipping' && (
 <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
 <div className="flex gap-3">
 <Truck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 stroke-[2] shrink-0 mt-0.5" />
 <div>
 <p className="text-sm font-bold mb-1">Delivery</p>
 <p className="text-sm text-foreground/60 leading-relaxed">
 {vendor?.shipping_policy || 'Delivery within 2–5 business days across Tanzania.'}
 {vendor?.region && ` Ships from ${vendor.region}.`}
 </p>
 </div>
 </div>
 <div className="flex gap-3">
 <RotateCcw className="w-5 h-5 text-emerald-600 dark:text-emerald-400 stroke-[2] shrink-0 mt-0.5" />
 <div>
 <p className="text-sm font-bold mb-1">Returns</p>
 <p className="text-sm text-foreground/60 leading-relaxed">{vendor?.return_policy || '7-day return window from the delivery date.'}</p>
 </div>
 </div>
 <div className="flex gap-3">
 <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400 stroke-[2] shrink-0 mt-0.5" />
 <div>
 <p className="text-sm font-bold mb-1">Payment</p>
 <p className="text-sm text-foreground/60 leading-relaxed">Pay securely via M-Pesa, Tigo Pesa, Airtel Money or bank transfer.</p>
 </div>
 </div>
 {(product.warranty_period || vendor?.warranty) && (
 <div className="flex gap-3">
 <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 stroke-[2] shrink-0 mt-0.5" />
 <div>
 <p className="text-sm font-bold mb-1">Warranty</p>
 <p className="text-sm text-foreground/60 leading-relaxed">{product.warranty_period || vendor?.warranty}</p>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 </motion.div>

 {/* ── Reviews ──────────────────────────────────────────────── */}
 <motion.div
 id="reviews"
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true, margin: '-50px' }}
 transition={{ duration: 0.5 }}
 className="mt-12 md:mt-16 scroll-mt-28"
 >
 <h2 className="text-xl md:text-2xl font-black tracking-tight mb-6">Customer Reviews</h2>
 <ReviewSection productId={product.id} />
 </motion.div>

 {/* ── Related ──────────────────────────────────────────────── */}
 {relatedProducts.length > 0 && (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true, margin: '-50px' }}
 transition={{ duration: 0.5 }}
 className="mt-12 md:mt-16"
 >
 <h2 className="text-xl md:text-2xl font-black tracking-tight mb-6">You might also like</h2>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-8 md:gap-x-5 md:gap-y-10">
 {relatedProducts.map((p, index) => (
 <ProductCard key={p.id} product={p} index={index} onClick={() => navigate(`/product/${p.id}`)} />
 ))}
 </div>
 </motion.div>
 )}

 {/* ── Recently viewed ──────────────────────────────────────── */}
 {recentlyViewed.filter(p => p.id !== product.id).length >= 2 && (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true, margin: '-50px' }}
 transition={{ duration: 0.5 }}
 className="mt-12 md:mt-16"
 >
 <h2 className="text-xl md:text-2xl font-black tracking-tight mb-6">Recently viewed</h2>
 <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
 {recentlyViewed.filter(p => p.id !== product.id).slice(0, 6).map((p, i) => (
 <div key={p.id} className="flex-shrink-0 w-40 md:w-48">
 <ProductCard product={p} index={i} onClick={() => navigate(`/product/${p.id}`)} />
 </div>
 ))}
 </div>
 </motion.div>
 )}
 </div>

 {/* ── Sticky mobile CTA ──────────────────────────────────────── */}
 <div className="fixed bottom-0 inset-x-0 z-[60] lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
 <div className="mx-3 mb-3 flex gap-2.5">
 <button
 aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
 onClick={() => { toggleWishlist(product); addToast(isLiked ? 'Removed from wishlist' : 'Saved to wishlist', 'success'); }}
 className={`w-14 h-14 rounded-2xl flex items-center justify-center border bg-background/96 backdrop-blur-xl transition-all active:scale-95 shadow-lg ${isLiked ? 'border-rose-400/50 text-rose-500' : 'border-foreground/12 text-foreground/60'}`}
 >
 <Heart className={`w-5 h-5 ${isLiked ? 'fill-current stroke-none' : 'stroke-[1.8]'}`} />
 </button>
 <button
 onClick={handleAdd}
 disabled={metrics.isOut || onVacation || isOwnProduct}
 className={`flex-1 h-14 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-lg ${(metrics.isOut || onVacation || isOwnProduct) ? 'bg-foreground/10 text-foreground/35 cursor-not-allowed' : isAdding ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white'}`}
 >
 {isAdding ? (
 <><Check className="w-4 h-4 stroke-[2.5]" /> Added to Cart</>
 ) : isOwnProduct ? 'Your Own Listing' : metrics.isOut ? 'Out of Stock' : onVacation ? 'Store on Vacation' : (
 <><ShoppingBag className="w-4 h-4 stroke-[2.2]" /> Add to Cart · {formatTZS(metrics.price * qty)}</>
 )}
 </button>
 </div>
 </div>

 {/* ── Share modal ────────────────────────────────────────────── */}
 <ProductShare product={product} isOpen={shareOpen} onClose={() => setShareOpen(false)} />

 {/* ── Lightbox ───────────────────────────────────────────────── */}
 <AnimatePresence>
   {lightboxOpen && (
     <motion.div
       initial={{ opacity: 0 }}
       animate={{ opacity: 1 }}
       exit={{ opacity: 0 }}
       transition={{ duration: 0.2 }}
       className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
       onClick={() => setLightboxOpen(false)}
     >
       <button aria-label="Close fullscreen image" className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10">
         <X className="w-5 h-5 stroke-[2]" />
       </button>
       <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/50 text-xs font-semibold tabular-nums">
         {activeImage + 1} / {images.length}
       </div>
       <motion.img
         key={activeImage}
         initial={{ opacity: 0, scale: 0.96 }}
         animate={{ opacity: 1, scale: 1 }}
         exit={{ opacity: 0, scale: 0.96 }}
         transition={{ duration: 0.2 }}
         src={images[activeImage]}
         alt={product.name}
         className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl"
         onClick={e => e.stopPropagation()}
       />
       {images.length > 1 && (
         <>
           <button
             aria-label="Previous image"
             onClick={e => { e.stopPropagation(); setActiveImage(i => (i - 1 + images.length) % images.length); }}
             className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
           >
             <ArrowLeft className="w-5 h-5 stroke-[2]" />
           </button>
           <button
             aria-label="Next image"
             onClick={e => { e.stopPropagation(); setActiveImage(i => (i + 1) % images.length); }}
             className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
           >
             <ArrowLeft className="w-5 h-5 stroke-[2] rotate-180" />
           </button>
           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
             {images.map((_, i) => (
               <button
                 key={i}
                 aria-label={`Image ${i + 1}`}
                 onClick={e => { e.stopPropagation(); setActiveImage(i); }}
                 className={`h-1.5 rounded-full transition-all ${i === activeImage ? 'w-6 bg-white' : 'w-1.5 bg-white/30'}`}
               />
             ))}
           </div>
         </>
       )}
     </motion.div>
   )}
 </AnimatePresence>
 </div>
 );
};
