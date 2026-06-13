import { sanitizeText, rateLimit } from '../src/security';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MessageSquare, ChevronLeft, Trash2, Search, Send, User, Sparkles, Wand2, Loader2, Filter, Pin, X, Smile, MoreVertical, Reply, Paperclip, ShieldAlert, Ban, AlertTriangle, Package } from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { Button, Input, useToast, ConfirmDialog, UserProfileModal, GraphicalTag } from './UI';
import { ProductOrderTag } from './SellerMessages';
import { ProductModal } from './ProductModal';
import { OrderDetailsModal } from './OrderDetailsModal';
import { supabase } from '../services/supabaseClient';
import { compressImage, IMMUTABLE_CACHE } from '../services/imageCompression';
import { Product, Order } from '../types';
import * as aiService from '../services/geminiService';
import { MessageContainer, SidebarContainer, ChatAreaContainer } from './MessageShared';

export const AdminMessages = ({ initialSelectedUser }: { initialSelectedUser?: { id: string, name: string, context?: { type: 'order' | 'return' | 'support', id: string, label: string } } | null }) => {
 const { user, fetchMessages, sendMessage, deleteMessage, softDeleteMessage, reportUser, addReaction, removeReaction } = useAppState();
 const { addToast } = useToast();
 const [chats, setChats] = useState<any[]>([]);
 const [selectedChatUser, setSelectedChatUser] = useState<string | null>(initialSelectedUser?.id || null);
 const [activeContext, setActiveContext] = useState<{ type: 'order' | 'return' | 'support', id: string, label: string } | null>(initialSelectedUser?.context || null);
 const [newMsg, setNewMsg] = useState('');
 const [searchTerm, setSearchTerm] = useState('');
 const scrollRef = useRef<HTMLDivElement>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 
 const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
 const [magicMode, setMagicMode] = useState(false);
 const [isPolishing, setIsPolishing] = useState(false);
 const [magicTone, setMagicTone] = useState<'professional' | 'persuasive' | 'friendly'>('professional');
 const [filterUnread, setFilterUnread] = useState(false);
 const [pinnedUsers, setPinnedUsers] = useState<Set<string>>(new Set());

 const [reportingUser, setReportingUser] = useState<string | null>(null);
 const [reportReason, setReportReason] = useState('Spam');
 const [reportDetails, setReportDetails] = useState('');
 const [viewingProfile, setViewingProfile] = useState<any | null>(null);
 const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
 const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
 const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
 const [replyingTo, setReplyingTo] = useState<any | null>(null);
 const [attachment, setAttachment] = useState<{ url: string, type: 'image' | 'file' } | null>(null);
 const [isUploading, setIsUploading] = useState(false);

 const [quickReplies, setQuickReplies] = useState<string[]>([
 "Hello! How can I help you today?",
 "Your issue has been resolved.",
 "Please provide more details.",
 "We are looking into this."
 ]);

 useEffect(() => {
 if (initialSelectedUser) {
 setSelectedChatUser(initialSelectedUser.id);
 if (initialSelectedUser.context) {
 setActiveContext(initialSelectedUser.context);
 }
 }
 }, [initialSelectedUser]);

 useEffect(() => {
 if (!user) return;
 const load = async () => {
 const msgs = await fetchMessages();
 setChats(msgs);
 };
 load();
 const channel = supabase.channel(`msgs-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` }, () => load())
      .subscribe();
 return () => { supabase.removeChannel(channel); };
 }, [user]);

 const activeChats = useMemo(() => {
 if (!selectedChatUser) return [];
 return chats.filter(c => c.sender_id === selectedChatUser || c.receiver_id === selectedChatUser)
 .sort((a,b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime());
 }, [chats, selectedChatUser]);

 const users = useMemo(() => {
 const map = new Map();
 chats.forEach(c => {
 const isMe = c.sender_id === user?.id;
 const otherId = isMe ? c.receiver_id : c.sender_id;
 const partnerProfile = isMe ? c.receiver : c.sender;
 
 if (!map.has(otherId)) {
 map.set(otherId, { 
 id: otherId, 
 name: partnerProfile?.full_name || 'User',
 avatar: partnerProfile?.avatar_url,
 lastMsg: c.text || c.body,
 time: c.created_at,
 unread: !isMe && !c.read
 });
 } else {
 const existing = map.get(otherId);
 if (partnerProfile?.full_name && existing.name === 'User') {
 existing.name = partnerProfile.full_name;
 existing.avatar = partnerProfile.avatar_url;
 }
 if (new Date(c.created_at) > new Date(existing.time)) {
 map.set(otherId, {
 ...existing,
 lastMsg: c.text || c.body,
 time: c.created_at,
 unread: !isMe && !c.read
 });
 }
 }
 });
 
 if (initialSelectedUser && !map.has(initialSelectedUser.id)) {
 map.set(initialSelectedUser.id, {
 id: initialSelectedUser.id,
 name: initialSelectedUser.name,
 avatar: null,
 lastMsg: 'Start a conversation...',
 time: new Date().toISOString(),
 unread: false
 });
 }

 let result = Array.from(map.values());
 
 if (searchTerm) {
 result = result.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.lastMsg.toLowerCase().includes(searchTerm.toLowerCase()));
 }
 if (filterUnread) {
 result = result.filter(u => u.unread);
 }

 return result.sort((a, b) => {
 if (pinnedUsers.has(a.id) && !pinnedUsers.has(b.id)) return -1;
 if (!pinnedUsers.has(a.id) && pinnedUsers.has(b.id)) return 1;
 return new Date(b.time).getTime() - new Date(a.time).getTime();
 });
 }, [chats, user?.id, searchTerm, filterUnread, pinnedUsers]);

 const activeUserData = useMemo(() => {
 if (!selectedChatUser) return null;
 const u = users.find((u: any) => u.id === selectedChatUser);
 return u ? { name: u.name, avatar: u.avatar } : { name: 'User' };
 }, [selectedChatUser, users]);

 useEffect(() => {
 if (activeChats.length > 0) {
 const lastMsg = activeChats[activeChats.length - 1];
 if (lastMsg.sender_id !== user?.id) {
 aiService.generateSellerReplies(lastMsg.text || lastMsg.body).then(setSuggestedReplies);
 } else {
 setSuggestedReplies([]);
 }
 }
 }, [activeChats, user?.id]);

 const handleSend = async (e?: React.FormEvent, textOverride?: string) => {
    if (!rateLimit("send_message", 15)) { addToast("Slow down", "error"); return; }
 if (e) e.preventDefault();
 const text = textOverride || newMsg;
 if (!selectedChatUser || (!text.trim() && !attachment) || !user) return;
 
 const tempId = Date.now().toString();
 const optimisticMsg = {
 id: tempId,
 sender_id: user.id,
 receiver_id: selectedChatUser,
 text, 
 body: text,
 read: false,
 created_at: new Date().toISOString(),
 attachment_url: attachment?.url,
 attachment_type: attachment?.type,
 reply_to_id: replyingTo?.id,
 reply_to: replyingTo
 };
 
 setChats(prev => [...prev, optimisticMsg]);
 setNewMsg('');
 setSuggestedReplies([]);
 setMagicMode(false);
 setReplyingTo(null);
 setAttachment(null);
 
 const orderId = activeContext?.type === 'order' || activeContext?.type === 'return' ? activeContext.id : undefined;
 await sendMessage(selectedChatUser, text, undefined, orderId, attachment || undefined, replyingTo?.id);
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
 if (!newMsg.trim()) return;
 setIsPolishing(true);
 const refined = await aiService.refineMessage(newMsg, magicTone);
 setNewMsg(refined);
 setIsPolishing(false);
 addToast("Draft Polished by AI", "success");
 };

 const togglePin = (e: React.MouseEvent, id: string) => {
 e.stopPropagation();
 const newPinned = new Set(pinnedUsers);
 if (newPinned.has(id)) newPinned.delete(id);
 else newPinned.add(id);
 setPinnedUsers(newPinned);
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

 useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeChats, magicMode]);

 // Mark messages as read when opening a chat
 useEffect(() => {
 if (selectedChatUser && user) {
 const unreadMessages = activeChats.filter(c => c.receiver_id === user.id && !c.read);
 if (unreadMessages.length > 0) {
 supabase.from('messages')
 .update({ read: true })
 .eq('receiver_id', user.id)
 .eq('sender_id', selectedChatUser)
 .then(() => {
 setChats(prev => prev.map(c => 
 (c.receiver_id === user.id && c.sender_id === selectedChatUser) 
 ? { ...c, read: true } 
 : c
 ));
 });
 }
 }
 }, [selectedChatUser, activeChats, user]);

 const handleContextClick = async () => {
 if (!activeContext) return;
 if (activeContext.type === 'order' || activeContext.type === 'return') {
 const { data } = await supabase.from('orders').select('*').eq('id', activeContext.id).single();
 if (data) setViewingOrder(data);
 }
 };

 return (
 <MessageContainer>
 {/* Sidebar */}
 <SidebarContainer isVisible={!!selectedChatUser}>
 <div className="p-6 border-b border-foreground/5 flex flex-col gap-4">
 <h3 className="font-sans font-black text-xl flex items-center justify-between">
 Inbox <span className="text-xs font-bold px-3 py-1 bg-primary/10 text-primary rounded-full">{users.length}</span>
 </h3>
 <div className="relative">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
 <Input 
 placeholder="Search messages..." 
 value={searchTerm}
 onChange={(e: any) => setSearchTerm(e.target.value)}
 className="h-12 pl-11 rounded-xl bg-foreground/5 border-transparent focus:border-primary/30 focus:bg-background transition-all font-medium"
 />
 </div>
 <div className="flex gap-2">
 <button 
 onClick={() => setFilterUnread(!filterUnread)}
 className={`flex-1 h-10 rounded-xl text-sm font-bold transition-all border ${filterUnread ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 border-primary' : 'bg-transparent text-foreground/60 border-foreground/10 hover:border-foreground/20 hover:bg-foreground/5'}`}
 >
 Unread
 </button>
 </div>
 </div>
 
 <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
 {users.length === 0 && <div className="text-center p-8 text-foreground/40 text-[10px] uppercase tracking-[0.2em]">No conversations</div>}
 {users.map(u => (
 <div 
 key={u.id} 
 onClick={() => setSelectedChatUser(u.id)} 
 role="button"
 tabIndex={0}
 className={`w-full text-left p-4 rounded-xl transition-all duration-300 group relative border cursor-pointer mb-2 ${selectedChatUser === u.id ? 'bg-primary/5 border-primary/20 shadow-sm' : 'bg-transparent border-transparent hover:bg-foreground/5 hover:border-foreground/10'}`}
 >
 <div className="flex items-center gap-4">
 <div 
 className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-sans font-bold text-lg shrink-0 overflow-hidden text-primary cursor-pointer border border-primary/20"
 onClick={(e) => { e.stopPropagation(); fetchUserProfile(u.id); }}
 >
 {u.avatar ? <img src={u.avatar} alt={`${u.name} avatar`} className="w-full h-full object-cover" loading="lazy" decoding="async"/> : u.name.slice(0,1).toUpperCase()}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex justify-between items-baseline mb-1">
 <span 
 className={`font-sans font-bold text-sm truncate flex items-center gap-2 cursor-pointer hover:text-primary transition-colors ${selectedChatUser === u.id ? 'text-foreground' : 'text-foreground/80'}`}
 onClick={(e) => { e.stopPropagation(); fetchUserProfile(u.id); }}
 >
 {u.name}
 {pinnedUsers.has(u.id) && <Pin className="w-3 h-3 text-foreground fill-current" />}
 </span>
 <span className="text-[10px] font-bold text-foreground/40">{new Date(u.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
 </div>
 <p className={`text-sm truncate font-medium ${u.unread && selectedChatUser !== u.id ? 'text-foreground font-bold' : 'text-foreground/60'}`}>{u.lastMsg}</p>
 </div>
 </div>
 <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
 <button onClick={(e) => togglePin(e, u.id)} className="p-2 rounded-full bg-background border border-foreground/10 hover:border-foreground/30 text-foreground/60 hover:text-foreground cursor-pointer transition-colors shadow-sm">
 <Pin className="w-4 h-4" />
 </button>
 </div>
 </div>
 ))}
 </div>
 </SidebarContainer>

 {/* Chat Area */}
 <ChatAreaContainer isVisible={!selectedChatUser}>
 {!selectedChatUser ? (
 <div className="flex-1 flex flex-col items-center justify-center text-foreground/40 bg-transparent">
 <MessageSquare className="w-12 h-12 mb-6 stroke-[1]" />
 <p className="text-[10px] uppercase tracking-[0.2em]">Select a Conversation</p>
 </div>
 ) : (
 <>
 <div className="p-6 border-b border-foreground/5 flex items-center justify-between bg-transparent z-10">
 <div className="flex items-center gap-4">
 <button onClick={() => setSelectedChatUser(null)} className="md:hidden p-2 rounded-full border border-foreground/10 text-foreground hover:bg-foreground/5"><ChevronLeft className="w-5 h-5 stroke-[2]" /></button>
 <div className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => fetchUserProfile(selectedChatUser)}>
 <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-sans font-bold text-lg shrink-0 overflow-hidden text-primary border border-primary/20">
 {activeUserData?.avatar ? <img src={activeUserData.avatar} alt={`${activeUserData?.name || 'User'} avatar`} className="w-full h-full object-cover" loading="lazy" decoding="async"/> : activeUserData?.name.slice(0,1).toUpperCase()}
 </div>
 <div className="flex flex-col">
 <p className="font-sans font-black text-xl text-foreground leading-none">{activeUserData?.name}</p>
 </div>
 </div>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 no-scrollbar bg-transparent">
 {activeContext && (
 <div className="mb-8 p-6 rounded-2xl bg-foreground/[0.05] border border-primary/10 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-700 shadow-sm">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-md shadow-primary/20">
 {activeContext.type === 'return' ? <AlertTriangle className="w-6 h-6 text-primary-foreground" /> : <Package className="w-6 h-6 text-primary-foreground" />}
 </div>
 <div>
 <p className="text-[10px] uppercase tracking-widest font-bold text-primary mb-1">Active Context</p>
 <h4 className="text-lg font-sans font-black text-foreground">{activeContext.label}</h4>
 </div>
 </div>
 <div className="flex items-center gap-4">
 <GraphicalTag 
 type={activeContext.type} 
 label={activeContext.type === 'return' ? 'Dispute' : 'Order'} 
 id={activeContext.id} 
 onClick={handleContextClick}
 />
 <button 
 onClick={() => setActiveContext(null)}
 className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-foreground/10 transition-colors"
 >
 <X className="w-4 h-4 text-foreground/60" />
 </button>
 </div>
 </div>
 )}

 {activeChats.map((c) => (
 <div key={c.id} className={`flex flex-col ${c.sender_id === user?.id ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 group`}>
 {c.reply_to && (
 <div className="mb-2 p-3 rounded-xl bg-foreground/5 border-l-4 border-primary text-xs font-medium text-foreground/70 max-w-[70%] truncate">
 {c.reply_to.text || c.reply_to.body}
 </div>
 )}
 <div className={`p-4 rounded-2xl text-sm font-medium relative max-w-[85%] leading-relaxed shadow-sm ${c.sender_id === user?.id ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-foreground/5 text-foreground rounded-tl-sm'}`}>
 {c.attachment_url && (
 <div className="mb-3">
 {c.attachment_type === 'image' ? (
 <img src={c.attachment_url} alt="Attachment" className="max-w-full rounded-xl h-auto border border-foreground/10" loading="lazy" decoding="async" />
 ) : (
 <a href={c.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-xl bg-background/50 hover:bg-background/80 transition-colors">
 <Paperclip className="w-4 h-4" />
 <span className="text-xs font-bold">View Attachment</span>
 </a>
 )}
 </div>
 )}
 {c.text || c.body}
 
 {(c.order || c.product) && (
 <ProductOrderTag 
 product={c.product} 
 order={c.order} 
 onViewProduct={setViewingProduct} 
 onViewOrder={setViewingOrder} 
 />
 )}

 <div className="flex items-center gap-2 mt-2 text-xs font-bold text-foreground/40">
 <span 
 className="cursor-pointer hover:text-foreground transition-colors" 
 onClick={() => fetchUserProfile(c.sender_id)}
 >
 {c.sender?.full_name || 'User'}
 </span>
 <span>•</span>
 <span>{c.created_at ? new Date(c.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}</span>
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
 <span key={emoji} className="px-2 py-1 bg-background/50 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
 {emoji} {count}
 </span>
 ))}
 </div>
 )}

 <div className={`absolute ${c.sender_id === user?.id ? '-left-28' : '-right-28'} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity`}>
 <button onClick={() => setReplyingTo(c)} className="p-2 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground/60 hover:text-foreground transition-colors" title="Reply">
 <Reply className="w-4 h-4" />
 </button>
 <button onClick={() => setShowEmojiPicker(showEmojiPicker === c.id ? null : c.id)} className="p-2 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground/60 hover:text-foreground transition-colors" title="React">
 <Smile className="w-4 h-4" />
 </button>
 {c.sender_id === user?.id && (
 <button onClick={async () => { await softDeleteMessage(c.id); const msgs = await fetchMessages(); setChats(msgs); }} className="p-2 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground/60 hover:text-destructive transition-colors" title="Delete">
 <Trash2 className="w-4 h-4" />
 </button>
 )}
 {c.sender_id !== user?.id && (
 <button onClick={() => setReportingUser(c.sender_id)} className="p-2 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground/60 hover:text-destructive transition-colors" title="Report">
 <ShieldAlert className="w-4 h-4" />
 </button>
 )}
 </div>

 {/* Emoji Picker Popover */}
 {showEmojiPicker === c.id && (
 <div className="absolute bottom-full mb-2 bg-card border border-foreground/20 p-2 flex gap-2 z-50 shadow-xl">
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

 <div className="bg-transparent border-t border-foreground/5 p-4 sm:p-6 transition-all duration-300">
 {replyingTo && (
 <div className="mb-4 p-4 rounded-xl bg-foreground/5 border border-foreground/10 flex items-center justify-between">
 <div className="flex flex-col gap-1">
 <span className="text-xs font-bold text-foreground/60">Replying to</span>
 <p className="text-sm font-medium truncate max-w-md text-foreground">"{replyingTo.text || replyingTo.body}"</p>
 </div>
 <button onClick={() => setReplyingTo(null)} className="p-2 rounded-full hover:bg-foreground/10 text-foreground/60 hover:text-foreground"><X className="w-4 h-4"/></button>
 </div>
 )}

 {attachment && (
 <div className="mb-4 p-4 rounded-xl bg-foreground/5 border border-foreground/10 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
 <Paperclip className="w-5 h-5 text-primary" />
 </div>
 <span className="text-sm font-bold">{attachment.type === 'image' ? 'Image Attached' : 'File Attached'}</span>
 </div>
 <button onClick={() => setAttachment(null)} className="p-2 rounded-full hover:bg-foreground/10 text-foreground/60 hover:text-foreground"><X className="w-4 h-4"/></button>
 </div>
 )}
 {magicMode && (
 <div className="mb-4 animate-in slide-in-from-bottom-2 fade-in rounded-2xl bg-gradient-to-r from-primary/10 to-transparent p-5 border border-primary/20">
 <div className="flex items-center justify-between mb-4">
 <span className="text-sm font-bold text-primary flex items-center gap-2"><Sparkles className="w-4 h-4"/> Magic Compose</span>
 <button onClick={() => setMagicMode(false)} className="p-2 rounded-full hover:bg-foreground/10 text-foreground/60 hover:text-foreground transition-colors"><X className="w-4 h-4"/></button>
 </div>
 <div className="flex gap-3">
 {(['professional', 'persuasive', 'friendly'] as const).map(tone => (
 <button 
 key={tone}
 onClick={() => setMagicTone(tone)} 
 className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all border ${magicTone === tone ? 'bg-primary text-primary-foreground shadow-sm border-primary' : 'bg-background text-foreground/60 border-foreground/10 hover:border-foreground/30 hover:bg-foreground/5'}`}
 >
 {tone.charAt(0).toUpperCase() + tone.slice(1)}
 </button>
 ))}
 </div>
 </div>
 )}

 {suggestedReplies.length > 0 && !magicMode && (
 <div className="flex gap-3 overflow-x-auto pb-4 pt-2 no-scrollbar mb-2">
 {suggestedReplies.map((reply, i) => (
 <button key={i} onClick={(e) => handleSend(e, reply)} className="px-5 py-2.5 rounded-full bg-background font-medium text-foreground text-sm border border-foreground/10 whitespace-nowrap hover:border-primary/50 hover:bg-primary/5 transition-colors flex items-center gap-2 shadow-sm">
 {reply}
 </button>
 ))}
 </div>
 )}

 <form onSubmit={handleSend} className="flex flex-col gap-4">
 {/* Quick Replies */}
 <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
 {quickReplies.map((reply, i) => (
 <button 
 key={i} 
 type="button"
 onClick={() => setNewMsg(reply)} 
 className="px-4 py-2 rounded-full bg-foreground/5 font-medium text-foreground/80 text-xs border border-transparent whitespace-nowrap hover:bg-foreground/10 transition-colors"
 >
 {reply}
 </button>
 ))}
 </div>

 <div className="flex gap-4 items-end">
 <div className="flex-1 relative bg-foreground/5 rounded-3xl border border-transparent focus-within:bg-background focus-within:border-primary/30 focus-within:shadow-sm transition-all pb-2">
 <textarea 
 placeholder="Write a message..." 
 value={newMsg} 
 onChange={(e:any) => setNewMsg(e.target.value)} 
 onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
 className="w-full bg-transparent border-none text-sm font-medium px-6 py-5 min-h-[60px] max-h-32 resize-none outline-none no-scrollbar placeholder:text-foreground/40 text-foreground" 
 />
 <div className="absolute right-4 bottom-3 flex gap-2">
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
 className="p-2 rounded-full text-foreground/40 hover:bg-foreground/10 hover:text-foreground transition-colors"
 disabled={isUploading}
 >
 {isUploading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <Paperclip className="w-5 h-5" />}
 </button>
 <button type="button" onClick={() => magicMode ? handleMagicPolish() : setMagicMode(true)} className={`p-2 rounded-full transition-colors ${magicMode ? 'text-primary bg-primary/10' : 'text-foreground/40 hover:bg-foreground/10 hover:text-foreground'}`} title="Magic Compose">
 {isPolishing ? <Loader2 className="w-5 h-5 animate-spin text-primary"/> : <Wand2 className="w-5 h-5"/>}
 </button>
 </div>
 </div>
 <button type="submit" className="h-16 w-16 rounded-full flex items-center justify-center flex-shrink-0 bg-primary text-primary-foreground hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-95"><Send className="w-6 h-6" /></button>
 </div>
 </form>
 </div>
 
 <ConfirmDialog 
 isOpen={!!reportingUser}
 onClose={() => setReportingUser(null)}
 onConfirm={async (reason) => {
 if (reportingUser) {
 await reportUser(reportingUser, reason);
 setReportingUser(null);
 }
 }}
 title="Report User"
 description="Please select a reason for reporting this user. Our moderation team will review the conversation."
 confirmText="Submit Report"
 showInput={true}
 inputPlaceholder="Reason for reporting (e.g., harassment, spam)..."
 />

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
 </>
 )}
 </ChatAreaContainer>
 </MessageContainer>
 );
};

