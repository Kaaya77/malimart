import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { VendorProfile } from '../../types';

interface FeaturedStoresProps {
  topShops: VendorProfile[];
  setActiveStore: (shop: VendorProfile) => void;
  navigate: (path: string) => void;
}

export const FeaturedStores = ({ topShops, setActiveStore, navigate }: FeaturedStoresProps) => {
  return (
    <motion.section 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="py-20 bg-background border-b border-foreground/5"
    >
        <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                <div>
                    <span className="text-[10px] uppercase tracking-[0.3em] opacity-50 mb-3 block">Our Partners</span>
                    <h2 className="text-4xl font-sans font-extrabold tracking-tight text-foreground">Featured Stores</h2>
                </div>
                <motion.button 
                    whileHover={{ x: 5 }}
                    onClick={() => navigate('/shop')} 
                    className="text-[10px] font-semibold uppercase tracking-[0.3em] flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity"
                >
                    Discover All Stores <ArrowRight className="w-3 h-3" />
                </motion.button>
            </div>

            <div className="flex overflow-x-auto hide-scrollbar gap-4 pb-8 pt-2 px-4 -mx-4">
                {topShops.map((shop) => (
                    <motion.div 
                        key={shop.seller_id} 
                        whileHover={{ scale: 1.02 }}
                        onClick={() => setActiveStore(shop)}
                        className="flex-shrink-0 cursor-pointer flex flex-col w-64 md:w-72 rounded-3xl border border-foreground/10 overflow-hidden bg-background shadow-sm hover:shadow-md transition-all group"
                    >
                        <div className="w-full h-32 relative bg-foreground/5 overflow-hidden">
                            <img 
                                src={shop.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(shop.store_name)}&background=1a1a1a&color=f5f2ed&size=400`} 
                                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" 
                                alt={shop.store_name} 
                                referrerPolicy="no-referrer"
                            />
                            <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur text-foreground text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                                15-25 min
                            </div>
                        </div>
                        <div className="p-4">
                            <h3 className="text-base font-extrabold text-foreground mb-1 truncate">{shop.store_name}</h3>
                            <p className="text-xs font-medium text-foreground/60 truncate">{shop.region || 'Tanzania'} • Delivery: TZS 1,500</p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    </motion.section>
  );
};
