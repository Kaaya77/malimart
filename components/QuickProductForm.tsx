import { validateUpload } from '../src/security';
import React, { useState } from 'react';
import { X, Sparkles, Loader2, Store } from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { Button, Input, Label, ImageDropzone, useToast } from './UI';
import { Product } from '../types';
import { supabase } from '../services/supabaseClient';
import { compressImage, IMMUTABLE_CACHE } from '../services/imageCompression';
import * as aiService from '../services/geminiService';
import { CURRENCY, CATEGORY_HIERARCHY } from '../constants';

interface QuickProductFormProps {
 onClose: () => void;
 onSuccess: () => void;
}

export const QuickProductForm = ({ onClose, onSuccess }: QuickProductFormProps) => {
 const { user } = useAppState();
 const { addToast } = useToast();
 const [isLoading, setIsLoading] = useState(false);
 const [formData, setFormData] = useState<Partial<Product>>({
 name: '',
 price: 0,
 category: Object.keys(CATEGORY_HIERARCHY)[0],
 images: [],
 status: 'active',
 });

 const handleImageUpload = async (fileOrUrl: File | string) => {
 setIsLoading(true);
 try {
 let url: string;
 if (typeof fileOrUrl === 'string') {
 url = fileOrUrl;
 } else {
 const fileExt = fileOrUrl.name.split('.').pop();
 const fileName = `${Math.random()}.${fileExt}`;
 const { error: uploadError } = await supabase.storage.from('mali-mart-uploads').upload(fileName, await compressImage(fileOrUrl), { cacheControl: IMMUTABLE_CACHE });
 if (uploadError) throw uploadError;
 const { data: publicUrlData } = supabase.storage.from('mali-mart-uploads').getPublicUrl(fileName);
 url = publicUrlData.publicUrl;
 }
 setFormData({ ...formData, images: [url] });
 } catch (e: any) {
 addToast(`Failed to upload image: ${e.message}`, "error");
 } finally {
 setIsLoading(false);
 }
 };

 const handleSubmit = async () => {
 if (!user) return;
 if (!formData.name || !formData.price || formData.images?.length === 0) {
 return addToast("Name, Price, and Image are required", "error");
 }
 setIsLoading(true);
 try {
 // AI Moderation Check
 const moderation = await aiService.moderateContent(formData.name, formData.description || '');
 let finalStatus = formData.status || 'active';
 
 if (moderation.isFlagged) {
 finalStatus = 'draft';
 addToast(`Product flagged for review: ${moderation.reason}. Saved as draft.`, "warning");
 }

 const { error } = await supabase.rpc('save_product', {
        p_product: { ...formData, status: finalStatus },
        p_variants: [],
      });
      if (error) throw error;
 
 if (!moderation.isFlagged) {
 addToast("Product published successfully!", "success");
 }
 onSuccess();
 onClose();
 } catch (e: any) {
 addToast(e.message || "Failed to save", "error");
 } finally {
 setIsLoading(false);
 }
 };

 return (
 <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center">
 <div className="w-full max-w-md bg-background rounded-t-3xl md:rounded-3xl p-6 relative shadow-2xl border-t border-foreground/8 md:border max-h-[90dvh] overflow-y-auto" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
 <div className="flex items-center justify-between mb-5">
 <h2 className="text-xl font-bold text-foreground">Quick Add Product</h2>
 <button onClick={onClose} className="w-9 h-9 rounded-full bg-foreground/[0.06] flex items-center justify-center hover:bg-foreground/[0.1] transition-colors"><X className="w-4 h-4" /></button>
 </div>
 <div className="space-y-4">
 <div className="aspect-[4/5] mb-4">
 {formData.images?.[0] ? (
 <img src={formData.images[0]} className="w-full h-full object-cover" alt="Product" loading="lazy" decoding="async" />
 ) : (
 <ImageDropzone onImageSelected={handleImageUpload} />
 )}
 </div>
 <Input value={formData.name || ''} onChange={(e: any) => setFormData({...formData, name: e.target.value})} placeholder="Product Name" />
 <Input type="number" value={formData.price || ''} onChange={(e: any) => setFormData({...formData, price: Number(e.target.value)})} placeholder={`Price (${CURRENCY})`} />
 <select value={formData.category || ''} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full h-12 bg-foreground/[0.04] border border-foreground/15 rounded-2xl px-4 text-foreground text-sm focus:outline-none focus:border-foreground/30 transition-colors">
 {Object.keys(CATEGORY_HIERARCHY).map(c => <option key={c} value={c}>{c}</option>)}
 </select>
 <Button onClick={handleSubmit} disabled={isLoading} className="w-full h-12">Publish</Button>
 </div>
 </div>
 </div>
 );
};
