import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { Product } from '../types';
import { supabase } from '../services/supabaseClient';
import { Input, useToast } from './UI';

export const BulkEditModal = ({ isOpen, onClose, products, onSave }: { isOpen: boolean, onClose: () => void, products: Product[], onSave: () => void }) => {
    const [editedProducts, setEditedProducts] = useState<Product[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            // Deep copy to avoid mutating original state directly
            setEditedProducts(JSON.parse(JSON.stringify(products)));
        }
    }, [isOpen, products]);

    if (!isOpen) return null;

    const handleUpdate = (id: string, field: keyof Product, value: any) => {
        setEditedProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Find changed products
            const changedProducts = editedProducts.filter(ep => {
                const original = products.find(p => p.id === ep.id);
                return original && (original.price !== ep.price || original.stock !== ep.stock || original.name !== ep.name || original.status !== ep.status);
            });

            if (changedProducts.length === 0) {
                addToast("No changes to save", "info");
                onClose();
                return;
            }

            // Update in Supabase (sequentially for simplicity, could use RPC for batch)
            for (const p of changedProducts) {
                await supabase.from('products').update({
                    name: p.name,
                    price: p.price,
                    stock: p.stock,
                    status: p.status
                }).eq('id', p.id);
            }

            addToast(`Successfully updated ${changedProducts.length} products`, "success");
            onSave();
            onClose();
        } catch (error) {
            console.error("Bulk update failed", error);
            addToast("Failed to save some changes", "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-6xl bg-background dark:bg-background border border-foreground/10 dark:border-background/10 shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                
                <div className="flex justify-between items-center p-6 border-b border-foreground/10 dark:border-background/10">
                    <div>
                        <h2 className="font-serif text-2xl text-foreground dark:text-background">Bulk Inventory Edit</h2>
                        <p className="text-xs opacity-60 text-foreground dark:text-background mt-1">Quickly adjust prices, stock, and status for all your products.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-primary/5 dark:hover:bg-background/5 rounded-full transition-colors">
                        <X className="w-5 h-5 text-foreground dark:text-background" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    <div className="min-w-[800px]">
                        <div className="grid grid-cols-12 gap-4 pb-4 border-b border-foreground/10 dark:border-background/10 text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground dark:text-background mb-4">
                            <div className="col-span-4">Product Name</div>
                            <div className="col-span-2">Price (TZS)</div>
                            <div className="col-span-2">Stock</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-2">SKU</div>
                        </div>

                        <div className="space-y-2">
                            {editedProducts.map(product => (
                                <div key={product.id} className="grid grid-cols-12 gap-4 items-center bg-white dark:bg-primary p-2 border border-foreground/5 dark:border-background/5">
                                    <div className="col-span-4">
                                        <Input 
                                            value={product.name} 
                                            onChange={(e: any) => handleUpdate(product.id, 'name', e.target.value)}
                                            className="h-10 text-sm bg-transparent border-transparent hover:border-foreground/20 dark:hover:border-background/20 focus:border-foreground dark:focus:border-background rounded-none px-2"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input 
                                            type="number"
                                            value={product.price} 
                                            onChange={(e: any) => handleUpdate(product.id, 'price', Number(e.target.value))}
                                            className="h-10 text-sm bg-transparent border-transparent hover:border-foreground/20 dark:hover:border-background/20 focus:border-foreground dark:focus:border-background rounded-none px-2"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input 
                                            type="number"
                                            value={product.stock} 
                                            onChange={(e: any) => handleUpdate(product.id, 'stock', Number(e.target.value))}
                                            className="h-10 text-sm bg-transparent border-transparent hover:border-foreground/20 dark:hover:border-background/20 focus:border-foreground dark:focus:border-background rounded-none px-2"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <select 
                                            value={product.status}
                                            onChange={(e: any) => handleUpdate(product.id, 'status', e.target.value)}
                                            className="w-full h-10 text-xs uppercase tracking-[0.1em] bg-transparent border-transparent hover:border-foreground/20 dark:hover:border-background/20 focus:border-foreground dark:focus:border-background rounded-none px-2 text-foreground dark:text-background outline-none"
                                        >
                                            <option value="active" className="bg-background dark:bg-background">Active</option>
                                            <option value="draft" className="bg-background dark:bg-background">Draft</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2 px-2 text-xs font-mono opacity-50 truncate">
                                        {product.sku || '-'}
                                    </div>
                                </div>
                            ))}
                        </div>
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
                        {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
                    </button>
                </div>
            </div>
        </div>
    );
};
