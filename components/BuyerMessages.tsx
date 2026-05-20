import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, ChevronLeft, BadgeCheck, Send, Search, Pin, Trash2, Sparkles, Wand2, Loader2, X, Smile, Reply, Paperclip, ShieldAlert, MoreVertical } from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { Button, Input, useToast, ConfirmDialog, UserProfileModal } from './UI';
import { ProductModal } from './ProductModal';
import { OrderDetailsModal } from './OrderDetailsModal';
import { supabase } from '../services/supabaseClient';
import { VendorProfile, ChatMessage, Product, Order } from '../types';
import { MessageContainer, SidebarContainer, ChatAreaContainer, DetailsAreaContainer } from './MessageShared';
import { ProductOrderTag } from './SellerMessages';
import * as aiService from '../services/geminiService';

export const BuyerMessages = ({ userId, initialSellerId }: { userId: string, initialSellerId?: string | null }) => {
 const { fetchMessages, sendMessage, deleteMessage, softDeleteMessage, reportUser, addReaction, removeReaction, user } = useAppState();
 const [searchParams] = useSearchParams();
 const { addToast } = useToast();
 const [chats, setChats] = useState<ChatMessage[]>([]);
 const [selectedSeller, setSelectedSeller] = useState<string | null>(initialSellerId || searchParams.get('sellerId'));
 const [msgText, setMsgText] = useState('');
 const [context, setContext] = useState<{ type: 'order' | 'return' | 'support' | 'product', id: string, label: string } | null>(
 searchParams.get('contextType') ? {
 type: searchParams.get('contextType') as any,
 id: searchParams.get('contextId') || '',
 label: searchParams.get('contextLabel') || ''
 } : null
 );
 const scrollRef = useRef<HTMLDivElement>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);

 // Advanced features state
 const [searchTerm, setSearchTerm] = useState('');
 const [filterUnread, setFilterUnread] = useState(false);
 const [pinnedSellers, setPinnedSellers] = useState<Set<string>>(new Set());
 const [magicMode, setMagicMode] = useState(false);
 const [isPolishing, setIsPolishing] = useState(false);
 const [magicTone, setMagicTone] = useState<'professional' | 'persuasive' | 'friendly'>('professional');

 const [reportingUser, setReportingUser] = useState<string | null>(null);
 const [reportReason, setReportReason] = useState('Spam');
 const [reportDetails, setReportDetails] = useState('');
 const [viewingProfile, setViewingProfile] = useState<any | null>(null);
 const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
 const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
 const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
 const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
 const [attachment, setAttachment] = useState<{ url: string, type: 'image' | 'file' } | null>(null);
 const [contextProduct, setContextProduct] = useState<Product | null>(null);
 const [contextOrder, setContextOrder] = useState<Order | null>(null);
 const [isUploading, setIsUploading] = useState(false);

 useEffect(() => {
 if (!user) return;
 const load = async () => {
 console.log('BuyerMessages: Loading messages for userId:', userId);
 const msgs = await fetchMessages();
 console.log('BuyerMessages: Fetched messages:', msgs);
 setChats(msgs);
 };
 load();
 const channel = supabase.channel('messages_channel')
 .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
 if(payload.new.receiver_id === userId || payload.new.sender_id === userId) load();
 })
 .subscribe();
 return () => { supabase.removeChannel(channel); };
 }, [userId, initialSellerId, user]);

 useEffect(() => {
 if (context?.type === 'product' && context.id) {
 supabase.from('products').select('*').eq('id', context.id).single().then(({ data }) => { if (data) setContextProduct(data); });
 }
 if (context?.type === 'order' && context.id) {
 supabase.from('orders').select('*').eq('id', context.id).single().then(({ data }) => { if (data) {
 setContextOrder(data);
 setMsgText(`Hi, I have a question regarding order #${context.id.slice(0,8)}`);
 }});
 }
 }, [context]);

 const vendorList = useMemo(() => {
 const map = new Map();
 chats.forEach(c => {
 const isMe = c.sender_id === userId;
 const otherId = isMe ? c.receiver_id : c.sender_id;
 const partnerProfile = isMe ? c.receiver : c.sender;
 
 if (!map.has(otherId)) {
 map.set(otherId, { 
 seller_id: otherId, 
 store_name: partnerProfile?.full_name || 'User',
 logo_url: partnerProfile?.avatar_url,
 is_verified: false // Simplified
 });
 }
 });
 
 let list = Array.from(map.values()) as VendorProfile[];
 
 if (searchTerm) {
 list = list.filter(v => v.store_name.toLowerCase().includes(searchTerm.toLowerCase()));
 }
 
 return list.sort((a, b) => {
 if (pinnedSellers.has(a.seller_id) && !pinnedSellers.has(b.seller_id)) return -1;
 if (!pinnedSellers.has(a.seller_id) && pinnedSellers.has(b.seller_id)) return 1;
 return 0;
 });
 }, [chats, userId, searchTerm, pinnedSellers]);

 const activeMessages = useMemo(() => {
 return chats.filter(c => c.sender_id === selectedSeller || c.receiver_id === selectedSeller)
 .sort((a,b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime());
 }, [chats, selectedSeller]);

 const handleSend = async (e?: React.FormEvent, textOverride?: string) => {
 if (e) e.preventDefault();
 const text = textOverride || msgText;
 if (!selectedSeller || (!text.trim() && !attachment)) return;
 
 setMsgText('');
 setReplyingTo(null);
 setAttachment(null);
 setMagicMode(false);
 
 await sendMessage(selectedSeller as string, text, contextProduct?.id, contextOrder?.id, attachment || undefined, replyingTo?.id);
 };

 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file || !user) return;

 setIsUploading(true);
 try {
 const fileExt = file.name.split('.').pop();
 const fileName = `${Math.random()}.${fileExt}`;
 const filePath = `chat-attachments/${user.id}/${fileName}`;

 const { error: uploadError } = await supabase.storage
 .from('mali-mart-uploads')
 .upload(filePath, file);

 if (uploadError) throw uploadError;

 const { data: { publicUrl } } = supabase.storage
 .from('mali-mart-uploads')
 .getPublicUrl(filePath);

 setAttachment({
 url: publicUrl,
 type: file.type.startsWith('image/') ? 'image' : 'file'
 });
 addToast("File uploaded", "success");
 } catch (error) {
 addToast("Upload failed", "error");
 } finally {
 setIsUploading(false);
 }
 };

 const handleMagicPolish = async () => {
 if (!msgText.trim()) return;
 setIsPolishing(true);
 const refined = await aiService.refineMessage(msgText, magicTone);
 setMsgText(refined);
 setIsPolishing(false);
 addToast("Draft Polished by AI", "success");
 };

 const togglePin = (e: React.MouseEvent, id: string) => {
 e.stopPropagation();
 const newPinned = new Set(pinnedSellers);
 if (newPinned.has(id)) newPinned.delete(id);
 else newPinned.add(id);
 setPinnedSellers(newPinned);
 };

 const handleReport = async () => {
 if (!reportingUser || !user) return;
 
 // Check if user is admin
 const { data: profile } = await supabase.from('profiles').select('role').eq('id', reportingUser).single();
 if (profile?.role === 'admin') {
 addToast("Cannot report or block an administrator", "error");
 setReportingUser(null);
 return;
 }

 await reportUser(reportingUser, reportReason, reportDetails);
 addToast("User reported successfully", "success");
 setReportingUser(null);
 setReportReason('Spam');
 setReportDetails('');
 };

 const fetchUserProfile = async (userId: string) => {
 const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
 if (data) {
 setViewingProfile({
 id: data.id,
 name: data.full_name || 'User',
 avatar: data.avatar_url,
 role: data.role,
 created_at: data.created_at,
 region: data.region,
 trust_score: data.trust_score,
 is_verified: data.is_verified
 });
 }
 };

 useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeMessages, magicMode]);

 const currentVendor = selectedSeller ? vendorList.find(v => v.seller_id === selectedSeller) : null;

 return (
 <MessageContainer>
 <SidebarContainer isVisible={!!selectedSeller}>
 <div className="p-4 border-b border-foreground/8 flex flex-col gap-3">
 <h3 className="font-black uppercase tracking-widest text-sm text-foreground">Conversations</h3>
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
 <Input 
 placeholder="Search sellers..." 
 value={searchTerm}
 onChange={(e: any) => setSearchTerm(e.target.value)}
 className="h-9 pl-9 text-xs rounded-xl bg-foreground/[0.02] dark:bg-background/5 border-transparent"
 />
 </div>
 </div>
 <div className="flex-1 overflow-y-auto p-2 space-y-1">
 {vendorList.map(v => (
 <button key={v.seller_id} onClick={() => setSelectedSeller(v.seller_id)} className={`w-full text-left p-4 rounded-2xl transition-all group relative ${selectedSeller === v.seller_id ? 'bg-foreground text-background' : 'hover:bg-foreground/[0.02] /5 text-foreground/65'}`}>
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-foreground/[0.08] overflow-hidden shrink-0">
 <img src={v.logo_url || `https://ui-avatars.com/api/?name=${v.store_name}`} className="w-full h-full object-cover" />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <p className={`font-black uppercase text-xs truncate ${selectedSeller === v.seller_id ? 'text-white' : 'text-foreground'}`}>{v.store_name}</p>
 {v.is_verified && <BadgeCheck className="w-3 h-3 text-emerald-500" />}
 {pinnedSellers.has(v.seller_id) && <Pin className="w-3 h-3 text-emerald-500" />}
 </div>
 <p className="text-[10px] opacity-80 truncate">{v.region}</p>
 </div>
 </div>
 <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
 <div onClick={(e) => togglePin(e, v.seller_id)} className="p-1.5 bg-foreground/10 backdrop-blur rounded-full hover:bg-foreground/15 text-foreground/55 cursor-pointer">
 <Pin className="w-3 h-3" />
 </div>
 </div>
 </button>
 ))}
 </div>
 </SidebarContainer>
 <ChatAreaContainer isVisible={!selectedSeller}>
 {!selectedSeller ? (
 <div className="flex-1 flex flex-col items-center justify-center text-foreground/40">
 <MessageSquare className="w-16 h-16 opacity-10 mb-3" />
 <p className="text-[10px] font-black uppercase tracking-widest">Select a Seller to Chat</p>
 </div>
 ) : (
 <>
 <div className="p-4 border-b border-foreground/5 flex items-center gap-3">
 <button onClick={() => setSelectedSeller(null)} className="md:hidden p-2 bg-foreground/[0.02] rounded-xl"><ChevronLeft className="w-4 h-4" /></button>
 <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => fetchUserProfile(selectedSeller || '')}>
 <div className="w-10 h-10 rounded-full bg-foreground/[0.08] overflow-hidden">
 <img src={currentVendor?.logo_url || `https://ui-avatars.com/api/?name=${currentVendor?.store_name}`} className="w-full h-full object-cover" />
 </div>
 <div className="flex items-center gap-2">
 <p className="font-black text-sm text-foreground uppercase">{currentVendor?.store_name}</p>
 {currentVendor?.is_verified && <BadgeCheck className="w-4 h-4 text-emerald-500" />}
 </div>
 </div>
 </div>
 <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-foreground/[0.02]/30 dark:bg-black/20">
 {activeMessages.map(c => (
 <div key={c.id} className={`flex flex-col ${c.sender_id === userId ? 'items-end' : 'items-start'} group animate-in slide-in-from-bottom-2`}>
 {c.reply_to && (
 <div className="mb-1 p-2 bg-foreground/[0.04] border-l-2 border-foreground/25 text-[9px] opacity-60 max-w-[70%] truncate rounded-lg">
 {c.reply_to.text || c.reply_to.body}
 </div>
 )}

 <ProductOrderTag 
 product={c.product} 
 order={c.order} 
 onViewProduct={setViewingProduct} 
 onViewOrder={setViewingOrder} 
 />

 <div className={`p-4 rounded-2xl text-[11px] font-medium shadow-sm max-w-[85%] relative ${c.sender_id === userId ? 'bg-foreground text-background rounded-tr-none' : 'bg-card text-foreground rounded-tl-none'}`}>
 {c.attachment_url && (
 <div className="mb-2">
 {c.attachment_type === 'image' ? (
 <img src={c.attachment_url} alt="Attachment" className="max-w-full h-auto rounded-lg border border-foreground/8 " />
 ) : (
 <a href={c.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-foreground/[0.02] rounded-lg border border-foreground/8 hover:bg-foreground/[0.05] transition-colors">
 <Paperclip className="w-3 h-3" />
 <span className="text-[9px] uppercase tracking-wider">View Attachment</span>
 </a>
 )}
 </div>
 )}
 {c.body}
 <div className="flex items-center gap-2 mt-1 opacity-40 text-[8px] uppercase tracking-widest">
 <span>{c.sender?.full_name || 'User'}</span>
 <span>•</span>
 <span>{c.created_at ? new Date(c.created_at).toLocaleDateString() + ' ' + new Date(c.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}</span>
 </div>

 {/* Reactions Display */}
 {c.reactions && c.reactions.length > 0 && (
 <div className="flex flex-wrap gap-1 mt-2">
 {Object.entries(
 c.reactions.reduce((acc: any, r: any) => {
 acc[r.emoji] = (acc[r.emoji] || 0) + 1;
 return acc;
 }, {})
 ).map(([emoji, count]: [string, any]) => (
 <span key={emoji} className="px-1.5 py-0.5 bg-foreground/[0.05] dark:bg-slate-700 rounded-full text-[9px] flex items-center gap-1">
 {emoji} {count}
 </span>
 ))}
 </div>
 )}

 <div className={`absolute ${c.sender_id === userId ? '-left-20' : '-right-20'} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity`}>
 <button onClick={() => setReplyingTo(c)} className="p-1.5 hover:text-emerald-500 text-foreground/40 transition-colors" title="Reply">
 <Reply className="w-3.5 h-3.5" />
 </button>
 <button onClick={() => setShowEmojiPicker(showEmojiPicker === c.id ? null : c.id)} className="p-1.5 hover:text-emerald-500 text-foreground/40 transition-colors" title="React">
 <Smile className="w-3.5 h-3.5" />
 </button>
 {c.sender_id === userId && (
 <button onClick={async () => { await softDeleteMessage(c.id); const msgs = await fetchMessages(); setChats(msgs); }} className="p-1.5 hover:text-red-500 text-foreground/40 transition-colors" title="Delete">
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 )}
 {c.sender_id !== userId && (
 <button onClick={() => setReportingUser(c.sender_id)} className="p-1.5 hover:text-red-500 text-foreground/40 transition-colors" title="Report">
 <ShieldAlert className="w-3.5 h-3.5" />
 </button>
 )}
 </div>

 {/* Emoji Picker Popover */}
 {showEmojiPicker === c.id && (
 <div className="absolute bottom-full mb-2 bg-card border border-foreground/8 p-2 rounded-xl flex gap-2 z-50 shadow-xl">
 {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
 <button 
 key={emoji} 
 onClick={() => {
 addReaction(c.id, emoji);
 setShowEmojiPicker(null);
 fetchMessages().then(setChats);
 }}
 className="hover:scale-125 transition-transform p-1"
 >
 {emoji}
 </button>
 ))}
 </div>
 )}
 </div>
 </div>
 ))}
 <div ref={scrollRef} />
 </div>
 <div className="p-4 bg-card border-t flex flex-col gap-2">
 {replyingTo && (
 <div className="mb-2 p-3 bg-foreground/[0.02] dark:bg-slate-800 rounded-xl border border-foreground/8 flex items-center justify-between">
 <div className="flex flex-col gap-1">
 <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Replying to</span>
 <p className="text-[11px] italic truncate max-w-md">"{replyingTo.text || replyingTo.body}"</p>
 </div>
 <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"><X className="w-3 h-3"/></button>
 </div>
 )}

 {attachment && (
 <div className="mb-2 p-3 bg-foreground/[0.02] dark:bg-slate-800 rounded-xl border border-foreground/8 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Paperclip className="w-4 h-4 text-emerald-500" />
 <span className="text-[10px] font-black uppercase tracking-widest">{attachment.type === 'image' ? 'Image Attachment' : 'File Attachment'}</span>
 </div>
 <button onClick={() => setAttachment(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"><X className="w-3 h-3"/></button>
 </div>
 )}
 {(contextProduct || contextOrder) && (
 <ProductOrderTag 
 product={contextProduct} 
 order={contextOrder} 
 onViewProduct={setViewingProduct} 
 onViewOrder={setViewingOrder} 
 />
 )}
 {magicMode && (
 <div className="mb-3 animate-in slide-in-from-bottom-2 fade-in bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/20">
 <div className="flex items-center justify-between mb-2">
 <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex items-center gap-2"><Sparkles className="w-3 h-3"/> Magic Compose</span>
 <button onClick={() => setMagicMode(false)} className="p-1 hover:bg-emerald-200/50 dark:hover:bg-emerald-900/30 rounded-full"><X className="w-3 h-3 text-emerald-700 dark:text-emerald-400"/></button>
 </div>
 <div className="flex gap-2">
 {(['professional', 'persuasive', 'friendly'] as const).map(tone => (
 <button 
 key={tone}
 onClick={() => setMagicTone(tone)} 
 className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all border ${magicTone === tone ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-background dark:bg-black/20 text-emerald-700 dark:text-emerald-300 border-transparent hover:border-emerald-300'}`}
 >
 {tone}
 </button>
 ))}
 </div>
 </div>
 )}
 <form onSubmit={handleSend} className="flex gap-2">
 <Input placeholder="Type message..." value={msgText} onChange={(e:any) => setMsgText(e.target.value)} className="h-12 bg-foreground/[0.02] dark:bg-slate-800 border-none rounded-xl" />
 <div className="flex gap-1 items-center">
 <input 
 type="file" 
 ref={fileInputRef} 
 onChange={handleFileUpload} 
 className="hidden" 
 accept="image/*,.pdf,.doc,.docx"
 />
 <button 
 type="button" 
 onClick={() => fileInputRef.current?.click()} 
 className={`p-3 rounded-xl transition-all ${attachment ? 'text-emerald-500 bg-emerald-50' : 'text-foreground/40 hover:bg-foreground/[0.02] hover:text-emerald-500'}`}
 disabled={isUploading}
 >
 {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
 </button>
 <button type="button" onClick={() => magicMode ? handleMagicPolish() : setMagicMode(true)} className={`p-3 rounded-xl transition-all ${magicMode ? 'bg-emerald-500 text-white shadow-lg' : 'text-foreground/40 hover:bg-emerald-50 hover:text-emerald-500'}`} title="Magic Compose">
 {isPolishing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4"/>}
 </button>
 </div>
 <Button type="submit" variant="brand" className="h-12 w-12 p-0 rounded-xl flex-shrink-0"><Send className="w-5 h-5" /></Button>
 </form>
 </div>
 
 {/* User Profile Modal */}
 <UserProfileModal 
 isOpen={!!viewingProfile} 
 onClose={() => setViewingProfile(null)} 
 user={viewingProfile} 
 />

 <ProductModal 
 isOpen={!!viewingProduct} 
 onClose={() => setViewingProduct(null)} 
 product={viewingProduct} 
 />

 <OrderDetailsModal 
 isOpen={!!viewingOrder} 
 onClose={() => setViewingOrder(null)} 
 order={viewingOrder} 
 />

 {/* Reporting Modal */}
 {reportingUser && (
 <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
 <div className="bg-background dark:bg-background border border-foreground/10 dark:border-background/10 w-full max-w-md p-8 shadow-2xl">
 <h3 className="text-2xl font-serif font-light mb-6">Report User</h3>
 <div className="space-y-6">
 <div className="space-y-2">
 <label className="text-[10px] uppercase tracking-[0.2em] opacity-60">Reason</label>
 <select 
 value={reportReason} 
 onChange={(e) => setReportReason(e.target.value)}
 className="w-full h-12 bg-transparent border border-foreground/10 dark:border-background/10 px-4 text-sm focus:outline-none focus:border-foreground dark:focus:border-background transition-colors"
 >
 <option value="Spam">Spam</option>
 <option value="Harassment">Harassment</option>
 <option value="Inappropriate Content">Inappropriate Content</option>
 <option value="Fraud/Scam">Fraud/Scam</option>
 <option value="Other">Other</option>
 </select>
 </div>
 <div className="space-y-2">
 <label className="text-[10px] uppercase tracking-[0.2em] opacity-60">Details</label>
 <textarea 
 value={reportDetails}
 onChange={(e) => setReportDetails(e.target.value)}
 placeholder="Please provide more information..."
 className="w-full h-32 bg-transparent border border-foreground/10 dark:border-background/10 p-4 text-sm focus:outline-none focus:border-foreground dark:focus:border-background transition-colors resize-none"
 />
 </div>
 <div className="flex gap-4 pt-4">
 <Button variant="secondary" onClick={() => setReportingUser(null)} className="flex-1">Cancel</Button>
 <Button variant="primary" onClick={handleReport} className="flex-1">Submit Report</Button>
 </div>
 </div>
 </div>
 </div>
 )}
 </>
 )}
 </ChatAreaContainer>
 <DetailsAreaContainer isVisible={!!selectedSeller}>
 <div className="p-6">
 <h4 className="font-black text-xs uppercase tracking-widest text-foreground/40 mb-4">Seller Info</h4>
 {currentVendor && (
 <div className="space-y-4">
 <div className="w-20 h-20 rounded-full bg-foreground/[0.08] overflow-hidden">
 <img src={currentVendor.logo_url || `https://ui-avatars.com/api/?name=${currentVendor.store_name}`} className="w-full h-full object-cover" />
 </div>
 <p className="font-black text-sm">{currentVendor.store_name}</p>
 <p className="text-xs text-foreground/55">{currentVendor.region}</p>
 </div>
 )}
 </div>
 </DetailsAreaContainer>
 </MessageContainer>
 );
};
