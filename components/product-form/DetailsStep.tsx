import React from 'react';
import { Button, Input, Label, Textarea, Switch } from '../UI';
import { Product } from '../../types';
import { CATEGORY_HIERARCHY, formatTZS } from '../../constants';
import { DollarSign, Languages, Loader2, MapPin, Sparkles, Wand2, X as XIcon } from 'lucide-react';
import { useToast } from '../UI';
import { usePF } from './FormContext';

export const DetailsStep = () => {
    const { aiLoading, includeVat, isMagicFilling, formData, setFormData, variants, tagInput, setTagInput, handleMagicFill, generateMagicDescription, handleSuggestPrice, handleTranslate, handleEnhanceDescription, toggleVat } = usePF();
    const { addToast } = useToast();
    return (
 <div className="space-y-10">
 <div className="flex items-center justify-between bg-foreground p-6 text-background dark:text-foreground">
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
 className="bg-background/10 dark:bg-foreground/[0.06] hover:bg-background/20 dark:hover:bg-primary/20 text-background dark:text-foreground"
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
       className="h-10 px-4 bg-foreground/[0.06] border border-foreground/10 text-foreground text-xs uppercase tracking-[0.1em] hover:bg-foreground/[0.12] transition-colors"
     >Add</button>
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
    );
};
