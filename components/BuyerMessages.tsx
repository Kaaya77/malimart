import { rateLimit } from '../src/security';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, BadgeCheck, Send, Search, Sparkles, ArrowUpRight, Truck,
  Wand2, Loader2, X, Paperclip, Ban, MoreVertical, ShieldAlert, Trash2, Plus,
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { Button, Input, useToast, ConfirmDialog, UserProfileModal, VerifiedBadge } from './UI';
import { ProductModal } from './ProductModal';
import { OrderDetailsModal } from './OrderDetailsModal';
import { supabase } from '../services/supabaseClient';
import { compressImage, IMMUTABLE_CACHE } from '../services/imageCompression';
import { VendorProfile, ChatMessage, Product, Order } from '../types';
import { SidebarContainer, ChatAreaContainer, DetailsAreaContainer } from './MessageShared';
import {
  ConversationListItem, ChatEmptyState, DayDivider, isSameDay,
  MessageBubble, TypingIndicator, NewConversationModal,
} from './messaging/ConversationKit';
import { ProductOrderTag } from './SellerMessages';
import { fetchProductById, fetchVendorProfile } from '../services/shopService';
import { fetchProfileRole, fetchProfile } from '../services/messagesService';
import { formatTZS } from '../constants';
import * as aiService from '../services/geminiService';

const PIN_KEY = 'malimart_pinned_chats';
const ARCHIVE_KEY = 'malimart_archived_chats';

export const BuyerMessages = ({ userId, initialSellerId, initialProductId, initialOrderId }: {
  userId: string;
  initialSellerId?: string | null;
  initialProductId?: string | null;
  initialOrderId?: string | null;
}) => {
  const { fetchMessages, sendMessage, softDeleteMessage, reportUser, addReaction, markMessagesAsRead, blockUser, blockedUsers, user, orders } = useAppState();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<string | null>(initialSellerId || searchParams.get('sellerId'));
  const [msgText, setMsgText] = useState('');
  const [context, setContext] = useState<{ type: 'order' | 'return' | 'support' | 'product'; id: string; label: string } | null>(() => {
    if (searchParams.get('contextType')) {
      return {
        type: searchParams.get('contextType') as any,
        id: searchParams.get('contextId') || '',
        label: searchParams.get('contextLabel') || '',
      };
    }
    const productId = initialProductId ?? searchParams.get('productId');
    if (productId) return { type: 'product', id: productId, label: '' };
    const orderId = initialOrderId ?? searchParams.get('orderId');
    if (orderId) return { type: 'order', id: orderId, label: '' };
    return null;
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [remoteIsTyping, setRemoteIsTyping] = useState(false);
  const typingOutRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);
  const [pinnedSellers, setPinnedSellers] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(PIN_KEY) || '[]')); } catch { return new Set(); }
  });
  const archiveKey = `${ARCHIVE_KEY}_${userId}`;
  const [archivedSellers, setArchivedSellers] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(archiveKey) || '[]')); } catch { return new Set(); }
  });
  const [showArchived, setShowArchived] = useState(false);

  const [magicMode, setMagicMode] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [magicTone, setMagicTone] = useState<'professional' | 'persuasive' | 'friendly'>('professional');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [attachment, setAttachment] = useState<{ url: string; type: 'image' | 'file' } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [reportingUser, setReportingUser] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('Spam');
  const [reportDetails, setReportDetails] = useState('');
  const [viewingProfile, setViewingProfile] = useState<any | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete-chat' | 'block'; targetId: string } | null>(null);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [contextProduct, setContextProduct] = useState<Product | null>(null);
  const [contextOrder, setContextOrder] = useState<Order | null>(null);
  const [initialVendor, setInitialVendor] = useState<VendorProfile | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);

  // A "contact seller" deep link can target a seller the buyer has never chatted with;
  // hydrate their public storefront profile so the conversation isn't a blank header.
  useEffect(() => {
    if (!selectedSeller) return;
    const known = chats.some(c => c.sender_id === selectedSeller || c.receiver_id === selectedSeller);
    if (known || initialVendor?.seller_id === selectedSeller) return;
    let cancelled = false;
    fetchVendorProfile(selectedSeller).then(v => { if (!cancelled && v) setInitialVendor(v); });
    return () => { cancelled = true; };
  }, [selectedSeller, chats]);

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
      // Soft-deletes are UPDATEs (deleted_at) — subscribe so a deleted message
      // reflects live for both parties, not just after a manual refresh.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${userId}` }, () => load())
      // Reactions live in message_reactions — reload on any change so emoji
      // reactions appear/disappear in realtime.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => load())
      .subscribe();
    const typingChannel = supabase.channel(`typing:${userId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        if (payload.userId === selectedSeller) {
          setRemoteIsTyping(payload.isTyping);
          setTimeout(() => setRemoteIsTyping(false), 3000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); supabase.removeChannel(typingChannel); };
  }, [userId, user, blockedUsers, selectedSeller]);

  // One outbound typing channel per selected conversation — created on select,
  // reused for every keystroke, removed on switch/unmount.
  useEffect(() => {
    if (!selectedSeller) return;
    const ch = supabase.channel(`typing:${selectedSeller}`).subscribe();
    typingOutRef.current = ch;
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingOutRef.current = null;
      supabase.removeChannel(ch);
    };
  }, [selectedSeller]);

  const handleTyping = () => {
    const ch = typingOutRef.current;
    if (!selectedSeller || !ch) return;
    ch.send({ type: 'broadcast', event: 'typing', payload: { userId, isTyping: true } });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingOutRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId, isTyping: false } });
    }, 2000);
  };

  useEffect(() => {
    if (!selectedSeller) return;
    markMessagesAsRead(selectedSeller);
    setChats(prev => prev.map(c =>
      c.sender_id === selectedSeller && c.receiver_id === userId ? { ...c, read: true } : c
    ));
  }, [selectedSeller]);

  useEffect(() => {
    let cancelled = false;
    if (context?.type === 'product' && context.id) {
      // Public product read via the approved service path (RLS-scoped), not a raw table query.
      fetchProductById(context.id).then(p => { if (!cancelled && p) setContextProduct(p); });
    }
    if ((context?.type === 'order' || context?.type === 'return') && context.id) {
      // Buyer's own orders are already hydrated in AppState via the buyer-orders RPC.
      const order = orders.find(o => o.id === context.id);
      if (order) {
        setContextOrder(order);
        setMsgText(prev => prev || `Hi, I have a question regarding ${context.type === 'return' ? 'my return for ' : ''}order #${context.id.slice(0, 8)}`);
      }
    }
    return () => { cancelled = true; };
  }, [context, orders]);

  const clearContext = () => { setContext(null); setContextProduct(null); setContextOrder(null); };

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
    if (selectedSeller && !map.has(selectedSeller) && initialVendor?.seller_id === selectedSeller) {
      map.set(selectedSeller, {
        seller_id: selectedSeller,
        store_name: initialVendor.store_name || 'Seller',
        logo_url: initialVendor.logo_url,
        is_verified: !!initialVendor.is_verified,
        lastMessage: 'New conversation',
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
      } as any);
    }
    let list = Array.from(map.values());
    list = list.filter(v => showArchived ? archivedSellers.has(v.seller_id) : !archivedSellers.has(v.seller_id));
    if (searchTerm) list = list.filter(v => v.store_name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterUnread) list = list.filter(v => v.unreadCount > 0);
    return list.sort((a, b) => {
      const ap = pinnedSellers.has(a.seller_id) ? 1 : 0;
      const bp = pinnedSellers.has(b.seller_id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
    });
  }, [chats, userId, searchTerm, filterUnread, pinnedSellers, archivedSellers, showArchived, selectedSeller, initialVendor]);

  const totalUnread = useMemo(
    () => chats.filter(c => c.receiver_id === userId && !c.read).length,
    [chats, userId]
  );

  const activeMessages = useMemo(() =>
    chats
      .filter(c => c.sender_id === selectedSeller || c.receiver_id === selectedSeller)
      .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime()),
    [chats, selectedSeller]
  );

  // People this buyer has already messaged — shown in the "new message" picker
  // before they type anything (#19).
  const recentContacts = useMemo(() => {
    const map = new Map<string, { id: string; full_name: string | null; avatar_url: string | null; role: string }>();
    for (const m of chats) {
      const isMine = m.sender_id === userId;
      const peerId = isMine ? m.receiver_id : m.sender_id;
      const peer: any = isMine ? (m as any).receiver : (m as any).sender;
      if (!peerId || map.has(peerId)) continue;
      map.set(peerId, { id: peerId, full_name: peer?.full_name || null, avatar_url: peer?.avatar_url || null, role: 'seller' });
    }
    return [...map.values()].slice(0, 8);
  }, [chats, userId]);

  const handleSend = async (e?: React.FormEvent) => {
    if (!rateLimit('send_message', 15)) { addToast('Slow down', 'error'); return; }
    if (e) e.preventDefault();
    if (!msgText.trim() && !attachment) {
      // Whitespace-only: reset so the placeholder returns instead of leaving
      // an invisible, non-empty value that reads as a broken input.
      setMsgText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }
    if (!selectedSeller) return;
    const text = msgText.trim();
    const refProductId = contextProduct?.id;
    const refOrderId = contextOrder?.id;
    const refAttachment = attachment || undefined;
    const refReplyId = replyingTo?.id;
    setMsgText('');
    setReplyingTo(null);
    setAttachment(null);
    setMagicMode(false);
    clearContext(); // the reference rides on this first message only
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessage(selectedSeller, text, refProductId, refOrderId, refAttachment, refReplyId);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `chat-attachments/${user.id}/${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('mali-mart-uploads')
        .upload(filePath, await compressImage(file), { cacheControl: IMMUTABLE_CACHE });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('mali-mart-uploads').getPublicUrl(filePath);
      setAttachment({ url: publicUrl, type: file.type.startsWith('image/') ? 'image' : 'file' });
      addToast('File uploaded', 'success');
    } catch { addToast('Upload failed', 'error'); }
    finally { setIsUploading(false); }
  };

  const handleMagicPolish = async (toneOverride?: 'professional' | 'persuasive' | 'friendly') => {
    if (!msgText.trim()) { addToast('Type a message first, then pick a tone', 'info'); return; }
    setIsPolishing(true);
    const refined = await aiService.refineMessage(msgText, toneOverride ?? magicTone);
    setMsgText(refined);
    setIsPolishing(false);
    addToast('Draft polished', 'success');
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

  const toggleArchive = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setArchivedSellers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(archiveKey, JSON.stringify([...next])); } catch {}
      return next;
    });
    if (selectedSeller === id) setSelectedSeller(null);
  };

  const handleReport = async () => {
    if (!reportingUser || !user) return;
    const role = await fetchProfileRole(reportingUser);
    if (role === 'admin') { addToast('Cannot report an administrator', 'error'); setReportingUser(null); return; }
    await reportUser(reportingUser, reportReason, reportDetails);
    addToast('User reported', 'success');
    setReportingUser(null);
    setReportReason('Spam');
    setReportDetails('');
  };

  const handleDeleteChat = async (partnerId: string) => {
    const mine = chats.filter(c => c.sender_id === userId && (c.receiver_id === partnerId || c.sender_id === partnerId));
    for (const m of mine) { await softDeleteMessage(m.id); }
    const msgs = await fetchMessages();
    setChats(msgs.filter(m => !blockedUsers.has(m.sender_id) && !blockedUsers.has(m.receiver_id)));
    setSelectedSeller(null);
    addToast('Chat deleted', 'success');
  };

  const handleBlock = async (partnerId: string) => {
    const role = await fetchProfileRole(partnerId);
    if (role === 'admin') { addToast('Cannot block an administrator', 'error'); return; }
    await blockUser(partnerId);
    setSelectedSeller(null);
    addToast('User blocked', 'success');
  };

  const fetchUserProfile = async (uid: string) => {
    const data = await fetchProfile(uid);
    if (data) setViewingProfile({ id: data.id, name: data.full_name || 'User', avatar: data.avatar_url, role: data.role, created_at: data.created_at, region: data.region, trust_score: data.trust_score, is_verified: data.is_verified });
  };

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeMessages, magicMode]);

  const currentVendor = selectedSeller ? vendorList.find(v => v.seller_id === selectedSeller) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-0 h-[calc(100vh-7rem)] min-h-[520px] max-h-[900px] overflow-hidden bg-background border border-foreground/8 rounded-2xl shadow-sm animate-in fade-in duration-300">
      {/* ── Sidebar ── */}
      <SidebarContainer isVisible={!!selectedSeller}>
        <div className="p-4 border-b border-foreground/8 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-foreground">
              Messages
              {totalUnread > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[9px] font-black text-white">
                  {totalUnread}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowNewChat(true)}
                title="New message"
                className="h-7 w-7 flex items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setFilterUnread(v => !v)}
                className={`h-7 px-3 rounded-full text-[10px] font-bold transition-colors ${filterUnread ? 'bg-emerald-500 text-white' : 'bg-foreground/[0.06] text-foreground/50 hover:text-foreground'}`}
              >
                Unread
              </button>
              <button
                onClick={() => setShowArchived(v => !v)}
                className={`h-7 px-3 rounded-full text-[10px] font-bold transition-colors ${showArchived ? 'bg-emerald-500 text-white' : 'bg-foreground/[0.06] text-foreground/50 hover:text-foreground'}`}
              >
                Archived
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/35" />
            <Input
              placeholder="Search…"
              value={searchTerm}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs rounded-xl bg-foreground/[0.04] border-transparent"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 no-scrollbar">
          {vendorList.length === 0 ? (
            <ChatEmptyState
              title={showArchived ? 'No archived chats' : filterUnread ? 'No unread messages' : searchTerm ? 'No matches' : 'No conversations yet'}
              hint={!showArchived && !filterUnread && !searchTerm ? 'Message a seller from any product page.' : undefined}
            />
          ) : vendorList.map(v => (
            <ConversationListItem
              key={v.seller_id}
              item={{ id: v.seller_id, name: v.store_name, avatarUrl: v.logo_url, isVerified: v.is_verified, lastMessage: (v as any).lastMessage, lastMessageAt: (v as any).lastMessageAt, unreadCount: (v as any).unreadCount }}
              selected={selectedSeller === v.seller_id}
              pinned={pinnedSellers.has(v.seller_id)}
              archived={archivedSellers.has(v.seller_id)}
              onSelect={() => { if (v.seller_id !== selectedSeller) clearContext(); setSelectedSeller(v.seller_id); }}
              onTogglePin={(e) => togglePin(e, v.seller_id)}
              onToggleArchive={(e) => toggleArchive(e, v.seller_id)}
            />
          ))}
        </div>
      </SidebarContainer>

      {/* ── Chat area ── */}
      <ChatAreaContainer isVisible={!selectedSeller}>
        {!selectedSeller ? (
          <ChatEmptyState title="Select a conversation" hint="Your chats with sellers about products and orders live here." />
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-foreground/8 flex items-center gap-3 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
              <button onClick={() => setSelectedSeller(null)} aria-label="Back" className="md:hidden flex items-center justify-center w-8 h-8 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.09] transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity flex-1 min-w-0"
                onClick={() => fetchUserProfile(selectedSeller || '')}
              >
                <div className="w-9 h-9 rounded-full bg-foreground/[0.08] overflow-hidden shrink-0">
                  <img
                    src={currentVendor?.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentVendor?.store_name || 'S')}`}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-[13px] text-foreground truncate">{currentVendor?.store_name}</p>
                    {currentVendor?.is_verified && <VerifiedBadge iconOnly size="w-3.5 h-3.5" />}
                  </div>
                  <p className="text-[10px] text-foreground/40">Tap to view profile</p>
                </div>
              </div>
              {/* Header actions */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setChatMenuOpen(o => !o)}
                  aria-label="Chat options"
                  className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-foreground/[0.06] text-foreground/50 hover:text-foreground transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {chatMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-background border border-foreground/10 rounded-xl shadow-xl p-1 z-50">
                    <button
                      onClick={() => { setChatMenuOpen(false); setReportingUser(selectedSeller); }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left text-xs font-semibold text-foreground/70 hover:bg-foreground/[0.05] transition-colors"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" /> Report user
                    </button>
                    <button
                      onClick={() => { setChatMenuOpen(false); setConfirmAction({ type: 'block', targetId: selectedSeller }); }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left text-xs font-semibold text-foreground/70 hover:bg-foreground/[0.05] transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5" /> Block user
                    </button>
                    <button
                      onClick={() => { setChatMenuOpen(false); setConfirmAction({ type: 'delete-chat', targetId: selectedSeller }); }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left text-xs font-semibold text-rose-500 hover:bg-rose-500/8 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete chat
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-0 bg-foreground/[0.01] no-scrollbar">
              {activeMessages.map((c, idx) => {
                const prev = activeMessages[idx - 1];
                const showDay = !prev || !isSameDay(new Date(prev.created_at!), new Date(c.created_at!));
                const mine = c.sender_id === userId;
                const replyToContent = c.reply_to ? (c.reply_to.text || c.reply_to.body) : null;
                return (
                  <React.Fragment key={c.id}>
                    {showDay && c.created_at && <DayDivider date={new Date(c.created_at)} />}
                    <MessageBubble
                      id={c.id}
                      body={c.body || c.text}
                      attachmentUrl={c.attachment_url}
                      attachmentType={c.attachment_type as any}
                      deletedAt={c.deleted_at}
                      createdAt={c.created_at}
                      isMine={mine}
                      read={c.read}
                      reactions={c.reactions}
                      replyToContent={replyToContent}
                      contextSlot={c.product || c.order ? (
                        <ProductOrderTag product={c.product} order={c.order} onViewProduct={setViewingProduct} onViewOrder={setViewingOrder} />
                      ) : undefined}
                      onReply={() => setReplyingTo(c)}
                      onDelete={mine ? async () => { await softDeleteMessage(c.id); const msgs = await fetchMessages(); setChats(msgs); } : undefined}
                      onReport={!mine ? () => setReportingUser(c.sender_id) : undefined}
                      onReact={(emoji) => { addReaction(c.id, emoji); fetchMessages().then(setChats); }}
                    />
                  </React.Fragment>
                );
              })}
              {remoteIsTyping && <TypingIndicator />}
              <div ref={scrollRef} />
            </div>

            {/* Composer */}
            <div className="px-4 py-3 bg-background border-t border-foreground/8 flex flex-col gap-2">
              {/* Reference card — what this message is about; sent with the next message */}
              {(contextProduct || contextOrder) && (
                <div
                  role="group"
                  aria-label={contextProduct ? `Asking about product ${contextProduct.name}` : `Asking about order ${contextOrder?.id?.slice(0, 8)}`}
                  className="flex items-center gap-3 p-2.5 bg-emerald-500/[0.06] rounded-2xl border border-emerald-500/25 animate-in slide-in-from-bottom-2"
                >
                  {contextProduct ? (
                    <>
                      {contextProduct.images?.[0] ? (
                        <img
                          src={contextProduct.images[0]}
                          alt={contextProduct.name}
                          className="w-11 h-11 object-cover rounded-xl flex-shrink-0"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                          <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-0.5">Asking about</p>
                        <p className="text-xs font-bold text-foreground truncate">{contextProduct.name}</p>
                        {typeof contextProduct.price === 'number' && (
                          <p className="text-[11px] font-semibold text-foreground/50">{formatTZS(contextProduct.price)}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/product/${contextProduct.id}`)}
                        aria-label={`View product ${contextProduct.name}`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </>
                  ) : contextOrder && (
                    <>
                      <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-0.5">
                          {context?.type === 'return' ? 'About your return' : 'About your order'}
                        </p>
                        <p className="text-xs font-bold text-foreground truncate">Order #{contextOrder.id?.slice(0, 8).toUpperCase()}</p>
                        {typeof (contextOrder as any).total === 'number' && (
                          <p className="text-[11px] font-semibold text-foreground/50">{formatTZS((contextOrder as any).total)}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewingOrder(contextOrder)}
                        aria-label={`View order ${contextOrder.id?.slice(0, 8)}`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={clearContext}
                    aria-label="Remove reference"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {replyingTo && (
                <div className="flex items-center gap-3 p-2.5 bg-foreground/[0.03] rounded-xl border border-foreground/8">
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-0.5">Replying to</p>
                    <p className="text-[11px] text-foreground/60 truncate italic">"{replyingTo.text || replyingTo.body}"</p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="p-1.5 hover:bg-foreground/[0.06] rounded-full text-foreground/40 hover:text-foreground transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {attachment && (
                <div className="flex items-center gap-3 p-2.5 bg-foreground/[0.03] rounded-xl border border-foreground/8">
                  <Paperclip className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-[11px] font-bold flex-1">{attachment.type === 'image' ? 'Image attached' : 'File attached'}</span>
                  <button onClick={() => setAttachment(null)} className="p-1.5 hover:bg-foreground/[0.06] rounded-full text-foreground/40 hover:text-foreground transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {magicMode && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/20 animate-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" /> Magic Compose
                    </span>
                    <button onClick={() => setMagicMode(false)} className="p-1 hover:bg-emerald-200/60 dark:hover:bg-emerald-900/30 rounded-full text-emerald-600 dark:text-emerald-400">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {(['professional', 'persuasive', 'friendly'] as const).map(tone => (
                      <button
                        key={tone}
                        onClick={() => { setMagicTone(tone); handleMagicPolish(tone); }}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all border
                          ${magicTone === tone ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-background text-emerald-700 dark:text-emerald-300 border-transparent hover:border-emerald-300'}`}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-end gap-2">
                {/* Left actions */}
                <div className="flex items-center gap-1 pb-1.5">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,.pdf,.doc,.docx" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className={`p-2.5 rounded-xl transition-all ${attachment ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'text-foreground/35 hover:bg-foreground/[0.05] hover:text-foreground'}`}
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => magicMode ? handleMagicPolish() : setMagicMode(true)}
                    className={`p-2.5 rounded-xl transition-all ${magicMode ? 'bg-emerald-500 text-white shadow-sm' : 'text-foreground/35 hover:bg-foreground/[0.05] hover:text-emerald-500'}`}
                  >
                    {isPolishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  </button>
                </div>

                {/* Textarea */}
                <div className="flex-1 bg-foreground/[0.04] rounded-xl border border-foreground/8 focus-within:border-foreground/20 focus-within:bg-background transition-all">
                  <textarea
                    ref={textareaRef}
                    placeholder={contextProduct ? `Ask about ${contextProduct.name}…` : contextOrder ? 'Ask about this order…' : 'Type a message…'}
                    aria-label="Message"
                    value={msgText}
                    onChange={(e: any) => {
                      setMsgText(e.target.value);
                      handleTyping();
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    rows={1}
                    className="w-full bg-transparent text-[13px] px-4 py-3 min-h-[44px] max-h-24 resize-none outline-none overflow-y-auto placeholder:text-foreground/35 text-foreground"
                  />
                </div>

                {/* Send */}
                <Button
                  type="submit"
                  variant="brand"
                  onClick={() => handleSend()}
                  // Matches Seller/Admin, which already did this. Without it the
                  // only feedback for a whitespace-only draft was an invisible
                  // dead box.
                  disabled={!msgText.trim() && !attachment}
                  className="h-11 w-11 p-0 rounded-xl flex items-center justify-center flex-shrink-0"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <UserProfileModal isOpen={!!viewingProfile} onClose={() => setViewingProfile(null)} user={viewingProfile} />
            <ProductModal isOpen={!!viewingProduct} onClose={() => setViewingProduct(null)} product={viewingProduct} />
            <OrderDetailsModal isOpen={!!viewingOrder} onClose={() => setViewingOrder(null)} order={viewingOrder} />
          </>
        )}
      </ChatAreaContainer>

      {/* ── Details panel ── */}
      <DetailsAreaContainer isVisible={!!selectedSeller}>
        <div className="p-5 overflow-y-auto no-scrollbar">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/35 mb-5">Seller info</h4>
          {currentVendor && (
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-foreground/[0.06] overflow-hidden">
                <img
                  src={currentVendor.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentVendor.store_name)}`}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">{currentVendor.store_name}</p>
                {(currentVendor as any).region && <p className="text-[11px] text-foreground/45 mt-0.5">{(currentVendor as any).region}</p>}
              </div>
              <button
                onClick={() => fetchUserProfile(currentVendor.seller_id)}
                className="w-full mt-2 py-2 rounded-xl border border-foreground/10 text-[11px] font-semibold text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground transition-colors"
              >
                View full profile
              </button>
            </div>
          )}
        </div>
      </DetailsAreaContainer>

      {/* Report modal */}
      {reportingUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background border border-foreground/10 w-full max-w-sm p-6 rounded-2xl shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-foreground">Report user</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45 block mb-1.5">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full h-11 bg-foreground/[0.03] border border-foreground/10 rounded-xl px-3 text-sm text-foreground focus:outline-none focus:border-foreground/25 transition-colors"
                >
                  <option value="Spam">Spam</option>
                  <option value="Harassment">Harassment</option>
                  <option value="Inappropriate Content">Inappropriate content</option>
                  <option value="Fraud/Scam">Fraud or scam</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45 block mb-1.5">Details</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="What happened?"
                  className="w-full h-24 bg-foreground/[0.03] border border-foreground/10 rounded-xl p-3 text-sm text-foreground focus:outline-none focus:border-foreground/25 transition-colors resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="secondary" onClick={() => setReportingUser(null)} className="flex-1 rounded-xl">Cancel</Button>
                <Button variant="primary" onClick={handleReport} className="flex-1 rounded-xl">Submit</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmAction}
        title={confirmAction?.type === 'block' ? 'Block this user?' : 'Delete this chat?'}
        message={confirmAction?.type === 'block'
          ? "They won't be able to message you. You can unblock them later in settings."
          : 'Your messages will be removed from your side. The other person keeps their copy.'}
        confirmText={confirmAction?.type === 'block' ? 'Block' : 'Delete chat'}
        isDangerous
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          const a = confirmAction;
          setConfirmAction(null);
          if (!a) return;
          if (a.type === 'block') await handleBlock(a.targetId);
          else await handleDeleteChat(a.targetId);
        }}
      />

      <NewConversationModal
        isOpen={showNewChat}
        onClose={() => setShowNewChat(false)}
        roleFilter="seller"
        recentContacts={recentContacts}
        onSelect={(contact) => {
          setInitialVendor({
            seller_id: contact.id,
            store_name: contact.full_name || 'Seller',
            logo_url: contact.avatar_url || undefined,
            is_verified: false,
          } as VendorProfile);
          setSelectedSeller(contact.id);
        }}
      />
    </div>
  );
};
