import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
 X, Heart, Star, Shield, Truck, MapPin, Plus, Minus,
 Share2, Package, ShoppingBag, ChevronUp, ChevronDown,
 ChevronLeft, ChevronRight, ArrowRight, Sparkles, ZoomIn, ExternalLink,
} from 'lucide-react';
import { Product } from '../types';
import { useAppState } from '../context/AppContext';
import { useToast, VerifiedBadge } from './UI';
import { CURRENCY } from '../constants';
import { ReviewSection } from './ReviewSection';
import { useProductPricing } from '../hooks/useProductPricing';
import { useVariantSelection } from '../hooks/useVariantSelection';
import { getAI } from '../services/aiClient';
import { MODELS } from '../services/aiModels';

interface ProductModalProps {
 product: Product | null;
 isOpen: boolean;
 onClose: () => void;
}

/**
 * ProductModal â€” premium editorial redesign.
 *
 * Mobile: stacked layout â€” full-bleed image â†’ content â†’ floating sticky CTA
 * Desktop: three-column â€” filmstrip thumbnails | main image (52%) | content panel
 *
 * Rules of Hooks: all hooks called unconditionally before any early return.
 */
export const ProductModal: React.FC<ProductModalProps> = ({ product, isOpen, onClose }) => {
 const { addToCart, toggleWishlist, isInWishlist } = useAppState();
 const { addToast } = useToast();
 const navigate = useNavigate();

 const [selectedImg, setSelectedImg] = useState(0);
 const [quantity, setQuantity] = useState(1);
 const [isAdding, setIsAdding] = useState(false);
 const [descExpanded, setDescExpanded] = useState(false);
 const [aiPitch, setAiPitch] = useState('');
 const [zoomedImg, setZoomedImg] = useState<string | null>(null);
 const scrollRef = useRef<HTMLDivElement>(null);
 const imgScrollRef = useRef<HTMLDivElement>(null);

 const { selectedOptions, setSelectedOptions, selectedVariant, variantStructure } = useVariantSelection(product);
 const stats = useProductPricing(product, selectedVariant);

 const dragY = useMotionValue(0);
 const sheetOpacity = useTransform(dragY, [0, 280], [1, 0.15]);
 const backdropOpacity = useTransform(dragY, [0, 280], [1, 0]);

 const handleDragEnd = useCallback((_: any, info: PanInfo) => {
 if (info.offset.y > 110 || info.velocity.y > 500) onClose();
 }, [onClose]);

 const deliveryDate = useMemo(() => {
 const d = new Date();
 d.setDate(d.getDate() + 3);
 return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
 setDescExpanded(false);
 setAiPitch('');
 if (scrollRef.current) scrollRef.current.scrollTop = 0;
 }, [product?.id]);

 // Generate a compelling AI pitch line when the modal opens
 useEffect(() => {
 if (!isOpen || !product || aiPitch) return;
 let cancelled = false;
 (async () => {
   try {
     const ai = getAI();
     const res = await ai.models.generateContent({
       model: MODELS.TEXT,
       contents: [{ role: 'user', parts: [{ text: `Write ONE punchy sentence (max 18 words) that highlights why someone should buy this product. Be specific, avoid generic phrases. Product: "${product.name}" | Category: "${product.category || ''}" | Description: "${(product.description || '').slice(0, 150)}". Output only the sentence, no quotes.` }] }],
       config: { maxOutputTokens: 60 },
     });
     if (!cancelled) setAiPitch(res.text?.trim() ?? '');
   } catch { /* silent */ }
 })();
 return () => { cancelled = true; };
 }, [isOpen, product?.id]);

 useEffect(() => {
 const el = imgScrollRef.current;
 if (!el) return;
 const observer = new IntersectionObserver(
 (entries) => {
 entries.forEach(e => {
 if (e.isIntersecting) {
 const idx = Number(e.target.getAttribute('data-idx'));
 if (!isNaN(idx)) setSelectedImg(idx);
 }
 });
 },
 { root: el, threshold: 0.6 }
 );
 el.querySelectorAll('[data-idx]').forEach(child => observer.observe(child));
 return () => observer.disconnect();
 }, [product?.id, isOpen]);

 if (!product) return null;

 const isLiked = isInWishlist(product.id);
 const finalPrice = stats.price;
 const onSale = !!(stats.originalPrice && stats.originalPrice > stats.price);
 const savingsPct = onSale ? Math.round((1 - stats.price / (stats.originalPrice as number)) * 100) : 0;
 const sellerLocation = (product as any).seller_location || product.location;

 const images = (() => {
 const base = product.images || [];
 if (selectedVariant?.image_url) return [selectedVariant.image_url, ...base];
 return base.length ? base : ['data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 600 800%27%3E%3Crect width=%27600%27 height=%27800%27 fill=%27%23f1f0ec%27/%3E%3Cg fill=%27%23c8c5bc%27%3E%3Ccircle cx=%27300%27 cy=%27340%27 r=%2770%27/%3E%3Cpath d=%27M170 560 q60 -110 130 -40 q40 -70 130 30 l0 50 l-260 0 z%27/%3E%3C/g%3E%3Ctext x=%27300%27 y=%27660%27 font-family=%27sans-serif%27 font-size=%2728%27 fill=%27%23a8a59c%27 text-anchor=%27middle%27%3ENo image%3C/text%3E%3C/svg%3E'];
 })();

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

 const scrollToImg = (idx: number) => {
 setSelectedImg(idx);
 imgScrollRef.current?.children[idx]?.scrollIntoView({ behavior: 'smooth', inline: 'center' });
 };

 // â”€â”€ Reusable sub-views â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 const RatingRow = () => product.rating ? (
 <div className="flex items-center gap-1.5">
 <div className="flex">
 {[1, 2, 3, 4, 5].map(n => (
 <Star key={n} className={`w-3.5 h-3.5 ${n <= Math.round(product.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-foreground/15'}`} />
 ))}
 </div>
 <span className="text-[13px] font-semibold text-foreground/80">{Number(product.rating).toFixed(1)}</span>
 {product.review_count ? (
 <span className="text-[13px] text-foreground/40">Â· {product.review_count} review{product.review_count === 1 ? '' : 's'}</span>
 ) : null}
 </div>
 ) : null;

 const VariantPicker = () => variantStructure.length > 0 ? (
 <div className="space-y-4">
 {variantStructure.map(attr => (
 <div key={attr.name}>
 <div className="flex justify-between items-center mb-2">
 <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/45">{attr.name}</span>
 <span className="text-[12px] font-semibold text-foreground">{selectedOptions[attr.name]}</span>
 </div>
 <div className="flex flex-wrap gap-2">
 {attr.values.map(val => {
 const isSel = selectedOptions[attr.name] === val;
 return (
 <button
 key={val}
 onClick={() => setSelectedOptions({ ...selectedOptions, [attr.name]: val })}
 className={`px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-95 min-h-[40px]
 ${isSel
 ? 'bg-foreground text-background'
 : 'bg-transparent text-foreground/70 ring-1 ring-foreground/15 hover:ring-foreground/40'}`}
 >
 {val}
 </button>
 );
 })}
 </div>
 </div>
 ))}
 </div>
 ) : null;

 const TrustBadges = ({ compact = false }: { compact?: boolean }) => (
 <div className="grid grid-cols-3 gap-2">
 {[
 { icon: Truck, label: 'Delivery', value: `By ${deliveryDate}` },
 { icon: Shield, label: 'Protected', value: 'Full refund' },
 { icon: Package, label: 'Stock', value: stats.isOut ? 'Out of stock' : (product.stock != null ? `${product.stock} left` : 'In stock') },
 ].map(item => (
 <div key={item.label} className={`flex flex-col gap-1 ${compact ? 'p-2.5' : 'p-3'} rounded-xl bg-foreground/[0.03] ring-1 ring-foreground/[0.05]`}>
 <item.icon className="w-3.5 h-3.5 text-foreground/50" />
 <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/40 leading-none">{item.label}</span>
 <span className={`${compact ? 'text-[11px]' : 'text-[12px]'} font-semibold text-foreground leading-tight`}>{item.value}</span>
 </div>
 ))}
 </div>
 );

 return (
 <AnimatePresence>
 {isOpen && (
 <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center p-0 md:p-6 font-sans">

 {/* Backdrop */}
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.25 }}
 style={{ opacity: backdropOpacity }}
 onClick={onClose}
 className="absolute inset-0 bg-black/70 backdrop-blur-sm"
 />

 {/* â•â•â•â• MOBILE bottom sheet â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
 <motion.div
 role="dialog"
 aria-modal="true"
 aria-label={product.name}
 initial={{ y: '100%' }}
 animate={{ y: 0 }}
 exit={{ y: '100%' }}
 transition={{ type: 'spring', damping: 34, stiffness: 320 }}
 style={{ y: dragY, opacity: sheetOpacity }}
 drag="y"
 dragConstraints={{ top: 0, bottom: 0 }}
 dragElastic={{ top: 0, bottom: 0.5 }}
 onDragEnd={handleDragEnd}
 className="relative z-50 w-full bg-background text-foreground
 rounded-t-[24px] overflow-hidden shadow-2xl
 flex flex-col h-[97dvh] md:hidden"
 >
 {/* Drag pill */}
 <div className="absolute top-0 left-0 right-0 flex justify-center pt-2 pb-1 z-20 pointer-events-none">
 <div className="w-10 h-1 rounded-full bg-foreground/20" />
 </div>

 {/* Floating top-right actions */}
 <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
 <button
 onClick={() => toggleWishlist(product)}
 aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
 className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md shadow-sm transition-all active:scale-90
 ${isLiked ? 'bg-rose-500 text-white' : 'bg-background/80 text-foreground ring-1 ring-foreground/10'}`}
 >
 <Heart className={`w-4 h-4 ${isLiked ? 'fill-current stroke-none' : 'stroke-[2.2]'}`} />
 </button>
 <button onClick={handleShare} aria-label="Share"
 className="w-9 h-9 rounded-full bg-background/80 text-foreground ring-1 ring-foreground/10 backdrop-blur-md shadow-sm flex items-center justify-center active:scale-90 transition-transform">
 <Share2 className="w-4 h-4 stroke-[2.2]" />
 </button>
 <button onClick={onClose} aria-label="Close"
 className="w-9 h-9 rounded-full bg-background/80 text-foreground ring-1 ring-foreground/10 backdrop-blur-md shadow-sm flex items-center justify-center active:scale-90 transition-transform">
 <X className="w-4 h-4 stroke-[2.5]" />
 </button>
 </div>

 {/* Scrollable body */}
 <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-y-contain no-scrollbar">

 {/* Full-bleed image carousel */}
 <div className="relative w-full" style={{ aspectRatio: '4/5' }}>
 <div
 ref={imgScrollRef}
 className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
 style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
 >
 {images.map((src, idx) => (
 <div key={`${src}-${idx}`} data-idx={idx}
 className="flex-shrink-0 w-full h-full snap-center">
 <img src={src} alt={`${product.name} ${idx + 1}`}
 className="w-full h-full object-cover"
 loading={idx === 0 ? 'eager' : 'lazy'} />
 </div>
 ))}
 </div>

 {onSale && (
 <div className="absolute top-12 left-4 z-10 px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[11px] font-bold tracking-wide shadow-md">
 âˆ’{savingsPct}% OFF
 </div>
 )}

 {/* Bottom gradient */}
 <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background/50 to-transparent pointer-events-none" />

 {/* Pagination dots */}
 {images.length > 1 && (
 <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
 {images.map((_, idx) => (
 <button key={idx} aria-label={`Image ${idx + 1}`}
 onClick={() => scrollToImg(idx)}
 className={`h-[5px] rounded-full transition-all duration-300
 ${selectedImg === idx ? 'w-6 bg-white' : 'w-[5px] bg-white/45'}`} />
 ))}
 </div>
 )}
 </div>

 {/* Info body */}
 <div className="px-5 pt-5 pb-32">
 {/* Seller */}
 <div className="flex items-center gap-1.5 mb-3">
 <button
 onClick={() => { onClose(); navigate(`/store/${product.seller_id}`); }}
 className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/45 hover:text-foreground transition-colors"
 >
 {product.seller_name || 'Store'}
 </button>
 {product.is_verified && <VerifiedBadge className="scale-[0.65] origin-left -ml-0.5 -mr-1 opacity-80" />}
 {sellerLocation && (
 <span className="flex items-center gap-0.5 text-[10px] text-foreground/35">
 <MapPin className="w-2.5 h-2.5 stroke-[2.5]" />
 {sellerLocation}
 </span>
 )}
 </div>

 <h2 className="text-[24px] font-semibold tracking-tight leading-tight text-foreground mb-2">
 {product.name}
 </h2>

 {/* AI pitch line */}
 {aiPitch && (
   <div className="flex items-start gap-1.5 mb-3 px-3 py-2 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
     <Sparkles className="w-3 h-3 text-emerald-600 mt-0.5 shrink-0" />
     <p className="text-[12px] font-semibold text-emerald-800 dark:text-emerald-300 leading-snug">{aiPitch}</p>
   </div>
 )}

 <div className="mb-4"><RatingRow /></div>

 {/* Price */}
 <div className="flex items-baseline gap-3 mb-5">
 <span className="text-[32px] font-bold tracking-tight leading-none text-foreground">
 {CURRENCY} {Math.round(finalPrice).toLocaleString()}
 </span>
 {onSale && (
 <>
 <span className="text-[15px] font-medium text-foreground/35 line-through">
 {CURRENCY} {Math.round(stats.originalPrice as number).toLocaleString()}
 </span>
 <span className="text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
 Save {savingsPct}%
 </span>
 </>
 )}
 </div>

 <div className="mb-5"><TrustBadges compact /></div>

 {product.description && (
 <div className="mb-5">
 <p className={`text-[14px] text-foreground/65 leading-relaxed whitespace-pre-line ${!descExpanded ? 'line-clamp-3' : ''}`}>
 {product.description}
 </p>
 {product.description.length > 120 && (
 <button onClick={() => setDescExpanded(v => !v)}
 className="mt-1.5 text-[12px] font-semibold text-foreground/45 hover:text-foreground flex items-center gap-0.5 transition-colors">
 {descExpanded ? 'Show less' : 'Read more'}
 {descExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
 </button>
 )}
 </div>
 )}

 {variantStructure.length > 0 && (
 <div className="mb-5"><VariantPicker /></div>
 )}

 <div className="pt-5 border-t border-foreground/8">
 <ReviewSection productId={product.id} />
 </div>
 </div>
 </div>

 {/* Floating sticky CTA */}
 <div
 className="absolute bottom-0 left-0 right-0 px-4 pt-3 bg-background/92 backdrop-blur-xl border-t border-foreground/[0.06]"
 style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))' }}
 >
 <div className="flex items-center gap-2.5">
 <div className="flex items-center bg-foreground/[0.05] rounded-xl ring-1 ring-foreground/10 h-[52px]">
 <button onClick={() => setQuantity(q => Math.max(1, q - 1))} aria-label="Decrease"
 className="w-11 h-full flex items-center justify-center text-foreground/60 active:bg-foreground/[0.06] rounded-l-xl transition-colors">
 <Minus className="w-4 h-4 stroke-[2.2]" />
 </button>
 <span className="w-7 text-center text-[15px] font-bold tabular-nums select-none">{quantity}</span>
 <button onClick={() => setQuantity(q => q + 1)} aria-label="Increase"
 className="w-11 h-full flex items-center justify-center text-foreground/60 active:bg-foreground/[0.06] rounded-r-xl transition-colors">
 <Plus className="w-4 h-4 stroke-[2.2]" />
 </button>
 </div>
 <motion.button
 whileTap={{ scale: 0.97 }}
 onClick={() => handleAddToCart(false)}
 disabled={isAdding || stats.isOut}
 className={`flex-1 h-[52px] rounded-xl flex items-center justify-center gap-2 text-[15px] font-semibold transition-all
 ${stats.isOut
 ? 'bg-foreground/10 text-foreground/40 cursor-not-allowed'
 : 'bg-foreground text-background active:bg-foreground/90'}`}
 >
 {isAdding ? (
 <span className="opacity-70">Addingâ€¦</span>
 ) : stats.isOut ? 'Out of stock' : (
 <>
 <ShoppingBag className="w-[17px] h-[17px] stroke-[2]" />
 <span>Add to bag</span>
 <span className="opacity-55 font-medium text-[13px]">
 Â· {CURRENCY} {Math.round(finalPrice * quantity).toLocaleString()}
 </span>
 </>
 )}
 </motion.button>
 </div>
 </div>
 </motion.div>

 {/* â•â•â•â• DESKTOP: editorial three-column â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
 <motion.div
 role="dialog"
 aria-modal="true"
 aria-label={product.name}
 initial={{ opacity: 0, scale: 0.97, y: 20 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.97, y: 20 }}
 transition={{ type: 'spring', damping: 30, stiffness: 300 }}
 className="relative z-50 w-full max-w-[1080px] bg-background text-foreground
 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-foreground/8
 hidden md:flex flex-row"
 style={{ maxHeight: '92vh' }}
 >
 {/* Col 1: Vertical filmstrip */}
 {images.length > 1 && (
 <div className="w-[72px] flex-shrink-0 flex flex-col gap-1.5 overflow-y-auto overscroll-contain no-scrollbar p-2 border-r border-foreground/[0.06] bg-foreground/[0.01]">
 {images.slice(0, 8).map((src, idx) => (
 <button
 key={`thumb-${idx}`}
 onClick={() => setSelectedImg(idx)}
 style={{ aspectRatio: '1/1' }}
 className={`relative flex-shrink-0 w-full rounded-lg overflow-hidden transition-all duration-200
 ${selectedImg === idx
 ? 'ring-2 ring-foreground opacity-100'
 : 'ring-1 ring-foreground/10 opacity-45 hover:opacity-75'}`}
 aria-label={`View image ${idx + 1}`}
 >
 <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
 </button>
 ))}
 </div>
 )}

 {/* Col 2: Main image */}
 <div
 className="relative flex-shrink-0 bg-foreground/[0.02]"
 style={{ width: images.length > 1 ? '52%' : '57%' }}
 >
 <AnimatePresence mode="wait">
 <motion.img
 key={images[selectedImg]}
 src={images[selectedImg]}
 alt={product.name}
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.18 }}
 className="w-full h-full object-cover"
 style={{ maxHeight: '92vh' }}
 />
 </AnimatePresence>

 {onSale && (
 <div className="absolute top-5 left-5 z-10 px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-[12px] font-bold tracking-wide shadow-md">
 âˆ’{savingsPct}% OFF
 </div>
 )}

 {/* Zoom button */}
 <button
   onClick={() => setZoomedImg(images[selectedImg])}
   className="absolute bottom-5 right-5 z-10 w-9 h-9 rounded-full bg-background/80 backdrop-blur-md ring-1 ring-foreground/10 flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-background transition-colors shadow-sm"
   aria-label="Zoom image"
 >
   <ZoomIn className="w-4 h-4 stroke-[2]" />
 </button>

 {/* Prev/next arrows */}
 {images.length > 1 && (
 <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
 <button
 onClick={() => setSelectedImg(i => (i - 1 + images.length) % images.length)}
 className="pointer-events-auto w-9 h-9 rounded-full bg-background/80 text-foreground ring-1 ring-foreground/10 backdrop-blur-md flex items-center justify-center hover:bg-background transition-colors shadow-sm"
 aria-label="Previous image"
 >
 <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
 </button>
 <button
 onClick={() => setSelectedImg(i => (i + 1) % images.length)}
 className="pointer-events-auto w-9 h-9 rounded-full bg-background/80 text-foreground ring-1 ring-foreground/10 backdrop-blur-md flex items-center justify-center hover:bg-background transition-colors shadow-sm"
 aria-label="Next image"
 >
 <ChevronRight className="w-4 h-4 stroke-[2.2]" />
 </button>
 </div>
 )}
 </div>

 {/* Col 3: Content + CTA */}
 <div className="flex-1 flex flex-col min-h-0 min-w-0">

 {/* Close + share */}
 <div className="absolute top-4 right-4 z-[60] flex gap-2">
 <button onClick={handleShare} aria-label="Share"
 className="w-9 h-9 rounded-full bg-background/90 text-foreground ring-1 ring-foreground/10 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors shadow-sm">
 <Share2 className="w-4 h-4 stroke-[2.2]" />
 </button>
 <button onClick={onClose} aria-label="Close"
 className="w-9 h-9 rounded-full bg-background/90 text-foreground ring-1 ring-foreground/10 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors shadow-sm">
 <X className="w-4 h-4 stroke-[2.5]" />
 </button>
 </div>

 {/* Scrollable content */}
 <div className="flex-1 overflow-y-auto no-scrollbar px-8 pt-9 pb-6">

 {/* Seller */}
 <div className="flex items-center gap-2 mb-4">
 <button
 onClick={() => { onClose(); navigate(`/store/${product.seller_id}`); }}
 className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/45 hover:text-foreground transition-colors"
 >
 {product.seller_name || 'Store'}
 </button>
 {product.is_verified && <VerifiedBadge className="scale-[0.7] origin-left -ml-1 opacity-90" />}
 {sellerLocation && (
 <span className="flex items-center gap-0.5 text-[10px] text-foreground/35 font-medium">
 <MapPin className="w-3 h-3 stroke-[2.5]" />
 {sellerLocation}
 </span>
 )}
 </div>

 <h2 className="font-sans text-[30px] font-semibold tracking-tight leading-tight text-foreground mb-3">
 {product.name}
 </h2>

 {/* AI pitch line */}
 {aiPitch && (
   <div className="flex items-start gap-2 mb-4 px-3.5 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
     <Sparkles className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
     <p className="text-[13px] font-semibold text-emerald-800 dark:text-emerald-300 leading-snug">{aiPitch}</p>
   </div>
 )}

 <div className="mb-5"><RatingRow /></div>

 {/* Price */}
 <div className="flex items-baseline gap-3 mb-6">
 <span className="font-sans text-[38px] font-bold tracking-tight leading-none text-foreground">
 {CURRENCY} {Math.round(finalPrice).toLocaleString()}
 </span>
 {onSale && (
 <>
 <span className="text-base font-medium text-foreground/35 line-through">
 {CURRENCY} {Math.round(stats.originalPrice as number).toLocaleString()}
 </span>
 <span className="text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
 Save {savingsPct}%
 </span>
 </>
 )}
 </div>

 <div className="mb-7"><TrustBadges /></div>

 {product.description && (
 <div className="mb-7">
 <p className={`text-[14px] text-foreground/65 leading-relaxed whitespace-pre-line ${!descExpanded ? 'line-clamp-4' : ''}`}>
 {product.description}
 </p>
 {product.description.length > 180 && (
 <button onClick={() => setDescExpanded(v => !v)}
 className="mt-2 text-[12px] font-semibold text-foreground/45 hover:text-foreground flex items-center gap-0.5 transition-colors">
 {descExpanded ? 'Show less' : 'Read more'}
 {descExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
 </button>
 )}
 </div>
 )}

 {variantStructure.length > 0 && (
 <div className="mb-7"><VariantPicker /></div>
 )}

 <div className="pt-6 border-t border-foreground/8">
 <ReviewSection productId={product.id} />
 </div>
 </div>

 {/* Desktop CTA bar */}
 <div className="flex-shrink-0 px-8 py-5 border-t border-foreground/8 bg-background/95 backdrop-blur-xl">
 <div className="flex items-center gap-3 mb-2.5">
 <button
 onClick={() => toggleWishlist(product)}
 aria-label={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
 className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all
 ${isLiked
 ? 'bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/30'
 : 'bg-foreground/[0.04] text-foreground/60 ring-1 ring-foreground/10 hover:text-foreground'}`}
 >
 <Heart className={`w-5 h-5 ${isLiked ? 'fill-current stroke-none' : 'stroke-[2]'}`} />
 </button>

 <div className="flex items-center bg-foreground/[0.04] rounded-xl ring-1 ring-foreground/10 h-12">
 <button onClick={() => setQuantity(q => Math.max(1, q - 1))} aria-label="Decrease"
 className="w-10 h-full flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors">
 <Minus className="w-4 h-4 stroke-[2.2]" />
 </button>
 <span className="w-7 text-center text-sm font-bold tabular-nums">{quantity}</span>
 <button onClick={() => setQuantity(q => q + 1)} aria-label="Increase"
 className="w-10 h-full flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors">
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
 : 'bg-foreground text-background hover:bg-foreground/90'}`}
 >
 {isAdding ? 'Addingâ€¦' : stats.isOut ? 'Out of stock' : (
 <>
 Add to bag
 <span className="opacity-55 font-medium text-[13px] tabular-nums">
 Â· {CURRENCY} {Math.round(finalPrice * quantity).toLocaleString()}
 </span>
 </>
 )}
 </motion.button>
 </div>

 <button
 onClick={() => { onClose(); navigate(`/product/${product.id}`); }}
 className="w-full flex items-center justify-center gap-1 text-[12px] font-medium text-foreground/35 hover:text-foreground transition-colors py-0.5"
 >
 View full product page <ArrowRight className="w-3 h-3" />
 </button>
 </div>
 </div>
 </motion.div>

 </div>
 )}

 {/* Image zoom lightbox */}
 <AnimatePresence>
   {zoomedImg && (
     <motion.div
       initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
       className="fixed inset-0 z-[500] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
       onClick={() => setZoomedImg(null)}
     >
       <motion.img
         src={zoomedImg}
         alt="Zoomed"
         initial={{ scale: 0.9, opacity: 0 }}
         animate={{ scale: 1, opacity: 1 }}
         exit={{ scale: 0.9, opacity: 0 }}
         transition={{ type: 'spring', damping: 26, stiffness: 300 }}
         className="max-w-full max-h-full object-contain rounded-2xl"
         onClick={e => e.stopPropagation()}
       />
       <button onClick={() => setZoomedImg(null)}
         className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
         <X className="w-5 h-5 stroke-[2.5]" />
       </button>
       {images.length > 1 && (
         <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
           {images.map((src, i) => (
             <button key={i} onClick={e => { e.stopPropagation(); setZoomedImg(src); }}
               className={`w-2 h-2 rounded-full transition-all ${zoomedImg === src ? 'bg-white scale-125' : 'bg-white/35 hover:bg-white/60'}`} />
           ))}
         </div>
       )}
     </motion.div>
   )}
 </AnimatePresence>
 </AnimatePresence>
 );
};
