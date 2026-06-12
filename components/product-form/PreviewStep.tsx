import React from 'react';

import { ArrowRight, Store } from 'lucide-react';
import { usePF } from './FormContext';
import { PhonePreview } from './PhonePreview';

export const PreviewStep = () => {
    const { isLoading, hoveredVariant, formData, handleSubmit } = usePF();
    return (
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
    );
};
