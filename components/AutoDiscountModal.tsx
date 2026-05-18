import React, { useState } from 'react';
import { X, Save, Clock, Percent } from 'lucide-react';
import { Product } from '../types';
import { Input, useToast } from './UI';
import { supabase } from '../services/supabaseClient';

export const AutoDiscountModal = ({ isOpen, onClose, product, onSave }: { isOpen: boolean, onClose: () => void, product: Product | null, onSave: () => void }) => {
    const [days, setDays] = useState(30);
    const [discount, setDiscount] = useState(10);
    const [isSaving, setIsSaving] = useState(false);
    const { addToast } = useToast();

    if (!isOpen || !product) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // In a real app, this would save to a 'pricing_rules' table or similar.
            // For this demo, we'll just add a toast and maybe save it to a metadata field if we had one.
            // We'll simulate saving the rule.
            await new Promise(resolve => setTimeout(resolve, 800));
            
            addToast(`Rule saved: ${discount}% off after ${days} days of no sales.`, "success");
            onSave();
            onClose();
        } catch (error) {
            addToast("Failed to save rule", "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-md bg-background dark:bg-background border border-foreground/10 dark:border-background/10 shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
                
                <div className="flex justify-between items-center p-6 border-b border-foreground/10 dark:border-background/10">
                    <div>
                        <h2 className="font-serif text-2xl text-foreground dark:text-background">Dynamic Pricing</h2>
                        <p className="text-xs opacity-60 text-foreground dark:text-background mt-1">Set auto-discount rules for {product.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-primary/5 dark:hover:bg-background/5 rounded-full transition-colors">
                        <X className="w-5 h-5 text-foreground dark:text-background" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground dark:text-background flex items-center gap-2">
                            <Clock className="w-3 h-3" /> If item hasn't sold in (Days)
                        </label>
                        <Input 
                            type="number" 
                            value={days} 
                            onChange={(e: any) => setDays(Number(e.target.value))}
                            className="h-12 bg-transparent border-foreground/20 dark:border-background/20 rounded-none focus:border-foreground dark:focus:border-background"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground dark:text-background flex items-center gap-2">
                            <Percent className="w-3 h-3" /> Automatically discount by (%)
                        </label>
                        <Input 
                            type="number" 
                            value={discount} 
                            onChange={(e: any) => setDiscount(Number(e.target.value))}
                            className="h-12 bg-transparent border-foreground/20 dark:border-background/20 rounded-none focus:border-foreground dark:focus:border-background"
                        />
                    </div>
                    
                    <div className="p-4 bg-primary/5 dark:bg-background/5 border border-foreground/10 dark:border-background/10">
                        <p className="text-xs text-foreground/80 dark:text-background/80 leading-relaxed">
                            <strong>Rule Summary:</strong> If <span className="font-serif italic">{product.name}</span> does not receive any orders for {days} consecutive days, its price will be automatically reduced by {discount}%.
                        </p>
                    </div>
                </div>

                <div className="p-6 border-t border-foreground/10 dark:border-background/10 flex justify-end gap-4 bg-background dark:bg-background">
                    <button 
                        onClick={onClose}
                        className="px-8 py-3 text-[10px] uppercase tracking-[0.2em] font-bold text-foreground dark:text-background hover:opacity-70 transition-opacity"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-8 py-3 bg-primary text-background dark:bg-background dark:text-foreground text-[10px] uppercase tracking-[0.2em] font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
                    >
                        {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Rule</>}
                    </button>
                </div>
            </div>
        </div>
    );
};
