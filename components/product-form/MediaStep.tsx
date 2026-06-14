import React, { useState } from 'react';
import { Button, Input, Label, ImageDropzone } from '../UI';
import * as aiService from '../../services/geminiService';
import { CheckCircle2, Download, Loader2, Sparkles, Trash2, Wand2, X, ImageIcon } from 'lucide-react';
import { useToast } from '../UI';
import { usePF } from './FormContext';

export const MediaStep = () => {
    const {
        aiLoading, setAiLoading,
        showGenImage, setShowGenImage,
        showRefineImage, setShowRefineImage,
        genPrompt, setGenPrompt,
        refinePrompt, setRefinePrompt,
        formData, setFormData,
        isLoading,
        uploadFileOrDataUrl,
        downloadImage,
        handleImageUpload,
        handleGenerateImage,
        handleRefineImage,
    } = usePF();
    const { addToast } = useToast();

    // Index of image being individually enhanced (-1 = none)
    const [enhancingIdx, setEnhancingIdx] = useState<number | null>(null);

    const MAX_IMAGES = 8;
    const imageCount = formData.images?.length ?? 0;
    const canAddMore = imageCount < MAX_IMAGES;

    const handleEnhanceSingle = async (i: number) => {
        const img = formData.images?.[i];
        if (!img) return;
        if (!confirm('Enhance this photo? AI will improve lighting and quality.')) return;
        setEnhancingIdx(i);
        try {
            const newImg = await aiService.refineProductImage(
                img,
                'Enhance image quality, improve lighting, and make it professional for e-commerce.'
            );
            if (newImg) {
                const url = await uploadFileOrDataUrl(newImg);
                const newImgs = [...(formData.images || [])];
                newImgs[i] = url;
                setFormData({ ...formData, images: newImgs });
                addToast('Photo enhanced!', 'success');
            } else {
                addToast('Enhancement failed — model returned no image', 'error');
            }
        } catch (e: any) {
            addToast(e.message || 'Enhancement failed', 'error');
        } finally {
            setEnhancingIdx(null);
        }
    };

    return (
        <div className="space-y-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h3 className="text-[10px] uppercase tracking-[0.2em] text-foreground">Visual Assets</h3>
                    <p className="text-[10px] text-foreground/50 mt-1">
                        {imageCount}/{MAX_IMAGES} images · High-quality imagery drives conversion
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowGenImage(v => !v); setShowRefineImage(false); }}
                        className={`text-[9px] uppercase tracking-[0.2em] border-foreground/15 transition-colors ${showGenImage ? 'bg-foreground text-background' : 'bg-transparent text-foreground'}`}
                        disabled={!canAddMore}
                        title={canAddMore ? undefined : `Max ${MAX_IMAGES} images reached`}
                    >
                        <Wand2 className="w-4 h-4 mr-2" /> AI Generate
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowRefineImage(v => !v); setShowGenImage(false); }}
                        className={`text-[9px] uppercase tracking-[0.2em] border-foreground/15 transition-colors ${showRefineImage ? 'bg-foreground text-background' : 'bg-transparent text-foreground'}`}
                        disabled={!imageCount}
                        title={imageCount ? undefined : 'Upload an image first'}
                    >
                        <Sparkles className="w-4 h-4 mr-2" /> AI Refine
                    </Button>
                </div>
            </div>

            {/* AI Generate Panel */}
            {showGenImage && (
                <div className="relative p-8 bg-foreground text-background animate-in slide-in-from-top-4 duration-300">
                    <button
                        onClick={() => setShowGenImage(false)}
                        className="absolute top-4 right-4 p-1 opacity-60 hover:opacity-100 transition-opacity"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    <Label className="text-background text-[10px] uppercase tracking-[0.2em] mb-3 block">
                        AI Image Generation
                    </Label>
                    <p className="text-background/60 text-[10px] mb-4">
                        Describe the product and setting. The AI will create a professional e-commerce photo.
                    </p>
                    <div className="flex gap-3">
                        <Input
                            value={genPrompt || ''}
                            onChange={(e: any) => setGenPrompt(e.target.value)}
                            onKeyDown={(e: any) => { if (e.key === 'Enter' && !aiLoading) handleGenerateImage(); }}
                            placeholder="e.g. Premium leather bag on a minimalist marble surface"
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 flex-1"
                        />
                        <Button
                            onClick={handleGenerateImage}
                            disabled={aiLoading || !genPrompt}
                            className="bg-background text-foreground hover:bg-background/90 shrink-0 min-w-[120px]"
                        >
                            {aiLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</> : 'Generate'}
                        </Button>
                    </div>
                </div>
            )}

            {/* AI Refine Panel */}
            {showRefineImage && (
                <div className="relative p-8 bg-foreground text-background animate-in slide-in-from-top-4 duration-300">
                    <button
                        onClick={() => setShowRefineImage(false)}
                        className="absolute top-4 right-4 p-1 opacity-60 hover:opacity-100 transition-opacity"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    <Label className="text-background text-[10px] uppercase tracking-[0.2em] mb-3 block">
                        AI Refine — Primary Image
                    </Label>
                    <p className="text-background/60 text-[10px] mb-4">
                        Describe how to edit your primary image. The AI will apply the change.
                    </p>
                    <div className="flex gap-3">
                        <Input
                            value={refinePrompt || ''}
                            onChange={(e: any) => setRefinePrompt(e.target.value)}
                            onKeyDown={(e: any) => { if (e.key === 'Enter' && !aiLoading) handleRefineImage(); }}
                            placeholder="e.g. Change background to a lush tropical garden"
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 flex-1"
                        />
                        <Button
                            onClick={handleRefineImage}
                            disabled={aiLoading || !refinePrompt}
                            className="bg-background text-foreground hover:bg-background/90 shrink-0 min-w-[100px]"
                        >
                            {aiLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Refining…</> : 'Refine'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Global loading bar */}
            {(isLoading || aiLoading) && (
                <div className="flex items-center gap-3 px-4 py-3 bg-foreground/[0.04] border border-foreground/10">
                    <Loader2 className="w-4 h-4 animate-spin text-foreground/60 shrink-0" />
                    <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">
                        {aiLoading ? 'AI processing…' : 'Uploading…'}
                    </p>
                </div>
            )}

            {/* Image Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {/* Upload dropzone — only shown when under max */}
                {canAddMore && (
                    <div className="aspect-[4/5]">
                        <ImageDropzone onImageSelected={handleImageUpload} />
                    </div>
                )}

                {(formData.images || []).map((img, i) => (
                    <div
                        key={img}
                        className="aspect-[4/5] relative group overflow-hidden border border-foreground/10 bg-foreground/[0.04]"
                    >
                        <img
                            src={img}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            alt=""
                            loading="lazy"
                            decoding="async"
                        />

                        {/* Per-image loading overlay */}
                        {enhancingIdx === i && (
                            <div className="absolute inset-0 bg-foreground/70 flex flex-col items-center justify-center gap-2">
                                <Loader2 className="w-6 h-6 animate-spin text-background" />
                                <span className="text-background text-[9px] uppercase tracking-[0.2em]">Enhancing…</span>
                            </div>
                        )}

                        {/* Hover actions */}
                        {enhancingIdx !== i && (
                            <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2 flex-wrap p-2">
                                <button
                                    title="Remove"
                                    onClick={() => {
                                        const newImgs = [...(formData.images || [])];
                                        newImgs.splice(i, 1);
                                        setFormData({ ...formData, images: newImgs });
                                    }}
                                    className="p-2.5 bg-background text-foreground hover:bg-red-500 hover:text-white transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>

                                {i !== 0 && (
                                    <button
                                        title="Set as primary"
                                        onClick={() => {
                                            const newImgs = [...(formData.images || [])];
                                            [newImgs[0], newImgs[i]] = [newImgs[i], newImgs[0]];
                                            setFormData({ ...formData, images: newImgs });
                                        }}
                                        className="p-2.5 bg-background text-foreground hover:bg-foreground hover:text-background transition-colors"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                )}

                                <button
                                    title="Download"
                                    onClick={() => downloadImage(img, `product-image-${i + 1}.png`)}
                                    className="p-2.5 bg-background text-foreground hover:bg-foreground hover:text-background transition-colors"
                                >
                                    <Download className="w-4 h-4" />
                                </button>

                                <button
                                    title="AI Enhance"
                                    onClick={() => handleEnhanceSingle(i)}
                                    className="p-2.5 bg-background text-foreground hover:bg-foreground hover:text-background transition-colors"
                                >
                                    <Sparkles className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Primary badge */}
                        {i === 0 && (
                            <div className="absolute top-3 left-3 px-2 py-1 bg-foreground text-background text-[8px] uppercase tracking-[0.25em] font-bold">
                                Primary
                            </div>
                        )}

                        {/* Image number */}
                        {i > 0 && (
                            <div className="absolute top-3 right-3 w-6 h-6 bg-background/80 text-foreground text-[9px] flex items-center justify-center font-bold">
                                {i + 1}
                            </div>
                        )}
                    </div>
                ))}

                {/* Empty state — shown when no images and no dropzone would otherwise show */}
                {imageCount === 0 && !canAddMore && (
                    <div className="col-span-2 md:col-span-4 aspect-video flex flex-col items-center justify-center border border-dashed border-foreground/20 text-foreground/30">
                        <ImageIcon className="w-10 h-10 mb-3" />
                        <p className="text-[10px] uppercase tracking-[0.2em]">No images yet</p>
                    </div>
                )}
            </div>

            {/* Helper text */}
            {imageCount > 0 && (
                <p className="text-[9px] text-foreground/40 uppercase tracking-[0.15em]">
                    Tip: Click <CheckCircle2 className="w-3 h-3 inline mx-0.5" /> on any image to set it as primary · <Sparkles className="w-3 h-3 inline mx-0.5" /> to AI-enhance · <Trash2 className="w-3 h-3 inline mx-0.5" /> to remove
                </p>
            )}
        </div>
    );
};
