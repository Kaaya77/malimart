import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Star, MapPin, Instagram, Facebook, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { VendorProfile } from '../types';
import { Button } from './UI';

interface StoreModalProps {
    store: VendorProfile | null;
    isOpen: boolean;
    onClose: () => void;
}

export const StoreModal: React.FC<StoreModalProps> = ({ store, isOpen, onClose }) => {
    const navigate = useNavigate();
    if (!store) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
                    >
                        <div className="bg-background w-full max-w-lg rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col items-center p-8 sm:p-12 border border-foreground/5">
                            {/* Decorative background element */}
                            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />

                            <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-foreground/5 hover:bg-foreground/10 text-foreground transition-colors rounded-full z-10">
                                <X className="w-5 h-5 stroke-[2.5]" />
                            </button>
                            
                            <div className="flex flex-col items-center text-center relative z-10 mt-4">
                                <div className="w-32 h-32 mb-6 rounded-full overflow-hidden border-4 border-background shadow-xl">
                                    <img 
                                        src={store.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(store.store_name)}&background=random`} 
                                        alt={store.store_name} 
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                    />
                                </div>
                                
                                <h2 className="text-3xl font-sans font-black tracking-tight mb-2 text-foreground">{store.store_name}</h2>
                                <div className="flex items-center gap-3 text-sm font-bold text-foreground/60 mb-6 bg-foreground/5 px-4 py-1.5 rounded-full">
                                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {store.region || 'Tanzania'}</span>
                                    {store.is_verified && (
                                        <>
                                            <span className="w-1 h-1 bg-foreground/20 rounded-full" />
                                            <span className="flex items-center gap-1 text-emerald-500"><ShieldCheck className="w-4 h-4 fill-emerald-500/20" /> Verified</span>
                                        </>
                                    )}
                                </div>
                                
                                <p className="text-base font-medium opacity-80 mb-10 max-w-sm leading-relaxed text-foreground/70">
                                    {store.description || "A dedicated store offering quality products and fast delivery right to your door."}
                                </p>
                                
                                <motion.button 
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => { onClose(); navigate(`/store/${store.seller_id}`); }} 
                                    className="w-full h-14 bg-primary text-primary-foreground font-black text-lg rounded-full flex items-center justify-center gap-2 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
                                >
                                    Visit Store <ArrowRight className="w-5 h-5" />
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
