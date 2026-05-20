import { ShopPage } from "./ShopPage";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
    Store, MapPin, Star, BadgeCheck, MessageSquare, 
    Share2, Filter, LayoutGrid, Search, Globe, Truck, Clock, 
    ShieldCheck, Loader2, ArrowRight, Instagram, Twitter, Facebook,
    Info, Calendar, FileText, Tag, Phone
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { Button, Card, Badge, Input } from '../components/UI';
import { ProductCard } from '../components/ProductCard';
import { SendMessageModal } from '../components/SendMessageModal';
import { supabase } from '../services/supabaseClient';
import { VendorProfile, Product } from '../types';

export const StorePage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { fetchVendorProfile, products, followSeller, unfollowSeller, isFollowing } = useAppState();
    
    const [vendor, setVendor] = useState<VendorProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

    const [activeTab, setActiveTab] = useState<'collection' | 'info'>('collection');

    useEffect(() => {
        const load = async () => {
            if (!id) return;
            const v = await fetchVendorProfile(id);
            setVendor(v);
            setIsLoading(false);
        };
        load();
    }, [id]);

    const storeProducts = useMemo(() => {
        return products.filter(p => p.seller_id === id && p.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => (b.is_verified ? 1 : 0) - (a.is_verified ? 1 : 0));
    }, [products, id, searchQuery]);

    // Shop mode: no seller ID — show all products
    if (!id) {
        return <ShopPage />;
    }

    if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin" /></div>;
    if (!vendor) return <div className="min-h-screen flex items-center justify-center font-black uppercase text-foreground/50">Store not found</div>;

    return (
        <div className="min-h-screen bg-background text-foreground font-sans pb-[calc(5rem+env(safe-area-inset-bottom))]">
            <SendMessageModal 
                isOpen={isMessageModalOpen} 
                onClose={() => setIsMessageModalOpen(false)} 
                sellerId={vendor.seller_id} 
                sellerName={vendor.store_name} 
            />
            {/* Immersive Banner */}
            <div className="h-[45vh] md:h-[55vh] relative overflow-hidden bg-foreground/[0.03]">
                <img 
                    src={vendor.banner_url || 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=2070&auto=format&fit=crop'} 
                    className="w-full h-full object-cover opacity-80 transition-transform duration-[20s] ease-linear hover:scale-105" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
            </div>

            <div className="container mx-auto px-4 md:px-8 -mt-32 relative z-10 max-w-7xl">
                {/* Store Profile Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.6 }}
                    className="p-8 md:p-12 border border-foreground/10 relative overflow-hidden mb-12 bg-background/90 backdrop-blur-xl rounded-3xl"
                >
                    <div className="flex flex-col lg:flex-row gap-12 items-start">
                        <div className="w-32 h-32 md:w-48 md:h-48 bg-foreground/[0.04] overflow-hidden shrink-0 relative border border-foreground/10">
                            <img src={vendor.logo_url || `https://ui-avatars.com/api/?name=${vendor.store_name}&background=1a1a1a&color=f5f2ed&size=400`} className="w-full h-full object-cover" />
                            {vendor.is_verified && <div className="absolute bottom-2 right-2 bg-primary text-background dark:bg-background dark:text-foreground p-1.5 rounded-full"><ShieldCheck className="w-4 h-4 stroke-[1]" /></div>}
                        </div>
                        
                        <div className="flex-1 space-y-6">
                            <div>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="flex items-center gap-1.5">
                                        <Star className="w-3.5 h-3.5 fill-current stroke-[1]" />
                                        <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">{vendor.trust_score || 98}% Trust</span>
                                    </div>
                                    {vendor.is_verified && <span className="text-[10px] uppercase tracking-[0.2em] font-semibold opacity-60">Verified Artisan</span>}
                                </div>
                                <h1 className="font-serif text-4xl md:text-6xl font-light tracking-tight leading-[1] uppercase">{vendor.store_name}</h1>
                            </div>
                            
                            <p className="text-sm leading-relaxed opacity-80 font-light max-w-2xl italic border-l border-foreground/20 pl-6 py-2">"{vendor.description}"</p>
                            
                            <div className="flex flex-wrap gap-6 pt-4">
                                <div className="flex items-center gap-2 opacity-60"><MapPin className="w-4 h-4 stroke-[1]" /> <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">{vendor.region}</span></div>
                                <div className="flex items-center gap-2 opacity-60"><Clock className="w-4 h-4 stroke-[1]" /> <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">Fast Response</span></div>
                                <div className="flex items-center gap-2 opacity-60"><Truck className="w-4 h-4 stroke-[1]" /> <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">Global Shipping</span></div>
                            </div>
                        </div>

                        <div className="flex flex-row lg:flex-col gap-4 w-full lg:w-auto">
                            <button 
                                className={`h-12 px-8 text-[10px] uppercase tracking-[0.2em] font-semibold transition-colors flex-1 lg:flex-none border ${isFollowing(vendor.seller_id) ? 'border-foreground/20 hover:border-foreground dark:hover:border-background' : 'border-foreground bg-primary text-background dark:border-background dark:bg-background dark:text-foreground hover:opacity-90'}`}
                                onClick={() => isFollowing(vendor.seller_id) ? unfollowSeller(vendor.seller_id) : followSeller(vendor.seller_id)}
                            >
                                {isFollowing(vendor.seller_id) ? "Following" : "Follow Brand"}
                            </button>
                            <button className="h-12 px-8 border border-foreground/20 text-[10px] uppercase tracking-[0.2em] font-semibold hover:border-foreground dark:hover:border-background transition-colors flex-1 lg:flex-none flex items-center justify-center gap-2" onClick={() => setIsMessageModalOpen(true)}>
                                <MessageSquare className="w-4 h-4 stroke-[1]" /> Message
                            </button>
                        </div>
                    </div>
                </motion.div>


                {/* Tabs Navigation */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="flex gap-12 border-b border-foreground/10 mb-16"
                >
                    <button 
                        onClick={() => setActiveTab('collection')}
                        className={`pb-4 text-[10px] uppercase tracking-[0.2em] font-black transition-all relative ${activeTab === 'collection' ? 'text-foreground' : 'text-foreground/40 hover:text-foreground/65'}`}
                    >
                        Collection
                        {activeTab === 'collection' && <motion.div layoutId="store-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 dark:bg-background" />}
                    </button>
                    <button 
                        onClick={() => setActiveTab('info')}
                        className={`pb-4 text-[10px] uppercase tracking-[0.2em] font-black transition-all relative ${activeTab === 'info' ? 'text-foreground' : 'text-foreground/40 hover:text-foreground/65'}`}
                    >
                        Store Info
                        {activeTab === 'info' && <motion.div layoutId="store-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 dark:bg-background" />}
                    </button>
                </motion.div>

                {activeTab === 'collection' ? (
                    /* Products Grid */
                    <div className="space-y-16">
                        <div className="flex flex-col md:flex-row justify-between items-end gap-8 border-b border-foreground/10 pb-8">
                            <div>
                                <h2 className="font-serif text-4xl font-light mb-4">Collection</h2>
                                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold opacity-60 flex items-center gap-3">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary dark:bg-background animate-pulse"></span>
                                    {storeProducts.length} Products Available
                                </p>
                            </div>
                            <div className="relative w-full md:w-[400px] group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 group-focus-within:opacity-100 transition-opacity stroke-[1]" />
                                <input 
                                    placeholder="Search collection..." 
                                    value={searchQuery} 
                                    onChange={(e: any) => setSearchQuery(e.target.value)} 
                                    className="w-full h-12 bg-transparent border-b border-foreground/20 focus:border-foreground dark:focus:border-background outline-none text-sm font-light pl-12 placeholder:opacity-40 transition-colors" 
                                />
                            </div>
                        </div>

                        {storeProducts.length === 0 ? (
                            <div className="py-32 text-center border border-foreground/10 border-dashed">
                                <Search className="w-8 h-8 mx-auto mb-4 opacity-20 stroke-[1]" />
                                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold opacity-60">No matches found in this shop.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                                {storeProducts.map((p, index) => (
                                    <ProductCard key={p.id} product={p} index={index} onClick={() => navigate(`/product/${p.id}`)} />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    /* Store Info Section */
                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.6 }}
                        className="grid md:grid-cols-3 gap-12"
                    >
                        <div className="md:col-span-2 space-y-12">
                            <section className="space-y-6">
                                <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-foreground/40 flex items-center gap-3">
                                    <FileText className="w-4 h-4" /> Store Policy
                                </h3>
                                <div className="p-8 bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 rounded-[2rem] text-sm leading-relaxed opacity-80 font-light italic">
                                    {vendor.store_policy || "No specific store policy provided. Standard marketplace terms apply."}
                                </div>
                            </section>

                            <section className="space-y-6">
                                <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-foreground/40 flex items-center gap-3">
                                    <Tag className="w-4 h-4" /> Specialties
                                </h3>
                                <div className="flex flex-wrap gap-3">
                                    {vendor.tags && vendor.tags.length > 0 ? (
                                        vendor.tags.map((tag: string) => (
                                            <span key={tag} className="px-6 py-3 bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 rounded-full text-[10px] uppercase tracking-widest font-black">
                                                {tag}
                                            </span>
                                        ))
                                    ) : (
                                        <p className="text-xs opacity-40 italic">No tags listed</p>
                                    )}
                                </div>
                            </section>

                            <section className="space-y-6">
                                <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-foreground/40 flex items-center gap-3">
                                    <Globe className="w-4 h-4" /> Social Presence
                                </h3>
                                <div className="flex gap-4">
                                    {vendor.social_links?.find(l => l.platform === 'Instagram') && (
                                        <a href={vendor.social_links.find(l => l.platform === 'Instagram')?.url} target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-2xl bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 flex items-center justify-center hover:scale-110 transition-transform">
                                            <Instagram className="w-5 h-5" />
                                        </a>
                                    )}
                                    {vendor.social_links?.find(l => l.platform === 'Twitter' || l.platform === 'X') && (
                                        <a href={vendor.social_links.find(l => l.platform === 'Twitter' || l.platform === 'X')?.url} target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-2xl bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 flex items-center justify-center hover:scale-110 transition-transform">
                                            <Twitter className="w-5 h-5" />
                                        </a>
                                    )}
                                    {vendor.social_links?.find(l => l.platform === 'Facebook') && (
                                        <a href={vendor.social_links.find(l => l.platform === 'Facebook')?.url} target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-2xl bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 flex items-center justify-center hover:scale-110 transition-transform">
                                            <Facebook className="w-5 h-5" />
                                        </a>
                                    )}
                                    {vendor.social_links?.find(l => l.platform === 'WhatsApp') && (
                                        <a href={`https://wa.me/${vendor.social_links.find(l => l.platform === 'WhatsApp')?.url?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-2xl bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 flex items-center justify-center hover:scale-110 transition-transform">
                                            <Phone className="w-5 h-5" />
                                        </a>
                                    )}
                                    {(!vendor.social_links || vendor.social_links.length === 0) && <p className="text-xs opacity-40 italic">No social links connected</p>}
                                </div>
                            </section>
                        </div>

                        <div className="space-y-12">
                            <section className="space-y-6">
                                <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-foreground/40 flex items-center gap-3">
                                    <Clock className="w-4 h-4" /> Opening Hours
                                </h3>
                                <div className="p-8 bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 rounded-[2rem] space-y-4">
                                    {vendor.opening_hours ? (
                                        Object.entries(vendor.opening_hours).map(([day, hours]: [string, any]) => (
                                            <div key={day} className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
                                                <span className="opacity-40">{day}</span>
                                                <span>{hours}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs opacity-40 italic">Hours not specified</p>
                                    )}
                                </div>
                            </section>

                            <section className="space-y-6">
                                <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-foreground/40 flex items-center gap-3">
                                    <Star className="w-4 h-4" /> Performance
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-6 bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 rounded-3xl text-center">
                                        <p className="text-2xl font-display font-black leading-none mb-2">{vendor.total_sales || 0}</p>
                                        <p className="text-[8px] uppercase tracking-widest opacity-40 font-black">Total Sales</p>
                                    </div>
                                    <div className="p-6 bg-background dark:bg-background/5 border border-foreground/8 dark:border-white/10 rounded-3xl text-center">
                                        <p className="text-2xl font-display font-black leading-none mb-2">{vendor.rating || '5.0'}</p>
                                        <p className="text-[8px] uppercase tracking-widest opacity-40 font-black">Rating</p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};
