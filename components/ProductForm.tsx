
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
import { supabase } from '../services/supabaseClient';
import { CURRENCY, CATEGORY_HIERARCHY, formatTZS } from '../constants';

interface ProductFormProps {
    initialData?: Product | null;
    onClose: () => void;
    onSuccess: () => void;
}

const PRESET_ATTRIBUTES: Record<string, string[]> = {
    'Color': ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Navy', 'Grey', 'Pink', 'Purple', 'Orange', 'Brown', 'Beige', 'Gold', 'Silver', 'Multi', 'Cream', 'Olive'],
    'Size': ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'Free Size'],
    'Shoe Size': ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
    'Material': ['Cotton', 'Polyester', 'Leather', 'Silk', 'Wool', 'Denim', 'Linen', 'Velvet', 'Satin', 'Nylon', 'Rayon', 'Spandex'],
    'Style': ['Casual', 'Formal', 'Sport', 'Vintage', 'Modern', 'Bohemian', 'Classic', 'Streetwear'],
    'Gender': ['Men', 'Women', 'Unisex', 'Kids', 'Girls', 'Boys']
};

// --- PREVIEW COMPONENT ---
const PhonePreview = ({ data, variant, activeImage }: { data: Partial<Product>, variant?: ProductVariant | null, activeImage: string }) => {
    const salePrice = !variant && data.sale_price && data.sale_price > 0 ? data.sale_price : null;
    const finalPrice = variant ? (variant.sale_price || variant.base_price) : (salePrice || data.price || 0);
    const discount = salePrice && data.price ? Math.round(((data.price - salePrice) / data.price) * 100) : 0;

    return (
        <div className="w-[280px] h-[560px] xl:w-[300px] xl:h-[600px] bg-primary dark:bg-background border-8 border-foreground dark:border-background shadow-2xl relative overflow-hidden flex flex-col pointer-events-none select-none mx-auto transform transition-all duration-300 origin-center scale-90 md:scale-100">
            {/* Dynamic Island */}
            <div className="absolute top-0 left-0 right-0 h-6 z-30 flex justify-center pt-2">
                <div className="w-20 h-5 bg-black rounded-none"></div>
            </div>
            
            {/* Content */}
            <div className="flex-1 bg-background dark:bg-background overflow-hidden flex flex-col relative">
                <div className="h-[60%] relative bg-foreground/[0.05] group">
                    <img 
                        src={activeImage || 'https://via.placeholder.com/300x400?text=Preview'} 
                        className="w-full h-full object-cover" 
                        alt="Preview" 
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

export const ProductForm = ({ initialData, onClose, onSuccess }: ProductFormProps) => {
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
    const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
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
            const blob = await res.blob();
            const fileExt = blob.type.split('/')[1] || 'png';
            const fileName = `${Math.random()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('mali-mart-uploads').upload(fileName, blob);
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabase.storage.from('mali-mart-uploads').getPublicUrl(fileName);
            return publicUrlData.publicUrl;
        } else {
            const fileExt = fileOrUrl.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('mali-mart-uploads').upload(fileName, fileOrUrl);
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabase.storage.from('mali-mart-uploads').getPublicUrl(fileName);
            return publicUrlData.publicUrl;
        }
    };

    const downloadImage = async (url: string, filename: string) => {
        try {
            const response = await fetch(url);
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
        setIsLoading(true);
        try {
            const url = await uploadFileOrDataUrl(fileOrUrl);
            
            const newImages = [...(formData.images || []), url];
            setFormData({ ...formData, images: newImages });
            if (newImages.length === 1 && !formData.name) {
                handleVisionAnalyze(url);
            }
        } catch (e: any) {
            addToast(`Failed to upload image: ${e.message || 'Unknown error'}`, "error");
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
        setAiLoading(true);
        try {
            const img = await aiService.generateProductImage(genPrompt);
            if (img) {
                handleImageUpload(img);
                setShowGenImage(false);
                addToast("Image Generated!", "success");
            } else {
                addToast("Generation failed", "error");
            }
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

    const handleGenerateVideo = async () => {
        if (!formData.name || !formData.description) return addToast("Name and Description required", "warning");
        setAiLoading(true);
        try {
            const videoUrl = await aiService.generateMarketingVideo(formData.name, formData.description);
            if (videoUrl) {
                setGeneratedVideo(videoUrl);
                addToast("Video Ad Generated!", "success");
            } else {
                addToast("Video generation failed or timed out", "error");
            }
        } catch (e: any) {
            addToast("Failed to generate video", "error");
        } finally {
            setAiLoading(false);
        }
    }

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
            // AI Moderation Check
            const moderation = await aiService.moderateContent(formData.name, formData.description || '');
            let finalStatus = formData.status || 'active';
            
            if (moderation.isFlagged) {
                finalStatus = 'draft';
                addToast(`Product flagged for review: ${moderation.reason}. Saved as draft.`, "warning");
            }

            const productPayload = { ...formData, status: finalStatus, seller_id: user.id, updated_at: new Date().toISOString() };
            if (!initialData) delete productPayload.id;
            const { data: prod, error: prodError } = await supabase.from('products').upsert(productPayload).select().single();
            if (prodError) throw prodError;
            if (variants.length > 0 && prod) {
                if (initialData) await supabase.from('product_variants').delete().eq('product_id', prod.id);
                const variantsPayload = variants.map(v => ({ ...v, product_id: prod.id }));
                const { error: varError } = await supabase.from('product_variants').insert(variantsPayload);
                if (varError) throw varError;
            }
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

    return (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-xl flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-[95vw] xl:max-w-7xl h-[95vh] md:h-[90vh] bg-background dark:bg-background flex overflow-hidden border border-foreground/10 relative shadow-2xl">
                <button onClick={onClose} className="absolute top-6 right-6 z-50 p-3 bg-transparent hover:opacity-50 transition-opacity text-foreground"><X className="w-6 h-6" /></button>

                {/* Left Rail */}
                <div className="w-20 lg:w-72 border-r border-foreground/10 flex flex-col justify-between py-8 shrink-0 bg-background dark:bg-background">
                    <div className="px-3 lg:px-10">
                        <div className="w-14 h-14 bg-primary text-background dark:bg-background dark:text-foreground flex items-center justify-center font-serif text-2xl mb-12 mx-auto lg:mx-0">M</div>
                        <nav className="space-y-3">
                            {[
                                { id: 'details', label: 'Essentials', icon: Package },
                                { id: 'media', label: 'Visuals', icon: ImageIcon },
                                { id: 'logistics', label: 'Logistics', icon: Truck },
                                { id: 'variants', label: 'Matrix', icon: LayoutGrid },
                                { id: 'preview', label: 'Preview', icon: Smartphone }
                            ].map((s) => (
                                <button key={s.id} onClick={() => setStep(s.id as any)} className={`w-full flex items-center justify-center lg:justify-start gap-4 p-4 lg:px-6 transition-all group relative ${step === s.id ? 'bg-primary/5 text-foreground' : 'opacity-40 hover:opacity-100 text-foreground'}`}>
                                    <s.icon className={`w-5 h-5 ${step === s.id ? 'text-foreground' : 'group-hover:text-foreground dark:group-hover:text-background'}`} />
                                    <span className="hidden lg:block text-[10px] uppercase tracking-[0.2em]">{s.label}</span>
                                    {step === s.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary dark:bg-background hidden lg:block"></div>}
                                </button>
                            ))}
                        </nav>
                    </div>
                    <div className="px-6 lg:px-10 hidden lg:block">
                        <div className="p-6 bg-primary dark:bg-background text-background dark:text-foreground relative overflow-hidden shadow-2xl">
                             <div className="relative z-10">
                                <p className="text-[10px] uppercase tracking-[0.2em] opacity-60 mb-2">Estimated Margin</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-serif">{margin.toFixed(0)}%</span>
                                    <span className="text-[11px] opacity-60 font-serif">/ unit</span>
                                </div>
                                <div className="mt-4 text-[11px] font-mono bg-black/10 dark:bg-white/10 p-2 border border-background/10 dark:border-foreground/10">Profit: {profit.toLocaleString()} {CURRENCY}</div>
                             </div>
                             <div className="absolute bottom-0 right-0 w-24 h-20 opacity-10"><BarChart4 className="w-full h-full" /></div>
                        </div>
                    </div>
                </div>

                {/* Form Main Area */}
                <div className="flex-1 overflow-y-auto no-scrollbar bg-background dark:bg-background">
                    <div className="max-w-5xl mx-auto p-10 md:p-20 space-y-16">
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
                            {step === 'details' && (
                                <div className="space-y-10">
                                    <div className="flex items-center justify-between bg-primary dark:bg-background p-6 text-background dark:text-foreground">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 border border-background/20 dark:border-foreground/20 flex items-center justify-center">
                                                <Sparkles className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-[0.2em]">AI-Powered Listing</p>
                                                <p className="text-[9px] opacity-60 uppercase tracking-[0.1em]">Let Gemini analyze your photo and fill the details.</p>
                                            </div>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            onClick={handleMagicFill} 
                                            disabled={isMagicFilling || !formData.images?.length}
                                            className="bg-background/10 dark:bg-primary/10 hover:bg-background/20 dark:hover:bg-primary/20 text-background dark:text-foreground"
                                        >
                                            {isMagicFilling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Magic Fill"}
                                        </Button>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div className="col-span-2">
                                                <Label>Product Name</Label>
                                                <div className="relative">
                                                    <Input value={formData.name || ''} onChange={(e: any) => setFormData({...formData, name: e.target.value})} placeholder="e.g. Tanzanian Peaberry Coffee" className="h-14 text-lg font-serif pl-5" />
                                                </div>
                                            </div>
                                            <div>
                                                <Label>Brand Name</Label>
                                                <Input value={formData.brand || ''} onChange={(e: any) => setFormData({...formData, brand: e.target.value})} placeholder="e.g. MaliMart Coffee Co." className="h-12" />
                                            </div>
                                            <div>
                                                <Label>Category</Label>
                                                <select value={formData.category || ''} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full h-12 bg-foreground/[0.03] border border-foreground/10 px-4 text-sm outline-none text-foreground rounded-none">
                                                    {Object.keys(CATEGORY_HIERARCHY).map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div><Label>Subcategory</Label><Input value={formData.subcategory || ''} onChange={(e: any) => setFormData({...formData, subcategory: e.target.value})} className="h-12" placeholder="e.g. Beans" /></div>
                                            <div><Label>Condition</Label><Input value={formData.condition || ''} onChange={(e: any) => setFormData({...formData, condition: e.target.value})} className="h-12" placeholder="e.g. New, Used" /></div>
                                            <div><Label>Warranty Period</Label><Input value={formData.warranty_period || ''} onChange={(e: any) => setFormData({...formData, warranty_period: e.target.value})} className="h-12" placeholder="e.g. 1 Year" /></div>
                                            <div className="col-span-2 md:col-span-1">
                                                <Label>Location</Label>
                                                <div className="flex gap-2">
                                                    <Input value={formData.location || ''} onChange={(e: any) => setFormData({...formData, location: e.target.value})} className="h-12 flex-1" placeholder="e.g. Dar es Salaam, Arusha" />
                                                    <Button 
                                                        type="button" 
                                                        variant="outline" 
                                                        className="h-12 px-4"
                                                        onClick={() => {
                                                            if (!navigator.geolocation) return addToast("Geolocation not supported", "error");
                                                            navigator.geolocation.getCurrentPosition(
                                                                async (pos) => {
                                                                    const { latitude, longitude } = pos.coords;
                                                                    setFormData({ ...formData, latitude, longitude });
                                                                    try {
                                                                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                                                                        const data = await res.json();
                                                                        if (data.address) {
                                                                            const locStr = [data.address.city || data.address.town || data.address.village, data.address.state || data.address.region].filter(Boolean).join(', ');
                                                                            if (locStr) setFormData(prev => ({ ...prev, location: locStr, latitude, longitude }));
                                                                        }
                                                                    } catch (e) {
                                                                    }
                                                                    addToast("Location updated", "success");
                                                                },
                                                                (err) => addToast(err.message, "error")
                                                            );
                                                        }}
                                                    >
                                                        <MapPin className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            
                                            <div className="col-span-2">
                                                <div className="flex justify-between items-center mb-2">
                                                    <Label className="mb-0">Description</Label>
                                                    <button onClick={generateMagicDescription} disabled={aiLoading} className="text-[9px] text-foreground uppercase tracking-[0.2em] hover:opacity-50 transition-opacity flex items-center gap-2">
                                                        <Wand2 className="w-3 h-3" /> Magic Describe
                                                    </button>
                                                </div>
                                                <Textarea 
                                                    value={formData.description || ''} 
                                                    onChange={(e: any) => setFormData({...formData, description: e.target.value})} 
                                                    placeholder="Tell the story of your product..."
                                                    className="min-h-[160px] font-serif text-base leading-relaxed"
                                                />
                                                <div className="flex justify-end mt-2 gap-4">
                                                    <button onClick={handleEnhanceDescription} disabled={aiLoading} className="text-[9px] text-foreground opacity-40 uppercase tracking-[0.2em] hover:opacity-100 transition-opacity flex items-center gap-2">
                                                        <Sparkles className="w-3 h-3" /> Enhance with AI
                                                    </button>
                                                    <button onClick={handleTranslate} disabled={aiLoading} className="text-[9px] text-foreground opacity-40 uppercase tracking-[0.2em] hover:opacity-100 transition-opacity flex items-center gap-2">
                                                        <Languages className="w-3 h-3" /> Translate to Swahili
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="col-span-2 p-10 bg-foreground/[0.03] border border-foreground/10">
                                                <div className="flex items-center justify-between mb-8">
                                                    <div className="flex items-center gap-3">
                                                        <DollarSign className="w-5 h-5 opacity-40" />
                                                        <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold">Pricing Strategy</h3>
                                                    </div>
                                                    <button onClick={handleSuggestPrice} disabled={aiLoading} className="text-[9px] text-foreground uppercase tracking-[0.2em] hover:opacity-50 transition-opacity flex items-center gap-2">
                                                        <Sparkles className="w-3 h-3" /> Magic Price
                                                    </button>
                                                </div>
                                                
                                                <div className="grid md:grid-cols-3 gap-8 mb-10">
                                                    <div className="space-y-3">
                                                        <Label className="text-[9px] uppercase tracking-[0.1em] opacity-60">Selling Price</Label>
                                                        {variants.length > 0 ? (
                                                            <div className="h-14 flex items-center px-5 bg-white dark:bg-black/20 border border-foreground/10 text-xs font-mono text-foreground">
                                                                {formatTZS(Math.min(...variants.map(v => v.base_price || 0)))} - {formatTZS(Math.max(...variants.map(v => v.base_price || 0)))}
                                                            </div>
                                                        ) : (
                                                            <div className="relative">
                                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] opacity-40">TZS</span>
                                                                <Input type="number" value={formData.price || ''} onChange={(e: any) => setFormData({...formData, price: e.target.value === '' ? null : Number(e.target.value)})} className="h-14 pl-12 font-mono bg-white dark:bg-black/20" />
                                                                <button
                                                                    type="button"
                                                                    onClick={handleSuggestPrice}
                                                                    disabled={aiLoading}
                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-3 bg-primary text-background dark:bg-background dark:text-foreground text-[9px] uppercase tracking-[0.1em] hover:opacity-90 transition-opacity"
                                                                >
                                                                    {aiLoading ? <Loader2 className="w-3 h-3 animate-spin"/> : "AI Suggest"}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-3">
                                                        <Label className="text-[9px] uppercase tracking-[0.1em] opacity-60">Cost Price</Label>
                                                        <div className="relative">
                                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] opacity-40">TZS</span>
                                                            <Input type="number" value={formData.cost_price || ''} onChange={(e: any) => setFormData({...formData, cost_price: e.target.value === '' ? null : Number(e.target.value)})} className="h-14 pl-12 font-mono bg-white dark:bg-black/20" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <Label className="text-[9px] uppercase tracking-[0.1em] opacity-60">Sale Price</Label>
                                                        <div className="relative">
                                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] opacity-40">TZS</span>
                                                            <Input type="number" value={formData.sale_price || ''} onChange={(e: any) => setFormData({...formData, sale_price: e.target.value === '' ? null : Number(e.target.value)})} className="h-14 pl-12 font-mono bg-white dark:bg-black/20 border-dashed" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-6 pt-8 border-t border-foreground/10">
                                                    <div className="flex items-center justify-between">
                                                        <Label>VAT Status</Label>
                                                        <div className="flex gap-2">
                                                            {[{l: 'Standard (18%)', v: 0.18}, {l: 'Exempt (0%)', v: 0}].map(opt => (
                                                                <button 
                                                                    key={opt.v}
                                                                    type="button" 
                                                                    onClick={() => setFormData({...formData, vat_rate: opt.v})}
                                                                    className={`px-4 h-10 text-[9px] uppercase tracking-[0.2em] border transition-all ${formData.vat_rate === opt.v ? 'bg-primary text-background dark:bg-background dark:text-foreground border-transparent' : 'bg-transparent border-foreground/10 text-foreground'}`}
                                                                >
                                                                    {opt.l}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    {formData.vat_rate === 0.18 && (
                                                        <div className="flex items-center justify-between p-4 border border-foreground/10">
                                                            <Label className="mb-0">Apply 18% VAT Adjustment (Shift to Consumer)</Label>
                                                            <Switch checked={includeVat} onCheckedChange={toggleVat} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 'media' && (
                                <div className="space-y-10">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                        <div>
                                            <h3 className="text-[10px] uppercase tracking-[0.2em]">Visual Assets</h3>
                                            <p className="text-[10px] text-foreground opacity-60 mt-1">High-quality imagery is the key to conversion.</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <Button variant="outline" size="sm" onClick={() => setShowGenImage(!showGenImage)} className="text-[9px] uppercase tracking-[0.2em] bg-transparent border-foreground/10"><Wand2 className="w-4 h-4 mr-2"/> AI Generate</Button>
                                            <Button variant="outline" size="sm" onClick={() => setShowRefineImage(!showRefineImage)} className="text-[9px] uppercase tracking-[0.2em] bg-transparent border-foreground/10" disabled={!formData.images?.length}><Sparkles className="w-4 h-4 mr-2"/> AI Refine</Button>
                                        </div>
                                    </div>

                                    {showGenImage && (
                                        <div className="p-8 bg-primary text-background dark:bg-background dark:text-foreground animate-in slide-in-from-top-4">
                                            <Label className="text-background dark:text-foreground">Image Generation Prompt</Label>
                                            <div className="flex gap-3">
                                                <Input 
                                                    value={genPrompt || ''} 
                                                    onChange={(e: any) => setGenPrompt(e.target.value)} 
                                                    placeholder="e.g. A premium leather bag on a minimalist marble background" 
                                                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 dark:bg-black/10 dark:border-black/20 dark:text-black dark:placeholder:text-black/40"
                                                />
                                                <Button onClick={handleGenerateImage} disabled={aiLoading} className="bg-background text-foreground dark:bg-primary">Generate</Button>
                                            </div>
                                        </div>
                                    )}

                                    {showRefineImage && (
                                        <div className="p-8 bg-primary text-background dark:bg-background dark:text-foreground animate-in slide-in-from-top-4">
                                            <Label className="text-background dark:text-foreground">Refinement Instruction</Label>
                                            <div className="flex gap-3">
                                                <Input 
                                                    value={refinePrompt || ''} 
                                                    onChange={(e: any) => setRefinePrompt(e.target.value)} 
                                                    placeholder="e.g. Change background to a lush tropical garden" 
                                                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 dark:bg-black/10 dark:border-black/20 dark:text-black dark:placeholder:text-black/40"
                                                />
                                                <Button onClick={handleRefineImage} disabled={aiLoading} className="bg-background text-foreground dark:bg-primary">Refine</Button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                        <div className="aspect-[4/5]"><ImageDropzone onImageSelected={handleImageUpload} /></div>
                                        {(formData.images || []).map((img, i) => (
                                            <div key={i} className="aspect-[4/5] relative group overflow-hidden border border-foreground/10 bg-foreground/[0.05]">
                                                <img src={img} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                                                <div className="absolute inset-0 bg-primary/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3 flex-wrap p-2">
                                                    <button onClick={() => { const newImgs = [...(formData.images || [])]; newImgs.splice(i, 1); setFormData({...formData, images: newImgs}); }} className="p-3 bg-background text-foreground hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-5 h-5"/></button>
                                                    {i !== 0 && <button onClick={() => { const newImgs = [...(formData.images || [])]; const temp = newImgs[0]; newImgs[0] = newImgs[i]; newImgs[i] = temp; setFormData({...formData, images: newImgs}); }} className="p-3 bg-background text-foreground hover:bg-primary hover:text-background transition-all"><CheckCircle2 className="w-5 h-5"/></button>}
                                                    <button onClick={() => downloadImage(img, `product-image-${i}.png`)} className="p-3 bg-background text-foreground hover:bg-primary hover:text-background transition-all"><Download className="w-5 h-5"/></button>
                                                    <button onClick={async () => {
                                                        if (confirm("Enhance this photo? This will improve lighting and quality.")) {
                                                            setAiLoading(true);
                                                            try {
                                                                const newImg = await aiService.refineProductImage(img, "Enhance image quality, improve lighting, and make it professional for e-commerce.");
                                                                if (newImg) {
                                                                    const url = await uploadFileOrDataUrl(newImg);
                                                                    const newImgs = [...(formData.images || [])];
                                                                    newImgs[i] = url;
                                                                    setFormData({...formData, images: newImgs});
                                                                    addToast("Photo enhanced!", "success");
                                                                } else {
                                                                    addToast("Enhancement failed", "error");
                                                                }
                                                            } finally { setAiLoading(false); }
                                                        }
                                                    }} className="p-3 bg-background text-foreground hover:bg-primary hover:text-background transition-all"><Sparkles className="w-5 h-5"/></button>
                                                </div>
                                                {i === 0 && <div className="absolute top-4 left-4 px-3 py-1.5 bg-primary text-background dark:bg-background dark:text-foreground text-[8px] uppercase tracking-[0.3em] font-bold">Primary</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {step === 'logistics' && (
                                <div className="space-y-6">
                                    <div className="p-8 bg-foreground/[0.03] border border-foreground/10">
                                        <div className="flex items-center gap-2 mb-8"><Box className="w-5 h-5" /><h3 className="text-[10px] uppercase tracking-[0.2em]">Inventory Management</h3></div>
                                        <div className="grid md:grid-cols-2 gap-10">
                                            <div><Label>Global Stock</Label><Input type="number" value={Number.isNaN(formData.stock) ? '' : (formData.stock ?? '')} onChange={(e: any) => setFormData({...formData, stock: e.target.value === '' ? null : Number(e.target.value)})} className={`h-12 ${variants.length > 0 ? 'bg-primary/10 dark:bg-background/10 opacity-70' : ''}`} disabled={variants.length > 0} />{variants.length > 0 && <span className="text-[9px] text-foreground opacity-60 uppercase tracking-[0.2em] mt-1 block">Calculated from Variants</span>}</div>
                                            <div><div className="flex justify-between items-center mb-2"><Label className="mb-0">Product SKU</Label><button onClick={handleGenerateSKU} disabled={aiLoading} className="text-[9px] text-foreground uppercase tracking-[0.2em] hover:opacity-50 transition-opacity">AI Gen</button></div><Input value={formData.sku || ''} onChange={(e: any) => setFormData({...formData, sku: e.target.value.toUpperCase()})} className="h-12 font-mono" /></div>
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div><Label>Shipment Weight (kg)</Label><Input type="number" value={Number.isNaN(formData.weight) ? '' : (formData.weight ?? '')} onChange={(e: any) => setFormData({...formData, weight: e.target.value === '' ? null : Number(e.target.value)})} className="h-12" /></div>
                                        <div><Label>Dimensions (L x W x H cm)</Label><div className="flex gap-2"><Input placeholder="L" type="number" value={Number.isNaN(formData.dimensions?.length) ? '' : (formData.dimensions?.length ?? '')} onChange={(e: any) => setFormData({...formData, dimensions: {...formData.dimensions, length: e.target.value === '' ? null : Number(e.target.value)} as any})} className="h-12 text-center" /><Input placeholder="W" type="number" value={Number.isNaN(formData.dimensions?.width) ? '' : (formData.dimensions?.width ?? '')} onChange={(e: any) => setFormData({...formData, dimensions: {...formData.dimensions, width: e.target.value === '' ? null : Number(e.target.value)} as any})} className="h-12 text-center" /><Input placeholder="H" type="number" value={Number.isNaN(formData.dimensions?.height) ? '' : (formData.dimensions?.height ?? '')} onChange={(e: any) => setFormData({...formData, dimensions: {...formData.dimensions, height: e.target.value === '' ? null : Number(e.target.value)} as any})} className="h-12 text-center" /></div></div>
                                    </div>
                                </div>
                            )}

                                {step === 'variants' && (
                                <div className="space-y-10">
                                    {/* Attribute Configuration */}
                                    <div className="p-8 bg-foreground/[0.03] border border-foreground/10">
                                        <div className="flex justify-between items-center mb-8">
                                            <div><h3 className="text-[10px] uppercase tracking-[0.2em]">Attributes</h3><p className="text-[10px] text-foreground opacity-60 mt-1">Add properties like size and color.</p></div>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={handleSuggestAttributes} disabled={aiLoading} className="text-[9px] uppercase tracking-[0.2em] h-9 bg-transparent border-foreground/10"><Wand2 className="w-3 h-3 mr-2"/> AI Suggest</Button>
                                                <div className="h-9 w-px bg-primary/10 dark:bg-background/10 mx-2" />
                                                <div className="flex gap-1">
                                                    {['Size', 'Color', 'Material'].map(attr => (
                                                        <button 
                                                            key={attr}
                                                            onClick={() => {
                                                                if (!attributes.find(a => a.name === attr)) {
                                                                    setAttributes([...attributes, { name: attr, values: [] }]);
                                                                }
                                                            }}
                                                            className="h-9 px-3 text-[9px] uppercase tracking-[0.1em] border border-foreground/10 hover:bg-foreground/[0.04] transition-colors text-foreground"
                                                        >
                                                            + {attr}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        {attributes.length === 0 ? <div className="text-center py-10 border border-dashed border-foreground/20"><Button size="sm" variant="outline" onClick={() => setAttributes([{ name: 'Color', values: [] }])}><Plus className="w-3 h-3 mr-2"/> Add Attribute</Button></div> : attributes.map((attr, idx) => (
                                            <div key={idx} className="p-6 bg-transparent border border-foreground/10 relative group mb-4">
                                                <button onClick={() => setAttributes(attributes.filter((_, i) => i !== idx))} className="absolute top-4 right-4 p-2 opacity-40 hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4"/></button>
                                                <div className="grid md:grid-cols-12 gap-8">
                                                    <div className="md:col-span-4"><Label>Attribute Name</Label><select value={Object.keys(PRESET_ATTRIBUTES).includes(attr.name) ? attr.name : (attr.name ? 'Custom' : '')} onChange={e => { const n = [...attributes]; if (e.target.value === 'Custom') n[idx].name = ''; else n[idx].name = e.target.value; setAttributes(n); }} className="w-full h-11 bg-foreground/[0.03] border border-foreground/10 px-4 text-xs outline-none rounded-none text-foreground">{Object.keys(PRESET_ATTRIBUTES).map(k => <option key={k} value={k}>{k}</option>)}<option value="Custom">Custom</option></select>{!Object.keys(PRESET_ATTRIBUTES).includes(attr.name) && <Input className="mt-2 h-10 text-xs" value={attr.name} onChange={e => { const n = [...attributes]; n[idx].name = e.target.value; setAttributes(n); }} />}</div>
                                                    <div className="md:col-span-8"><Label>Values</Label><div className="flex flex-wrap gap-2 mb-3 p-2 bg-foreground/[0.03] border border-foreground/10 rounded-xl min-h-[44px] items-center">{attr.values.map((val, vIdx) => <Badge key={vIdx} variant="secondary" className="pl-3 pr-1 py-1 font-medium rounded-lg">{val}<button onClick={() => { const n = [...attributes]; n[idx].values = attr.values.filter((_, i) => i !== vIdx); setAttributes(n); }} className="ml-1.5 p-0.5 hover:opacity-50 transition-opacity"><X className="w-3 h-3"/></button></Badge>)}{attr.values.length === 0 && <span className="text-[10px] opacity-40 italic px-2">None added</span>}</div><div className="flex gap-2"><select className="flex-1 h-10 bg-transparent border border-foreground/10 px-3 text-xs rounded-none text-foreground" onChange={(e) => { if (e.target.value && !attr.values.includes(e.target.value)) { const n = [...attributes]; n[idx].values = [...n[idx].values, e.target.value]; setAttributes(n); e.target.value = ""; } }} value=""><option value="" disabled>Select...</option>{(PRESET_ATTRIBUTES[attr.name] || []).map(opt => <option key={opt} value={opt} disabled={attr.values.includes(opt)}>{opt}</option>)}</select><Input placeholder="Or type custom..." className="w-1/2 h-10 text-xs rounded-xl" onKeyDown={(e: any) => { if (e.key === 'Enter') { e.preventDefault(); const val = e.currentTarget.value.trim(); if (val && !attr.values.includes(val)) { const n = [...attributes]; n[idx].values = [...n[idx].values, val]; setAttributes(n); e.currentTarget.value = ''; } } }} /></div></div>
                                                </div>
                                            </div>
                                        ))}
                                        {attributes.length > 0 && <Button size="sm" variant="outline" onClick={() => setAttributes([...attributes, { name: 'Size', values: [] }])} className="w-full border-dashed mt-4 rounded-xl"><Plus className="w-4 h-4 mr-2"/> Add Attribute Rail</Button>}
                                    </div>
                                    <div className="flex justify-end"><Button onClick={generateVariants} disabled={attributes.length === 0 || attributes.some(a => a.values.length === 0)} className="h-12 px-10"><Zap className="w-4 h-4 mr-2" /> Generate Matrix Combos</Button></div>

                                    {/* Variant Breakdown Table */}
                                    {variants.length > 0 && (
                                        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
                                            {/* Separation of Bulk Tools and Header */}
                                            <div className="flex flex-col md:flex-row justify-between items-center bg-transparent p-4 border border-foreground/10 gap-4">
                                                <h3 className="text-[10px] uppercase tracking-[0.2em] text-foreground shrink-0">Variant Matrix ({variants.length})</h3>
                                                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                                                    <div className="flex items-center gap-2 p-1.5 bg-foreground/[0.03] border border-foreground/10">
                                                        <Input placeholder="Bulk Price.." className="h-9 w-24 text-[10px] bg-transparent border-none" value={bulkPrice} onChange={(e: any) => setBulkPrice(e.target.value)} />
                                                        <Input placeholder="Bulk Stock.." className="h-9 w-24 text-[10px] bg-transparent border-none" value={bulkStock} onChange={(e: any) => setBulkStock(e.target.value)} />
                                                        <button onClick={handleBulkApply} className="h-9 px-4 bg-primary text-background dark:bg-background dark:text-foreground text-[10px] uppercase tracking-[0.2em] hover:opacity-90 transition-opacity">Apply All</button>
                                                    </div>
                                                    <button onClick={handleAutoSkuVariants} className="h-12 px-5 bg-transparent border border-foreground/10 text-foreground text-[10px] uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-foreground/[0.04] transition-colors"><Wand2 className="w-4 h-4"/> Auto-SKU</button>
                                                </div>
                                            </div>
                                            
                                            <div className="overflow-hidden border border-foreground/10 shadow-sm">
                                                <table className="w-full text-left">
                                                    <thead className="bg-primary/5 text-[10px] uppercase tracking-[0.2em] text-foreground opacity-60">
                                                        <tr>
                                                            <th className="p-5 w-20 text-center">Img</th>
                                                            <th className="p-5">Configuration</th>
                                                            <th className="p-5 w-32">Price ({CURRENCY})</th>
                                                            <th className="p-5 w-24">Stock</th>
                                                            <th className="p-5 w-40">SKU Code</th>
                                                            <th className="p-5 w-12"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-foreground/10 dark:divide-background/10 bg-transparent">
                                                        {variants.map((v, i) => (
                                                            <tr key={i} className="group hover:bg-foreground/[0.04] transition-colors" onMouseEnter={() => setHoveredVariant(v)} onMouseLeave={() => setHoveredVariant(null)}>
                                                                <td className="p-4 text-center">
                                                                    <div className="relative w-12 h-12 mx-auto bg-foreground/[0.05] overflow-hidden shadow-inner group-hover:ring-1 ring-foreground dark:ring-background transition-all">
                                                                        {v.image_url ? <img src={v.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center opacity-40"><ImageIcon className="w-5 h-5"/></div>}
                                                                        <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 flex flex-wrap items-center justify-center gap-1 transition-opacity p-1">
                                                                            <button onClick={() => document.getElementById(`var-img-${i}`)?.click()} className="p-1 bg-background text-foreground hover:opacity-80 rounded-sm"><Upload className="w-3 h-3"/></button>
                                                                            <button onClick={() => handleRefurbishVariant(i)} className="p-1 bg-primary text-background dark:bg-background dark:text-foreground hover:opacity-80 rounded-sm" disabled={refurbishingIdx === i}>{refurbishingIdx === i ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}</button>
                                                                            {v.image_url && <button onClick={() => downloadImage(v.image_url!, `variant-${i}.png`)} className="p-1 bg-background text-foreground hover:opacity-80 rounded-sm"><Download className="w-3 h-3"/></button>}
                                                                        </div>
                                                                        <input type="file" id={`var-img-${i}`} className="hidden" accept="image/*" onChange={(e) => handleVariantImageUpload(i, e)} />
                                                                    </div>
                                                                </td>
                                                                <td className="p-4">
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {Object.entries(v.attributes).map(([key, val]) => (
                                                                            <div key={key} className="flex flex-col">
                                                                                <span className="text-[7px] uppercase opacity-40 mb-0.5">{key}</span>
                                                                                <span className="px-2.5 py-1.5 bg-foreground/[0.05] text-[9px] text-foreground border border-foreground/10 uppercase tracking-[0.2em]">{val}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </td>
                                                                <td className="p-4"><Input type="number" className="h-10 text-xs bg-transparent border-foreground/10" value={v.base_price || 0} onChange={e => { const n = [...variants]; n[i].base_price = Number(e.target.value); setVariants(n); }} /></td>
                                                                <td className="p-4"><Input type="number" className="h-10 text-xs bg-transparent border-foreground/10 text-center" value={v.stock || 0} onChange={e => { const n = [...variants]; n[i].stock = Number(e.target.value); setVariants(n); }} /></td>
                                                                <td className="p-4"><Input type="text" className="h-10 text-[10px] font-mono font-black bg-foreground/[0.04] border-foreground/10 uppercase" value={v.sku || ''} onChange={e => { const n = [...variants]; n[i].sku = e.target.value.toUpperCase(); setVariants(n); }} /></td>
                                                                <td className="p-4 text-right"><button onClick={() => setVariants(variants.filter((_, idx) => idx !== i))} className="p-2 text-foreground/30 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                                {step === 'preview' && (
                                    <div className="max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4">
                                        <h3 className="text-center text-[10px] uppercase tracking-[0.2em] text-foreground opacity-60 mb-12">Real-time Buyer Experience Preview</h3>
                                        <PhonePreview 
                                            data={formData} 
                                            variant={hoveredVariant}
                                            activeImage={hoveredVariant?.image_url || formData.images?.[0] || ''} 
                                        />
                                        <div className="mt-12 text-center">
                                            <button onClick={handleSubmit} disabled={isLoading} className="w-full h-16 bg-foreground text-background text-[10px] uppercase tracking-[0.15em] font-bold hover:bg-foreground/85 transition-colors flex items-center justify-center gap-2.5 disabled:opacity-40 rounded-b-3xl">
                                                Publish Store Listing <ArrowRight className="w-4 h-4 ml-3 group-hover:translate-x-1 transition-transform stroke-[1]"/>
                                            </button>
                                            <p className="mt-6 text-[9px] text-foreground opacity-40 uppercase tracking-[0.2em]">Listing will be live immediately after verification</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
    );
};
