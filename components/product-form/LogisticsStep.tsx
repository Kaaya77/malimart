import React from 'react';
import { Input, Label } from '../UI';
import { Product } from '../../types';
import { Box } from 'lucide-react';
import { usePF } from './FormContext';

export const LogisticsStep = () => {
    const { aiLoading, formData, setFormData, variants, handleGenerateSKU } = usePF();
    return (
 <div className="space-y-6">
 <div className="p-6 bg-foreground/[0.02] border border-foreground/8 rounded-2xl">
 <div className="flex items-center gap-2 mb-8"><Box className="w-5 h-5" /><h3 className="text-[10px] uppercase tracking-[0.2em]">Inventory Management</h3></div>
 <div className="grid md:grid-cols-2 gap-10">
 <div><Label>Global Stock</Label><Input type="number" value={Number.isNaN(formData.stock) ? '' : (formData.stock ?? '')} onChange={(e: any) => setFormData({...formData, stock: e.target.value === '' ? null : Number(e.target.value)})} className={`h-12 ${variants.length > 0 ? 'bg-foreground/[0.06] opacity-70' : ''}`} disabled={variants.length > 0} />{variants.length > 0 && <span className="text-[9px] text-foreground opacity-60 uppercase tracking-[0.2em] mt-1 block">Calculated from Variants</span>}</div>
 <div><div className="flex justify-between items-center mb-2"><Label className="mb-0">Product SKU</Label><button onClick={handleGenerateSKU} disabled={aiLoading} className="text-[9px] text-foreground uppercase tracking-[0.2em] hover:opacity-50 transition-opacity">AI Gen</button></div><Input value={formData.sku || ''} onChange={(e: any) => setFormData({...formData, sku: e.target.value.toUpperCase()})} className="h-12 font-mono" /></div>
 <div>
   <Label>Low Stock Alert Threshold</Label>
   <Input type="number" min={0} value={Number.isNaN(formData.low_stock_threshold) ? '' : (formData.low_stock_threshold ?? '')} onChange={(e: any) => setFormData({...formData, low_stock_threshold: e.target.value === '' ? null : Number(e.target.value)})} className="h-12" placeholder="e.g. 5" />
   <span className="text-[9px] text-foreground opacity-50 uppercase tracking-[0.1em] mt-1 block">Alert shows when stock falls below this number</span>
 </div>
 </div>
 </div>
 <div className="grid md:grid-cols-2 gap-6">
 <div><Label>Shipment Weight (kg)</Label><Input type="number" value={Number.isNaN(formData.weight) ? '' : (formData.weight ?? '')} onChange={(e: any) => setFormData({...formData, weight: e.target.value === '' ? null : Number(e.target.value)})} className="h-12" /></div>
 <div><Label>Dimensions (L x W x H cm)</Label><div className="flex gap-2"><Input placeholder="L" type="number" value={Number.isNaN(formData.dimensions?.length) ? '' : (formData.dimensions?.length ?? '')} onChange={(e: any) => setFormData({...formData, dimensions: {...formData.dimensions, length: e.target.value === '' ? null : Number(e.target.value)} as any})} className="h-12 text-center" /><Input placeholder="W" type="number" value={Number.isNaN(formData.dimensions?.width) ? '' : (formData.dimensions?.width ?? '')} onChange={(e: any) => setFormData({...formData, dimensions: {...formData.dimensions, width: e.target.value === '' ? null : Number(e.target.value)} as any})} className="h-12 text-center" /><Input placeholder="H" type="number" value={Number.isNaN(formData.dimensions?.height) ? '' : (formData.dimensions?.height ?? '')} onChange={(e: any) => setFormData({...formData, dimensions: {...formData.dimensions, height: e.target.value === '' ? null : Number(e.target.value)} as any})} className="h-12 text-center" /></div></div>
 </div>
 </div>
    );
};
