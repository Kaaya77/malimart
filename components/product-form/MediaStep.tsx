import React from 'react';
import { Button, Input, Label, ImageDropzone } from '../UI';
import * as aiService from '../../services/geminiService';
import { CheckCircle2, Download, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { useToast } from '../UI';
import { usePF } from './FormContext';

export const MediaStep = () => {
    const { aiLoading, setAiLoading, showGenImage, setShowGenImage, showRefineImage, setShowRefineImage, genPrompt, setGenPrompt, refinePrompt, setRefinePrompt, formData, setFormData, uploadFileOrDataUrl, downloadImage, handleImageUpload, handleGenerateImage, handleRefineImage } = usePF();
    const { addToast } = useToast();
    return (
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
 <img src={img} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" loading="lazy" decoding="async" />
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
    );
};
