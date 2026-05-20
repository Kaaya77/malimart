import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, ChevronLeft, Trash2, X, Sparkles, Send, Loader2, BrainCircuit, Tag, Truck, User, Wand2, Search, Filter, Pin, Plus, Ban, ShieldAlert, Smile, MoreVertical, Reply, Paperclip, Check, CheckCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppState } from '../context/AppContext';
import { Button, Input, useToast, ConfirmDialog, UserProfileModal, GraphicalTag } from './UI';
import { ProductModal } from './ProductModal';
import { OrderDetailsModal } from './OrderDetailsModal';
import { supabase } from '../services/supabaseClient';
import { Product, Order } from '../types';
import { formatTZS } from '../constants';
import * as aiService from '../services/geminiService';
import { MessageContainer, SidebarContainer, ChatAreaContainer, DetailsAreaContainer } from './MessageShared';

const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
const formatDateLabel = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (isSameDay(date, today)) return 'Today';
    if (isSameDay(date, yesterday)) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
};

export const ProductOrderTag = ({ product, order, onViewProduct, onViewOrder }: { product?: Partial<Product>, order?: Partial<Order>, onViewProduct: (p: Product) => void, onViewOrder: (o: Order) => void }) => {
    if (!product && !order) return null;
    return (
        <div className="mb-6">
            {order && (
                <div className="cursor-pointer inline-block" onClick={() => onViewOrder(order as Order)}>
                    <GraphicalTag 
                        type="order" 
                        label={`Order #${order.id?.slice(0,8)}`}
                        id={order.id}
                    />
                </div>
            )}
            {product && (
                <div 
                    className={`cursor-pointer p-4 bg-primary/5 dark:bg-background/5 border border-foreground/10 flex items-center gap-4 group hover:border-foreground/30 dark:hover:border-background/30 transition-all ${order ? 'mt-3' : ''}`}
                    onClick={() => onViewProduct(product as Product)}
                >
                    {product.images?.[0] && (
                        <img src={product.images[0]} alt={product.name} className="w-12 h-12 object-cover grayscale group-hover:grayscale-0 transition-all" />
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="font-serif text-sm text-foreground truncate">{product.name}</p>
                        <p className="text-[9px] text-foreground/40 uppercase tracking-[0.2em] mt-1">Contextual Product</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export const SellerMessages = ({ userId, selectedChatUser, setSelectedChatUser, products, initialProductId, initialOrderId, initialChatUser }: { userId: string, selectedChatUser: string | null, setSelectedChatUser: (uid: string | null) => void, products: Product[], initialProductId?: string | null, initialOrderId?: string | null, initialChatUser?: string | null }) => {
    const { user, fetchMessages, sendMessage, deleteMessage, softDeleteMessage, reportUser, addReaction, removeReaction, blockedUsers, markMessagesAsRead, blockUser, unblockUser } = useAppState();
    const { addToast } = useToast();
    const [chats, setChats] = useState<any[]>([]);
    const [newMsg, setNewMsg] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterUnread, setFilterUnread] = useState(false);
    const [pinnedUsers, setPinnedUsers] = useState<Set<string>>(new Set());
    const [magicMode, setMagicMode] = useState(false);
    const [isPolishing, setIsPolishing] = useState(false);
    const [magicTone, setMagicTone] = useState<'professional' | 'persuasive' | 'friendly'>('professional');
    const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [remoteIsTyping, setRemoteIsTyping] = useState(false);
    const [reportingUser, setReportingUser] = useState<any | null>(null);
    const [isReporting, setIsReporting] = useState(false);
    const [reportReason, setReportReason] = useState('Spam');
    const [reportDetails, setReportDetails] = useState('');
    const [viewingProfile, setViewingProfile] = useState<any | null>(null);
    const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
    const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [attachment, setAttachment] = useState<{ url: string, type: string } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const load = async () => {
            const msgs = await fetchMessages();
            // Filter out messages from/to blocked users
            const filteredMsgs = msgs.filter(m => !blockedUsers.has(m.sender_id) && !blockedUsers.has(m.receiver_id));
            console.log('Messages loaded:', filteredMsgs);
            setChats(filteredMsgs);
        };
        load();
        const channel = supabase.channel('messages_channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                console.log('New message received via real-time:', payload);
                if(payload.new.receiver_id === userId || payload.new.sender_id === userId) load();
            })
            .subscribe();

        // Typing indicator channel
        const typingChannel = supabase.channel(`typing:${userId}`)
            .on('broadcast', { event: 'typing' }, ({ payload }) => {
                if (payload.userId === selectedChatUser) {
                    setRemoteIsTyping(payload.isTyping);
                    setTimeout(() => setRemoteIsTyping(false), 3000);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(typingChannel);
        };
    }, [userId, fetchMessages, selectedChatUser, blockedUsers]);

    const handleTyping = () => {
        if (!selectedChatUser) return;
        setIsTyping(true);
        supabase.channel(`typing:${selectedChatUser}`).send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId, isTyping: true }
        });
        
        // Debounce typing off
        const timeout = setTimeout(() => {
            setIsTyping(false);
            supabase.channel(`typing:${selectedChatUser}`).send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId, isTyping: false }
            });
        }, 2000);
        
        return () => clearTimeout(timeout);
    };

    const users = useMemo(() => {
        const map = new Map();
        chats.forEach(c => {
            const isMe = c.sender_id === userId;
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
        
        if (initialChatUser && !map.has(initialChatUser)) {
            map.set(initialChatUser, {
                id: initialChatUser,
                name: 'Admin/User',
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
    }, [chats, userId, searchTerm, filterUnread, pinnedUsers, initialChatUser]);

    const activeChats = useMemo(() => {
        if (!selectedChatUser) return [];
        return chats.filter(c => c.sender_id === selectedChatUser || c.receiver_id === selectedChatUser)
            .sort((a,b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime());
    }, [chats, selectedChatUser]);

    const handleSend = async (e?: React.FormEvent, textOverride?: string) => {
        if (e) e.preventDefault();
        const text = textOverride || newMsg;
        console.log('handleSend called, selectedChatUser:', selectedChatUser, 'text:', text);
        if (!selectedChatUser || (!text.trim() && !attachment)) return;
        await sendMessage(selectedChatUser, text, undefined, undefined, attachment || undefined, replyingTo?.id);
        setNewMsg('');
        setAttachment(null);
        setReplyingTo(null);
        setMagicMode(false);
        setSuggestedReplies([]);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `chat-attachments/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('mali-mart-uploads')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('mali-mart-uploads')
                .getPublicUrl(filePath);

            setAttachment({ url: publicUrl, type: file.type.startsWith('image/') ? 'image' : 'file' });
            addToast("File uploaded", "success");
        } catch (error: any) {
            addToast(error.message, "error");
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

    const handleReport = async () => {
        if (!reportingUser || !userId) return;
        
        // Check if user is admin
        if (reportingUser.role === 'admin') {
            addToast("Cannot report or block an administrator", "error");
            setReportingUser(null);
            return;
        }

        setIsReporting(true);
        try {
            await reportUser(reportingUser.id, reportReason, reportDetails);
            addToast("User reported successfully", "success");
            setReportingUser(null);
            setReportReason('Spam');
            setReportDetails('');
        } catch (error: any) {
            addToast("Failed to report user", "error");
        } finally {
            setIsReporting(false);
        }
    };

    const handleBlockAction = async (targetUserId: string) => {
        const targetUser = users.find(u => u.id === targetUserId);
        if (targetUser?.role === 'admin') {
            addToast("Cannot block an administrator", "error");
            return;
        }

        try {
            await blockUser(targetUserId);
            addToast("User blocked", "success");
        } catch (error: any) {
            addToast("Failed to block user", "error");
        }
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

    useEffect(() => {
        if (selectedChatUser) {
            markMessagesAsRead(selectedChatUser);
        }
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); 
    }, [activeChats, magicMode, selectedChatUser]);

    return (
        <MessageContainer>
            <SidebarContainer isVisible={!!selectedChatUser}>
                <div className="p-6 border-b border-foreground/10 flex flex-col gap-4">
                    <h3 className="font-serif text-xl text-foreground flex items-center gap-3">
                        Inbox <span className="text-[10px] uppercase tracking-[0.2em] font-sans bg-primary/5 dark:bg-background/5 px-2 py-1 border border-foreground/10 text-foreground/60">{users.length}</span>
                    </h3>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 stroke-[1]" />
                        <Input 
                            placeholder="Search..." 
                            value={searchTerm}
                            onChange={(e: any) => setSearchTerm(e.target.value)}
                            className="h-10 pl-9 text-[11px] rounded-none bg-transparent border-foreground/20 text-foreground focus:border-foreground dark:focus:border-background transition-colors"
                        />
                    </div>
                    <button 
                        onClick={() => setFilterUnread(!filterUnread)}
                        className={`py-2 text-[10px] uppercase tracking-[0.2em] transition-all border ${filterUnread ? 'bg-primary text-background dark:bg-background dark:text-foreground border-foreground dark:border-background' : 'bg-transparent text-foreground/60 border-foreground/20 hover:border-foreground dark:hover:border-background hover:text-foreground dark:hover:text-background'}`}
                    >
                        Unread
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                    {users.map(u => (
                        <button 
                            key={u.id} 
                            onClick={() => setSelectedChatUser(u.id)} 
                            className={`w-full text-left p-4 transition-all duration-300 group relative border-l-2 ${selectedChatUser === u.id ? 'bg-primary/5 dark:bg-background/5 border-l-foreground dark:border-l-background border-y-transparent border-r-transparent' : 'bg-transparent border-transparent hover:bg-primary/5 dark:hover:bg-background/5'}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-primary/5 dark:bg-background/5 flex items-center justify-center font-serif text-lg shrink-0 overflow-hidden border border-foreground/10">
                                    {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover"/> : u.name.slice(0,1).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className={`text-[11px] uppercase tracking-[0.15em] truncate flex items-center gap-2 ${selectedChatUser === u.id ? 'text-foreground' : 'text-foreground/80'}`}>
                                            {u.name}
                                            {pinnedUsers.has(u.id) && <Pin className="w-3 h-3 text-foreground fill-current" />}
                                        </span>
                                        <span className="text-[9px] font-mono opacity-40">{new Date(u.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <p className={`text-[11px] truncate font-serif italic ${u.unread && selectedChatUser !== u.id ? 'text-foreground font-medium' : 'text-foreground/60'}`}>{u.lastMsg}</p>
                                </div>
                            </div>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div onClick={(e) => togglePin(e, u.id)} className="p-2 bg-background dark:bg-background border border-foreground/10 hover:border-foreground/30 dark:hover:border-background/30 text-foreground/60 hover:text-foreground dark:hover:text-background cursor-pointer transition-colors">
                                    <Pin className="w-3 h-3 stroke-[1]" />
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </SidebarContainer>
            <ChatAreaContainer isVisible={!selectedChatUser}>
                {!selectedChatUser && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-50">
                        <MessageSquare className="w-16 h-16 mb-6 stroke-[0.5]" />
                        <h3 className="font-serif text-2xl font-light mb-2">Your Messages</h3>
                        <p className="text-[10px] uppercase tracking-[0.2em]">Select a conversation to begin</p>
                    </div>
                )}
                {selectedChatUser && (
                    <div className="p-6 border-b border-foreground/10 flex items-center justify-between bg-background/50 dark:bg-black/50 backdrop-blur-md sticky top-0 z-10">
                        <div className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => fetchUserProfile(selectedChatUser)}>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedChatUser(null); }} className="md:hidden p-2 hover:bg-primary/5 dark:hover:bg-background/5 transition-colors">
                                <ChevronLeft className="w-5 h-5 stroke-[1]" />
                            </button>
                            <div>
                                <h3 className="text-[11px] uppercase tracking-[0.2em] font-medium text-foreground">
                                    {users.find(u => u.id === selectedChatUser)?.name || 'User'}
                                </h3>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setReportingUser(selectedChatUser)}
                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-colors"
                                title="Report User"
                            >
                                <ShieldAlert className="w-4 h-4" />
                            </button>
                            {blockedUsers.has(selectedChatUser) ? (
                                <button 
                                    onClick={() => unblockUser(selectedChatUser)}
                                    className="flex items-center gap-2 px-4 py-2 text-[9px] uppercase tracking-[0.15em] text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors border border-green-600/20"
                                >
                                    <ShieldAlert className="w-3.5 h-3.5" /> Unblock
                                </button>
                            ) : (
                                <button 
                                    onClick={() => blockUser(selectedChatUser)}
                                    className="flex items-center gap-2 px-4 py-2 text-[9px] uppercase tracking-[0.15em] text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border border-red-600/20"
                                >
                                    <Ban className="w-3.5 h-3.5" /> Block
                                </button>
                            )}
                        </div>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-transparent">
                    {activeChats.map((c, index) => {
                        const prev = index > 0 ? activeChats[index - 1] : null;
                        const currDate = new Date(c.created_at!);
                        const prevDate = prev ? new Date(prev.created_at!) : null;
                        const showDate = !prevDate || !isSameDay(currDate, prevDate);
                        const isMe = c.sender_id === userId;
                        const showHeader = showDate || !prev || prev.sender_id !== c.sender_id || (currDate.getTime() - prevDate.getTime() > 5 * 60 * 1000);

                        return (
                        <React.Fragment key={c.id}>
                            {showDate && (
                                <div className="flex justify-center my-8">
                                    <span className="text-[9px] uppercase tracking-[0.2em] px-4 py-1.5 bg-primary/5 dark:bg-background/5 text-foreground/60 rounded-full">
                                        {formatDateLabel(currDate)}
                                    </span>
                                </div>
                            )}
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative ${showHeader ? 'mt-6' : 'mt-1.5'}`}
                        >
                            {showHeader && (
                                <div className="flex items-center gap-2 mb-1.5 px-1">
                                    <span className="text-[9px] font-mono opacity-60 uppercase tracking-widest">{c.sender?.full_name || 'User'}</span>
                                    <span className="text-[9px] font-mono opacity-40 uppercase tracking-widest">•</span>
                                    <span className="text-[9px] font-mono opacity-40 uppercase tracking-widest">{currDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                    {isMe && (
                                        <span className={`text-[9px] font-mono uppercase tracking-widest ${c.read ? 'text-emerald-500' : 'opacity-40'}`}>
                                            {c.read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                                        </span>
                                    )}
                                </div>
                            )}
                            
                            {c.reply_to_id && (
                                <div className={`mb-1.5 p-2.5 bg-primary/5 dark:bg-background/5 border-l-2 border-foreground/20 text-[11px] italic opacity-70 max-w-[80%] rounded-r-md ${isMe ? 'mr-1' : 'ml-1'}`}>
                                    Replying to: {chats.find(m => m.id === c.reply_to_id)?.body?.slice(0, 50)}...
                                </div>
                            )}

                            <ProductOrderTag 
                                product={c.product} 
                                order={c.order} 
                                onViewProduct={setViewingProduct} 
                                onViewOrder={setViewingOrder} 
                            />

                            <div className="relative group/msg max-w-[85%]">
                                <div className={`p-4 text-[13px] shadow-sm relative leading-relaxed ${isMe ? 'bg-primary text-background dark:bg-background dark:text-foreground rounded-2xl rounded-tr-sm' : 'bg-background dark:bg-primary text-foreground border border-foreground/10 rounded-2xl rounded-tl-sm'}`}>
                                    {c.attachment_url && (
                                        <div className="mb-3">
                                            {c.attachment_type === 'image' ? (
                                                <img src={c.attachment_url} className="max-w-full h-auto border border-foreground/10" referrerPolicy="no-referrer" />
                                            ) : (
                                                <a href={c.attachment_url} target="_blank" className="flex items-center gap-2 p-2 bg-primary/5 dark:bg-background/5 text-[10px] uppercase tracking-widest">
                                                    <Paperclip className="w-3 h-3" /> View Attachment
                                                </a>
                                            )}
                                        </div>
                                    )}
                                    {c.text || c.body}
                                </div>

                                {/* Message Actions */}
                                <div className={`absolute top-0 ${c.sender_id === userId ? '-left-12' : '-right-12'} opacity-0 group-hover/msg:opacity-100 transition-opacity flex flex-col gap-1`}>
                                    <button onClick={() => setReplyingTo(c)} className="p-2 hover:bg-primary/5 dark:hover:bg-background/5 rounded-full transition-colors" title="Reply">
                                        <Reply className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => setShowEmojiPicker(showEmojiPicker === c.id ? null : c.id)} className="p-2 hover:bg-primary/5 dark:hover:bg-background/5 rounded-full transition-colors" title="React">
                                        <Smile className="w-3.5 h-3.5" />
                                    </button>
                                    {c.sender_id === userId && (
                                        <button onClick={() => softDeleteMessage(c.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors" title="Delete">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Emoji Picker */}
                                {showEmojiPicker === c.id && (
                                    <div className={`absolute bottom-full mb-2 ${c.sender_id === userId ? 'right-0' : 'left-0'} bg-background dark:bg-black border border-foreground/10 p-2 flex gap-2 z-20 shadow-xl`}>
                                        {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
                                            <button 
                                                key={emoji} 
                                                onClick={() => { addReaction(c.id, emoji); setShowEmojiPicker(null); }}
                                                className="hover:scale-125 transition-transform p-1"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Reactions Display */}
                            {c.reactions && c.reactions.length > 0 && (
                                <div className={`flex gap-1 mt-1 ${c.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
                                    {Array.from(new Set(c.reactions.map((r: any) => r.emoji))).map((emoji: any) => (
                                        <div key={emoji} className="bg-primary/5 dark:bg-background/5 px-1.5 py-0.5 rounded-full text-[10px] border border-foreground/10">
                                            {emoji} {c.reactions.filter((r: any) => r.emoji === emoji).length}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                        </React.Fragment>
                    )})}
                    {remoteIsTyping && (
                        <div className="flex items-start animate-in fade-in slide-in-from-bottom-2 mt-4">
                            <div className="bg-background dark:bg-primary border border-foreground/10 rounded-2xl rounded-tl-sm p-4 flex gap-1.5 items-center h-12 shadow-sm">
                                <div className="w-1.5 h-1.5 bg-primary/40 dark:bg-background/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 bg-primary/40 dark:bg-background/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 bg-primary/40 dark:bg-background/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>
                {selectedChatUser && (
                <div className="bg-background/50 dark:bg-background/50 border-t border-foreground/10 p-4 md:p-6 transition-all duration-300">
                    {replyingTo && (
                        <div className="mb-4 p-3 bg-primary/5 dark:bg-background/5 border-l-2 border-foreground dark:border-background flex justify-between items-center">
                            <div className="text-[10px] italic opacity-60">
                                Replying to: {replyingTo.body?.slice(0, 50)}...
                            </div>
                            <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-primary/10 dark:hover:bg-background/10">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                    {attachment && (
                        <div className="mb-4 p-3 bg-primary/5 dark:bg-background/5 border border-foreground/20 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                {attachment.type === 'image' ? <img src={attachment.url} className="w-10 h-10 object-cover" /> : <Paperclip className="w-4 h-4" />}
                                <span className="text-[10px] uppercase tracking-widest">Attachment Ready</span>
                            </div>
                            <button onClick={() => setAttachment(null)} className="p-1 hover:bg-primary/10 dark:hover:bg-background/10">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                    {magicMode && (
                        <div className="mb-4 animate-in slide-in-from-bottom-2 fade-in bg-primary/5 dark:bg-background/5 p-4 rounded-none border border-foreground/10">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-foreground flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 stroke-[1]"/> Magic Compose</span>
                                <button onClick={() => setMagicMode(false)} className="p-2 hover:bg-primary/5 dark:hover:bg-background/5 transition-colors"><X className="w-3.5 h-3.5 stroke-[1] text-foreground"/></button>
                            </div>
                            <div className="flex gap-3">
                                {(['professional', 'persuasive', 'friendly'] as const).map(tone => (
                                    <button 
                                        key={tone}
                                        onClick={() => setMagicTone(tone)} 
                                        className={`px-4 py-2 text-[9px] uppercase tracking-[0.2em] transition-all border ${magicTone === tone ? 'bg-primary text-background dark:bg-background dark:text-foreground border-foreground dark:border-background' : 'bg-transparent text-foreground/60 border-foreground/20 hover:border-foreground dark:hover:border-background hover:text-foreground dark:hover:text-background'}`}
                                    >
                                        {tone}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <form onSubmit={handleSend} className="flex gap-3 items-end bg-background dark:bg-primary p-2 rounded-2xl border border-foreground/10 shadow-sm focus-within:border-foreground/30 dark:focus-within:border-background/30 transition-all">
                        <div className="flex-1 relative">
                            <textarea 
                                placeholder={blockedUsers.has(selectedChatUser || '') ? "You have blocked this user" : "Type your response..."}
                                disabled={blockedUsers.has(selectedChatUser || '')}
                                value={newMsg} 
                                onChange={(e:any) => {
                                    setNewMsg(e.target.value);
                                    handleTyping();
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                className="w-full bg-transparent border-none text-[13px] px-4 py-3 min-h-[44px] max-h-32 resize-none outline-none no-scrollbar placeholder:text-foreground/40 dark:placeholder:text-background/40 text-foreground disabled:opacity-50" 
                            />
                            <div className="absolute right-2 bottom-2 flex gap-1">
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileUpload} 
                                    className="hidden" 
                                    accept="image/*,application/pdf"
                                />
                                <button 
                                    type="button" 
                                    onClick={() => fileInputRef.current?.click()} 
                                    className="p-2 rounded-lg bg-transparent text-foreground/40 hover:bg-primary/5 dark:hover:bg-background/5 hover:text-foreground dark:hover:text-background transition-all"
                                    title="Attach File"
                                    disabled={isUploading}
                                >
                                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4 stroke-[1]" />}
                                </button>
                                <button type="button" onClick={() => magicMode ? handleMagicPolish() : setMagicMode(true)} className={`p-2 rounded-lg transition-all ${magicMode ? 'bg-primary text-background dark:bg-background dark:text-foreground' : 'bg-transparent text-foreground/40 hover:bg-primary/5 dark:hover:bg-background/5 hover:text-foreground dark:hover:text-background'}`} title="Magic Compose">
                                    {isPolishing ? <Loader2 className="w-4 h-4 animate-spin stroke-[1]"/> : <Wand2 className="w-4 h-4 stroke-[1]"/>}
                                </button>
                            </div>
                        </div>
                        <button type="submit" className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary text-background dark:bg-background dark:text-foreground hover:scale-105 transition-transform"><Send className="w-4 h-4 stroke-[1.5]" /></button>
                    </form>
                </div>
                )}
            </ChatAreaContainer>
            <DetailsAreaContainer isVisible={!!selectedChatUser}>
                <div className="p-6 border-l border-foreground/10 h-full overflow-y-auto no-scrollbar">
                    <h3 className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-8">User Details</h3>
                    
                    {selectedChatUser && (() => {
                        const u = users.find(u => u.id === selectedChatUser);
                        if (!u) return null;
                        return (
                            <div className="space-y-8">
                                <div className="flex flex-col items-center text-center space-y-4">
                                    <div className="w-20 h-20 rounded-full bg-primary/5 dark:bg-background/5 flex items-center justify-center text-2xl font-serif overflow-hidden border border-foreground/10">
                                        {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.name.slice(0, 1).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-serif text-xl">{u.name}</h4>
                                        <p className="text-[10px] uppercase tracking-widest opacity-40">Verified Member</p>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-6 border-t border-foreground/10">
                                    <div className="flex justify-between text-[10px] uppercase tracking-widest">
                                        <span className="opacity-40">Status</span>
                                        <span className="text-emerald-500">Online</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] uppercase tracking-widest">
                                        <span className="opacity-40">Member Since</span>
                                        <span>{new Date(u.time || Date.now()).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] uppercase tracking-widest">
                                        <span className="opacity-40">Trust Score</span>
                                        <span className="text-emerald-500">98%</span>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-6">
                                    <button 
                                        onClick={() => fetchUserProfile(u.id)}
                                        className="w-full py-3 text-[10px] uppercase tracking-[0.2em] border border-foreground/10 hover:bg-primary/5 dark:hover:bg-background/5 transition-all"
                                    >
                                        View Full Profile
                                    </button>
                                    <button 
                                        onClick={() => blockedUsers.has(u.id) ? unblockUser(u.id) : handleBlockAction(u.id)}
                                        className={`w-full py-3 text-[10px] uppercase tracking-[0.2em] border transition-all ${blockedUsers.has(u.id) ? 'border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5' : 'border-rose-500/20 text-rose-500 hover:bg-rose-500/5'}`}
                                    >
                                        {blockedUsers.has(u.id) ? 'Unblock User' : 'Block User'}
                                    </button>
                                    <button 
                                        onClick={() => setReportingUser(u)}
                                        className="w-full py-3 text-[10px] uppercase tracking-[0.2em] text-rose-500 opacity-60 hover:opacity-100 transition-all"
                                    >
                                        Report User
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </DetailsAreaContainer>
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

            {reportingUser && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-background dark:bg-background border border-foreground/10 w-full max-w-md p-8 shadow-2xl">
                        <h3 className="text-2xl font-serif font-light mb-6">Report User</h3>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-[0.2em] opacity-60">Reason</label>
                                <select 
                                    value={reportReason} 
                                    onChange={(e) => setReportReason(e.target.value)}
                                    className="w-full h-12 bg-transparent border border-foreground/10 px-4 text-sm focus:outline-none focus:border-foreground dark:focus:border-background transition-colors appearance-none"
                                >
                                    <option value="Spam" className="bg-background dark:bg-background">Spam or Harassment</option>
                                    <option value="Fraud" className="bg-background dark:bg-background">Fraud or Scam</option>
                                    <option value="Inappropriate" className="bg-background dark:bg-background">Inappropriate Content</option>
                                    <option value="Other" className="bg-background dark:bg-background">Other</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-[0.2em] opacity-60">Details (Optional)</label>
                                <textarea 
                                    value={reportDetails}
                                    onChange={(e) => setReportDetails(e.target.value)}
                                    placeholder="Provide more context..."
                                    className="w-full h-32 bg-transparent border border-foreground/10 p-4 text-sm focus:outline-none focus:border-foreground dark:focus:border-background transition-colors resize-none"
                                />
                            </div>
                            <div className="flex gap-4">
                                <button 
                                    onClick={() => setReportingUser(null)}
                                    className="flex-1 h-12 text-[10px] uppercase tracking-[0.2em] border border-foreground/10 hover:bg-primary/5 dark:hover:bg-background/5 transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleReport}
                                    disabled={isReporting}
                                    className="flex-1 h-12 text-[10px] uppercase tracking-[0.2em] bg-rose-600 text-white hover:bg-rose-700 transition-all disabled:opacity-50"
                                >
                                    {isReporting ? 'Submitting...' : 'Submit Report'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </MessageContainer>
    );
};
