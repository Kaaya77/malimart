import { validateUpload } from '../src/security';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
 X, Save, Sparkles, Image as ImageIcon, Plus, Trash2, 
 Layers, DollarSign, Box, Tag, Zap, AlertCircle, 
 ChevronRight, ArrowRight, Wand2, Calculator, MoreHorizontal,
 LayoutGrid, List, CheckCircle2, Scan, Smartphone, Info, Package,
 BarChart4, Percent, Truck, Ruler, Scale, TrendingUp, Languages, RefreshCw, ChevronDown, Upload, Copy,
 Store, BadgeCheck, Loader2, Video, Download, MapPin
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { Button, Input, Label, Textarea, ImageDropzone, Switch, useToast, Badge, Card, Skeleton } from './UI';
import { Product, ProductVariant } from '../types';
import * as aiService from '../services/geminiService';
import { PFContext } from './product-form/FormContext';
import { DetailsStep } from './product-form/DetailsStep';
import { MediaStep } from './product-form/MediaStep';
import { LogisticsStep } from './product-form/LogisticsStep';
import { VariantsStep } from './product-form/VariantsStep';
import { PreviewStep } from './product-form/PreviewStep';
import { supabase } from '../services/supabaseClient';
import { compressImage, extFor, IMMUTABLE_CACHE } from '../services/imageCompression';
import { CURRENCY, CATEGORY_HIERARCHY, formatTZS } from '../constants';

interface ProductFormProps {
 initialData?: Product | null;
 onClose: () => void;
 onSuccess: () => void;
 mode?: 'modal' | 'page';
}

import { PRESET_ATTRIBUTES } from './product-form/presets';
export { PRESET_ATTRIBUTES };

// --- PREVIEW COMPONENT ---
import { PhonePreview } from './product-form/PhonePreview';


export const ProductForm = ({ initialData, onClose, onSuccess, mode = 'modal' }: ProductFormProps) => {
 const { user } = useAppState();
 const { addToast } = useToast();
 const [step, setStep] = useState<'details' | 'media' | 'logistics' | 'variants' | 'preview'>('details');
 const [isQuickMode, setIsQuickMode] = useState(false);
 const [isLoading, setIsLoading] = useState(false);
 const [visionLoading, setVisionLoading] = useState(false);
 const [aiLoading, setAiLoading] = useState(false);
 const [refurbishingIdx, setRefurbishingIdx] = useState<number | null>(null);
 
 const [includeVat, setIncludeVat] = useState(false);
 const [showGenImage, setShowGenImage] = useState(false);
 const [showRefineImage, setShowRefineImage] = useState(false);
 const [genPrompt, setGenPrompt] = useState('');
 const [refinePrompt, setRefinePrompt] = useState('');
 const [hoveredVariant, setHoveredVariant] = useState<ProductVariant | null>(null);
 const [isMagicFilling, setIsMagicFilling] = useState(false);

 const [bulkPrice, setBulkPrice] = useState('');
 const [bulkStock, setBulkStock] = useState('');

 const [formData, setFormData] = useState<Partial<Product>>({
 name: '',
 brand: '',
 description: '',
 category: Object.keys(CATEGORY_HIERARCHY)[0],
 subcategory: '',
 price: 0,
 cost_price: 0,
 sale_price: 0,
 stock: 1,
 low_stock_threshold: 5,
 sku: '',
 images: [],
 tags: [],
 vat_rate: 0.18,
 is_boosted: false,
 status: 'active',
 weight: 0,
 dimensions: { length: 0, width: 0, height: 0 },
 ...initialData
 });

 const [attributes, setAttributes] = useState<{name: string, values: string[]}[]>([]);
 const [variants, setVariants] = useState<ProductVariant[]>([]);
 const [tagInput, setTagInput] = useState('');

 useEffect(() => {
 if (initialData?.id) {
 supabase.from('product_variants').select('*').eq('product_id', initialData.id)
 .then(({ data }) => {
 if (data && data.length > 0) {
 setVariants(data);
 const attrMap: Record<string, Set<string>> = {};
 data.forEach(v => {
 Object.entries(v.attributes).forEach(([k, val]) => {
 if (!attrMap[k]) attrMap[k] = new Set();
 attrMap[k].add(String(val));
 });
 });
 setAttributes(Object.entries(attrMap).map(([name, set]) => ({ name, values: Array.from(set) })));
 }
 });
 }
 }, [initialData]);

 useEffect(() => {
 if (variants.length > 0) {
 const totalVariantStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
 const minVariantPrice = Math.min(...variants.map(v => v.base_price));
 setFormData(prev => ({ ...prev, stock: totalVariantStock, price: minVariantPrice }));
 }
 }, [variants]);

 const handleMagicFill = async () => {
 const primaryImage = formData.images?.[0];
 if (!primaryImage) return addToast("Upload a primary image first", "warning");
 
 setIsMagicFilling(true);
 try {
 const analysis = await aiService.analyzeProductImage(primaryImage);
 if (analysis) {
 setFormData(prev => ({
 ...prev,
 name: analysis.name || prev.name,
 category: analysis.category || prev.category,
 tags: Array.from(new Set([...(prev.tags || []), ...(analysis.tags || [])])),
 description: analysis.description || prev.description
 }));
 addToast("Magic Fill complete!", "success");
 }
 } catch (e) {
 addToast("Magic Fill failed", "error");
 } finally {
 setIsMagicFilling(false);
 }
 };

 const handleVisionAnalyze = async (url: string) => {
 setVisionLoading(true);
 try {
 const analysis = await aiService.analyzeProductImage(url);
 if (analysis) {
 setFormData(prev => ({
 ...prev,
 name: analysis.name || prev.name,
 category: analysis.category || prev.category,
 tags: [...(prev.tags || []), ...(analysis.tags || [])],
 description: analysis.description || prev.description
 }));
 addToast("Vision AI applied!", "success");
 }
 } catch (e) {
 addToast("Vision analysis failed", "error");
 } finally {
 setVisionLoading(false);
 }
 };

 const uploadFileOrDataUrl = async (fileOrUrl: File | string): Promise<string> => {
 if (typeof fileOrUrl === 'string') {
 if (!fileOrUrl.startsWith('data:')) return fileOrUrl;
 const res = await fetch(fileOrUrl);
 if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
 const raw = await res.blob();
 const blob = await compressImage(raw);
 const fileName = `${Math.random()}.${extFor(blob)}`;
 const { error: uploadError } = await supabase.storage.from('mali-mart-uploads').upload(fileName, blob, { cacheControl: IMMUTABLE_CACHE, contentType: blob.type });
 if (uploadError) throw uploadError;
 const { data: publicUrlData } = supabase.storage.from('mali-mart-uploads').getPublicUrl(fileName);
 return publicUrlData.publicUrl;
 } else {
 const blob = await compressImage(fileOrUrl);
 const fileName = `${Math.random()}.${extFor(blob, fileOrUrl.name.split('.').pop() || 'webp')}`;
 const { error: uploadError } = await supabase.storage.from('mali-mart-uploads').upload(fileName, blob, { cacheControl: IMMUTABLE_CACHE, contentType: blob.type });
 if (uploadError) throw uploadError;
 const { data: publicUrlData } = supabase.storage.from('mali-mart-uploads').getPublicUrl(fileName);
 return publicUrlData.publicUrl;
 }
 };

 const downloadImage = async (url: string, filename: string) => {
 try {
 const response = await fetch(url);
 if (!response.ok) throw new Error(`HTTP ${response.status}`);
 const blob = await response.blob();
 const blobUrl = window.URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = blobUrl;
 a.download = filename || 'image.png';
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 window.URL.revokeObjectURL(blobUrl);
 } catch (e) {
 addToast("Failed to download image", "error");
 }
 };

 const handleImageUpload = async (fileOrUrl: File | string) => {
    const MAX_IMAGES = 8;
    if ((formData.images?.length ?? 0) >= MAX_IMAGES) {
      return addToast(`Maximum ${MAX_IMAGES} images allowed`, "error");
    }
    setIsLoading(true);
    try {
      const url = await uploadFileOrDataUrl(fileOrUrl);
      setFormData(prev => ({ ...prev, images: [...(prev.images || []), url] }));
    } catch (e: any) {
      addToast(e.message || "Failed to upload image", "error");
    } finally {
      setIsLoading(false);
    }
  };

 const handleVariantImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
 if (e.target.files?.[0]) {
 setIsLoading(true);
 try {
 const url = await uploadFileOrDataUrl(e.target.files[0]);
 const n = [...variants];
 n[index].image_url = url;
 setVariants(n);
 } catch (err) {
 addToast("Failed to upload variant image", "error");
 } finally {
 setIsLoading(false);
 }
 }
 };

 const handleRefurbishVariant = async (index: number) => {
 const v = variants[index];
 const baseImg = formData.images?.[0];
 if (!baseImg) return addToast("Upload a primary product image first", "warning");
 
 setRefurbishingIdx(index);
 try {
 const attrString = Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ');
 const prompt = `Change the product in this image to strictly match these attributes: ${attrString}. Ensure the color and visual details are photorealistic and high-end for e-commerce.`;
 const newImg = await aiService.refineProductImage(baseImg, prompt);
 if (newImg) {
 const url = await uploadFileOrDataUrl(newImg);
 const n = [...variants];
 n[index].image_url = url;
 setVariants(n);
 addToast("Variant image refurbished!", "success");
 } else {
 addToast("Could not generate refined image", "info");
 }
 } catch (e) {
 addToast("AI Refurbishment failed", "error");
 } finally {
 setRefurbishingIdx(null);
 }
 };

 const generateMagicDescription = async () => {
 if (!formData.name || !formData.category) return addToast("Enter name and category first", "warning");
 setAiLoading(true);
 try {
 const desc = await aiService.generateProductDescription(formData.name, formData.category, formData.tags?.join(',') || '');
 setFormData(prev => ({ ...prev, description: desc }));
 } finally { setAiLoading(false); }
 };

 const handleSuggestPrice = async () => {
 if (!formData.name || !formData.category) return addToast("Enter product name first", "warning");
 setAiLoading(true);
 try {
 const suggested = await aiService.suggestProductPrice(formData.name, formData.category);
 if (suggested > 0) {
 setFormData(prev => ({ ...prev, price: suggested }));
 addToast(`Price suggested: ${suggested.toLocaleString()}`, "success");
 } else {
 addToast("Could not determine price", "info");
 }
 } finally { setAiLoading(false); }
 };

 const handleTranslate = async () => {
 if (!formData.description) return addToast("Enter description first", "warning");
 setAiLoading(true);
 try {
 const swahili = await aiService.translateToSwahili(formData.description);
 setFormData(prev => ({ ...prev, description: swahili }));
 addToast("Translated to Swahili", "success");
 } finally { setAiLoading(false); }
 };

 const handleEnhanceDescription = async () => {
 if (!formData.description) return addToast("Enter a basic description first", "warning");
 setAiLoading(true);
 try {
 const enhanced = await aiService.enhanceDescription(formData.description);
 setFormData(prev => ({ ...prev, description: enhanced }));
 addToast("Description enhanced!", "success");
 } finally { setAiLoading(false); }
 };

 const handleSuggestAttributes = async () => {
 if (!formData.name || !formData.category) return addToast("Details needed for suggestion", "warning");
 setAiLoading(true);
 try {
 const suggestions = await aiService.suggestAttributes(formData.name, formData.category, formData.description || '');
 if (suggestions.length > 0) {
 setAttributes(suggestions);
 addToast("Attributes suggested", "success");
 } else {
 addToast("No suggestions found", "info");
 }
 } finally { setAiLoading(false); }
 };

 const handleGenerateSKU = async () => {
 if (!formData.name || !formData.category) return addToast("Name & Category required", "warning");
 setAiLoading(true);
 try {
 const sku = await aiService.generateSmartSKU(formData.name, formData.category);
 setFormData(prev => ({ ...prev, sku }));
 } finally { setAiLoading(false); }
 };

 const handleGenerateImage = async () => {
 if (!genPrompt) return addToast("Describe the image first", "warning");
 if ((formData.images?.length ?? 0) >= 8) return addToast("Maximum 8 images allowed", "error");
 setAiLoading(true);
 try {
 const img = await aiService.generateProductImage(genPrompt);
 if (img) {
   const url = await uploadFileOrDataUrl(img);
   setFormData(prev => ({ ...prev, images: [...(prev.images || []), url] }));
   setShowGenImage(false);
   setGenPrompt('');
   addToast("Image Generated!", "success");
 } else {
 addToast("Generation failed — try a more descriptive prompt", "error");
 }
 } catch (e: any) {
   addToast(e.message || "Image generation failed", "error");
 } finally { setAiLoading(false); }
 };

 const handleRefineImage = async () => {
 if (!formData.images?.[0] || !refinePrompt) return addToast("Image and instruction required", "warning");
 setAiLoading(true);
 try {
 const img = await aiService.refineProductImage(formData.images[0], refinePrompt);
 if (img) {
 const url = await uploadFileOrDataUrl(img);
 const newImgs = [...formData.images];
 newImgs[0] = url; 
 setFormData(prev => ({ ...prev, images: [url, ...prev.images!.slice(1)] }));
 setShowRefineImage(false);
 addToast("Image Refined!", "success");
 } else {
 addToast("Refinement failed", "error");
 }
 } finally { setAiLoading(false); }
 };

 const toggleVat = (enabled: boolean) => {
 setIncludeVat(enabled);
 if (formData.price) {
 const newPrice = enabled ? Math.round(formData.price * 1.18) : Math.round(formData.price / 1.18);
 setFormData(prev => ({ ...prev, price: newPrice }));
 }
 };

 const generateVariants = () => {
 if (attributes.length === 0) return;
 const cartesian = (...a: any[]) => a.reduce((a, b) => a.flatMap((d: any) => b.map((e: any) => [d, e].flat())), [[]]);
 const values = attributes.map(a => a.values);
 const combos = cartesian(...values);
 const newVariants = combos.map((combo: string[]) => {
 const attrObj: Record<string, string> = {};
 attributes.forEach((a, i) => { attrObj[a.name] = combo[i]; });
 // Fix: Explicitly cast c to any/string to resolve 'unknown' type error for substring
 const variantSuffix = combo.map((c: any) => (c as string).substring(0,3).toUpperCase()).join('-');
 return {
 attributes: attrObj,
 base_price: formData.price || 0,
 cost_price: formData.cost_price || 0,
 vat_rate: formData.vat_rate || 0,
 stock: Math.max(1, Math.floor((formData.stock || 10) / combos.length)),
 sku: `${formData.sku || 'SKU'}-${variantSuffix}`,
 image_url: formData.images?.[0] || '',
 is_active: true
 } as unknown as ProductVariant;
 });
 setVariants(newVariants);
 addToast(`Generated ${newVariants.length} variants`, "success");
 };

 const handleBulkApply = () => {
 const n = [...variants];
 let changed = false;
 if (bulkPrice) {
 n.forEach(v => v.base_price = Number(bulkPrice));
 changed = true;
 }
 if (bulkStock) {
 n.forEach(v => v.stock = Number(bulkStock));
 changed = true;
 }
 if (changed) {
 setVariants(n);
 addToast("Bulk updates applied", "success");
 setBulkPrice('');
 setBulkStock('');
 }
 };

 const handleAutoSkuVariants = () => {
 if (!formData.sku) return addToast("Set Main Product SKU first", "warning");
 const n = [...variants];
 n.forEach(v => {
 const suffix = Object.values(v.attributes).map(val => (val as string).substring(0,3).toUpperCase()).join('-');
 v.sku = `${formData.sku}-${suffix}`;
 });
 setVariants(n);
 addToast("Smart SKUs Generated", "success");
 };

 const handleSubmit = async () => {
 if (!user) return;
 if (!formData.name || (formData.price === undefined || formData.price < 0)) return addToast("Name and a valid Price are required", "error");
 if ((formData.cost_price !== undefined && formData.cost_price < 0) || 
 (formData.sale_price !== undefined && formData.sale_price < 0) ||
 (formData.stock !== undefined && formData.stock < 0) || 
 (formData.vat_rate !== undefined && formData.vat_rate < 0) ||
 (formData.weight !== undefined && formData.weight < 0) ||
 (formData.dimensions?.length !== undefined && formData.dimensions.length < 0) ||
 (formData.dimensions?.width !== undefined && formData.dimensions.width < 0) ||
 (formData.dimensions?.height !== undefined && formData.dimensions.height < 0)) {
 return addToast("Numeric fields must be non-negative", "error");
 }

 // Validate variants
 for (const v of variants) {
 if (v.base_price < 0 || v.stock < 0 || (v.sale_price !== undefined && v.sale_price < 0)) {
 return addToast("Variant price, stock, and sale price must be non-negative", "error");
 }
 }

    setIsLoading(true);
    try {
      const moderation = await aiService.moderateContent(formData.name, formData.description || '');
      let finalStatus = formData.status || 'active';

      if (moderation.isFlagged) {
        finalStatus = 'draft';
        addToast(`Product flagged for review: ${moderation.reason}. Saved as draft.`, "warning");
      }

      // Single atomic, server-validated write (product + variants) via save_product RPC.
      // seller_id is enforced server-side; unknown/computed fields are ignored safely.
      const productPayload: any = { ...formData, status: finalStatus };
      if (!initialData) delete productPayload.id;
      const { data: prod, error: prodError } = await supabase.rpc('save_product', {
        p_product: productPayload,
        p_variants: variants ?? [],
      });
      if (prodError) throw prodError;

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

 const margin = formData.price && formData.cost_price ? ((formData.price - formData.cost_price) / formData.price) * 100 : 0;
 const profit = (formData.price || 0) - (formData.cost_price || 0);

 // ── Step completion ────────────────────────────────────────────────────────
 const stepComplete = useMemo(() => ({
   details:   !!(formData.name?.trim() && formData.price && formData.category),
   media:     (formData.images?.length ?? 0) > 0,
   logistics: !!(formData.sku?.trim() || (formData.stock !== undefined && formData.stock >= 0)),
   variants:  true,
   preview:   true,
 }), [formData, variants]);

 // ── Autosave draft to localStorage (new products only) ────────────────────
 const DRAFT_KEY = 'malimart-product-draft';
 const [draftBanner, setDraftBanner] = useState(false);

 useEffect(() => {
   if (initialData) return;
   const saved = localStorage.getItem(DRAFT_KEY);
   if (saved) {
     try {
       const parsed = JSON.parse(saved);
       if (parsed.name && !formData.name) setDraftBanner(true);
     } catch { /* ignore */ }
   }
 }, []);

 useEffect(() => {
   if (initialData) return;
   const timer = setTimeout(() => {
     if (formData.name || (formData.images?.length ?? 0) > 0) {
       localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
     }
   }, 2000);
   return () => clearTimeout(timer);
 }, [formData, initialData]);

 const restoreDraft = () => {
   const saved = localStorage.getItem(DRAFT_KEY);
   if (!saved) return;
   try {
     setFormData(prev => ({ ...prev, ...JSON.parse(saved) }));
     setDraftBanner(false);
     addToast('Draft restored', 'success');
   } catch { /* ignore */ }
 };

 const discardDraft = () => {
   localStorage.removeItem(DRAFT_KEY);
   setDraftBanner(false);
 };

 const clearDraftOnSave = () => {
   if (!initialData) localStorage.removeItem(DRAFT_KEY);
 };

 const pf = { step, setStep, isQuickMode, setIsQuickMode, isLoading, setIsLoading, visionLoading, setVisionLoading, aiLoading, setAiLoading, refurbishingIdx, setRefurbishingIdx, includeVat, setIncludeVat, showGenImage, setShowGenImage, showRefineImage, setShowRefineImage, genPrompt, setGenPrompt, refinePrompt, setRefinePrompt, hoveredVariant, setHoveredVariant, isMagicFilling, setIsMagicFilling, bulkPrice, setBulkPrice, bulkStock, setBulkStock, formData, setFormData, attributes, setAttributes, variants, setVariants, tagInput, setTagInput, handleMagicFill, handleVisionAnalyze, uploadFileOrDataUrl, downloadImage, handleImageUpload, handleVariantImageUpload, handleRefurbishVariant, generateMagicDescription, handleSuggestPrice, handleTranslate, handleEnhanceDescription, handleSuggestAttributes, handleGenerateSKU, handleGenerateImage, handleRefineImage, toggleVat, generateVariants, handleBulkApply, handleAutoSkuVariants, handleSubmit, margin, profit, initialData, onClose, stepComplete, clearDraftOnSave };

 const STEPS = [
   { id: 'details',   label: 'Essentials', mobileLabel: 'Details',  icon: Package },
   { id: 'media',     label: 'Visuals',    mobileLabel: 'Media',    icon: ImageIcon },
   { id: 'logistics', label: 'Logistics',  mobileLabel: 'Shipping', icon: Truck },
   { id: 'variants',  label: 'Matrix',     mobileLabel: 'Options',  icon: LayoutGrid },
   { id: 'preview',   label: 'Preview',    mobileLabel: 'Preview',  icon: Smartphone },
 ] as const;

 const formInner = (
   <div className="w-full max-w-[95vw] xl:max-w-7xl h-[95dvh] md:h-[90dvh] bg-background dark:bg-background flex flex-col lg:flex-row overflow-hidden border border-foreground/10 relative shadow-2xl">
     {mode === 'modal' && (
       <button onClick={onClose} className="absolute top-6 right-6 z-50 p-3 bg-transparent hover:opacity-50 transition-opacity text-foreground"><X className="w-6 h-6" /></button>
     )}

     {/* Left Rail — hidden on mobile, shown on lg */}
     <div className="hidden lg:flex w-72 border-r border-foreground/8 flex-col justify-between py-8 shrink-0 bg-foreground/[0.02]">
     <div className="px-10">
     <div className="w-14 h-14 bg-foreground text-background flex items-center justify-center font-serif text-2xl mb-12 rounded-2xl">M</div>
     <nav className="space-y-3">
     {STEPS.map((s) => {
       const done = stepComplete[s.id as keyof typeof stepComplete];
       return (
         <button key={s.id} onClick={() => setStep(s.id as any)} className={`w-full flex items-center justify-start gap-4 p-4 px-6 transition-all group relative ${step === s.id ? 'bg-foreground/[0.06] text-foreground font-semibold' : 'opacity-40 hover:opacity-100 text-foreground'}`}>
           <s.icon className={`w-5 h-5 flex-shrink-0 ${step === s.id ? 'text-foreground' : 'group-hover:text-foreground'}`} />
           <span className="text-[10px] uppercase tracking-[0.2em] flex-1 text-left">{s.label}</span>
           {done && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
           {step === s.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-foreground"></div>}
         </button>
       );
     })}
     </nav>
     </div>
 <div className="px-10">
 <div className="p-6 bg-foreground text-background dark:text-foreground relative overflow-hidden shadow-2xl">
 <div className="relative z-10">
 <p className="text-[10px] uppercase tracking-[0.2em] opacity-60 mb-2">Estimated Margin</p>
 <div className="flex items-baseline gap-2">
 <span className="text-3xl font-serif">{margin.toFixed(0)}%</span>
 <span className="text-[10px] opacity-60 font-serif">/ unit</span>
 </div>
 <div className="mt-4 text-[10px] font-mono bg-black/10 dark:bg-white/10 p-2 border border-background/10 dark:border-foreground/10">Profit: {profit.toLocaleString()} {CURRENCY}</div>
 </div>
 <div className="absolute bottom-0 right-0 w-24 h-20 opacity-10"><BarChart4 className="w-full h-full" /></div>
 </div>
 </div>
 </div>

 {/* Mobile Steps Nav */}
     <div className="lg:hidden border-b border-foreground/8 bg-foreground/[0.02] overflow-x-auto no-scrollbar">
       <nav className="flex gap-2 px-4 py-3">
         {STEPS.map((s) => {
           const done = stepComplete[s.id as keyof typeof stepComplete];
           return (
             <button key={s.id} onClick={() => setStep(s.id as any)} className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[9px] uppercase tracking-[0.15em] flex-shrink-0 transition-all ${step === s.id ? 'bg-foreground text-background font-bold' : 'bg-foreground/[0.06] text-foreground opacity-60 hover:opacity-100'}`}>
               <s.icon className="w-4 h-4" />
               <span className="hidden xs:inline">{s.mobileLabel}</span>
               {done && <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />}
             </button>
           );
         })}
       </nav>
     </div>

     {/* Form Main Area */}
     <div className="flex-1 overflow-y-auto no-scrollbar bg-background dark:bg-background">
       <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8 lg:p-20 space-y-8 md:space-y-16">

         {/* Draft restore banner */}
         {draftBanner && (
           <div className="flex items-center justify-between gap-3 px-5 py-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-sm">
             <span className="text-amber-800 dark:text-amber-300">You have an unsaved draft. Restore it?</span>
             <div className="flex gap-2">
               <button onClick={restoreDraft} className="px-3 py-1 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors">Restore</button>
               <button onClick={discardDraft} className="px-3 py-1 rounded-lg bg-transparent text-amber-700 dark:text-amber-400 text-xs hover:underline">Discard</button>
             </div>
           </div>
         )}

         {/* Header */}
         <div className="flex justify-between items-end border-b border-foreground/10 pb-10">
           <div>
             <h1 className="text-4xl font-serif text-foreground tracking-wide">{initialData ? 'Edit Product' : 'New Listing'}</h1>
             <div className="flex items-center gap-2 mt-2">
               <Switch checked={isQuickMode} onCheckedChange={setIsQuickMode} />
               <span className="text-foreground opacity-60 text-[10px] uppercase tracking-[0.2em]">Quick Add Mode</span>
             </div>
           </div>
           <div className="flex gap-3">
             <Button variant="ghost" onClick={onClose} size="lg" className="hidden md:flex text-[10px] uppercase tracking-[0.2em]">Cancel</Button>
             <Button onClick={handleSubmit} disabled={isLoading} className="h-12 px-8 text-[10px] uppercase tracking-[0.2em]">Publish Listing</Button>
           </div>
         </div>

         {/* Step Content */}
         <div className="animate-in slide-in-from-bottom-4 duration-500 min-h-[400px]">
           {step === 'details' && <DetailsStep />}
           {step === 'media' && <MediaStep />}
           {step === 'logistics' && <LogisticsStep />}
           {step === 'variants' && <VariantsStep />}
           {step === 'preview' && <PreviewStep />}
         </div>
       </div>
     </div>
   </div>
 );

 return (
   <PFContext.Provider value={pf}>
     {mode === 'modal' ? (
       <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-xl flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-300">
         {formInner}
       </div>
     ) : (
       <div className="min-h-screen bg-background flex items-start justify-center p-2 md:p-4">
         {formInner}
       </div>
     )}
   </PFContext.Provider>
 );
};
