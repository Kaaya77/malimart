import React from 'react';
import { Button, Input, Label, Badge } from '../UI';
import { CURRENCY } from '../../constants';
import { Download, Loader2, Plus, Sparkles, Trash2, Upload, Wand2, X, Zap, Image as ImageIcon } from 'lucide-react';
import { PRESET_ATTRIBUTES } from './presets';
import { usePF } from './FormContext';

export const VariantsStep = () => {
    const { aiLoading, refurbishingIdx, setHoveredVariant, bulkPrice, setBulkPrice, bulkStock, setBulkStock, attributes, setAttributes, variants, setVariants, downloadImage, handleVariantImageUpload, handleRefurbishVariant, handleSuggestAttributes, generateVariants, handleBulkApply, handleAutoSkuVariants } = usePF();
    return (
 <div className="space-y-10">
 {/* Attribute Configuration */}
 <div className="p-6 bg-foreground/[0.02] border border-foreground/8 rounded-2xl">
 <div className="flex justify-between items-center mb-8">
 <div><h3 className="text-[10px] uppercase tracking-[0.2em]">Attributes</h3><p className="text-[10px] text-foreground opacity-60 mt-1">Add properties like size and color.</p></div>
 <div className="flex gap-2">
 <Button size="sm" variant="outline" onClick={handleSuggestAttributes} disabled={aiLoading} className="text-[9px] uppercase tracking-[0.2em] h-9 bg-transparent border-foreground/10"><Wand2 className="w-3 h-3 mr-2"/> AI Suggest</Button>
 <div className="h-9 w-px bg-foreground/[0.06] mx-2" />
 <div className="flex gap-1">
 {['Size', 'Color', 'Material'].map(attr => (
 <button 
 key={attr}
 onClick={() => {
 if (!attributes.find(a => a.name === attr)) {
 setAttributes([...attributes, { name: attr, values: [] }]);
 }
 }}
 className="h-9 px-3 text-[9px] uppercase tracking-widest font-bold border border-foreground/10 rounded-xl hover:bg-foreground/[0.06] transition-colors text-foreground/70 hover:text-foreground active:scale-95"
 >
 + {attr}
 </button>
 ))}
 </div>
 </div>
 </div>
 {attributes.length === 0 ? <div className="text-center py-10 border border-dashed border-foreground/15 rounded-2xl"><Button size="sm" variant="outline" onClick={() => setAttributes([{ name: 'Color', values: [] }])}><Plus className="w-3 h-3 mr-2"/> Add Attribute</Button></div> : attributes.map((attr, idx) => (
 <div key={idx} className="p-5 bg-foreground/[0.02] border border-foreground/8 rounded-2xl relative group mb-3">
 <button onClick={() => setAttributes(attributes.filter((_, i) => i !== idx))} className="absolute top-4 right-4 p-2 opacity-40 hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4"/></button>
 <div className="grid md:grid-cols-12 gap-8">
 <div className="md:col-span-4"><Label>Attribute Name</Label><select value={Object.keys(PRESET_ATTRIBUTES).includes(attr.name) ? attr.name : (attr.name ? 'Custom' : '')} onChange={e => { const n = [...attributes]; if (e.target.value === 'Custom') n[idx].name = ''; else n[idx].name = e.target.value; setAttributes(n); }} className="w-full h-11 bg-foreground/[0.03] border border-foreground/10 px-4 text-xs outline-none rounded-xl text-foreground">{Object.keys(PRESET_ATTRIBUTES).map(k => <option key={k} value={k}>{k}</option>)}<option value="Custom">Custom</option></select>{!Object.keys(PRESET_ATTRIBUTES).includes(attr.name) && <Input className="mt-2 h-10 text-xs" value={attr.name} onChange={e => { const n = [...attributes]; n[idx].name = e.target.value; setAttributes(n); }} />}</div>
 <div className="md:col-span-8"><Label>Values</Label><div className="flex flex-wrap gap-2 mb-3 p-2 bg-foreground/[0.03] border border-foreground/10 rounded-xl min-h-[44px] items-center">{attr.values.map((val, vIdx) => <Badge key={vIdx} variant="secondary" className="pl-3 pr-1 py-1 font-medium rounded-lg">{val}<button onClick={() => { const n = [...attributes]; n[idx].values = attr.values.filter((_, i) => i !== vIdx); setAttributes(n); }} className="ml-1.5 p-0.5 hover:opacity-50 transition-opacity"><X className="w-3 h-3"/></button></Badge>)}{attr.values.length === 0 && <span className="text-[10px] opacity-40 italic px-2">None added</span>}</div><div className="flex gap-2"><select className="flex-1 h-10 bg-foreground/[0.04] border border-foreground/10 px-3 text-xs rounded-xl text-foreground appearance-none" onChange={(e) => { if (e.target.value && !attr.values.includes(e.target.value)) { const n = [...attributes]; n[idx].values = [...n[idx].values, e.target.value]; setAttributes(n); e.target.value = ""; } }} value=""><option value="" disabled>Select...</option>{(PRESET_ATTRIBUTES[attr.name] || []).map(opt => <option key={opt} value={opt} disabled={attr.values.includes(opt)}>{opt}</option>)}</select><Input placeholder="Or type custom..." className="w-1/2 h-10 text-xs rounded-xl" onKeyDown={(e: any) => { if (e.key === 'Enter') { e.preventDefault(); const val = e.currentTarget.value.trim(); if (val && !attr.values.includes(val)) { const n = [...attributes]; n[idx].values = [...n[idx].values, val]; setAttributes(n); e.currentTarget.value = ''; } } }} /></div></div>
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
 {v.image_url ? <img src={v.image_url} alt={`${Object.values(v.attributes || {}).join(" ") || "Variant"} image`} className="w-full h-full object-cover" loading="lazy" decoding="async" /> : <div className="w-full h-full flex items-center justify-center opacity-40"><ImageIcon className="w-5 h-5"/></div>}
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
 <span className="px-2.5 py-1.5 bg-foreground/[0.05] text-[9px] text-foreground border border-foreground/10 uppercase tracking-[0.2em]">{String(val)}</span>
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
    );
};
