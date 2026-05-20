import React, { useState } from 'react';
import { Button, Input, Label } from './UI';
import { X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CancelOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    role: 'buyer' | 'seller';
}

export const CancelOrderModal = ({ isOpen, onClose, onConfirm, role }: CancelOrderModalProps) => {
    const [selectedReason, setSelectedReason] = useState('');
    const [customReason, setCustomReason] = useState('');

    const buyerReasons = [
        "Changed my mind",
        "Found a better price",
        "Ordered by mistake",
        "Delivery time is too long",
        "Other"
    ];

    const sellerReasons = [
        "Out of stock",
        "Cannot deliver to this address",
        "Suspected fraud",
        "Pricing error",
        "Other"
    ];

    const reasons = role === 'buyer' ? buyerReasons : sellerReasons;

    const handleConfirm = () => {
        const finalReason = selectedReason === 'Other' ? customReason : selectedReason;
        if (!finalReason.trim()) return;
        onConfirm(finalReason);
        setSelectedReason('');
        setCustomReason('');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-background rounded-3xl p-8 max-w-md w-full shadow-2xl border border-foreground/8 relative"
                    >
                        <button onClick={onClose} className="absolute top-6 right-6 text-foreground/40 hover:text-foreground transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Cancel Order</h2>
                    </div>

                    <p className="text-sm text-foreground/55 mb-6">
                        Please select a reason for cancelling this order. This helps us improve our service.
                    </p>

                    <div className="space-y-3 mb-6">
                        {reasons.map((reason) => (
                            <label key={reason} className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedReason === reason ? 'border-foreground dark:border-background bg-foreground/[0.02] dark:bg-background/5' : 'border-foreground/8 hover:border-foreground/10'}`}>
                                <input 
                                    type="radio" 
                                    name="cancelReason" 
                                    value={reason} 
                                    checked={selectedReason === reason}
                                    onChange={(e) => setSelectedReason(e.target.value)}
                                    className="w-4 h-4 text-foreground dark:text-background focus:ring-foreground dark:focus:ring-background"
                                />
                                <span className="text-sm font-bold text-foreground/80">{reason}</span>
                            </label>
                        ))}
                    </div>

                    {selectedReason === 'Other' && (
                        <div className="mb-6">
                            <Label className="text-xs font-black uppercase tracking-widest text-foreground/40 mb-2 block">Please specify</Label>
                            <Input 
                                value={customReason} 
                                onChange={(e: any) => setCustomReason(e.target.value)} 
                                placeholder="Enter your reason..."
                                className="h-12 rounded-2xl bg-foreground/[0.02] dark:bg-background/5 border-none"
                            />
                        </div>
                    )}

                        <div className="flex gap-4">
                            <Button variant="ghost" onClick={onClose} className="flex-1 h-12 rounded-2xl">Keep Order</Button>
                            <Button 
                                variant="danger" 
                                onClick={handleConfirm} 
                                disabled={!selectedReason || (selectedReason === 'Other' && !customReason.trim())}
                                className="flex-1 h-12 rounded-2xl uppercase tracking-widest text-xs font-black"
                            >
                                Confirm Cancel
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
