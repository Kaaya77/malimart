import { sanitizeText, rateLimit } from '../src/security';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Send, Loader2, Sparkles, Wand2, Search,
  X, Paperclip, Ban, ShieldAlert, MoreVertical, Tag, Truck, Check, CheckCheck,
  MessageSquarePlus, Plus, Trash2,
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { Button, Input, useToast, ConfirmDialog, UserProfileModal, GraphicalTag } from './UI';
import { ProductModal } from './ProductModal';
import { OrderDetailsModal } from './OrderDetailsModal';
import { supabase } from '../services/supabaseClient';
import { fetchProfile, fetchProfileNameAvatar } from '../services/messagesService';
import { compressImage, IMMUTABLE_CACHE } from '../services/imageCompression';
import { Product, Order } from '../types';
import * as aiService from '../services/geminiService';
import { MessageContainer, SidebarContainer, ChatAreaContainer, DetailsAreaContainer } from './MessageShared';
import {
  ConversationListItem, ChatEmptyState, DayDivider, isSameDay,
  MessageBubble, TypingIndicator, NewConversationModal,
} from './messaging/ConversationKit';

// ─── ProductOrderTag ─────────────────────────────────────────────────────────
export const ProductOrderTag = ({
  product, order, onViewProduct, onViewOrder,
}: { product?: Partial<Product>; order?: Partial<Order>; onViewProduct: (p: Product) => void; onViewOrder: (o: Order) => void }) => {
  if (!product && !order) return null;
  return (
    <div className="mb-3">
      {order && (
        <div className="cursor-pointer inline-block mb-2" onClick={() => onViewOrder(order as Order)}>
          <GraphicalTag type="order" label={`Order #${order.id?.slice(0, 8)}`} id={order.id} />
        </div>
      )}
      {product && (
        <div
          className="cursor-pointer flex items-center gap-3 p-3 rounded-xl bg-foreground/[0.04] border border-foreground/8 hover:border-foreground/20 transition-all group"
          onClick={() => onViewProduct(product as Product)}
        >
          {product.images?.[0] && (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-10 h-10 object-cover rounded-lg flex-shrink-0"
              loading="lazy"
              decoding="async"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{product.name}</p>
            <p className="text-[10px] text-foreground/40 mt-0.5 flex items-center gap-1">
              <Tag className="w-2.5 h-2.5" /> Contextual product
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const QUICK_REPLY_KEY = 'malimart_seller_quick_replies';
const DEFAULT_QUICK_REPLIES = [
  'Thank you for your order! 🙏',
  'This item will ship within 2 business days.',
  'Sorry for the delay — your order is on its way.',
  'Feel free to ask if you have any questions!',
];

// ─── SellerMessages ──────────────────────────────────────────────────────────
export const SellerMessages = ({
  userId, selectedChatUser, setSelectedChatUser, products,
  initialProductId, initialOrderId, initialChatUser,
}: {
  userId: string;
  selectedChatUser: string | null;
  setSelectedChatUser: (uid: string | null) => void;
  products: Product[];
  initialProductId?: string | null;
  initialOrderId?: string | null;
  initialChatUser?: string | null;
}) => {
  const { user, fetchMessages, sendMessage, softDeleteMessage, reportUser, addReaction, blockedUsers, markMessagesAsRead, blockUser, unblockUser, preloadedMessages } = useAppState();
  const { addToast } = useToast();
  const [chats, setChats] = useState<any[]>(
    preloadedMessages?.filter(m => !blockedUsers.has(m.sender_id) && !blockedUsers.has(m.receiver_id)) || []
  );

  // Keep chats in sync if preloadedMessages arrive after mount (context hydrates async).
  useEffect(() => {
    if (preloadedMessages?.length && chats.length === 0) {
      setChats(preloadedMessages.filter(m => !blockedUsers.has(m.sender_id) && !blockedUsers.has(m.receiver_id)));
    }
  }, [preloadedMessages]);
  const [newMsg, setNewMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);
  const [pinnedUsers, setPinnedUsers] = useState<Set<string>>(new Set());
  const archiveKey = `malimart_archived_seller_chats_${userId}`;
  const [archivedUsers, setArchivedUsers] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(archiveKey) || '[]')); } catch { return new Set(); }
  });
  const [showArchived, setShowArchived] = useState(false);
  const quickReplyKey = `${QUICK_REPLY_KEY}_${userId}`;
  const [quickReplies, setQuickReplies] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(quickReplyKey) || 'null') ?? DEFAULT_QUICK_REPLIES; } catch { return DEFAULT_QUICK_REPLIES; }
  });
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [newQuickReply, setNewQuickReply] = useState('');

  const [magicMode, setMagicMode] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [magicTone, setMagicTone] = useState<'professional' | 'persuasive' | 'friendly'>('professional');
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);

  const [remoteIsTyping, setRemoteIsTyping] = useState(false);
  const [reportingUser, setReportingUser] = useState<any | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState('Spam');
  const [reportDetails, setReportDetails] = useState('');
  const [viewingProfile, setViewingProfile] = useState<any | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [attachment, setAttachment] = useState<{ url: string; type: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);

  const [initialUserProfile, setInitialUserProfile] = useState<{ name: string; avatar: string | null } | null>(null);

  useEffect(() => {
    if (!initialChatUser) return;
    fetchProfileNameAvatar(initialChatUser)
      .then((data) => {
        if (data) setInitialUserProfile({ name: data.full_name || 'Buyer', avatar: data.avatar_url ?? null });
      });
  }, [initialChatUser]);

  // Starting a brand-new conversation (no existing thread) — same shape as
  // the initialChatUser deep-link above, just sourced from the contact
  // search modal instead of a "Contact Seller" navigation.
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatContact, setNewChatContact] = useState<{ id: string; name: string; avatar: string | null } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const load = async (bust = false) => {
      const msgs = await fetchMessages(bust);
      setChats(msgs.filter(m => !blockedUsers.has(m.sender_id) && !blockedUsers.has(m.receiver_id)));
    };
    load(false);
    const channel = supabase.channel(`msgs-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, () => load(true))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${userId}` }, () => load(true))
      .subscribe();
    const typingChannel = supabase.channel(`typing:${userId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId === selectedChatUser) {
          setRemoteIsTyping(payload.isTyping);
          setTimeout(() => setRemoteIsTyping(false), 3000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); supabase.removeChannel(typingChannel); };
  }, [userId, fetchMessages, selectedChatUser, blockedUsers]);

  // One outbound typing channel per selected conversation — created on select,
  // reused for every keystroke, removed on switch/unmount. (Previously each
  // keystroke created a fresh, never-cleaned-up channel.)
  const typingOutRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!selectedChatUser) return;
    const ch = supabase.channel(`typing:${selectedChatUser}`).subscribe();
    typingOutRef.current = ch;
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingOutRef.current = null;
      supabase.removeChannel(ch);
    };
  }, [selectedChatUser]);

  const handleTyping = () => {
    const ch = typingOutRef.current;
    if (!selectedChatUser || !ch) return;
    ch.send({ type: 'broadcast', event: 'typing', payload: { userId, isTyping: true } });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingOutRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId, isTyping: false } });
    }, 2000);
  };

  const users = useMemo(() => {
    const map = new Map();
    chats.forEach(c => {
      const isMe = c.sender_id === userId;
      const otherId = isMe ? c.receiver_id : c.sender_id;
      const partnerProfile = isMe ? c.receiver : c.sender;
      if (!map.has(otherId)) {
        map.set(otherId, { id: otherId, name: partnerProfile?.full_name || 'User', avatar: partnerProfile?.avatar_url, lastMsg: c.text || c.body, time: c.created_at, unread: !isMe && !c.read });
      } else {
        const existing = map.get(otherId);
        if (new Date(c.created_at) > new Date(existing.time)) {
          map.set(otherId, { ...existing, lastMsg: c.text || c.body, time: c.created_at, unread: !isMe && !c.read });
        }
      }
    });
    if (initialChatUser && !map.has(initialChatUser)) {
      map.set(initialChatUser, {
        id: initialChatUser,
        name: initialUserProfile?.name || 'Buyer',
        avatar: initialUserProfile?.avatar || null,
        lastMsg: 'New conversation',
        time: new Date().toISOString(),
        unread: false,
      });
    }
    if (newChatContact && !map.has(newChatContact.id)) {
      map.set(newChatContact.id, {
        id: newChatContact.id,
        name: newChatContact.name,
        avatar: newChatContact.avatar,
        lastMsg: 'New conversation',
        time: new Date().toISOString(),
        unread: false,
      });
    }
    let result = Array.from(map.values());
    result = result.filter((u: any) => showArchived ? archivedUsers.has(u.id) : !archivedUsers.has(u.id));
    if (searchTerm) result = result.filter((u: any) => u.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterUnread) result = result.filter((u: any) => u.unread);
    return result.sort((a: any, b: any) => {
      if (pinnedUsers.has(a.id) && !pinnedUsers.has(b.id)) return -1;
      if (!pinnedUsers.has(a.id) && pinnedUsers.has(b.id)) return 1;
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    });
  }, [chats, userId, searchTerm, filterUnread, pinnedUsers, archivedUsers, showArchived, initialChatUser, initialUserProfile, newChatContact]);

  const activeChats = useMemo(() => {
    if (!selectedChatUser) return [];
    return chats
      .filter(c => c.sender_id === selectedChatUser || c.receiver_id === selectedChatUser)
      .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime());
  }, [chats, selectedChatUser]);

  const activeUser = useMemo(() => users.find((u: any) => u.id === selectedChatUser), [users, selectedChatUser]);

  const lastSeenMsgIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeChats.length === 0) return;
    const lastMsg = activeChats[activeChats.length - 1];
    // Only call AI when there's a NEW inbound message we haven't processed yet
    if (lastMsg.sender_id === userId) { setSuggestedReplies([]); return; }
    if (lastMsg.id === lastSeenMsgIdRef.current) return;
    lastSeenMsgIdRef.current = lastMsg.id;
    const t = setTimeout(() => {
      aiService.generateSellerReplies(lastMsg.text || lastMsg.body).then(setSuggestedReplies);
    }, 1500); // debounce: wait 1.5s in case more messages arrive
    return () => clearTimeout(t);
  }, [activeChats, userId]);

  const handleSend = async (e?: React.FormEvent, textOverride?: string) => {
    if (!rateLimit('send_message', 15)) { addToast('Slow down', 'error'); return; }
    if (e) e.preventDefault();
    const text = textOverride || newMsg;
    if (!selectedChatUser || (!text.trim() && !attachment)) return;
    await sendMessage(selectedChatUser, sanitizeText(text), undefined, undefined, attachment || undefined, replyingTo?.id);
    setNewMsg('');
    setAttachment(null);
    setReplyingTo(null);
    setMagicMode(false);
    setSuggestedReplies([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `chat-attachments/${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('mali-mart-uploads').upload(filePath, await compressImage(file), { cacheControl: IMMUTABLE_CACHE });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('mali-mart-uploads').getPublicUrl(filePath);
      setAttachment({ url: publicUrl, type: file.type.startsWith('image/') ? 'image' : 'file' });
      addToast('File uploaded', 'success');
    } catch (error: any) { addToast(error.message, 'error'); }
    finally { setIsUploading(false); }
  };

  const handleMagicPolish = async () => {
    if (!newMsg.trim()) return;
    setIsPolishing(true);
    const refined = await aiService.refineMessage(newMsg, magicTone);
    setNewMsg(refined);
    setIsPolishing(false);
    addToast('Draft polished by AI', 'success');
  };

  const togglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = new Set(pinnedUsers);
    next.has(id) ? next.delete(id) : next.add(id);
    setPinnedUsers(next);
  };

  const toggleArchive = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setArchivedUsers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(archiveKey, JSON.stringify([...next])); } catch {}
      return next;
    });
    if (selectedChatUser === id) setSelectedChatUser(null);
  };

  const addQuickReply = () => {
    const text = newQuickReply.trim();
    if (!text) return;
    const next = [...quickReplies, text];
    setQuickReplies(next);
    try { localStorage.setItem(quickReplyKey, JSON.stringify(next)); } catch {}
    setNewQuickReply('');
  };

  const removeQuickReply = (idx: number) => {
    const next = quickReplies.filter((_, i) => i !== idx);
    setQuickReplies(next);
    try { localStorage.setItem(quickReplyKey, JSON.stringify(next)); } catch {}
  };

  const handleReport = async () => {
    if (!reportingUser || !userId) return;
    if (reportingUser.role === 'admin') { addToast('Cannot report an administrator', 'error'); setReportingUser(null); return; }
    setIsReporting(true);
    try {
      await reportUser(reportingUser.id, reportReason, reportDetails);
      addToast('User reported', 'success');
      setReportingUser(null);
      setReportReason('Spam');
      setReportDetails('');
    } catch { addToast('Failed to report', 'error'); }
    finally { setIsReporting(false); }
  };

  const handleBlockAction = async (targetUserId: string) => {
    const targetUser = users.find((u: any) => u.id === targetUserId);
    if ((targetUser as any)?.role === 'admin') { addToast('Cannot block an administrator', 'error'); return; }
    try { await blockUser(targetUserId); addToast('User blocked', 'success'); }
    catch { addToast('Failed to block', 'error'); }
  };

  const fetchUserProfile = async (uid: string) => {
    const data = await fetchProfile(uid);
    if (data) setViewingProfile({ id: data.id, name: data.full_name || 'User', avatar: data.avatar_url, role: data.role, created_at: data.created_at, region: data.region, trust_score: data.trust_score, is_verified: data.is_verified });
  };

  useEffect(() => {
    if (selectedChatUser) markMessagesAsRead(selectedChatUser);
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChats, magicMode, selectedChatUser]);

  return (
    <MessageContainer>
      {/* ── Sidebar ── */}
      <SidebarContainer isVisible={!!selectedChatUser}>
        <div className="p-4 border-b border-foreground/8 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-foreground">
              Inbox
              <span className="ml-1.5 text-foreground/40 font-normal text-xs">({users.length})</span>
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowNewChat(true)}
                title="New message"
                className="h-7 w-7 flex items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setFilterUnread(!filterUnread)}
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
          {users.length === 0 ? (
            <ChatEmptyState
              title={showArchived ? 'No archived chats' : filterUnread ? 'No unread messages' : searchTerm ? 'No matches' : 'No conversations yet'}
            />
          ) : (users as any[]).map(u => (
            <ConversationListItem
              key={u.id}
              item={{
                id: u.id,
                name: u.name,
                avatarUrl: u.avatar,
                lastMessage: u.lastMsg,
                lastMessageAt: u.time,
                unreadCount: chats.filter(c => c.sender_id === u.id && c.receiver_id === userId && !c.read).length,
              }}
              selected={selectedChatUser === u.id}
              pinned={pinnedUsers.has(u.id)}
              archived={archivedUsers.has(u.id)}
              onSelect={() => setSelectedChatUser(u.id)}
              onTogglePin={(e) => togglePin(e, u.id)}
              onToggleArchive={(e) => toggleArchive(e, u.id)}
            />
          ))}
        </div>
      </SidebarContainer>

      {/* ── Chat area ── */}
      <ChatAreaContainer isVisible={!selectedChatUser}>
        {!selectedChatUser && (
          <ChatEmptyState title="Your inbox" hint="Select a conversation to start responding to buyers." />
        )}
        {selectedChatUser && (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-foreground/8 flex items-center gap-3 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedChatUser(null); }}
                className="md:hidden flex items-center justify-center w-8 h-8 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.09] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity flex-1 min-w-0"
                onClick={() => fetchUserProfile(selectedChatUser)}
              >
                <div className="w-9 h-9 rounded-full bg-foreground/[0.08] overflow-hidden shrink-0">
                  {activeUser?.avatar ? (
                    <img src={activeUser.avatar} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-foreground/60">
                      {(activeUser?.name || 'U').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[13px] text-foreground truncate">
                    {activeUser?.name || 'Buyer'}
                  </p>
                  {initialOrderId && selectedChatUser === initialChatUser ? (
                    <p className="text-[10px] text-brand-500 font-semibold flex items-center gap-1">
                      <Truck className="w-2.5 h-2.5" /> Re: Order #{initialOrderId.slice(0, 8).toUpperCase()}
                    </p>
                  ) : (
                    <p className="text-[10px] text-foreground/40">Buyer</p>
                  )}
                </div>
              </div>
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setChatMenuOpen(o => !o)}
                  className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-foreground/[0.06] text-foreground/50 hover:text-foreground transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {chatMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-background border border-foreground/10 rounded-xl shadow-xl p-1 z-50">
                    <button
                      onClick={() => { setChatMenuOpen(false); setReportingUser(activeUser); }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left text-xs font-semibold text-foreground/70 hover:bg-foreground/[0.05] transition-colors"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" /> Report user
                    </button>
                    <button
                      onClick={() => { setChatMenuOpen(false); blockedUsers.has(selectedChatUser) ? unblockUser(selectedChatUser) : handleBlockAction(selectedChatUser); }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left text-xs font-semibold text-foreground/70 hover:bg-foreground/[0.05] transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      {blockedUsers.has(selectedChatUser) ? 'Unblock user' : 'Block user'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-5 bg-foreground/[0.01] no-scrollbar">
              {activeChats.map((c, index) => {
                const prev = index > 0 ? activeChats[index - 1] : null;
                const currDate = new Date(c.created_at!);
                const prevDate = prev ? new Date(prev.created_at!) : null;
                const showDate = !prevDate || !isSameDay(currDate, prevDate);
                const isMe = c.sender_id === userId;
                const replyToContent = c.reply_to_id
                  ? chats.find(m => m.id === c.reply_to_id)?.body?.slice(0, 60)
                  : null;
                return (
                  <React.Fragment key={c.id}>
                    {showDate && <DayDivider date={currDate} />}
                    <MessageBubble
                      id={c.id}
                      body={c.text || c.body}
                      attachmentUrl={c.attachment_url}
                      attachmentType={c.attachment_type}
                      deletedAt={c.deleted_at}
                      createdAt={c.created_at}
                      isMine={isMe}
                      read={c.read}
                      reactions={c.reactions}
                      replyToContent={replyToContent}
                      contextSlot={c.product || c.order ? (
                        <ProductOrderTag product={c.product} order={c.order} onViewProduct={setViewingProduct} onViewOrder={setViewingOrder} />
                      ) : undefined}
                      onReply={() => setReplyingTo(c)}
                      onDelete={isMe ? () => softDeleteMessage(c.id) : undefined}
                      onReport={!isMe ? () => setReportingUser(c.sender) : undefined}
                      onReact={(emoji) => addReaction(c.id, emoji)}
                    />
                  </React.Fragment>
                );
              })}
              {remoteIsTyping && <TypingIndicator />}
              <div ref={scrollRef} />
            </div>

            {/* Composer */}
            <div className="px-4 py-3 bg-background border-t border-foreground/8 flex flex-col gap-2">
              {/* Suggested replies */}
              {suggestedReplies.length > 0 && !magicMode && (
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {suggestedReplies.map((reply, i) => (
                    <button
                      key={i}
                      onClick={(e) => handleSend(e, reply)}
                      className="flex-shrink-0 px-3 py-1.5 rounded-full bg-foreground/[0.05] border border-foreground/8 text-[11px] font-medium text-foreground/70 hover:bg-foreground/[0.09] hover:text-foreground whitespace-nowrap transition-colors"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}

              {replyingTo && (
                <div className="flex items-center gap-3 p-2.5 bg-foreground/[0.03] rounded-xl border border-foreground/8">
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-0.5">Replying to</p>
                    <p className="text-[11px] text-foreground/60 truncate italic">"{replyingTo.body?.slice(0, 50)}"</p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="p-1.5 hover:bg-foreground/[0.06] rounded-full text-foreground/40 hover:text-foreground transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {showQuickReplies && (
                <div className="p-3 bg-foreground/[0.03] rounded-xl border border-foreground/8 animate-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground/50 flex items-center gap-1.5">
                      <MessageSquarePlus className="w-3 h-3" /> Quick Replies
                    </span>
                    <button onClick={() => setShowQuickReplies(false)} className="p-1 hover:bg-foreground/[0.06] rounded-full text-foreground/40">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-1.5 mb-2 max-h-40 overflow-y-auto no-scrollbar">
                    {quickReplies.map((reply, i) => (
                      <div key={i} className="flex items-center gap-1.5 group">
                        <button
                          onClick={(e) => { handleSend(e, reply); setShowQuickReplies(false); }}
                          className="flex-1 text-left px-3 py-1.5 rounded-lg bg-background border border-foreground/8 text-[11px] font-medium text-foreground/75 hover:bg-foreground/[0.05] transition-colors truncate"
                        >
                          {reply}
                        </button>
                        <button
                          onClick={() => removeQuickReply(i)}
                          aria-label="Remove template"
                          className="p-1.5 rounded-full text-foreground/30 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      placeholder="Add a template…"
                      value={newQuickReply}
                      onChange={(e: any) => setNewQuickReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addQuickReply(); } }}
                      className="h-8 text-xs rounded-lg bg-background border-foreground/8"
                    />
                    <button
                      onClick={addQuickReply}
                      aria-label="Save template"
                      className="p-2 rounded-lg bg-foreground/[0.06] text-foreground/50 hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {attachment && (
                <div className="flex items-center gap-3 p-2.5 bg-foreground/[0.03] rounded-xl border border-foreground/8">
                  {attachment.type === 'image' ? (
                    <img src={attachment.url} alt="" className="w-10 h-10 object-cover rounded-lg flex-shrink-0" loading="lazy" decoding="async" />
                  ) : <Paperclip className="w-4 h-4 text-emerald-500 shrink-0" />}
                  <span className="text-[11px] font-bold flex-1">Attachment ready</span>
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
                        onClick={() => setMagicTone(tone)}
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
                <div className="flex items-center gap-1 pb-1.5">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,application/pdf" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || blockedUsers.has(selectedChatUser || '')}
                    className={`p-2.5 rounded-xl transition-all ${attachment ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'text-foreground/35 hover:bg-foreground/[0.05] hover:text-foreground'}`}
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => magicMode ? handleMagicPolish() : setMagicMode(true)}
                    disabled={blockedUsers.has(selectedChatUser || '')}
                    className={`p-2.5 rounded-xl transition-all ${magicMode ? 'bg-emerald-500 text-white shadow-sm' : 'text-foreground/35 hover:bg-foreground/[0.05] hover:text-emerald-500'}`}
                  >
                    {isPolishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQuickReplies(v => !v)}
                    disabled={blockedUsers.has(selectedChatUser || '')}
                    title="Quick replies"
                    className={`p-2.5 rounded-xl transition-all ${showQuickReplies ? 'bg-emerald-500 text-white shadow-sm' : 'text-foreground/35 hover:bg-foreground/[0.05] hover:text-emerald-500'}`}
                  >
                    <MessageSquarePlus className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 bg-foreground/[0.04] rounded-xl border border-foreground/8 focus-within:border-foreground/20 focus-within:bg-background transition-all">
                  <textarea
                    ref={textareaRef}
                    placeholder={blockedUsers.has(selectedChatUser || '') ? 'You have blocked this user' : 'Type your response…'}
                    disabled={blockedUsers.has(selectedChatUser || '')}
                    value={newMsg}
                    onChange={(e: any) => {
                      setNewMsg(e.target.value);
                      handleTyping();
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    rows={1}
                    className="w-full bg-transparent text-[13px] px-4 py-3 min-h-[44px] max-h-32 resize-none outline-none no-scrollbar placeholder:text-foreground/35 text-foreground disabled:opacity-50"
                  />
                </div>

                <button
                  type="submit"
                  onClick={() => handleSend()}
                  disabled={(!newMsg.trim() && !attachment) || blockedUsers.has(selectedChatUser || '')}
                  className="h-11 w-11 flex items-center justify-center rounded-xl bg-foreground text-background hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </ChatAreaContainer>

      {/* ── Details panel ── */}
      <DetailsAreaContainer isVisible={!!selectedChatUser}>
        <div className="p-5 h-full overflow-y-auto no-scrollbar">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/35 mb-5">Buyer details</h3>
          {activeUser && (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-foreground/[0.06] overflow-hidden flex items-center justify-center text-xl font-bold text-foreground/50">
                  {activeUser.avatar
                    ? <img src={activeUser.avatar} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    : (activeUser.name || 'U').slice(0, 1).toUpperCase()
                  }
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">{activeUser.name}</h4>
                  <p className="text-[10px] text-foreground/40 mt-0.5">Buyer</p>
                </div>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => fetchUserProfile(activeUser.id)}
                  className="w-full py-2.5 rounded-xl border border-foreground/10 text-[11px] font-semibold text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground transition-colors"
                >
                  View full profile
                </button>
                <button
                  onClick={() => blockedUsers.has(activeUser.id) ? unblockUser(activeUser.id) : handleBlockAction(activeUser.id)}
                  className={`w-full py-2.5 rounded-xl border text-[11px] font-semibold transition-colors
                    ${blockedUsers.has(activeUser.id)
                      ? 'border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/5'
                      : 'border-rose-500/20 text-rose-500 hover:bg-rose-500/5'
                    }`}
                >
                  {blockedUsers.has(activeUser.id) ? 'Unblock user' : 'Block user'}
                </button>
                <button
                  onClick={() => setReportingUser(activeUser)}
                  className="w-full py-2.5 rounded-xl text-[11px] font-semibold text-rose-500 opacity-60 hover:opacity-100 hover:bg-rose-500/5 border border-transparent hover:border-rose-500/20 transition-all"
                >
                  Report user
                </button>
              </div>
            </div>
          )}
        </div>
      </DetailsAreaContainer>

      {/* Modals */}
      <UserProfileModal isOpen={!!viewingProfile} onClose={() => setViewingProfile(null)} user={viewingProfile} />
      <ProductModal isOpen={!!viewingProduct} onClose={() => setViewingProduct(null)} product={viewingProduct} />
      <OrderDetailsModal isOpen={!!viewingOrder} onClose={() => setViewingOrder(null)} order={viewingOrder} />

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
                  <option value="Spam">Spam or harassment</option>
                  <option value="Fraud">Fraud or scam</option>
                  <option value="Inappropriate">Inappropriate content</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45 block mb-1.5">Details (optional)</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Provide more context…"
                  className="w-full h-24 bg-foreground/[0.03] border border-foreground/10 rounded-xl p-3 text-sm text-foreground focus:outline-none focus:border-foreground/25 transition-colors resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setReportingUser(null)} className="flex-1 h-11 rounded-xl border border-foreground/10 text-sm font-semibold text-foreground/70 hover:bg-foreground/[0.04] transition-colors">Cancel</button>
                <button onClick={handleReport} disabled={isReporting} className="flex-1 h-11 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50">
                  {isReporting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <NewConversationModal
        isOpen={showNewChat}
        onClose={() => setShowNewChat(false)}
        onSelect={(contact) => {
          setNewChatContact({ id: contact.id, name: contact.full_name || 'User', avatar: contact.avatar_url });
          setSelectedChatUser(contact.id);
        }}
      />
    </MessageContainer>
  );
};
