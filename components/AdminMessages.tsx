import { sanitizeText, rateLimit } from '../src/security';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft, Send, Loader2, Sparkles, Wand2, Search,
  X, Paperclip, ShieldAlert, MoreVertical, AlertTriangle, Package, Pin,
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { Button, Input, useToast, UserProfileModal, GraphicalTag } from './UI';
import { ProductOrderTag } from './SellerMessages';
import { ProductModal } from './ProductModal';
import { OrderDetailsModal } from './OrderDetailsModal';
import { supabase } from '../services/supabaseClient';
import { compressImage, IMMUTABLE_CACHE } from '../services/imageCompression';
import { Product, Order } from '../types';
import * as aiService from '../services/geminiService';
import { MessageContainer, SidebarContainer, ChatAreaContainer } from './MessageShared';
import {
  ConversationListItem, ChatEmptyState, DayDivider, isSameDay,
  MessageBubble,
} from './messaging/ConversationKit';

export const AdminMessages = ({
  initialSelectedUser,
}: {
  initialSelectedUser?: { id: string; name: string; context?: { type: 'order' | 'return' | 'support'; id: string; label: string } } | null;
}) => {
  const { user, fetchMessages, sendMessage, softDeleteMessage, reportUser, addReaction } = useAppState();
  const { addToast } = useToast();
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChatUser, setSelectedChatUser] = useState<string | null>(initialSelectedUser?.id || null);
  const [activeContext, setActiveContext] = useState<{ type: 'order' | 'return' | 'support'; id: string; label: string } | null>(
    initialSelectedUser?.context || null
  );
  const [newMsg, setNewMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [magicMode, setMagicMode] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [magicTone, setMagicTone] = useState<'professional' | 'persuasive' | 'friendly'>('professional');
  const [filterUnread, setFilterUnread] = useState(false);
  const [pinnedUsers, setPinnedUsers] = useState<Set<string>>(new Set());

  const [viewingProfile, setViewingProfile] = useState<any | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [attachment, setAttachment] = useState<{ url: string; type: 'image' | 'file' } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);

  const quickReplies = [
    'Hello! How can I help you today?',
    'Your issue has been resolved.',
    'Please provide more details.',
    'We are looking into this.',
  ];

  useEffect(() => {
    if (initialSelectedUser) {
      setSelectedChatUser(initialSelectedUser.id);
      if (initialSelectedUser.context) setActiveContext(initialSelectedUser.context);
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

  const users = useMemo(() => {
    const map = new Map();
    chats.forEach(c => {
      const isMe = c.sender_id === user?.id;
      const otherId = isMe ? c.receiver_id : c.sender_id;
      const partnerProfile = isMe ? c.receiver : c.sender;
      if (!map.has(otherId)) {
        map.set(otherId, { id: otherId, name: partnerProfile?.full_name || 'User', avatar: partnerProfile?.avatar_url, lastMsg: c.text || c.body, time: c.created_at, unread: !isMe && !c.read });
      } else {
        const existing = map.get(otherId);
        if (partnerProfile?.full_name && existing.name === 'User') { existing.name = partnerProfile.full_name; existing.avatar = partnerProfile.avatar_url; }
        if (new Date(c.created_at) > new Date(existing.time)) {
          map.set(otherId, { ...existing, lastMsg: c.text || c.body, time: c.created_at, unread: !isMe && !c.read });
        }
      }
    });
    if (initialSelectedUser && !map.has(initialSelectedUser.id)) {
      map.set(initialSelectedUser.id, { id: initialSelectedUser.id, name: initialSelectedUser.name, avatar: null, lastMsg: 'Start a conversation...', time: new Date().toISOString(), unread: false });
    }
    let result = Array.from(map.values());
    if (searchTerm) result = result.filter((u: any) => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.lastMsg?.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterUnread) result = result.filter((u: any) => u.unread);
    return result.sort((a: any, b: any) => {
      if (pinnedUsers.has(a.id) && !pinnedUsers.has(b.id)) return -1;
      if (!pinnedUsers.has(a.id) && pinnedUsers.has(b.id)) return 1;
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    });
  }, [chats, user?.id, searchTerm, filterUnread, pinnedUsers]);

  const activeChats = useMemo(() => {
    if (!selectedChatUser) return [];
    return chats
      .filter(c => c.sender_id === selectedChatUser || c.receiver_id === selectedChatUser)
      .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime());
  }, [chats, selectedChatUser]);

  const activeUserData = useMemo(() => {
    if (!selectedChatUser) return null;
    const u = users.find((u: any) => u.id === selectedChatUser);
    return u || { name: 'User', avatar: null };
  }, [selectedChatUser, users]);

  const lastSeenMsgIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeChats.length === 0) return;
    const lastMsg = activeChats[activeChats.length - 1];
    if (lastMsg.sender_id === user?.id) { setSuggestedReplies([]); return; }
    if (lastMsg.id === lastSeenMsgIdRef.current) return;
    lastSeenMsgIdRef.current = lastMsg.id;
    const t = setTimeout(() => {
      aiService.generateSellerReplies(lastMsg.text || lastMsg.body).then(setSuggestedReplies);
    }, 1500);
    return () => clearTimeout(t);
  }, [activeChats, user?.id]);

  const handleSend = async (e?: React.FormEvent, textOverride?: string) => {
    if (!rateLimit('send_message', 15)) { addToast('Slow down', 'error'); return; }
    if (e) e.preventDefault();
    const text = textOverride || newMsg;
    if (!selectedChatUser || (!text.trim() && !attachment) || !user) return;

    const tempId = Date.now().toString();
    const optimisticMsg = {
      id: tempId, sender_id: user.id, receiver_id: selectedChatUser,
      text, body: text, read: false, created_at: new Date().toISOString(),
      attachment_url: attachment?.url, attachment_type: attachment?.type,
      reply_to_id: replyingTo?.id, reply_to: replyingTo,
    };
    setChats(prev => [...prev, optimisticMsg]);
    setNewMsg('');
    setSuggestedReplies([]);
    setMagicMode(false);
    setReplyingTo(null);
    setAttachment(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const orderId = activeContext?.type === 'order' || activeContext?.type === 'return' ? activeContext.id : undefined;
    await sendMessage(selectedChatUser, sanitizeText(text), undefined, orderId, attachment || undefined, replyingTo?.id);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    try {
      const filePath = `chat-attachments/${user.id}/${Math.random()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('mali-mart-uploads').upload(filePath, await compressImage(file), { cacheControl: 'public,max-age=31536000,immutable' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('mali-mart-uploads').getPublicUrl(filePath);
      setAttachment({ url: publicUrl, type: file.type.startsWith('image/') ? 'image' : 'file' });
      addToast('File uploaded', 'success');
    } catch { addToast('Upload failed', 'error'); }
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

  const fetchUserProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (data) setViewingProfile({ id: data.id, name: data.full_name || 'User', avatar: data.avatar_url, role: data.role, created_at: data.created_at, region: data.region, trust_score: data.trust_score, is_verified: data.is_verified });
  };

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeChats, magicMode]);

  useEffect(() => {
    if (selectedChatUser && user) {
      const unread = activeChats.filter(c => c.receiver_id === user.id && !c.read);
      if (unread.length > 0) {
        supabase.from('messages').update({ read: true }).eq('receiver_id', user.id).eq('sender_id', selectedChatUser).then(() => {
          setChats(prev => prev.map(c =>
            (c.receiver_id === user.id && c.sender_id === selectedChatUser) ? { ...c, read: true } : c
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
      {/* ── Sidebar ── */}
      <SidebarContainer isVisible={!!selectedChatUser}>
        <div className="p-4 border-b border-foreground/8 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-foreground">
              Inbox
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground/[0.08] px-1.5 text-[9px] font-bold text-foreground/60">
                {users.length}
              </span>
            </h3>
            <button
              onClick={() => setFilterUnread(!filterUnread)}
              className={`h-7 px-3 rounded-full text-[10px] font-bold transition-colors ${filterUnread ? 'bg-emerald-500 text-white' : 'bg-foreground/[0.06] text-foreground/50 hover:text-foreground'}`}
            >
              Unread
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/35" />
            <Input
              placeholder="Search messages…"
              value={searchTerm}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs rounded-xl bg-foreground/[0.04] border-transparent"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 no-scrollbar">
          {users.length === 0 ? (
            <ChatEmptyState title="No conversations" />
          ) : (users as any[]).map(u => (
            <ConversationListItem
              key={u.id}
              item={{
                id: u.id, name: u.name, avatarUrl: u.avatar, lastMessage: u.lastMsg, lastMessageAt: u.time,
                unreadCount: chats.filter(c => c.sender_id === u.id && c.receiver_id === user?.id && !c.read).length,
              }}
              selected={selectedChatUser === u.id}
              pinned={pinnedUsers.has(u.id)}
              onSelect={() => setSelectedChatUser(u.id)}
              onTogglePin={(e) => togglePin(e, u.id)}
            />
          ))}
        </div>
      </SidebarContainer>

      {/* ── Chat area ── */}
      <ChatAreaContainer isVisible={!selectedChatUser}>
        {!selectedChatUser ? (
          <ChatEmptyState title="Select a conversation" hint="Review and respond to user messages from here." />
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-foreground/8 flex items-center gap-3 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
              <button
                onClick={() => setSelectedChatUser(null)}
                className="md:hidden flex items-center justify-center w-8 h-8 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.09] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity flex-1 min-w-0"
                onClick={() => fetchUserProfile(selectedChatUser)}
              >
                <div className="w-9 h-9 rounded-full bg-foreground/[0.08] overflow-hidden shrink-0 flex items-center justify-center text-sm font-bold text-foreground/50">
                  {activeUserData?.avatar
                    ? <img src={activeUserData.avatar} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    : (activeUserData?.name || 'U').slice(0, 1).toUpperCase()
                  }
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[13px] text-foreground truncate">{activeUserData?.name}</p>
                  <p className="text-[10px] text-foreground/40">Click to view profile</p>
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
                  <div className="absolute right-0 top-full mt-1 w-44 bg-background border border-foreground/10 rounded-xl shadow-xl p-1 z-50">
                    <button
                      onClick={() => { setChatMenuOpen(false); fetchUserProfile(selectedChatUser); }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left text-xs font-semibold text-foreground/70 hover:bg-foreground/[0.05] transition-colors"
                    >
                      View profile
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-1 bg-foreground/[0.01] no-scrollbar">
              {/* Active context banner */}
              {activeContext && (
                <div className="mb-4 p-4 rounded-xl bg-foreground/[0.04] border border-foreground/8 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-foreground/[0.08] flex items-center justify-center flex-shrink-0">
                      {activeContext.type === 'return' ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <Package className="w-4 h-4 text-foreground/60" />}
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground/40 mb-0.5">Active context</p>
                      <h4 className="text-sm font-bold text-foreground">{activeContext.label}</h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraphicalTag
                      type={activeContext.type}
                      label={activeContext.type === 'return' ? 'Dispute' : 'Order'}
                      id={activeContext.id}
                      onClick={handleContextClick}
                    />
                    <button
                      onClick={() => setActiveContext(null)}
                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-foreground/[0.08] transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-foreground/50" />
                    </button>
                  </div>
                </div>
              )}

              {activeChats.map((c, index) => {
                const prev = index > 0 ? activeChats[index - 1] : null;
                const currDate = new Date(c.created_at!);
                const prevDate = prev ? new Date(prev.created_at!) : null;
                const showDate = !prevDate || !isSameDay(currDate, prevDate);
                const isMe = c.sender_id === user?.id;
                const replyToContent = c.reply_to
                  ? (c.reply_to.text || c.reply_to.body)
                  : c.reply_to_id
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
                      onDelete={isMe ? async () => { await softDeleteMessage(c.id); const msgs = await fetchMessages(); setChats(msgs); } : undefined}
                      onReport={!isMe ? () => reportUser(c.sender_id, 'Admin flagged') : undefined}
                      onReact={(emoji) => { addReaction(c.id, emoji); fetchMessages().then(setChats); }}
                    />
                  </React.Fragment>
                );
              })}
              <div ref={scrollRef} />
            </div>

            {/* Composer */}
            <div className="px-4 py-3 bg-background border-t border-foreground/8 flex flex-col gap-2">
              {/* AI suggested replies */}
              {suggestedReplies.length > 0 && !magicMode && (
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest self-center shrink-0">AI:</span>
                  {suggestedReplies.map((reply, i) => (
                    <button
                      key={i}
                      onClick={(e) => handleSend(e, reply)}
                      className="flex-shrink-0 px-3 py-1.5 rounded-full bg-foreground/[0.04] border border-foreground/8 text-[11px] font-medium text-foreground/65 hover:bg-foreground/[0.08] hover:text-foreground whitespace-nowrap transition-colors"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}

              {/* Quick replies */}
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {quickReplies.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => setNewMsg(reply)}
                    className="flex-shrink-0 px-3 py-1 rounded-full bg-foreground/[0.03] text-[10px] font-medium text-foreground/50 hover:bg-foreground/[0.07] hover:text-foreground whitespace-nowrap transition-colors border border-foreground/[0.05]"
                  >
                    {reply}
                  </button>
                ))}
              </div>

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
                  <div className="w-8 h-8 rounded-lg bg-foreground/[0.08] flex items-center justify-center shrink-0">
                    <Paperclip className="w-4 h-4 text-foreground/50" />
                  </div>
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

                <div className="flex-1 bg-foreground/[0.04] rounded-xl border border-foreground/8 focus-within:border-foreground/20 focus-within:bg-background transition-all">
                  <textarea
                    ref={textareaRef}
                    placeholder="Write a message…"
                    value={newMsg}
                    onChange={(e: any) => {
                      setNewMsg(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    rows={1}
                    className="w-full bg-transparent text-[13px] px-4 py-3 min-h-[44px] max-h-32 resize-none outline-none no-scrollbar placeholder:text-foreground/35 text-foreground"
                  />
                </div>

                <button
                  type="submit"
                  onClick={() => handleSend()}
                  disabled={!newMsg.trim() && !attachment}
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

      {/* Modals */}
      <UserProfileModal isOpen={!!viewingProfile} onClose={() => setViewingProfile(null)} user={viewingProfile} />
      <ProductModal isOpen={!!viewingProduct} onClose={() => setViewingProduct(null)} product={viewingProduct} />
      <OrderDetailsModal isOpen={!!viewingOrder} onClose={() => setViewingOrder(null)} order={viewingOrder} />
    </MessageContainer>
  );
};
