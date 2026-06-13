import { rateLimit } from '../src/security';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, ChevronLeft, BadgeCheck, Send, Search, Trash2, Sparkles, Wand2, Loader2, X, Smile, Reply, Paperclip, ShieldAlert, Ban, MoreVertical } from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { Button, Input, useToast, ConfirmDialog, UserProfileModal } from './UI';
import { ProductModal } from './ProductModal';
import { OrderDetailsModal } from './OrderDetailsModal';
import { supabase } from '../services/supabaseClient';
import { compressImage, IMMUTABLE_CACHE } from '../services/imageCompression';
import { VendorProfile, ChatMessage, Product, Order } from '../types';
import { SidebarContainer, ChatAreaContainer, DetailsAreaContainer } from './MessageShared';
import { ConversationListItem, ChatEmptyState, DayDivider, isSameDay } from './messaging/ConversationKit';
import { ProductOrderTag } from './SellerMessages';
import * as aiService from '../services/geminiService';

const PIN_KEY = 'malimart_pinned_chats';

export const BuyerMessages = ({ userId, initialSellerId }: { userId: string, initialSellerId?: string | null }) => {
 const { fetchMessages, sendMessage, softDeleteMessage, reportUser, addReaction, markMessagesAsRead, blockUser, blockedUsers, user } = useAppState();
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

 // List controls
 const [searchTerm, setSearchTerm] = useState('');
 const [filterUnread, setFilterUnread] = useState(false);
 const [pinnedSellers, setPinnedSellers] = useState<Set<string>>(() => {
 try { return new Set(JSON.parse(localStorage.getItem(PIN_KEY) || '[]')); } catch { return new Set(); }
 });

 // Composer extras
 const [magicMode, setMagicMode] = useState(false);
 const [isPolishing, setIsPolishing] = useState(false);
 const [magicTone, setMagicTone] = useState<'professional' | 'persuasive' | 'friendly'>('professional');
 const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
 const [attachment, setAttachment] = useState<{ url: string, type: 'image' | 'file' } | null>(null);
 const [isUploading, setIsUploading] = useState(false);

 // Modals / actions
 const [reportingUser, setReportingUser] = useState<string | null>(null);
 const [reportReason, setReportReason] = useState('Spam');
 const [reportDetails, setReportDetails] = useState('');
 const [viewingProfile, setViewingProfile] = useState<any | null>(null);
 const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
 const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
 const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
 const [confirmAction, setConfirmAction] = useState<{ type: 'delete-chat' | 'block', targetId: string } | null>(null);
 const [chatMenuOpen, setChatMenuOpen] = useState(false);
 const [contextProduct, setContextProduct] = useState<Product | null>(null);
 const [contextOrder, setContextOrder] = useState<Order | null>(null);

 useEffect(() => {
 if (!user) return;
 const load = async () => {
 const msgs = await fetchMessages();
 setChats(msgs.filter(m => !blockedUsers.has(m.sender_id) && !blockedUsers.has(m.receiver_id)));
 };
 load();
const channel = supabase.channel(`msgs-${userId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, () => load())
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${userId}` }, () => load())
          .subscribe();
 return () => { supabase.removeChannel(channel); };
 }, [userId, initialSellerId, user, blockedUsers]);

 // Opening a conversation marks it read
 useEffect(() => {
 if (!selectedSeller) return;
 markMessagesAsRead(selectedSeller);
 setChats(prev => prev.map(c =>
 c.sender_id === selectedSeller && c.receiver_id === userId ? { ...c, read: true } : c
 ));
 }, [selectedSeller]);

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

 // Conversations: one per partner, with last message + unread count, recency-sorted
 const vendorList = useMemo(() => {
 const map = new Map<string, VendorProfile & { lastMessage?: string; lastMessageAt?: string; unreadCount: number }>();
 const sorted = [...chats].sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime());
 sorted.forEach(c => {
 const isMe = c.sender_id === userId;
 const otherId = isMe ? c.receiver_id : c.sender_id;
 const partnerProfile = isMe ? c.receiver : c.sender;
 if (!map.has(otherId)) {
 map.set(otherId, {
 seller_id: otherId,
 store_name: partnerProfile?.full_name || 'User',
 logo_url: partnerProfile?.avatar_url,
 is_verified: false,
 lastMessage: c.deleted_at ? 'Message deleted' : (c.attachment_url && !c.body ? '📎 Attachment' : (c.body || c.text)),
 lastMessageAt: c.created_at,
 unreadCount: 0,
 } as any);
 }
 if (!isMe && !c.read) {
 const entry = map.get(otherId)!;
 entry.unreadCount += 1;
 }
 });

 let list = Array.from(map.values());
 if (searchTerm) list = list.filter(v => v.store_name.toLowerCase().includes(searchTerm.toLowerCase()));
 if (filterUnread) list = list.filter(v => v.unreadCount > 0);

 return list.sort((a, b) => {
 const ap = pinnedSellers.has(a.seller_id) ? 1 : 0;
 const bp = pinnedSellers.has(b.seller_id) ? 1 : 0;
 if (ap !== bp) return bp - ap;
 return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
 });
 }, [chats, userId, searchTerm, filterUnread, pinnedSellers]);

 const totalUnread = useMemo(
 () => chats.filter(c => c.receiver_id === userId && !c.read).length,
 [chats, userId]
 );

 const activeMessages = useMemo(() => {
 return chats.filter(c => c.sender_id === selectedSeller || c.receiver_id === selectedSeller)
 .sort((a,b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime());
 }, [chats, selectedSeller]);

 const handleSend = async (e?: React.FormEvent, textOverride?: string) => {
 if (!rateLimit("send_message", 15)) { addToast("Slow down", "error"); return; }
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
 .upload(filePath, await compressImage(file), { cacheControl: IMMUTABLE_CACHE });
 if (uploadError) throw uploadError;
 const { data: { publicUrl } } = supabase.storage.from('mali-mart-uploads').getPublicUrl(filePath);
 setAttachment({ url: publicUrl, type: file.type.startsWith('image/') ? 'image' : 'file' });
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
 addToast("Draft polished", "success");
 };

 const togglePin = (e: React.MouseEvent, id: string) => {
 e.stopPropagation();
 setPinnedSellers(prev => {
 const next = new Set(prev);
 next.has(id) ? next.delete(id) : next.add(id);
 try { localStorage.setItem(PIN_KEY, JSON.stringify([...next])); } catch {}
 return next;
 });
 };

 const handleReport = async () => {
 if (!reportingUser || !user) return;
 const { data: profile } = await supabase.from('profiles').select('role').eq('id', reportingUser).single();
 if (profile?.role === 'admin') {
 addToast("Cannot report or block an administrator", "error");
 setReportingUser(null);
 return;
 }
 await reportUser(reportingUser, reportReason, reportDetails);
 addToast("User reported", "success");
 setReportingUser(null);
 setReportReason('Spam');
 setReportDetails('');
 };

 // Delete chat = soft-delete every message you sent in this thread.
 // The other person keeps their copy; your side shows it as removed.
 const handleDeleteChat = async (partnerId: string) => {
 const mine = chats.filter(c => c.sender_id === userId && (c.receiver_id === partnerId || c.sender_id === partnerId));
 for (const m of mine) { await softDeleteMessage(m.id); }
 const msgs = await fetchMessages();
 setChats(msgs.filter(m => !blockedUsers.has(m.sender_id) && !blockedUsers.has(m.receiver_id)));
 setSelectedSeller(null);
 addToast("Chat deleted", "success");
 };

 const handleBlock = async (partnerId: string) => {
 const { data: profile } = await supabase.from('profiles').select('role').eq('id', partnerId).single();
 if (profile?.role === 'admin') { addToast("Cannot block an administrator", "error"); return; }
 await blockUser(partnerId);
 setSelectedSeller(null);
 addToast("User blocked", "success");
 };

 const fetchUserProfile = async (uid: string) => {
 const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
 if (data) {
 setViewingProfile({
 id: data.id, name: data.full_name || 'User', avatar: data.avatar_url, role: data.role,
 created_at: data.created_at, region: data.region, trust_score: data.trust_score, is_verified: data.is_verified
 });
 }
 };

 useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeMessages, magicMode]);

 const currentVendor = selectedSeller ? vendorList.find(v => v.seller_id === selectedSeller) : null;

 return (
 <div className="grid grid-cols-1 md:grid-cols-12 gap-0 h-full overflow-hidden bg-background">
 <SidebarContainer isVisible={!!selectedSeller}>
 <div className="p-4 border-b border-foreground/8 flex flex-col gap-3">
 <div className="flex items-center justify-between">
 <h3 className="font-bold text-sm text-foreground">Conversations</h3>
 <button
 onClick={() => setFilterUnread(v => !v)}
 className={`h-7 px-2.5 rounded-full text-[10px] font-bold transition-colors ${filterUnread ? 'bg-foreground text-background' : 'bg-foreground/[0.05] text-foreground/50 hover:text-foreground'}`}
 >
 Unread{totalUnread > 0 ? ` · ${totalUnread}` : ''}
 </button>
 </div>
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
 <Input
 placeholder="Search conversations…"
 value={searchTerm}
 onChange={(e: any) => setSearchTerm(e.target.value)}
 className="h-9 pl-9 text-xs rounded-xl bg-foreground/[0.03] border-transparent"
 />
 </div>
 </div>
 <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
 {vendorList.length === 0 ? (
 <div className="py-12 px-4 text-center text-foreground/35">
 <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20"/>
 <p className="text-xs font-semibold">{filterUnread ? 'No unread messages' : searchTerm ? 'No matches' : 'No conversations yet'}</p>
 {!filterUnread && !searchTerm && <p className="text-[11px] mt-1">Message a seller from any product page.</p>}
 </div>
 ) : vendorList.map(v => (
 <ConversationListItem
 key={v.seller_id}
 item={{
 id: v.seller_id,
 name: v.store_name,
 avatarUrl: v.logo_url,
 isVerified: v.is_verified,
 lastMessage: (v as any).lastMessage,
 lastMessageAt: (v as any).lastMessageAt,
 unreadCount: (v as any).unreadCount,
 }}
 selected={selectedSeller === v.seller_id}
 pinned={pinnedSellers.has(v.seller_id)}
 onSelect={() => setSelectedSeller(v.seller_id)}
 onTogglePin={(e) => togglePin(e, v.seller_id)}
 />
 ))}
 </div>
 </SidebarContainer>

 <ChatAreaContainer isVisible={!selectedSeller}>
 {!selectedSeller ? (
 <ChatEmptyState title="Select a conversation" hint="Your chats with sellers about products and orders live here." />
 ) : (
 <>
 {/* Chat header */}
 <div className="p-4 border-b border-foreground/8 flex items-center gap-3">
 <button onClick={() => setSelectedSeller(null)} aria-label="Back" className="md:hidden p-2 bg-foreground/[0.04] rounded-xl"><ChevronLeft className="w-4 h-4" /></button>
 <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity flex-1 min-w-0" onClick={() => fetchUserProfile(selectedSeller || '')}>
 <div className="w-10 h-10 rounded-full bg-foreground/[0.08] overflow-hidden shrink-0">
 <img src={currentVendor?.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentVendor?.store_name || 'S')}`} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
 </div>
 <div className="flex items-center gap-2 min-w-0">
 <p className="font-bold text-sm text-foreground truncate">{currentVendor?.store_name}</p>
 {currentVendor?.is_verified && <BadgeCheck className="w-4 h-4 text-emerald-500 shrink-0" />}
 </div>
 </div>
 {/* Chat actions */}
 <div className="relative">
 <button onClick={() => setChatMenuOpen(o => !o)} aria-label="Chat options" className="p-2 rounded-xl hover:bg-foreground/[0.05] text-foreground/50 hover:text-foreground transition-colors">
 <MoreVertical className="w-4 h-4"/>
 </button>
 {chatMenuOpen && (
 <>
 <div className="fixed inset-0 z-40" onClick={() => setChatMenuOpen(false)}/>
 <div className="absolute right-0 top-full mt-1 w-48 bg-background border border-foreground/10 rounded-2xl shadow-xl p-1.5 z-50">
 <button onClick={() => { setChatMenuOpen(false); setReportingUser(selectedSeller); }}
 className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left text-xs font-semibold text-foreground/70 hover:bg-foreground/[0.05] transition-colors">
 <ShieldAlert className="w-3.5 h-3.5"/> Report user
 </button>
 <button onClick={() => { setChatMenuOpen(false); setConfirmAction({ type: 'block', targetId: selectedSeller }); }}
 className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left text-xs font-semibold text-foreground/70 hover:bg-foreground/[0.05] transition-colors">
 <Ban className="w-3.5 h-3.5"/> Block user
 </button>
 <button onClick={() => { setChatMenuOpen(false); setConfirmAction({ type: 'delete-chat', targetId: selectedSeller }); }}
 className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left text-xs font-semibold text-rose-500 hover:bg-rose-500/8 transition-colors">
 <Trash2 className="w-3.5 h-3.5"/> Delete chat
 </button>
 </div>
 </>
 )}
 </div>
 </div>

 {/* Messages */}
 <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar bg-foreground/[0.015]">
 {activeMessages.map((c, idx) => {
 const prev = activeMessages[idx - 1];
 const showDay = !prev || !isSameDay(new Date(prev.created_at!), new Date(c.created_at!));
 const mine = c.sender_id === userId;
 return (
 <React.Fragment key={c.id}>
 {showDay && c.created_at && <DayDivider date={new Date(c.created_at)} />}
 <div className={`flex flex-col mb-3 ${mine ? 'items-end' : 'items-start'} group animate-in slide-in-from-bottom-2`}>
 {c.reply_to && (
 <div className="mb-1 p-2 bg-foreground/[0.04] border-l-2 border-foreground/25 text-[10px] opacity-60 max-w-[70%] truncate rounded-lg">
 {c.reply_to.text || c.reply_to.body}
 </div>
 )}

 <ProductOrderTag product={c.product} order={c.order} onViewProduct={setViewingProduct} onViewOrder={setViewingOrder} />

 <div className={`px-4 py-3 rounded-2xl text-[12px] font-medium shadow-sm max-w-[85%] relative ${mine ? 'bg-foreground text-background rounded-tr-md' : 'bg-card text-foreground rounded-tl-md border border-foreground/6'}`}>
 {c.deleted_at ? (
 <span className="italic opacity-50">Message deleted</span>
 ) : (
 <>
 {c.attachment_url && (
 <div className="mb-2">
 {c.attachment_type === 'image' ? (
 <img src={c.attachment_url} alt="Attachment" className="max-w-full h-auto rounded-lg border border-foreground/8" loading="lazy" decoding="async" />
 ) : (
 <a href={c.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-foreground/[0.04] rounded-lg border border-foreground/8 hover:bg-foreground/[0.07] transition-colors">
 <Paperclip className="w-3 h-3" />
 <span className="text-[10px] font-semibold">View attachment</span>
 </a>
 )}
 </div>
 )}
 {c.body}
 </>
 )}
 <div className="mt-1 opacity-40 text-[9px]">
 {c.created_at ? new Date(c.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}
 </div>

 {c.reactions && c.reactions.length > 0 && (
 <div className="flex flex-wrap gap-1 mt-2">
 {Object.entries(
 c.reactions.reduce((acc: any, r: any) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {})
 ).map(([emoji, count]: [string, any]) => (
 <span key={emoji} className="px-1.5 py-0.5 bg-foreground/[0.05] rounded-full text-[10px] flex items-center gap-1">{emoji} {count}</span>
 ))}
 </div>
 )}

 {!c.deleted_at && (
 <div className={`absolute ${mine ? '-left-20' : '-right-20'} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity`}>
 <button onClick={() => setReplyingTo(c)} className="p-1.5 hover:text-emerald-500 text-foreground/40 transition-colors" title="Reply"><Reply className="w-3.5 h-3.5" /></button>
 <button onClick={() => setShowEmojiPicker(showEmojiPicker === c.id ? null : c.id)} className="p-1.5 hover:text-emerald-500 text-foreground/40 transition-colors" title="React"><Smile className="w-3.5 h-3.5" /></button>
 {mine ? (
 <button onClick={async () => { await softDeleteMessage(c.id); const msgs = await fetchMessages(); setChats(msgs); }} className="p-1.5 hover:text-red-500 text-foreground/40 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
 ) : (
 <button onClick={() => setReportingUser(c.sender_id)} className="p-1.5 hover:text-red-500 text-foreground/40 transition-colors" title="Report"><ShieldAlert className="w-3.5 h-3.5" /></button>
 )}
 </div>
 )}

 {showEmojiPicker === c.id && (
 <div className="absolute bottom-full mb-2 bg-card border border-foreground/8 p-2 rounded-xl flex gap-2 z-50 shadow-xl">
 {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
 <button key={emoji} onClick={() => { addReaction(c.id, emoji); setShowEmojiPicker(null); fetchMessages().then(setChats); }} className="hover:scale-125 transition-transform p-1">{emoji}</button>
 ))}
 </div>
 )}
 </div>
 </div>
 </React.Fragment>
 );
 })}
 <div ref={scrollRef} />
 </div>

 {/* Composer */}
 <div className="p-4 bg-card border-t border-foreground/8 flex flex-col gap-2">
 {replyingTo && (
 <div className="p-3 bg-foreground/[0.03] rounded-xl border border-foreground/8 flex items-center justify-between">
 <div className="flex flex-col gap-0.5 min-w-0">
 <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">Replying to</span>
 <p className="text-[11px] italic truncate max-w-md">"{replyingTo.text || replyingTo.body}"</p>
 </div>
 <button onClick={() => setReplyingTo(null)} aria-label="Cancel reply" className="p-1 hover:bg-foreground/[0.08] rounded-full"><X className="w-3 h-3"/></button>
 </div>
 )}
 {attachment && (
 <div className="p-3 bg-foreground/[0.03] rounded-xl border border-foreground/8 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Paperclip className="w-4 h-4 text-emerald-500" />
 <span className="text-[10px] font-bold uppercase tracking-widest">{attachment.type === 'image' ? 'Image attached' : 'File attached'}</span>
 </div>
 <button onClick={() => setAttachment(null)} aria-label="Remove attachment" className="p-1 hover:bg-foreground/[0.08] rounded-full"><X className="w-3 h-3"/></button>
 </div>
 )}
 {(contextProduct || contextOrder) && (
 <ProductOrderTag product={contextProduct} order={contextOrder} onViewProduct={setViewingProduct} onViewOrder={setViewingOrder} />
 )}
 {magicMode && (
 <div className="animate-in slide-in-from-bottom-2 fade-in bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/20">
 <div className="flex items-center justify-between mb-2">
 <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex items-center gap-2"><Sparkles className="w-3 h-3"/> Magic Compose</span>
 <button onClick={() => setMagicMode(false)} className="p-1 hover:bg-emerald-200/50 dark:hover:bg-emerald-900/30 rounded-full"><X className="w-3 h-3 text-emerald-700 dark:text-emerald-400"/></button>
 </div>
 <div className="flex gap-2">
 {(['professional', 'persuasive', 'friendly'] as const).map(tone => (
 <button key={tone} onClick={() => setMagicTone(tone)}
 className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all border ${magicTone === tone ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-background dark:bg-black/20 text-emerald-700 dark:text-emerald-300 border-transparent hover:border-emerald-300'}`}>
 {tone}
 </button>
 ))}
 </div>
 </div>
 )}
 <form onSubmit={handleSend} className="flex gap-2">
 <Input placeholder="Type a message…" value={msgText} onChange={(e:any) => setMsgText(e.target.value)} className="h-12 bg-foreground/[0.03] border-none rounded-xl" />
 <div className="flex gap-1 items-center">
 <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,.pdf,.doc,.docx" />
 <button type="button" onClick={() => fileInputRef.current?.click()}
 className={`p-3 rounded-xl transition-all ${attachment ? 'text-emerald-500 bg-emerald-50' : 'text-foreground/40 hover:bg-foreground/[0.04] hover:text-emerald-500'}`} disabled={isUploading} aria-label="Attach file">
 {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
 </button>
 <button type="button" onClick={() => magicMode ? handleMagicPolish() : setMagicMode(true)}
 className={`p-3 rounded-xl transition-all ${magicMode ? 'bg-emerald-500 text-white shadow-lg' : 'text-foreground/40 hover:bg-emerald-50 hover:text-emerald-500'}`} title="Magic Compose">
 {isPolishing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4"/>}
 </button>
 </div>
 <Button type="submit" variant="brand" className="h-12 w-12 p-0 rounded-xl flex-shrink-0" aria-label="Send message"><Send className="w-5 h-5" /></Button>
 </form>
 </div>

 <UserProfileModal isOpen={!!viewingProfile} onClose={() => setViewingProfile(null)} user={viewingProfile} />
 <ProductModal isOpen={!!viewingProduct} onClose={() => setViewingProduct(null)} product={viewingProduct} />
 <OrderDetailsModal isOpen={!!viewingOrder} onClose={() => setViewingOrder(null)} order={viewingOrder} />

 {/* Report modal */}
 {reportingUser && (
 <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
 <div className="bg-background border border-foreground/10 w-full max-w-md p-6 rounded-3xl shadow-2xl">
 <h3 className="text-xl font-bold tracking-tight mb-5 text-foreground">Report user</h3>
 <div className="space-y-5">
 <div className="space-y-2">
 <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">Reason</label>
 <select value={reportReason} onChange={(e) => setReportReason(e.target.value)}
 className="w-full h-12 bg-foreground/[0.03] border border-foreground/10 rounded-xl px-4 text-sm text-foreground focus:outline-none focus:border-foreground/30 transition-colors">
 <option value="Spam">Spam</option>
 <option value="Harassment">Harassment</option>
 <option value="Inappropriate Content">Inappropriate content</option>
 <option value="Fraud/Scam">Fraud or scam</option>
 <option value="Other">Other</option>
 </select>
 </div>
 <div className="space-y-2">
 <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">Details</label>
 <textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)}
 placeholder="What happened?"
 className="w-full h-28 bg-foreground/[0.03] border border-foreground/10 rounded-xl p-4 text-sm text-foreground focus:outline-none focus:border-foreground/30 transition-colors resize-none" />
 </div>
 <div className="flex gap-3 pt-2">
 <Button variant="secondary" onClick={() => setReportingUser(null)} className="flex-1 rounded-xl">Cancel</Button>
 <Button variant="primary" onClick={handleReport} className="flex-1 rounded-xl">Submit report</Button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Confirm delete chat / block */}
 <ConfirmDialog
 isOpen={!!confirmAction}
 title={confirmAction?.type === 'block' ? 'Block this user?' : 'Delete this chat?'}
 message={confirmAction?.type === 'block'
 ? "They won't be able to message you, and this conversation will be hidden. You can unblock them later from settings."
 : 'Messages you sent in this conversation will be removed on your side. The other person keeps their copy.'}
 confirmText={confirmAction?.type === 'block' ? 'Block' : 'Delete chat'}
 isDangerous
 onCancel={() => setConfirmAction(null)}
 onConfirm={async () => {
 const a = confirmAction; setConfirmAction(null);
 if (!a) return;
 if (a.type === 'block') await handleBlock(a.targetId);
 else await handleDeleteChat(a.targetId);
 }}
 />
 </>
 )}
 </ChatAreaContainer>

 <DetailsAreaContainer isVisible={!!selectedSeller}>
 <div className="p-6">
 <h4 className="font-bold text-[10px] uppercase tracking-widest text-foreground/40 mb-4">Seller info</h4>
 {currentVendor && (
 <div className="space-y-4">
 <div className="w-20 h-20 rounded-full bg-foreground/[0.08] overflow-hidden">
 <img src={currentVendor.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentVendor.store_name)}`} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
 </div>
 <p className="font-bold text-sm text-foreground">{currentVendor.store_name}</p>
 {currentVendor.region && <p className="text-xs text-foreground/55">{currentVendor.region}</p>}
 </div>
 )}
 </div>
 </DetailsAreaContainer>
 </div>
 );
};
