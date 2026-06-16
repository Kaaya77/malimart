import React, { useRef, useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from '../../components/UI';
import { SOCIAL_PLATFORMS, TANZANIA_DISTRICTS, TANZANIA_REGIONS } from '../../constants';
import { Globe, ImageIcon, Info, Loader2, Store, Trash2, Upload } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { compressImage } from '../../services/imageCompression';
import { useSellerSettings } from './context';

export const StoreTab = () => {
    const { addToast, handleAddSocial, handleGenericSave, handleRemoveSocial, isSaving, newSocial, policiesData, profileData, setNewSocial, setPoliciesData, setProfileData, socialLinks, user } = useSellerSettings();
    const logoInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);

    const uploadStoreImage = async (
        file: File,
        pathKey: 'logo' | 'banner',
        setUploading: (v: boolean) => void,
        fieldKey: 'logo_url' | 'banner_url',
        inputEl: HTMLInputElement | null,
    ) => {
        if (!file || !user) return;
        setUploading(true);
        try {
            const compressed = await compressImage(file, pathKey === 'logo' ? 400 : 1200, 0.8);
            const ext = file.name.split('.').pop() ?? 'jpg';
            const path = `store/${user.id}/${pathKey}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('mali-mart-uploads')
                .upload(path, compressed, { upsert: true, contentType: file.type });
            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from('mali-mart-uploads').getPublicUrl(path);
            const url = data.publicUrl + `?v=${Date.now()}`;
            setProfileData((prev: any) => ({ ...prev, [fieldKey]: url }));
            addToast(`${pathKey === 'logo' ? 'Logo' : 'Banner'} updated`, 'success');
        } catch (err: any) {
            addToast(err.message || 'Upload failed', 'error');
        } finally {
            setUploading(false);
            if (inputEl) inputEl.value = '';
        }
    };

    return (
 <div className="space-y-6 animate-in fade-in">
 <Card>
 <CardHeader>
 <CardTitle>Basic Information</CardTitle>
 <CardDescription>Your public store details and location.</CardDescription>
 </CardHeader>
 <CardContent>
 {/* Logo + Banner row */}
 <div className="flex flex-col sm:flex-row gap-4 mb-6">
   {/* Store Logo */}
   <div className="flex flex-col items-center gap-2 shrink-0">
     <div className="relative w-20 h-20 group cursor-pointer" onClick={() => logoInputRef.current?.click()}>
       <div className="w-20 h-20 rounded-2xl border-2 border-foreground/10 bg-foreground/[0.04] overflow-hidden flex items-center justify-center">
         {profileData.logo_url
           ? <img src={profileData.logo_url} alt="Logo" className="w-full h-full object-cover" />
           : <Store className="w-8 h-8 text-foreground/25" />}
       </div>
       <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
         {uploadingLogo ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Upload className="w-5 h-5 text-white" />}
       </div>
     </div>
     <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="text-[9px] uppercase tracking-[0.15em] text-foreground/40 hover:text-foreground/70 transition-colors">
       {uploadingLogo ? 'Uploading…' : 'Change Logo'}
     </button>
     <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadStoreImage(e.target.files![0], 'logo', setUploadingLogo, 'logo_url', logoInputRef.current)} />
   </div>
   {/* Banner */}
   <div className="flex-1 flex flex-col gap-2">
     <div
       className="relative w-full h-24 rounded-2xl border-2 border-dashed border-foreground/15 bg-foreground/[0.03] overflow-hidden flex items-center justify-center cursor-pointer group"
       onClick={() => bannerInputRef.current?.click()}
     >
       {profileData.banner_url
         ? <img src={profileData.banner_url} alt="Banner" className="w-full h-full object-cover" />
         : <div className="flex flex-col items-center gap-1 text-foreground/30"><ImageIcon className="w-6 h-6" /><span className="text-[10px] uppercase tracking-[0.1em]">Banner</span></div>}
       <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
         {uploadingBanner ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <><Upload className="w-4 h-4 text-white mr-1.5" /><span className="text-white text-xs font-medium">Upload Banner</span></>}
       </div>
     </div>
     <button type="button" onClick={() => bannerInputRef.current?.click()} disabled={uploadingBanner} className="text-[9px] uppercase tracking-[0.15em] text-foreground/40 hover:text-foreground/70 transition-colors text-left">
       {uploadingBanner ? 'Uploading…' : 'Click to change banner / cover image'}
     </button>
     <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadStoreImage(e.target.files![0], 'banner', setUploadingBanner, 'banner_url', bannerInputRef.current)} />
   </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 <div className="space-y-1">
 <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Store Name</label>
 <Input placeholder="Store Name" value={profileData.store_name || ''} onChange={(e: any) => setProfileData({...profileData, store_name: e.target.value})} />
 </div>
 <div className="space-y-1">
 <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Contact Phone</label>
 <Input placeholder="Contact Phone" value={profileData.contact_phone} onChange={(e: any) => setProfileData({...profileData, contact_phone: e.target.value})} />
 </div>
 <div className="space-y-1">
 <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Region</label>
 <select 
 className="flex h-11 w-full rounded-xl border border-foreground/15 bg-foreground/[0.04] px-4 text-sm text-foreground focus:outline-none focus:border-foreground/30 transition-all"
 value={profileData.region}
 onChange={(e) => setProfileData({...profileData, region: e.target.value, district: TANZANIA_DISTRICTS[e.target.value]?.[0] || ''})}
 >
 {TANZANIA_REGIONS.map(region => (
 <option key={region} value={region}>{region}</option>
 ))}
 </select>
 </div>
 <div className="space-y-1">
 <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">District</label>
 <select 
 className="flex h-11 w-full rounded-xl border border-foreground/15 bg-foreground/[0.04] px-4 text-sm text-foreground focus:outline-none focus:border-foreground/30 transition-all disabled:opacity-50"
 value={profileData.district}
 onChange={(e) => setProfileData({...profileData, district: e.target.value})}
 disabled={!profileData.region || !TANZANIA_DISTRICTS[profileData.region]}
 >
 <option value="">Select District</option>
 {(TANZANIA_DISTRICTS[profileData.region] || []).map(district => (
 <option key={district} value={district}>{district}</option>
 ))}
 </select>
 </div>
 <div className="md:col-span-2 space-y-1">
 <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Specific Address</label>
 <Input placeholder="e.g., Kariakoo, Msimbazi St" value={profileData.address} onChange={(e: any) => setProfileData({...profileData, address: e.target.value})} />
 </div>
 <div className="md:col-span-2 space-y-1">
 <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Store Description</label>
 <Textarea placeholder="What do you sell?" value={profileData.description} onChange={(e: any) => setProfileData({...profileData, description: e.target.value})} />
 </div>
 </div>
 <div className="flex justify-end pt-6">
 <Button variant="primary" onClick={() => handleGenericSave({ ...profileData, social_links: socialLinks }, "Store info saved")} disabled={isSaving}>
 {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Save Basic Info'}
 </Button>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Store Policies</CardTitle>
 <CardDescription>Set expectations for your buyers.</CardDescription>
 </CardHeader>
 <CardContent className="space-y-5">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 <div className="space-y-1">
 <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Return Policy</label>
 <select 
 className="flex h-11 w-full rounded-xl border border-foreground/15 bg-foreground/[0.04] px-4 text-sm text-foreground focus:outline-none focus:border-foreground/30 transition-all"
 value={policiesData.return_policy}
 onChange={(e) => setPoliciesData({...policiesData, return_policy: e.target.value})}
 >
 <option value="No Returns">No Returns</option>
 <option value="3 Days">3 Days Return</option>
 <option value="7 Days">7 Days Return</option>
 <option value="14 Days">14 Days Return</option>
 </select>
 </div>
 <div className="space-y-1">
 <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Processing Time</label>
 <select 
 className="flex h-11 w-full rounded-xl border border-foreground/15 bg-foreground/[0.04] px-4 text-sm text-foreground focus:outline-none focus:border-foreground/30 transition-all"
 value={policiesData.processing_time}
 onChange={(e) => setPoliciesData({...policiesData, processing_time: e.target.value})}
 >
 <option value="Same Day">Same Day Dispatch</option>
 <option value="1-2 Business Days">1-2 Business Days</option>
 <option value="3-5 Business Days">3-5 Business Days</option>
 <option value="Made to Order (7+ Days)">Made to Order (7+ Days)</option>
 </select>
 </div>
 <div className="md:col-span-2 space-y-1">
 <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Warranty Information (Optional)</label>
 <Input placeholder="e.g., 6 Months Manufacturer Warranty" value={policiesData.warranty} onChange={(e: any) => setPoliciesData({...policiesData, warranty: e.target.value})} />
 </div>
 </div>
 <div className="flex justify-end pt-4">
 <Button variant="primary" onClick={() => handleGenericSave(policiesData, "Policies saved")} disabled={isSaving}>
 {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Save Policies'}
 </Button>
 </div>
 </CardContent>
 </Card>

 {/* Dynamic Social Links */}
 <Card>
 <CardHeader>
 <CardTitle>Social & Contact Links</CardTitle>
 <CardDescription>Add the platforms where buyers can reach you.</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {socialLinks.length > 0 && (
 <div className="space-y-2 mb-4">
 {socialLinks.map((link, idx) => (
 <div key={idx} className="flex items-center justify-between p-3 border border-foreground/8 rounded-xl bg-foreground/[0.02]">
 <div className="flex items-center gap-3">
 <Globe className="w-4 h-4 text-foreground/40" />
 <span className="font-bold text-sm text-foreground">{link.platform}</span>
 <span className="text-[10px] uppercase tracking-[0.1em] text-foreground/60 truncate max-w-[200px]">{link.url}</span>
 </div>
 <Button variant="ghost" size="icon" className="text-red-500 h-8 w-8" onClick={() => handleRemoveSocial(idx)}>
 <Trash2 className="w-4 h-4 stroke-[1.5]" />
 </Button>
 </div>
 ))}
 </div>
 )}

 <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-foreground/10">
 <select 
 className="flex h-11 w-full sm:w-auto rounded-xl border border-foreground/15 bg-foreground/[0.04] px-4 text-sm text-foreground focus:outline-none focus:border-foreground/30 transition-all"
 value={newSocial.platform}
 onChange={(e) => setNewSocial({...newSocial, platform: e.target.value})}
 >
 {SOCIAL_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
 </select>
 <Input 
 placeholder={newSocial.platform === 'WhatsApp' ? 'Phone Number (e.g., +255...)' : 'Profile URL or Username'} 
 value={newSocial.url} 
 onChange={(e: any) => setNewSocial({...newSocial, url: e.target.value})} 
 className="flex-1"
 />
 <Button variant="secondary" onClick={handleAddSocial} disabled={!newSocial.url}>Add Link</Button>
 </div>
 <div className="flex justify-end pt-4">
 <Button variant="primary" onClick={() => handleGenericSave({ social_links: socialLinks }, "Social links saved")} disabled={isSaving}>
 {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Save Links'}
 </Button>
 </div>
 </CardContent>
 </Card>
 </div>
    );
};
