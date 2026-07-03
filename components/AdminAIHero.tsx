import { safeJsonParse } from '../src/security';
import React, { useState, useEffect, useMemo } from 'react';
import * as adminApi from '../services/adminApi';
import { generateHeroRecommendation } from '../services/heroRecommendationService';
import { Sparkles, Check, X, RefreshCw, Edit2, Trash2, Save, Settings, Star, TrendingUp, Store } from 'lucide-react';
import { formatTZS } from '../constants';
import { ConfirmModal, Input, Button, useToast } from '../components/UI';

export const AdminAIHero = () => {
 const { addToast } = useToast();
 const [activeTab, setActiveTab] = useState<'ai' | 'manual' | 'products'>('ai');
 
 // AI Recommendations State
 const [recommendations, setRecommendations] = useState<any[]>([]);
 const [isLoading, setIsLoading] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [editTitle, setEditTitle] = useState('');
 const [editDesc, setEditDesc] = useState('');
 const [editOfferType, setEditOfferType] = useState('percentage');
 const [editOfferValue, setEditOfferValue] = useState(0);
 const [editOfferText, setEditOfferText] = useState('');
 const [deletingId, setDeletingId] = useState<string | null>(null);

 // Manual Settings State
 const [manualSettings, setManualSettings] = useState({
 heroBadgeText: '',
 heroHeadline: '',
 heroSubheadline: ''
 });
 const [isSavingManual, setIsSavingManual] = useState(false);

 // Top Products State
 const [topProducts, setTopProducts] = useState<any[]>([]);
 const [productSearch, setProductSearch] = useState('');

 useEffect(() => {
 fetchRecommendations();
 fetchManualSettings();
 fetchTopProducts();
 }, []);

 const filteredProducts = useMemo(() => {
 return topProducts.filter(p => 
 p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
 p.profiles?.store_name?.toLowerCase().includes(productSearch.toLowerCase())
 );
 }, [topProducts, productSearch]);

 const fetchRecommendations = async () => {
 try {
 const data = await adminApi.listHeroRecommendations();
 if (data) setRecommendations(data);
 } catch (error) {
 console.error('Error fetching recommendations:', error);
 }
 };

 const fetchManualSettings = async () => {
 try {
 const data = await adminApi.getHeroSettings();
 if (data) {
 setManualSettings({
 heroBadgeText: data.hero_badge_text || '',
 heroHeadline: data.hero_headline || '',
 heroSubheadline: data.hero_subheadline || ''
 });
 }
 } catch (error) {
 console.error('Error fetching manual settings:', error);
 }
 };

 const fetchTopProducts = async () => {
 // Fetch all products to show as top products
 try {
 const data = await adminApi.listHeroProducts();
 if (data) setTopProducts(data);
 } catch (error) {
 console.error('Error fetching top products:', error);
 }
 };

 const handleSaveManualSettings = async () => {
 setIsSavingManual(true);
 try {
 await adminApi.updateHeroSettings({
 badgeText: manualSettings.heroBadgeText,
 headline: manualSettings.heroHeadline,
 subheadline: manualSettings.heroSubheadline
 });
 addToast("Manual hero settings saved", "success");
 } catch (error) {
 addToast("Failed to save settings", "error");
 } finally {
 setIsSavingManual(false);
 }
 };

 const handleGenerate = async () => {
 setIsLoading(true);
 try {
 await generateHeroRecommendation();
 fetchRecommendations();
 addToast("New recommendation generated", "success");
 } catch (error) {
 addToast("Failed to generate recommendation", "error");
 } finally {
 setIsLoading(false);
 }
 };

 const startEdit = (rec: any) => {
 setEditingId(rec.id);
 setEditTitle(rec.title);
 setEditDesc(rec.description);
 
 try {
 const offer = (safeJsonParse(rec.offer_text, {}) as any);
 setEditOfferType(offer.type || 'percentage');
 setEditOfferValue(offer.value || 0);
 setEditOfferText(offer.text || '');
 } catch (e) {
 setEditOfferType('percentage');
 setEditOfferValue(0);
 setEditOfferText(rec.offer_text || '');
 }
 };

 const cancelEdit = () => {
 setEditingId(null);
 };

 const saveEdit = async (id: string) => {
 const offer = { type: editOfferType, value: editOfferValue, text: editOfferText };
 try {
 await adminApi.updateHeroRecommendation(id, {
 title: editTitle,
 description: editDesc,
 offerText: JSON.stringify(offer)
 });
 setEditingId(null);
 fetchRecommendations();
 addToast("Recommendation updated", "success");
 } catch (error) {
 addToast("Failed to update recommendation", "error");
 }
 };

 const handleApprove = async (id: string, productId: string) => {
 // First, mark all others as not approved (if we only want one active)
 // For now, we just approve this one. The homepage fetches the latest approved.
 // The RPC also notifies the seller server-side.
 try {
 await adminApi.setHeroRecommendationStatus(id, 'approved');
 fetchRecommendations();
 addToast("Recommendation approved and is now live!", "success");
 } catch (error) {
 addToast("Failed to approve recommendation", "error");
 }
 };

 const handleReject = async (id: string) => {
 try {
 await adminApi.setHeroRecommendationStatus(id, 'rejected');
 fetchRecommendations();
 } catch (error) {
 addToast("Failed to reject recommendation", "error");
 }
 };

 const confirmDelete = async () => {
 if (deletingId) {
 try {
 await adminApi.deleteHeroRecommendation(deletingId);
 setDeletingId(null);
 fetchRecommendations();
 addToast("Recommendation deleted", "success");
 } catch (error) {
 addToast("Failed to delete recommendation", "error");
 }
 }
 };

 const handleClearAll = async () => {
 try {
 await adminApi.clearHeroRecommendations();
 addToast("Cleared all pending/rejected recommendations", "success");
 fetchRecommendations();
 } catch (error) {
 addToast("Failed to clear recommendations", "error");
 }
 };

 const handlePromoteProduct = async (product: any) => {
 // Manually create a pending recommendation for a product
 try {
 await adminApi.createHeroRecommendation({
 productId: product.id,
 title: `Featured: ${product.name}`,
 description: product.description.substring(0, 100) + '...',
 priceDisplay: formatTZS(product.price),
 offerText: 'Special Feature'
 });
 addToast("Product nominated for Hero section", "success");
 setActiveTab('ai');
 fetchRecommendations();
 } catch (error) {
 addToast("Failed to nominate product", "error");
 }
 };

 return (
 <div className="space-y-8">
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
 <div>
 <h2 className="text-2xl font-sans font-black">Hero Section Management</h2>
 <p className="text-sm text-foreground/60 mt-1">Control what appears on the homepage hero section.</p>
 </div>
 <div className="flex gap-2 bg-foreground/[0.05] dark:bg-background/5 p-1 rounded-lg">
 <button 
 onClick={() => setActiveTab('ai')}
 className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors ${activeTab === 'ai' ? 'bg-primary text-background dark:bg-background dark:text-foreground' : 'text-foreground/60 hover:text-foreground'}`}
 >
 <Sparkles className="w-3 h-3 inline mr-2" /> AI Recommendations
 </button>
 <button 
 onClick={() => setActiveTab('manual')}
 className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors ${activeTab === 'manual' ? 'bg-primary text-background dark:bg-background dark:text-foreground' : 'text-foreground/60 hover:text-foreground'}`}
 >
 <Settings className="w-3 h-3 inline mr-2" /> Manual Fallback
 </button>
 <button 
 onClick={() => setActiveTab('products')}
 className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors ${activeTab === 'products' ? 'bg-primary text-background dark:bg-background dark:text-foreground' : 'text-foreground/60 hover:text-foreground'}`}
 >
 <TrendingUp className="w-3 h-3 inline mr-2" /> Top Products
 </button>
 </div>
 </div>

 {activeTab === 'ai' && (
 <div className="space-y-6">
 <div className="flex justify-between items-center bg-foreground/[0.05] dark:bg-background/5 p-4 border border-foreground/10">
 <div>
 <h3 className="font-sans font-black text-lg">AI-Powered Curation</h3>
 <p className="text-xs text-foreground/60">Let AI analyze top products and generate compelling hero copy.</p>
 </div>
 <div className="flex gap-2">
 <button 
 onClick={handleClearAll} 
 className="flex items-center gap-2 px-4 py-3 border border-foreground/10 text-foreground/60 text-xs font-bold uppercase tracking-[0.2em] hover:bg-red-500/10 hover:text-red-500 transition-colors"
 >
 <Trash2 className="w-4 h-4" /> Clear All
 </button>
 <button onClick={handleGenerate} disabled={isLoading} className="flex items-center gap-2 px-6 py-3 bg-primary text-background dark:bg-background dark:text-foreground text-xs font-bold uppercase tracking-[0.2em] hover:opacity-80 transition-opacity">
 <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> {isLoading ? 'Generating...' : 'Generate New'}
 </button>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {recommendations.map((rec) => (
 <div key={rec.id} className={`flex flex-col glass-surface border rounded-2xl ${rec.status === 'approved' ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-foreground/10'} overflow-hidden`}>
 {rec.products && (
 <div className="relative h-48 w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
 <img src={rec.products.images?.[0] || "https://picsum.photos/seed/luxurycraft/1920/1080"} alt={rec.products.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
 <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
 <div className="absolute bottom-4 left-4 right-4">
 <p className="text-white text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">Featured Product</p>
 <p className="text-white font-sans font-black text-lg truncate">{rec.products.name}</p>
 </div>
 </div>
 )}
 
 <div className="p-6 flex-1 flex flex-col">
 {editingId === rec.id ? (
 <div className="space-y-4 flex-1">
 <div>
 <label className="text-[10px] uppercase tracking-widest opacity-50 mb-1 block">Title</label>
 <Input value={editTitle} onChange={(e: any) => setEditTitle(e.target.value)} />
 </div>
 <div>
 <label className="text-[10px] uppercase tracking-widest opacity-50 mb-1 block">Description</label>
 <textarea 
 value={editDesc} 
 onChange={(e) => setEditDesc(e.target.value)} 
 className="w-full p-3 bg-transparent border border-foreground/20 focus:outline-none focus:border-primary text-foreground rounded-xl transition-colors min-h-[100px] text-sm"
 />
 </div>
 <div>
 <label className="text-[10px] uppercase tracking-widest opacity-50 mb-1 block">Offer Type</label>
 <select value={editOfferType} onChange={(e) => setEditOfferType(e.target.value)} className="w-full p-2 bg-transparent border border-foreground/20">
 <option value="percentage">Percentage</option>
 <option value="fixed">Fixed Amount</option>
 </select>
 </div>
 <div>
 <label className="text-[10px] uppercase tracking-widest opacity-50 mb-1 block">Offer Value</label>
 <Input type="number" value={editOfferValue} onChange={(e: any) => setEditOfferValue(Number(e.target.value))} />
 </div>
 <div>
 <label className="text-[10px] uppercase tracking-widest opacity-50 mb-1 block">Offer Display Text</label>
 <Input value={editOfferText} onChange={(e: any) => setEditOfferText(e.target.value)} />
 </div>
 <div className="flex gap-2 pt-2">
 <Button onClick={() => saveEdit(rec.id)} className="flex-1 text-xs"><Save className="w-3 h-3 mr-2" /> Save Changes</Button>
 <Button onClick={cancelEdit} variant="outline" className="flex-1 text-xs">Cancel</Button>
 </div>
 </div>
 ) : (
 <div className="flex-1">
 <div className="flex justify-between items-start mb-4">
 {(() => {
 try {
 const offer = (safeJsonParse(rec.offer_text, {}) as any);
 return (
 <span className="inline-flex items-center gap-1 px-2 py-1 bg-foreground/[0.05] dark:bg-background/5 text-[10px] font-semibold uppercase tracking-widest">
 <Sparkles className="w-3 h-3" /> {offer.text}
 </span>
 );
 } catch (e) {
 return (
 <span className="inline-flex items-center gap-1 px-2 py-1 bg-foreground/[0.05] dark:bg-background/5 text-[10px] font-semibold uppercase tracking-widest">
 <Sparkles className="w-3 h-3" /> {rec.offer_text}
 </span>
 );
 }
 })()}
 <span className="font-mono text-sm font-semibold">{rec.products ? formatTZS(rec.products.price) : rec.price_display}</span>
 </div>
 <h3 className="text-xl font-sans font-black mb-3 leading-tight">{rec.title}</h3>
 <p className="text-sm text-foreground/70 mb-4 leading-relaxed">{rec.description}</p>
 
 {rec.products && rec.products.profiles && (
 <div className="flex items-center gap-2 mt-auto mb-4 p-3 bg-foreground/[0.05] dark:bg-background/5 rounded-lg">
 <Store className="w-4 h-4 opacity-70" />
 <div className="flex flex-col">
 <span className="text-[10px] uppercase tracking-widest opacity-50">Seller</span>
 <span className="text-xs font-semibold">{rec.products.profiles.store_name || rec.products.profiles.full_name || 'Unknown'}</span>
 </div>
 </div>
 )}
 </div>
 )}

 {editingId !== rec.id && (
 <div className="flex items-center justify-between mt-auto pt-4 border-t border-foreground/10">
 <div className="flex gap-2">
 {rec.status === 'pending' && (
 <>
 <button onClick={() => handleApprove(rec.id, rec.product_id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-600 text-xs font-bold uppercase tracking-wider hover:bg-green-500/20 transition-colors"><Check className="w-3 h-3" /> Approve</button>
 <button onClick={() => handleReject(rec.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-600 text-xs font-bold uppercase tracking-wider hover:bg-red-500/20 transition-colors"><X className="w-3 h-3" /> Reject</button>
 </>
 )}
 {rec.status === 'approved' && <span className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-xs font-bold uppercase tracking-wider"><Check className="w-3 h-3" /> Live on Homepage</span>}
 {rec.status === 'rejected' && <span className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-600 text-xs font-bold uppercase tracking-wider"><X className="w-3 h-3" /> Rejected</span>}
 </div>
 
 <div className="flex gap-3">
 <button onClick={() => startEdit(rec)} className="text-foreground/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
 <button onClick={() => setDeletingId(rec.id)} className="text-foreground/50 hover:text-red-600 dark:hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
 </div>
 </div>
 )}
 </div>
 </div>
 ))}
 {recommendations.length === 0 && !isLoading && (
 <div className="col-span-full py-12 text-center border border-dashed border-foreground/20">
 <Sparkles className="w-8 h-8 mx-auto mb-4 opacity-20" />
 <p className="text-foreground/60 font-medium">No AI recommendations yet. Click Generate New to start.</p>
 </div>
 )}
 </div>
 </div>
 )}

 {activeTab === 'manual' && (
 <div className="max-w-2xl glass-surface p-8 rounded-2xl border border-foreground/10">
 <div className="mb-8">
 <h3 className="font-sans font-black text-xl mb-2">Manual Fallback Settings</h3>
 <p className="text-sm text-foreground/60">These settings are used if no AI recommendation is approved or if the AI service is temporarily unavailable.</p>
 </div>

 <div className="space-y-6">
 <div>
 <label className="block text-xs font-semibold uppercase tracking-widest mb-2">Hero Badge Text</label>
 <Input 
 type="text" 
 value={manualSettings.heroBadgeText} 
 onChange={(e: any) => setManualSettings({...manualSettings, heroBadgeText: e.target.value})}
 placeholder="e.g., Summer Collection 2026"
 />
 </div>
 <div>
 <label className="block text-xs font-semibold uppercase tracking-widest mb-2">Hero Headline</label>
 <Input 
 type="text" 
 value={manualSettings.heroHeadline} 
 onChange={(e: any) => setManualSettings({...manualSettings, heroHeadline: e.target.value})}
 placeholder="e.g., Discover Artisan Products"
 />
 </div>
 <div>
 <label className="block text-xs font-semibold uppercase tracking-widest mb-2">Hero Subheadline</label>
 <textarea 
 value={manualSettings.heroSubheadline} 
 onChange={(e) => setManualSettings({...manualSettings, heroSubheadline: e.target.value})}
 className="w-full p-4 bg-transparent border border-foreground/20 rounded-xl focus:outline-none focus:border-primary text-foreground transition-colors min-h-[120px]"
 placeholder="e.g., Explore our curated selection of handcrafted goods..."
 />
 </div>
 
 <div className="pt-4 border-t border-foreground/10">
 <Button onClick={handleSaveManualSettings} disabled={isSavingManual} className="w-full">
 {isSavingManual ? 'Saving...' : 'Save Manual Settings'}
 </Button>
 </div>
 </div>
 </div>
 )}

 {activeTab === 'products' && (
 <div className="space-y-6">
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
 <div>
 <h3 className="font-sans font-black text-xl mb-2">Top Products & Nominations</h3>
 <p className="text-sm text-foreground/60">Select a high-performing product to manually feature it in the Hero section.</p>
 </div>
 <Input 
 placeholder="Search products or stores..." 
 value={productSearch}
 onChange={(e: any) => setProductSearch(e.target.value)}
 className="w-full md:w-64"
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {filteredProducts.map(product => (
 <div key={product.id} className="glass-surface border border-foreground/10 rounded-2xl overflow-hidden flex flex-col">
 <div className="h-48 overflow-hidden relative">
 <img src={product.images?.[0] || "https://picsum.photos/seed/luxurycraft/1920/1080"} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
 <div className="absolute top-2 right-2 bg-background/90 dark:bg-black/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
 {formatTZS(product.price)}
 </div>
 </div>
 <div className="p-4 flex-1 flex flex-col">
 <h4 className="font-sans font-black text-lg mb-1 truncate">{product.name}</h4>
 <p className="text-xs text-foreground/60 mb-4 truncate">By {product.profiles?.store_name || product.profiles?.full_name}</p>
 
 <div className="mt-auto pt-4 border-t border-foreground/10 flex flex-col gap-2">
 <button 
 onClick={() => handlePromoteProduct(product)}
 className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest border border-foreground dark:border-background hover:bg-primary hover:text-background dark:hover:text-foreground transition-colors"
 >
 <Star className="w-3 h-3" /> Nominate for Hero
 </button>
 <button 
 onClick={async () => {
 const newVal = !product.is_boosted;
 try {
 await adminApi.setProductBoost(product.id, newVal);
 addToast(newVal ? "Added to Trending" : "Removed from Trending", "success");
 fetchTopProducts();
 } catch (error) {
 addToast("Failed to update trending status", "error");
 }
 }}
 className={`w-full py-2 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest border transition-colors ${product.is_boosted ? 'bg-primary text-background dark:bg-background dark:text-foreground border-foreground dark:border-background' : 'border-foreground/20 hover:border-foreground'}`}
 >
 <TrendingUp className="w-3 h-3" /> {product.is_boosted ? 'Trending (Pinned)' : 'Pin to Trending'}
 </button>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 <ConfirmModal
 isOpen={!!deletingId}
 onClose={() => setDeletingId(null)}
 onConfirm={confirmDelete}
 title="Delete Recommendation"
 message="Are you sure you want to delete this AI hero recommendation? This action cannot be undone."
 confirmText="Delete"
 isDestructive={true}
 />
 </div>
 );
};
