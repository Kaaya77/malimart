import React, { useRef, useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Switch } from '../../components/UI';
import { TANZANIA_REGIONS } from '../../constants';
import { Globe, Home, Loader2, Mail, Phone, Upload, User as UserIcon, Wallet } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { compressImage } from '../../services/imageCompression';
import { useBuyerSettings } from './context';

export const ProfileTab = () => {
    const { addToast, handleLanguageChange, handleProfileUpdate, isSavingProfile, preferences, profileData, setPreferences, setProfileData, togglePreference, updateUserProfile, user } = useBuyerSettings();
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        setUploadingAvatar(true);
        try {
            const compressed = await compressImage(file, 400, 0.8);
            const ext = file.name.split('.').pop() ?? 'jpg';
            const path = `avatars/${user.id}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('mali-mart-uploads')
                .upload(path, compressed, { upsert: true, contentType: file.type });
            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from('mali-mart-uploads').getPublicUrl(path);
            const url = data.publicUrl + `?v=${Date.now()}`;
            setProfileData((prev: any) => ({ ...prev, avatar_url: url }));
            await updateUserProfile({ avatar_url: url });
            addToast('Avatar updated', 'success');
        } catch (err: any) {
            addToast(err.message || 'Upload failed', 'error');
        } finally {
            setUploadingAvatar(false);
            e.target.value = '';
        }
    };

    const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        setUploadingCover(true);
        try {
            const compressed = await compressImage(file, 1200, 0.8);
            const ext = file.name.split('.').pop() ?? 'jpg';
            const path = `covers/${user.id}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('mali-mart-uploads')
                .upload(path, compressed, { upsert: true, contentType: file.type });
            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from('mali-mart-uploads').getPublicUrl(path);
            const url = data.publicUrl + `?v=${Date.now()}`;
            setProfileData((prev: any) => ({ ...prev, cover_image_url: url }));
            await updateUserProfile({ cover_image_url: url });
            addToast('Cover image updated', 'success');
        } catch (err: any) {
            addToast(err.message || 'Upload failed', 'error');
        } finally {
            setUploadingCover(false);
            e.target.value = '';
        }
    };
    return (
            <div className="space-y-6 animate-in fade-in">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your personal details and public profile.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileUpdate} className="space-y-6">
                    <div className="flex items-center gap-6 mb-6">
                      <div className="relative w-20 h-20 shrink-0 group">
                        <div className="w-20 h-20 rounded-full bg-foreground/[0.06] overflow-hidden border-2 border-foreground/10 flex items-center justify-center">
                          {profileData.avatar_url ? (
                            <img src={profileData.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <UserIcon className="w-8 h-8 text-foreground/40" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {uploadingAvatar ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Upload className="w-5 h-5 text-white" />}
                        </button>
                        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Profile Photo</p>
                        <p className="text-xs text-muted-foreground mt-1">Hover the circle and click to upload. Max 5 MB.</p>
                        <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} className="mt-2 text-xs font-semibold text-foreground underline underline-offset-2 hover:opacity-60 transition-opacity">
                          {uploadingAvatar ? 'Uploading…' : 'Change photo'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name</label>
                          <Input icon={UserIcon} placeholder="Full Name" value={profileData.full_name || ''} onChange={(e: any) => setProfileData({ ...profileData, full_name: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display Name</label>
                          <Input icon={UserIcon} placeholder="Display name (shown publicly)" value={profileData.display_name || ''} onChange={(e: any) => setProfileData({ ...profileData, display_name: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</label>
                          <Input icon={Mail} placeholder="Email Address" value={user?.email || ''} disabled className="bg-foreground/[0.03] /50 opacity-70" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone Number</label>
                          <Input icon={Phone} placeholder="Phone Number" value={profileData.phone || ''} onChange={(e: any) => setProfileData({ ...profileData, phone: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Region</label>
                          <div className="relative">
                              <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                              <select 
                                  className="w-full h-10 bg-background border border-foreground/10 rounded-xl pl-10 pr-4 text-sm outline-none text-foreground appearance-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all"
                                  value={profileData.region || ''}
                                  onChange={(e: any) => setProfileData({ ...profileData, region: e.target.value })}
                              >
                                  {TANZANIA_REGIONS.map(region => (
                                      <option key={region} value={region}>{region}</option>
                                  ))}
                              </select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pronouns</label>
                          <Input placeholder="e.g. he/him, she/her, they/them" value={profileData.pronouns || ''} onChange={(e: any) => setProfileData({ ...profileData, pronouns: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Signature Emoji</label>
                          <Input placeholder="e.g. 🌟" value={profileData.signature_emoji || ''} onChange={(e: any) => setProfileData({ ...profileData, signature_emoji: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Greeting Style</label>
                          <select className="w-full h-10 bg-background border border-foreground/10 rounded-xl px-4 text-sm outline-none text-foreground appearance-none" value={profileData.greeting_style || 'karibu'} onChange={(e: any) => setProfileData({ ...profileData, greeting_style: e.target.value })}>
                            <option value="karibu">Karibu (Welcome)</option>
                            <option value="habari">Habari (How are you?)</option>
                            <option value="hello">Hello (English)</option>
                            <option value="mambo">Mambo (Swahili casual)</option>
                          </select>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bio</label>
                          <textarea placeholder="Tell people a little about yourself..." value={profileData.bio || ''} onChange={(e: any) => setProfileData({ ...profileData, bio: e.target.value })} maxLength={500} rows={3} className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-sm outline-none text-foreground focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all resize-none" />
                          <p className="text-xs text-muted-foreground text-right">{(profileData.bio || '').length}/500</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timezone</label>
                          <select className="w-full h-10 bg-background border border-foreground/10 rounded-xl px-4 text-sm outline-none text-foreground appearance-none" value={profileData.timezone || 'Africa/Dar_es_Salaam'} onChange={(e: any) => setProfileData({ ...profileData, timezone: e.target.value })}>
                            <option value="Africa/Dar_es_Salaam">East Africa Time (Dar es Salaam)</option>
                            <option value="Africa/Nairobi">East Africa Time (Nairobi)</option>
                            <option value="UTC">UTC</option>
                            <option value="Europe/London">GMT (London)</option>
                            <option value="America/New_York">EST (New York)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cover Image</label>
                          <div
                            className="relative w-full h-20 rounded-xl border-2 border-dashed border-foreground/15 bg-foreground/[0.03] overflow-hidden flex items-center justify-center cursor-pointer group"
                            onClick={() => coverInputRef.current?.click()}
                          >
                            {profileData.cover_image_url
                              ? <img src={profileData.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
                              : <div className="flex items-center gap-2 text-foreground/30"><Upload className="w-4 h-4" /><span className="text-xs">Upload cover banner</span></div>}
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              {uploadingCover ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <><Upload className="w-4 h-4 text-white mr-1.5" /><span className="text-white text-xs font-medium">Change Cover</span></>}
                            </div>
                          </div>
                          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                        </div>
                    </div>
                    <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-white/5">
                      <Button type="submit" variant="primary" disabled={isSavingProfile}>
                        {isSavingProfile ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Changes'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Preferences</CardTitle>
                  <CardDescription>Customize your regional and display settings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Language</label>
                        <div className="relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                            <select 
                                className="w-full h-10 bg-background border border-foreground/10 rounded-xl pl-10 pr-4 text-sm outline-none text-foreground appearance-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all"
                                value={preferences.language}
                                onChange={handleLanguageChange}
                            >
                                <option value="en">English (US)</option>
                                <option value="sw">Swahili</option>
                                <option value="fr">French</option>
                            </select>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Default Currency</label>
                        <div className="relative">
                            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                            <select 
                                className="w-full h-10 bg-background border border-foreground/10 rounded-xl pl-10 pr-4 text-sm outline-none text-foreground appearance-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all"
                                value={preferences.defaultCurrency}
                                onChange={(e) => {
                                    setPreferences({...preferences, defaultCurrency: e.target.value});
                                    updateUserProfile({ default_currency: e.target.value });
                                }}
                            >
                                <option value="TZS">TZS - Tanzanian Shilling</option>
                                <option value="USD">USD - US Dollar</option>
                                <option value="KES">KES - Kenyan Shilling</option>
                            </select>
                        </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-sm text-foreground">High Contrast Mode</p>
                            <p className="text-xs text-muted-foreground">Improve visibility for accessibility</p>
                        </div>
                        <Switch checked={preferences.highContrastMode} onChange={() => togglePreference('highContrastMode')} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
    );
};
