import React from 'react';
import { Star, ShieldCheck, Truck, Zap, Store } from 'lucide-react';
import { Product, ProductVariant } from '../../types';
import { formatTZS, CURRENCY } from '../../constants';

export const PhonePreview = ({ data, variant, activeImage }: { data: Partial<Product>, variant?: ProductVariant | null, activeImage: string }) => {
 const salePrice = !variant && data.sale_price && data.sale_price > 0 ? data.sale_price : null;
 const finalPrice = variant ? (variant.sale_price || variant.base_price) : (salePrice || data.price || 0);
 const discount = salePrice && data.price ? Math.round(((data.price - salePrice) / data.price) * 100) : 0;

 return (
 <div className="w-[280px] h-[560px] xl:w-[300px] xl:h-[600px] rounded-[40px] bg-foreground border-8 border-foreground/90 ring-1 ring-foreground/20 shadow-2xl relative overflow-hidden flex flex-col pointer-events-none select-none mx-auto transform transition-all duration-300 origin-center scale-90 md:scale-100">
 {/* Dynamic Island */}
 <div className="absolute top-0 left-0 right-0 h-6 z-30 flex justify-center pt-2">
 <div className="w-20 h-5 bg-black rounded-full"></div>
 </div>
 
 {/* Content */}
 <div className="flex-1 bg-background dark:bg-background overflow-hidden flex flex-col relative">
 <div className="h-[60%] relative bg-foreground/[0.05] group">
 <img 
 src={activeImage || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 600 800%27%3E%3Crect width=%27600%27 height=%27800%27 fill=%27%23f1f0ec%27/%3E%3Cg fill=%27%23c8c5bc%27%3E%3Ccircle cx=%27300%27 cy=%27340%27 r=%2770%27/%3E%3Cpath d=%27M170 560 q60 -110 130 -40 q40 -70 130 30 l0 50 l-260 0 z%27/%3E%3C/g%3E%3Ctext x=%27300%27 y=%27660%27 font-family=%27sans-serif%27 font-size=%2728%27 fill=%27%23a8a59c%27 text-anchor=%27middle%27%3ENo image%3C/text%3E%3C/svg%3E'} 
 className="w-full h-full object-cover" 
 alt="Preview" loading="lazy" decoding="async" 
 />
 <div className="absolute top-8 left-4 flex flex-col gap-2 z-10">
 {discount > 0 && !variant && <span className="bg-primary text-background dark:bg-background dark:text-foreground text-[8px] px-2 py-1 uppercase tracking-[0.2em]">{discount}% OFF</span>}
 {data.is_boosted && <span className="bg-primary text-background dark:bg-background dark:text-foreground text-[8px] px-2 py-1 uppercase tracking-[0.2em] flex items-center gap-1"><Zap className="w-2 h-2 fill-current"/> Boosted</span>}
 </div>
 </div>
 
 <div className="flex-1 p-5 bg-background dark:bg-background relative z-10 flex flex-col border-t border-foreground/10">
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-1.5 text-foreground opacity-60">
 {data.brand ? (
 <span className="text-[9px] uppercase tracking-[0.2em]">{data.brand}</span>
 ) : (
 <div className="flex items-center gap-1">
 <Store className="w-3 h-3 stroke-[1]" />
 <span className="text-[9px] uppercase tracking-[0.2em]">My Store</span>
 </div>
 )}
 </div>
 </div>
 <h3 className="font-serif text-lg text-foreground leading-snug mb-4 line-clamp-2">{data.name || 'Product Title'}</h3>
 <div className="mt-auto">
 {salePrice && !variant && (
 <span className="text-[10px] text-foreground opacity-40 line-through mb-0.5 block">
 {(data.price || 0).toLocaleString()} {CURRENCY}
 </span>
 )}
 <div className="flex justify-between items-end">
 <div className="flex items-baseline gap-1">
 <span className="text-2xl font-serif text-foreground">{(finalPrice || 0).toLocaleString()}</span>
 <span className="text-[9px] uppercase tracking-[0.2em] text-foreground opacity-60">{CURRENCY}</span>
 </div>
 {variant && (
 <div className="px-2 py-1 border border-foreground/10 text-[8px] uppercase tracking-[0.2em] text-foreground">
 {Object.values(variant.attributes).join('/')}
 </div>
 )}
 </div>
 </div>
 <div className="w-full h-12 bg-primary text-background dark:bg-background dark:text-foreground flex items-center justify-center text-[10px] uppercase tracking-[0.2em] mt-4 transition-opacity hover:opacity-90">
 Add To Bag
 </div>
 </div>
 </div>
 </div>
 );
};