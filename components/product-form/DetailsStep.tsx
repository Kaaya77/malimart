import React from 'react';
import { Button, Input, Label, Textarea, Switch } from '../UI';
import { Product } from '../../types';
import { formatTZS } from '../../constants';
import { DollarSign, Languages, Loader2, MapPin, Sparkles, Wand2, X as XIcon, Check } from 'lucide-react';
import { useToast } from '../UI';
import { usePF } from './FormContext';
import { useCategoryOptions } from '../../hooks/useCategoryOptions';

const CONDITIONS = ['New', 'Like New', 'Used — Good', 'Used — Fair', 'Refurbished'];

export const DetailsStep = () => {
    const { aiLoading, includeVat, isMagicFilling, formData, setFormData, variants, tagInput, setTagInput, handleMagicFill, generateMagicDescription, handleSuggestPrice, handleTranslate, handleEnhanceDescription, toggleVat } = usePF();
    const { addToast } = useToast();
    // The one category list shared with every other seller entry point and
    // with the homepage/Shop's own category filters — see useCategoryOptions.
    const categoryOptions = useCategoryOptions();
    return (
 <div className="space-y-10">
 <div className="flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white shadow-lg shadow-emerald-600/15">
 <div className="flex items-center gap-4 min-w-0">
 <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
 <Sparkles className="w-5 h-5" />
 </div>
 <div className="min-w-0">
 <p className="text-xs font-black uppercase tracking-[0.15em]">AI-Powered Listing</p>
 <p className="text-[11px] text-white/70 mt-0.5">Upload a photo, then let AI fill name, category and description.</p>
 </div>
 </div>
 <button
 onClick={handleMagicFill}
 disabled={isMagicFilling || !formData.images?.length}
 title={formData.images?.length ? undefined : 'Add a photo in the Visuals step first'}
 className="h-10 px-4 rounded-xl bg-white text-emerald-700 text-xs font-black uppercase tracking-wide hover:bg-white/90 active:scale-95 transition-all disabled:opacity-50 shrink-0"
 >
 {isMagicFilling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Magic Fill"}
 </button>
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
 <Label>Category <span className="text-red-500">*</span></Label>
 <select value={formData.category || ''} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full h-12 rounded-xl bg-foreground/[0.04] border border-foreground/[0.12] focus:border-foreground/30 px-4 text-sm outline-none text-foreground transition-colors">
 <option value="" disabled>Select a category…</option>
 {categoryOptions.map((c: string) => <option key={c} value={c}>{c}</option>)}
 </select>
 </div>
 <div><Label>Subcategory</Label><Input value={formData.subcategory || ''} onChange={(e: any) => setFormData({...formData, subcategory: e.target.value})} className="h-12" placeholder="e.g. Beans" /></div>
 <div>
 <Label>Condition</Label>
 <select value={formData.condition || ''} onChange={(e) => setFormData({...formData, condition: e.target.value})} className="w-full h-12 rounded-xl bg-foreground/[0.04] border border-foreground/[0.12] focus:border-foreground/30 px-4 text-sm outline-none text-foreground transition-colors">
 <option value="">Not specified</option>
 {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
 </select>
 </div>
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
 {formData.latitude != null && formData.longitude != null && (
 <p className="flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-emerald-600">
 <Check className="w-3 h-3" /> GPS pinned ({Number(formData.latitude).toFixed(3)}, {Number(formData.longitude).toFixed(3)}) — buyers nearby will find you first
 </p>
 )}
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

 {/* Tags */}
 <div className="col-span-2">
   <Label>Tags</Label>
   <div className="flex flex-wrap gap-2 mb-2">
     {(formData.tags ?? []).map((tag: string) => (
       <span key={tag} className="flex items-center gap-1 px-3 py-1 rounded-full bg-foreground/[0.08] text-foreground text-xs border border-foreground/10">
         {tag}
         <button type="button" onClick={() => setFormData({ ...formData, tags: (formData.tags ?? []).filter((t: string) => t !== tag) })} className="ml-1 hover:opacity-60 transition-opacity"><XIcon className="w-3 h-3" /></button>
       </span>
     ))}
   </div>
   <div className="flex gap-2">
     <Input
       value={tagInput}
       onChange={(e: any) => setTagInput(e.target.value)}
       onKeyDown={(e: any) => {
         if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
           e.preventDefault();
           const next = tagInput.trim().replace(/,$/, '');
           if (next && !(formData.tags ?? []).includes(next)) {
             setFormData({ ...formData, tags: [...(formData.tags ?? []), next] });
           }
           setTagInput('');
         } else if (e.key === 'Backspace' && !tagInput && (formData.tags ?? []).length > 0) {
           setFormData({ ...formData, tags: (formData.tags ?? []).slice(0, -1) });
         }
       }}
       placeholder="Add tag, press Enter or comma..."
       className="h-10 flex-1 text-sm"
     />
     <button
       type="button"
       onClick={() => {
         const next = tagInput.trim().replace(/,$/, '');
         if (next && !(formData.tags ?? []).includes(next)) {
           setFormData({ ...formData, tags: [...(formData.tags ?? []), next] });
         }
         setTagInput('');
       }}
       className="h-10 px-4 rounded-xl bg-foreground/[0.06] border border-foreground/10 text-foreground text-xs font-bold uppercase tracking-[0.1em] hover:bg-foreground/[0.12] transition-colors"
     >Add</button>
   </div>
 </div>

 <div className="col-span-2 p-6 sm:p-8 rounded-2xl bg-foreground/[0.02] border border-foreground/[0.08]">
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-3">
 <span className="w-9 h-9 rounded-xl bg-emerald-500/12 text-emerald-600 flex items-center justify-center"><DollarSign className="w-4 h-4" /></span>
 <h3 className="text-xs uppercase tracking-[0.2em] font-black text-foreground/70">Pricing</h3>
 </div>
 <button onClick={handleSuggestPrice} disabled={aiLoading} className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:opacity-70 transition-opacity flex items-center gap-1.5">
 <Sparkles className="w-3 h-3" /> Magic Price
 </button>
 </div>

 <div className="grid md:grid-cols-3 gap-5 mb-8">
 <div className="space-y-2">
 <Label className="text-[10px] uppercase tracking-wider text-foreground/50">Selling Price <span className="text-red-500">*</span></Label>
 {variants.length > 0 ? (
 <div className="h-14 flex items-center px-5 rounded-xl bg-foreground/[0.04] border border-foreground/[0.12] text-xs font-mono text-foreground/70">
 {formatTZS(Math.min(...variants.map(v => v.base_price || 0)))} – {formatTZS(Math.max(...variants.map(v => v.base_price || 0)))} (from variants)
 </div>
 ) : (
 <div className="relative">
 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-foreground/35">TZS</span>
 <Input type="number" min={1} value={formData.price || ''} onChange={(e: any) => setFormData({...formData, price: e.target.value === '' ? null : Number(e.target.value)})} className="h-14 pl-12 font-mono rounded-xl bg-foreground/[0.04]" />
 </div>
 )}
 </div>
 <div className="space-y-2">
 <Label className="text-[10px] uppercase tracking-wider text-foreground/50">Cost Price</Label>
 <div className="relative">
 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-foreground/35">TZS</span>
 <Input type="number" min={0} value={formData.cost_price || ''} onChange={(e: any) => setFormData({...formData, cost_price: e.target.value === '' ? null : Number(e.target.value)})} className="h-14 pl-12 font-mono rounded-xl bg-foreground/[0.04]" />
 </div>
 <p className="text-[10px] text-foreground/35">What it costs you — used for your margin, never shown to buyers</p>
 </div>
 <div className="space-y-2">
 <Label className="text-[10px] uppercase tracking-wider text-foreground/50">Sale Price</Label>
 <div className="relative">
 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-foreground/35">TZS</span>
 <Input type="number" min={0} value={formData.sale_price || ''} onChange={(e: any) => setFormData({...formData, sale_price: e.target.value === '' ? null : Number(e.target.value)})} className="h-14 pl-12 font-mono rounded-xl bg-foreground/[0.04] border-dashed" />
 </div>
 {formData.sale_price != null && formData.price != null && formData.sale_price >= formData.price && (
 <p className="text-[10px] font-semibold text-red-500">Must be lower than the selling price</p>
 )}
 </div>
 </div>

 <div className="space-y-4 pt-6 border-t border-foreground/[0.08]">
 <div className="flex items-center justify-between flex-wrap gap-3">
 <Label className="mb-0">VAT Status</Label>
 <div className="flex gap-2">
 {[{l: 'Standard (18%)', v: 0.18}, {l: 'Exempt (0%)', v: 0}].map(opt => (
 <button
 key={opt.v}
 type="button"
 onClick={() => setFormData({...formData, vat_rate: opt.v})}
 className={`px-4 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${formData.vat_rate === opt.v ? 'bg-emerald-600 text-white border-transparent' : 'bg-transparent border-foreground/[0.12] text-foreground/60 hover:border-foreground/30'}`}
 >
 {opt.l}
 </button>
 ))}
 </div>
 </div>
 {formData.vat_rate === 0.18 && (
 <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-foreground/[0.03] border border-foreground/[0.08]">
 <Label className="mb-0 text-xs">Add 18% VAT on top of the price (buyer pays it)</Label>
 <Switch checked={includeVat} onCheckedChange={toggleVat} />
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 </div>
    );
};
