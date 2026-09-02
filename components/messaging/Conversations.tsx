/**
 * Conversations — the ONE messaging surface, for all three roles.
 *
 * Replaces BuyerMessages (823 lines), SellerMessages (833) and AdminMessages
 * (537): three near-identical screens, each with its own copy of the
 * composer, the attachment upload, the typing broadcast, the report modal,
 * the magic-compose panel and the conversation list. Every fix had to be made
 * three times, and in practice never was — the buyer inbox had a delete-chat
 * flow the others lacked, the seller had editable quick replies the others
 * lacked, and the admin was missing the details column entirely, which left
 * three empty grid columns on large screens.
 *
 * What differs per role is small and declarative — see ROLE_CONFIG. What is
 * shared is everything else.
 *
 * All data flows through useMessaging → messagesService → RPCs. There is no
 * supabase.from() in this file.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Send, Loader2, Sparkles, Wand2, Search, X, Paperclip, Ban,
  ShieldAlert, MoreVertical, Truck, MessageSquarePlus, Plus, Trash2, ArrowUpRight,
  ArrowUp, Package,
} from 'lucide-react';
import { useAppState } from '../../context/AppContext';
import { Button, Input, useToast, ConfirmDialog, UserProfileModal, Skeleton } from '../UI';
import { ProductModal } from '../ProductModal';
import { OrderDetailsModal } from '../OrderDetailsModal';
import { compressImage, IMMUTABLE_CACHE } from '../../services/imageCompression';
import { formatTZS } from '../../constants';
import { Product, Order } from '../../types';
import * as aiService from '../../services/geminiService';
import { sanitizeText, rateLimit } from '../../src/security';
import { useMessaging, isOnline } from '../../hooks/useMessaging';
import {
  Conversation, PeerRole, ThreadMessage,
  uploadAttachment, fetchPeerProfile, fetchProfileRole,
} from '../../services/messagesService';
import { fetchProductById } from '../../services/shopService';
import { getOrderAsAdmin } from '../../services/adminApi';
import {
  MessageContainer, SidebarContainer, ChatAreaContainer, DetailsAreaContainer,
} from '../MessageShared';
import {
  ConversationListItem, ChatEmptyState, DayDivider, isSameDay,
  MessageBubble, TypingIndicator, NewConversationModal, MessageContextTag,
} from './ConversationKit';

// ─── Role configuration ──────────────────────────────────────────────────────

export type MessagingRole = 'buyer' | 'seller' | 'admin';

interface RoleConfig {
  /** Sidebar heading. */
  inboxTitle: string;
  /** What the other party is called in this role's copy. */
  peerNoun: string;
  /** Heading of the right-hand details column. */
  detailsTitle: string;
  /** Restrict the contact search to one role, or search everyone. */
  contactFilter?: PeerRole;
  /** AI reply suggestions for incoming messages. */
  aiSuggestions: boolean;
  /** Saved reply templates: user-editable, a fixed set, or none. */
  quickReplies: 'editable' | 'fixed' | 'none';
  /** Block/unblock available from the chat menu. */
  canBlock: boolean;
  /** Archive conversations. */
  canArchive: boolean;
  emptyHint: string;
}

const ROLE_CONFIG: Record<MessagingRole, RoleConfig> = {
  buyer: {
    inboxTitle: 'Messages',
    peerNoun: 'Seller',
    detailsTitle: 'Seller info',
    contactFilter: 'seller',
    aiSuggestions: false,
    quickReplies: 'none',
    canBlock: true,
    canArchive: true,
    emptyHint: 'Message a seller from any product page.',
  },
  seller: {
    inboxTitle: 'Inbox',
    peerNoun: 'Buyer',
    detailsTitle: 'Buyer details',
    contactFilter: undefined,
    aiSuggestions: true,
    quickReplies: 'editable',
    canBlock: true,
    canArchive: true,
    emptyHint: 'Buyer conversations about your products land here.',
  },
  admin: {
    inboxTitle: 'Inbox',
    peerNoun: 'User',
    detailsTitle: 'User details',
    contactFilter: undefined,
    aiSuggestions: true,
    quickReplies: 'fixed',
    // Admins moderate; blocking a user from the admin inbox would silently
    // cut the support channel the user is trying to reach.
    canBlock: false,
    canArchive: true,
    emptyHint: 'Review and respond to user messages from here.',
  },
};

const ADMIN_QUICK_REPLIES = [
  'Hello! How can I help you today?',
  'Your issue has been resolved.',
  'Please provide more details.',
  'We are looking into this.',
];

const SELLER_DEFAULT_REPLIES = [
  'Thank you for your order! 🙏',
  'This item will ship within 2 business days.',
  'Sorry for the delay — your order is on its way.',
  'Feel free to ask if you have any questions!',
];

const REPORT_REASONS = ['Spam', 'Harassment', 'Fraud/Scam', 'Inappropriate Content', 'Other'];

/** The reference a message can carry: a product, an order, or a return. */
export interface MessageContext {
  type: 'product' | 'order' | 'return';
  id: string;
  label?: string;
}

export interface ConversationsProps {
  role: MessagingRole;
  userId: string;
  /** Open this peer on mount (deep link from a product page, order, return). */
  initialPeerId?: string | null;
  /** Display name for the peer, when the caller already knows it. */
  initialPeerName?: string | null;
  /** Attach this reference to the first message sent in the opened thread. */
  initialContext?: MessageContext | null;
  /** Notify the host page when the selection changes (tab deep-link sync). */
  onPeerChange?: (peerId: string | null) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const Conversations = ({
  role, userId, initialPeerId, initialPeerName, initialContext, onPeerChange,
}: ConversationsProps) => {
  const cfg = ROLE_CONFIG[role];
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { orders, blockedUsers, blockUser, unblockUser, reportUser, refreshUnreadMessages } = useAppState();

  // Opening a thread marks it read server-side; refresh the navbar badge so it
  // drops immediately instead of on the next realtime echo.
  const m = useMessaging(userId, { onThreadRead: () => void refreshUnreadMessages() });

  // ─── Composer state ────────────────────────────────────────────────────────
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null);
  const [attachment, setAttachment] = useState<{ url: string; type: 'image' | 'file' } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // ─── Sidebar state ─────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);

  // ─── AI state ──────────────────────────────────────────────────────────────
  const [magicMode, setMagicMode] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [magicTone, setMagicTone] = useState<'professional' | 'persuasive' | 'friendly'>('professional');
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);

  // ─── Quick replies (seller: editable and persisted per user) ───────────────
  const quickReplyKey = `malimart_seller_quick_replies_${userId}`;
  const [quickReplies, setQuickReplies] = useState<string[]>(() => {
    if (cfg.quickReplies === 'fixed') return ADMIN_QUICK_REPLIES;
    if (cfg.quickReplies === 'none') return [];
    try {
      return JSON.parse(localStorage.getItem(quickReplyKey) || 'null') ?? SELLER_DEFAULT_REPLIES;
    } catch { return SELLER_DEFAULT_REPLIES; }
  });
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [newQuickReply, setNewQuickReply] = useState('');

  // ─── Modals ────────────────────────────────────────────────────────────────
  const [viewingProfile, setViewingProfile] = useState<any | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [reportingPeer, setReportingPeer] = useState<Conversation | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    { type: 'delete-chat' | 'block'; peerId: string } | null
  >(null);

  // ─── Message reference (product/order the next message is about) ───────────
  const [context, setContext] = useState<MessageContext | null>(initialContext ?? null);
  const [contextProduct, setContextProduct] = useState<Product | null>(null);
  const [contextOrder, setContextOrder] = useState<Order | null>(null);
  const clearContext = useCallback(() => {
    setContext(null); setContextProduct(null); setContextOrder(null);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const scrollBoxRef = useRef<HTMLDivElement>(null);

  const { selectPeer, openPeer, activePeerId } = m;

  // ─── Deep link ─────────────────────────────────────────────────────────────
  // Runs once per incoming peer id. openPeer resolves the display name via the
  // peer RPC when the caller did not supply one, so a first-contact thread no
  // longer shows the literal placeholder "Buyer" / "Seller" as its title.
  const openedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialPeerId || openedRef.current === initialPeerId) return;
    // SellerPage feeds our own selection back in through initialPeerId (it is
    // the same state onPeerChange writes). Without this guard, every click in
    // the sidebar would round-trip back here and re-fetch the thread we are
    // already showing.
    if (initialPeerId === activePeerId) { openedRef.current = initialPeerId; return; }
    openedRef.current = initialPeerId;
    void openPeer(initialPeerId, initialPeerName ? { name: initialPeerName } : undefined);
  }, [initialPeerId, initialPeerName, activePeerId, openPeer]);

  useEffect(() => { onPeerChange?.(activePeerId); }, [activePeerId, onPeerChange]);

  // The host can hand over a NEW reference without remounting — a seller
  // clicking "Contact buyer" on a second order, say. Keyed on the reference
  // itself, not the object identity, which is rebuilt on every host render.
  const ctxKey = initialContext ? `${initialContext.type}:${initialContext.id}` : null;
  useEffect(() => {
    setContext(initialContext ?? null);
    setContextProduct(null);
    setContextOrder(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey]);

  // ─── Hydrate the reference card ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!context) return;
    if (context.type === 'product') {
      fetchProductById(context.id).then(p => { if (!cancelled && p) setContextProduct(p); });
    } else {
      // The buyer's own orders are already in AppState via the buyer-orders
      // RPC; admins read through the admin RPC. Sellers get the id-only tag,
      // since orders has no seller_id column to read it back by.
      const own = orders.find(o => o.id === context.id);
      if (own) {
        setContextOrder(own);
      } else if (role === 'admin') {
        getOrderAsAdmin(context.id)
          .then(o => { if (!cancelled && o) setContextOrder(o as Order); })
          .catch(() => { /* tag still renders from the id alone */ });
      }
      setDraft(prev => prev || (context.type === 'return'
        ? `Hi, I have a question regarding my return for order #${context.id.slice(0, 8)}`
        : `Hi, I have a question regarding order #${context.id.slice(0, 8)}`));
    }
    return () => { cancelled = true; };
  }, [context, orders, role]);

  // ─── AI reply suggestions ──────────────────────────────────────────────────
  const lastSuggestedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!cfg.aiSuggestions) return;
    const last = m.thread[m.thread.length - 1];
    if (!last || last.senderId === userId || last.deletedAt) { setSuggestedReplies([]); return; }
    if (last.id === lastSuggestedFor.current) return;
    lastSuggestedFor.current = last.id;
    // Debounced: a burst of incoming messages should produce one call, on the
    // last of them, not one per message.
    const t = setTimeout(() => {
      aiService.generateSellerReplies(last.body || '')
        .then(setSuggestedReplies)
        .catch(() => setSuggestedReplies([]));
    }, 1500);
    return () => clearTimeout(t);
  }, [m.thread, userId, cfg.aiSuggestions]);

  // ─── Scroll management ─────────────────────────────────────────────────────
  // Stick to the bottom for new messages, but do NOT yank the view when an
  // older page is prepended — preserve the scroll offset instead.
  const prevOldestRef = useRef<string | null>(null);
  useEffect(() => {
    const box = scrollBoxRef.current;
    const oldest = m.thread[0]?.id ?? null;
    if (box && prevOldestRef.current && oldest !== prevOldestRef.current) {
      // A page was prepended; leave the viewport where the reader left it.
      prevOldestRef.current = oldest;
      return;
    }
    prevOldestRef.current = oldest;
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [m.thread, magicMode]);

  // Reset per-conversation composer state on switch.
  useEffect(() => {
    setDraft('');
    setReplyingTo(null);
    setAttachment(null);
    setMagicMode(false);
    setSuggestedReplies([]);
    setChatMenuOpen(false);
    lastSuggestedFor.current = null;
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [activePeerId]);

  // ─── Derived ───────────────────────────────────────────────────────────────
  const visibleConversations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return m.conversations.filter(c => {
      if (cfg.canArchive && (showArchived ? !c.archived : c.archived)) return false;
      if (filterUnread && c.unreadCount === 0) return false;
      if (q && !c.name.toLowerCase().includes(q) && !(c.lastBody || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [m.conversations, searchTerm, filterUnread, showArchived, cfg.canArchive]);

  const active = m.activeConversation;
  const peerBlocked = !!active && (active.isBlocked || blockedUsers.has(active.peerId));
  const composerLocked = peerBlocked || !active;

  const previewOf = (c: Conversation) => {
    if (c.lastDeleted) return 'Message deleted';
    if (!c.lastBody && c.lastAttachmentType) {
      return c.lastAttachmentType === 'image' ? '📷 Photo' : '📎 Attachment';
    }
    const body = c.lastBody || '';
    return c.lastSenderId === userId && body ? `You: ${body}` : body;
  };

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleSend = useCallback(async (textOverride?: string) => {
    if (!active) return;
    const text = (textOverride ?? draft).trim();
    if (!text && !attachment) {
      // Whitespace-only via Enter (the button is disabled, the keyboard is
      // not): clear so the placeholder returns instead of an invisible value.
      setDraft('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }
    if (!rateLimit('send_message', 15)) { addToast('Slow down', 'error'); return; }

    const payload = {
      body: sanitizeText(text),
      productId: context?.type === 'product' ? context.id : undefined,
      orderId: context && context.type !== 'product' ? context.id : undefined,
      replyToId: replyingTo?.id,
      attachment: attachment ?? undefined,
    };

    setDraft('');
    setReplyingTo(null);
    setAttachment(null);
    setMagicMode(false);
    setSuggestedReplies([]);
    clearContext(); // the reference rides on this first message only
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setIsSending(true);
    try {
      await m.send(payload);
    } catch (e: any) {
      // The bubble stays on screen marked "Not sent" with a retry, so the
      // text is never lost to a failed round trip.
      addToast(e?.message || 'Message not sent', 'error');
    } finally {
      setIsSending(false);
    }
  }, [active, draft, attachment, context, replyingTo, m, addToast, clearContext]);

  const handleRetry = useCallback(async (msg: ThreadMessage) => {
    m.discardFailed(msg.id);
    try {
      await m.send({
        body: msg.body || '',
        replyToId: msg.replyToId ?? undefined,
        orderId: msg.orderId ?? undefined,
        attachment: msg.attachmentUrl && msg.attachmentType
          ? { url: msg.attachmentUrl, type: msg.attachmentType }
          : undefined,
      });
    } catch (e: any) {
      addToast(e?.message || 'Still could not send', 'error');
    }
  }, [m, addToast]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file after a failure
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { addToast('Files must be under 10MB', 'error'); return; }
    setIsUploading(true);
    try {
      const uploaded = await uploadAttachment(userId, file, compressImage, IMMUTABLE_CACHE);
      setAttachment(uploaded);
      addToast('Attachment ready', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleMagicPolish = async (tone?: 'professional' | 'persuasive' | 'friendly') => {
    if (!draft.trim()) { addToast('Type a message first, then pick a tone', 'info'); return; }
    setIsPolishing(true);
    try {
      const refined = await aiService.refineMessage(draft, tone ?? magicTone);
      setDraft(refined);
      addToast('Draft polished', 'success');
    } catch {
      addToast('Could not polish that draft', 'error');
    } finally {
      setIsPolishing(false);
    }
  };

  const saveQuickReplies = (next: string[]) => {
    setQuickReplies(next);
    try { localStorage.setItem(quickReplyKey, JSON.stringify(next)); } catch { /* private mode */ }
  };

  const handleReport = async () => {
    if (!reportingPeer) return;
    setIsReporting(true);
    try {
      const peerRole = await fetchProfileRole(reportingPeer.peerId);
      if (peerRole === 'admin') {
        addToast('Cannot report an administrator', 'error');
        setReportingPeer(null);
        return;
      }
      await reportUser(reportingPeer.peerId, reportReason, reportDetails);
      setReportingPeer(null);
      setReportReason(REPORT_REASONS[0]);
      setReportDetails('');
    } catch {
      addToast('Failed to submit report', 'error');
    } finally {
      setIsReporting(false);
    }
  };

  const handleBlock = async (peerId: string) => {
    const peerRole = await fetchProfileRole(peerId);
    if (peerRole === 'admin') { addToast('Cannot block an administrator', 'error'); return; }
    try {
      await blockUser(peerId);
      addToast('User blocked', 'success');
      void m.refreshList();
    } catch { addToast('Failed to block', 'error'); }
  };

  const openPeerProfile = async (peerId: string) => {
    const p = await fetchPeerProfile(peerId);
    if (!p) { addToast('Profile unavailable', 'error'); return; }
    setViewingProfile({
      id: p.id, name: p.name, avatar: p.avatar, role: p.role,
      region: p.region, created_at: p.created_at,
    });
  };

  const openProduct = async (productId: string) => {
    const p = await fetchProductById(productId);
    if (p) setViewingProduct(p);
    else addToast('That product is no longer available', 'info');
  };

  const openOrder = async (orderId: string) => {
    const own = orders.find(o => o.id === orderId);
    if (own) { setViewingOrder(own); return; }
    if (role === 'admin') {
      try {
        const o = await getOrderAsAdmin(orderId);
        if (o) { setViewingOrder(o as Order); return; }
      } catch { /* fall through */ }
    }
    if (role === 'seller') { navigate('/seller?tab=orders'); return; }
    addToast('Order details unavailable', 'info');
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <MessageContainer>
      {/* ══ Sidebar ══ */}
      <SidebarContainer isVisible={!!activePeerId}>
        <div className="p-4 border-b border-foreground/8 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-sm text-foreground shrink-0">
              {cfg.inboxTitle}
              {m.totalUnread > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[9px] font-black text-white">
                  {m.totalUnread > 99 ? '99+' : m.totalUnread}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowNewChat(true)}
                title="New message"
                aria-label="New message"
                className="h-7 w-7 flex items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setFilterUnread(v => !v)}
                aria-pressed={filterUnread}
                className={`h-7 px-3 rounded-full text-[10px] font-bold transition-colors ${filterUnread ? 'bg-emerald-500 text-white' : 'bg-foreground/[0.06] text-foreground/50 hover:text-foreground'}`}
              >
                Unread
              </button>
              {cfg.canArchive && (
                <button
                  onClick={() => setShowArchived(v => !v)}
                  aria-pressed={showArchived}
                  className={`h-7 px-3 rounded-full text-[10px] font-bold transition-colors ${showArchived ? 'bg-emerald-500 text-white' : 'bg-foreground/[0.06] text-foreground/50 hover:text-foreground'}`}
                >
                  Archived
                </button>
              )}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/35 pointer-events-none" />
            <Input
              placeholder="Search…"
              aria-label="Search conversations"
              value={searchTerm}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs rounded-xl bg-foreground/[0.04] border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5 no-scrollbar">
          {m.listLoading ? (
            <div className="space-y-2 p-1">
              {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : m.listError ? (
            <div className="flex flex-col items-center gap-3 py-10 px-6 text-center">
              <p className="text-xs text-foreground/50">{m.listError}</p>
              <Button variant="secondary" onClick={() => void m.refreshList()} className="rounded-xl text-xs h-8">
                Try again
              </Button>
            </div>
          ) : visibleConversations.length === 0 ? (
            <ChatEmptyState
              title={
                showArchived ? 'No archived chats'
                : filterUnread ? 'No unread messages'
                : searchTerm ? 'No matches'
                : 'No conversations yet'
              }
              hint={!showArchived && !filterUnread && !searchTerm ? cfg.emptyHint : undefined}
            />
          ) : visibleConversations.map(c => (
            <ConversationListItem
              key={c.peerId}
              item={{
                id: c.peerId,
                name: c.name,
                avatarUrl: c.avatarUrl,
                lastMessage: previewOf(c),
                lastMessageAt: c.lastMessageAt,
                unreadCount: c.unreadCount,
                isOnline: isOnline(c.lastSeenAt),
              }}
              selected={activePeerId === c.peerId}
              pinned={c.pinned}
              archived={c.archived}
              onSelect={() => { if (c.peerId !== activePeerId) clearContext(); selectPeer(c.peerId); }}
              onTogglePin={(e) => { e.stopPropagation(); void m.setPref(c.peerId, { pinned: !c.pinned }); }}
              onToggleArchive={cfg.canArchive
                ? (e) => {
                    e.stopPropagation();
                    void m.setPref(c.peerId, { archived: !c.archived });
                    if (activePeerId === c.peerId) selectPeer(null);
                  }
                : undefined}
            />
          ))}
        </div>
      </SidebarContainer>

      {/* ══ Chat area ══ */}
      <ChatAreaContainer isVisible={!activePeerId}>
        {!active ? (
          <ChatEmptyState title="Select a conversation" hint={cfg.emptyHint} />
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-foreground/8 flex items-center gap-3 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
              <button
                onClick={() => selectPeer(null)}
                aria-label="Back to conversations"
                className="md:hidden flex items-center justify-center w-8 h-8 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.09] transition-colors shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => void openPeerProfile(active.peerId)}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-1 min-w-0 text-left"
              >
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-foreground/[0.08] overflow-hidden flex items-center justify-center text-sm font-bold text-foreground/60">
                    {active.avatarUrl
                      ? <img src={active.avatarUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      : (active.name || 'U').slice(0, 1).toUpperCase()}
                  </div>
                  {isOnline(active.lastSeenAt) && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[13px] text-foreground truncate">{active.name}</p>
                  {context?.type === 'order' || context?.type === 'return' ? (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <Truck className="w-2.5 h-2.5" />
                      Re: Order #{context.id.slice(0, 8).toUpperCase()}
                    </p>
                  ) : (
                    <p className="text-[10px] text-foreground/40">
                      {peerBlocked ? 'Blocked' : isOnline(active.lastSeenAt) ? 'Online' : cfg.peerNoun}
                    </p>
                  )}
                </div>
              </button>

              <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setChatMenuOpen(o => !o)}
                  aria-label="Conversation options"
                  aria-expanded={chatMenuOpen}
                  className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-foreground/[0.06] text-foreground/50 hover:text-foreground transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {chatMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setChatMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-52 bg-background border border-foreground/10 rounded-xl shadow-xl p-1 z-50">
                      <button
                        onClick={() => { setChatMenuOpen(false); void openPeerProfile(active.peerId); }}
                        className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left text-xs font-semibold text-foreground/70 hover:bg-foreground/[0.05] transition-colors"
                      >
                        <Package className="w-3.5 h-3.5" /> View profile
                      </button>
                      <button
                        onClick={() => { setChatMenuOpen(false); setReportingPeer(active); }}
                        className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left text-xs font-semibold text-foreground/70 hover:bg-foreground/[0.05] transition-colors"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" /> Report user
                      </button>
                      {cfg.canBlock && (
                        <button
                          onClick={() => {
                            setChatMenuOpen(false);
                            if (peerBlocked) void unblockUser(active.peerId);
                            else setConfirmAction({ type: 'block', peerId: active.peerId });
                          }}
                          className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left text-xs font-semibold text-foreground/70 hover:bg-foreground/[0.05] transition-colors"
                        >
                          <Ban className="w-3.5 h-3.5" /> {peerBlocked ? 'Unblock user' : 'Block user'}
                        </button>
                      )}
                      <button
                        onClick={() => { setChatMenuOpen(false); setConfirmAction({ type: 'delete-chat', peerId: active.peerId }); }}
                        className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left text-xs font-semibold text-rose-500 hover:bg-rose-500/8 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete chat
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollBoxRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-5 bg-foreground/[0.01] no-scrollbar">
              {m.threadLoading ? (
                <div className="space-y-4">
                  {[0, 1, 2, 3].map(i => (
                    <Skeleton key={i} className={`h-12 rounded-2xl ${i % 2 ? 'w-2/3 ml-auto' : 'w-1/2'}`} />
                  ))}
                </div>
              ) : m.threadError ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-xs text-foreground/50">{m.threadError}</p>
                  <Button variant="secondary" onClick={() => selectPeer(active.peerId)} className="rounded-xl text-xs h-8">
                    Try again
                  </Button>
                </div>
              ) : (
                <>
                  {/* Paging control — the thread loads one page, not all history */}
                  {m.hasMore && (
                    <div className="flex justify-center mb-4">
                      <button
                        onClick={() => void m.loadOlder()}
                        disabled={m.loadingOlder}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/[0.05] border border-foreground/10 text-[11px] font-semibold text-foreground/60 hover:text-foreground hover:bg-foreground/[0.09] transition-colors disabled:opacity-50"
                      >
                        {m.loadingOlder
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> Loading…</>
                          : <><ArrowUp className="w-3 h-3" /> Load earlier messages</>}
                      </button>
                    </div>
                  )}

                  {m.thread.length === 0 && (
                    <ChatEmptyState
                      title={`Say hello to ${active.name}`}
                      hint="Messages you send here are private between the two of you."
                    />
                  )}

                  {m.thread.map((msg, i) => {
                    const prev = m.thread[i - 1];
                    const showDay = !prev || !isSameDay(new Date(prev.createdAt), new Date(msg.createdAt));
                    const mine = msg.senderId === userId;
                    // Delete-for-everyone is the sender's, within one hour —
                    // the same window the RPC enforces, so the action is only
                    // offered when it will actually succeed.
                    const withinRecall = mine && !msg.pending && !msg.failed &&
                      Date.now() - new Date(msg.createdAt).getTime() < 60 * 60 * 1000;
                    return (
                      <React.Fragment key={msg.id}>
                        {showDay && <DayDivider date={new Date(msg.createdAt)} />}
                        <MessageBubble
                          id={msg.id}
                          body={msg.body}
                          attachmentUrl={msg.attachmentUrl}
                          attachmentType={msg.attachmentType}
                          deleted={!!msg.deletedAt}
                          createdAt={msg.createdAt}
                          isMine={mine}
                          read={msg.read}
                          reactions={msg.reactions}
                          myUserId={userId}
                          replyToContent={msg.replyToBody}
                          pending={msg.pending}
                          failed={msg.failed}
                          contextSlot={(msg.product || msg.orderId) ? (
                            <MessageContextTag
                              product={msg.product}
                              orderId={msg.orderId}
                              onViewProduct={openProduct}
                              onViewOrder={openOrder}
                            />
                          ) : undefined}
                          onReply={() => setReplyingTo(msg)}
                          onDelete={() => void m.removeMessage(msg.id, false)}
                          onDeleteForEveryone={withinRecall ? () => void m.removeMessage(msg.id, true) : undefined}
                          onReport={!mine ? () => setReportingPeer(active) : undefined}
                          onReact={(emoji) => void m.react(msg.id, emoji)}
                          onRetry={msg.failed ? () => void handleRetry(msg) : undefined}
                          onDiscard={msg.failed ? () => m.discardFailed(msg.id) : undefined}
                        />
                      </React.Fragment>
                    );
                  })}
                </>
              )}
              {m.peerTyping && <TypingIndicator />}
              <div ref={scrollAnchorRef} />
            </div>

            {/* Composer */}
            <div className="px-4 py-3 bg-background border-t border-foreground/8 flex flex-col gap-2">
              {peerBlocked && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/[0.06] border border-rose-500/25">
                  <Ban className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="text-[11px] font-semibold text-foreground/70 flex-1">
                    You have blocked {active.name}. Unblock to send a message.
                  </span>
                  {cfg.canBlock && (
                    <button
                      onClick={() => { void unblockUser(active.peerId); void m.refreshList(); }}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                    >
                      Unblock
                    </button>
                  )}
                </div>
              )}

              {/* AI suggestions */}
              {cfg.aiSuggestions && suggestedReplies.length > 0 && !magicMode && !composerLocked && (
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest self-center shrink-0">AI</span>
                  {suggestedReplies.map((reply, i) => (
                    <button
                      key={i}
                      onClick={() => void handleSend(reply)}
                      className="shrink-0 px-3 py-1.5 rounded-full bg-foreground/[0.05] border border-foreground/8 text-[11px] font-medium text-foreground/70 hover:bg-foreground/[0.09] hover:text-foreground whitespace-nowrap transition-colors"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}

              {/* Reference card — what this message is about */}
              {(contextProduct || contextOrder || (context && context.type !== 'product')) && (
                <div
                  role="group"
                  aria-label="Message reference"
                  className="flex items-center gap-3 p-2.5 bg-emerald-500/[0.06] rounded-2xl border border-emerald-500/25 animate-in slide-in-from-bottom-2"
                >
                  {contextProduct ? (
                    <>
                      {contextProduct.images?.[0] ? (
                        <img src={contextProduct.images[0]} alt="" className="w-11 h-11 object-cover rounded-xl shrink-0" loading="lazy" decoding="async" />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
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
                        aria-label={`View ${contextProduct.name}`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-0.5">
                          {context?.type === 'return' ? 'About your return' : 'About your order'}
                        </p>
                        <p className="text-xs font-bold text-foreground truncate">
                          Order #{(contextOrder?.id || context?.id || '').slice(0, 8).toUpperCase()}
                        </p>
                        {contextOrder && typeof (contextOrder as any).total === 'number' && (
                          <p className="text-[11px] font-semibold text-foreground/50">{formatTZS((contextOrder as any).total)}</p>
                        )}
                      </div>
                      {contextOrder && (
                        <button
                          type="button"
                          onClick={() => setViewingOrder(contextOrder)}
                          aria-label="View order"
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </button>
                      )}
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
                    <p className="text-[11px] text-foreground/60 truncate italic">
                      "{replyingTo.body?.slice(0, 80) || 'Attachment'}"
                    </p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} aria-label="Cancel reply" className="p-1.5 hover:bg-foreground/[0.06] rounded-full text-foreground/40 hover:text-foreground transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Quick replies */}
              {cfg.quickReplies === 'fixed' && !composerLocked && (
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {quickReplies.map((reply, i) => (
                    <button
                      key={i}
                      onClick={() => setDraft(reply)}
                      className="shrink-0 px-3 py-1 rounded-full bg-foreground/[0.03] text-[10px] font-medium text-foreground/50 hover:bg-foreground/[0.07] hover:text-foreground whitespace-nowrap transition-colors border border-foreground/[0.05]"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}

              {cfg.quickReplies === 'editable' && showQuickReplies && (
                <div className="p-3 bg-foreground/[0.03] rounded-xl border border-foreground/8 animate-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground/50 flex items-center gap-1.5">
                      <MessageSquarePlus className="w-3 h-3" /> Quick replies
                    </span>
                    <button onClick={() => setShowQuickReplies(false)} aria-label="Close quick replies" className="p-1 hover:bg-foreground/[0.06] rounded-full text-foreground/40">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-1.5 mb-2 max-h-40 overflow-y-auto no-scrollbar">
                    {quickReplies.map((reply, i) => (
                      <div key={i} className="flex items-center gap-1.5 group">
                        <button
                          onClick={() => { void handleSend(reply); setShowQuickReplies(false); }}
                          className="flex-1 text-left px-3 py-1.5 rounded-lg bg-background border border-foreground/8 text-[11px] font-medium text-foreground/75 hover:bg-foreground/[0.05] transition-colors truncate"
                        >
                          {reply}
                        </button>
                        <button
                          onClick={() => saveQuickReplies(quickReplies.filter((_, j) => j !== i))}
                          aria-label={`Remove template: ${reply}`}
                          className="p-1.5 rounded-full text-foreground/30 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      placeholder="Add a template…"
                      aria-label="New quick reply"
                      value={newQuickReply}
                      onChange={(e: any) => setNewQuickReply(e.target.value)}
                      onKeyDown={(e: any) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newQuickReply.trim()) { saveQuickReplies([...quickReplies, newQuickReply.trim()]); setNewQuickReply(''); }
                        }
                      }}
                      className="h-8 text-xs rounded-lg bg-background border-foreground/8"
                    />
                    <button
                      onClick={() => { if (newQuickReply.trim()) { saveQuickReplies([...quickReplies, newQuickReply.trim()]); setNewQuickReply(''); } }}
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
                  {attachment.type === 'image'
                    ? <img src={attachment.url} alt="" className="w-10 h-10 object-cover rounded-lg shrink-0" loading="lazy" decoding="async" />
                    : <Paperclip className="w-4 h-4 text-emerald-500 shrink-0" />}
                  <span className="text-[11px] font-bold flex-1">
                    {attachment.type === 'image' ? 'Image attached' : 'File attached'}
                  </span>
                  <button onClick={() => setAttachment(null)} aria-label="Remove attachment" className="p-1.5 hover:bg-foreground/[0.06] rounded-full text-foreground/40 hover:text-foreground transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {magicMode && (
                <div className="p-3 bg-emerald-500/[0.07] rounded-xl border border-emerald-500/20 animate-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" /> Magic compose
                    </span>
                    <button onClick={() => setMagicMode(false)} aria-label="Close magic compose" className="p-1 hover:bg-emerald-500/15 rounded-full text-emerald-600 dark:text-emerald-400">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {(['professional', 'persuasive', 'friendly'] as const).map(tone => (
                      <button
                        key={tone}
                        onClick={() => { setMagicTone(tone); void handleMagicPolish(tone); }}
                        disabled={isPolishing}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all border disabled:opacity-50
                          ${magicTone === tone
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-background text-emerald-700 dark:text-emerald-300 border-transparent hover:border-emerald-500/40'}`}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="flex items-center gap-1 pb-1.5">
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
                    disabled={isUploading || composerLocked}
                    aria-label="Attach a file"
                    className={`p-2.5 rounded-xl transition-all disabled:opacity-40 ${attachment ? 'text-emerald-500 bg-emerald-500/10' : 'text-foreground/35 hover:bg-foreground/[0.05] hover:text-foreground'}`}
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => magicMode ? void handleMagicPolish() : setMagicMode(true)}
                    disabled={composerLocked}
                    aria-label="Polish this draft with AI"
                    className={`p-2.5 rounded-xl transition-all disabled:opacity-40 ${magicMode ? 'bg-emerald-500 text-white shadow-sm' : 'text-foreground/35 hover:bg-foreground/[0.05] hover:text-emerald-500'}`}
                  >
                    {isPolishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  </button>
                  {cfg.quickReplies === 'editable' && (
                    <button
                      type="button"
                      onClick={() => setShowQuickReplies(v => !v)}
                      disabled={composerLocked}
                      aria-label="Quick replies"
                      className={`p-2.5 rounded-xl transition-all disabled:opacity-40 ${showQuickReplies ? 'bg-emerald-500 text-white shadow-sm' : 'text-foreground/35 hover:bg-foreground/[0.05] hover:text-emerald-500'}`}
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex-1 bg-foreground/[0.04] rounded-xl border border-foreground/8 focus-within:border-foreground/20 focus-within:bg-background transition-all">
                  <textarea
                    ref={textareaRef}
                    aria-label="Message"
                    placeholder={
                      peerBlocked ? 'You have blocked this user'
                      : contextProduct ? `Ask about ${contextProduct.name}…`
                      : 'Type a message…'
                    }
                    disabled={composerLocked}
                    value={draft}
                    maxLength={4000}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      m.notifyTyping();
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
                    }}
                    rows={1}
                    className="w-full bg-transparent text-[13px] px-4 py-3 min-h-[44px] max-h-24 resize-none outline-none overflow-y-auto placeholder:text-foreground/35 text-foreground disabled:opacity-50"
                  />
                </div>

                <Button
                  type="button"
                  variant="brand"
                  onClick={() => void handleSend()}
                  disabled={composerLocked || isSending || (!draft.trim() && !attachment)}
                  className="h-11 w-11 p-0 rounded-xl flex items-center justify-center shrink-0"
                  aria-label="Send message"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </ChatAreaContainer>

      {/* ══ Details column ══ */}
      <DetailsAreaContainer isVisible={!!activePeerId}>
        <div className="p-5 h-full overflow-y-auto no-scrollbar">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/35 mb-5">
            {cfg.detailsTitle}
          </h3>
          {active && (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-foreground/[0.06] overflow-hidden flex items-center justify-center text-xl font-bold text-foreground/50">
                  {active.avatarUrl
                    ? <img src={active.avatarUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    : (active.name || 'U').slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">{active.name}</h4>
                  <p className="text-[10px] text-foreground/40 mt-0.5 capitalize">
                    {isOnline(active.lastSeenAt) ? 'Online now' : active.role}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => void openPeerProfile(active.peerId)}
                  className="w-full py-2.5 rounded-xl border border-foreground/10 text-[11px] font-semibold text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground transition-colors"
                >
                  View full profile
                </button>
                {cfg.canBlock && (
                  <button
                    onClick={() => peerBlocked
                      ? void unblockUser(active.peerId)
                      : setConfirmAction({ type: 'block', peerId: active.peerId })}
                    className={`w-full py-2.5 rounded-xl border text-[11px] font-semibold transition-colors
                      ${peerBlocked
                        ? 'border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/5'
                        : 'border-rose-500/20 text-rose-500 hover:bg-rose-500/5'}`}
                  >
                    {peerBlocked ? 'Unblock user' : 'Block user'}
                  </button>
                )}
                <button
                  onClick={() => setReportingPeer(active)}
                  className="w-full py-2.5 rounded-xl text-[11px] font-semibold text-rose-500 opacity-60 hover:opacity-100 hover:bg-rose-500/5 border border-transparent hover:border-rose-500/20 transition-all"
                >
                  Report user
                </button>
              </div>
            </div>
          )}
        </div>
      </DetailsAreaContainer>

      {/* ══ Modals ══ */}
      <UserProfileModal isOpen={!!viewingProfile} onClose={() => setViewingProfile(null)} user={viewingProfile} />
      <ProductModal isOpen={!!viewingProduct} onClose={() => setViewingProduct(null)} product={viewingProduct} />
      <OrderDetailsModal isOpen={!!viewingOrder} onClose={() => setViewingOrder(null)} order={viewingOrder} />

      {reportingPeer && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-label="Report user" className="bg-background border border-foreground/10 w-full max-w-sm p-6 rounded-2xl shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-foreground">Report {reportingPeer.name}</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="report-reason" className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45 block mb-1.5">Reason</label>
                <select
                  id="report-reason"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full h-11 bg-foreground/[0.03] border border-foreground/10 rounded-xl px-3 text-sm text-foreground focus:outline-none focus:border-foreground/25 transition-colors"
                >
                  {REPORT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="report-details" className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45 block mb-1.5">Details (optional)</label>
                <textarea
                  id="report-details"
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="What happened?"
                  className="w-full h-24 bg-foreground/[0.03] border border-foreground/10 rounded-xl p-3 text-sm text-foreground focus:outline-none focus:border-foreground/25 transition-colors resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="secondary" onClick={() => setReportingPeer(null)} className="flex-1 rounded-xl">Cancel</Button>
                <Button variant="primary" onClick={() => void handleReport()} isLoading={isReporting} className="flex-1 rounded-xl">Submit</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmAction}
        title={confirmAction?.type === 'block' ? 'Block this user?' : 'Delete this chat?'}
        message={confirmAction?.type === 'block'
          ? "They won't be able to message you. You can unblock them later."
          : 'This conversation is removed from your inbox. The other person keeps their copy.'}
        confirmText={confirmAction?.type === 'block' ? 'Block' : 'Delete chat'}
        isDangerous
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          const a = confirmAction;
          setConfirmAction(null);
          if (!a) return;
          try {
            if (a.type === 'block') await handleBlock(a.peerId);
            else { await m.removeConversation(a.peerId); addToast('Chat deleted', 'success'); }
          } catch (e: any) {
            addToast(e?.message || 'That did not work', 'error');
          }
        }}
      />

      <NewConversationModal
        isOpen={showNewChat}
        onClose={() => setShowNewChat(false)}
        roleFilter={cfg.contactFilter}
        recentContacts={m.conversations.slice(0, 8).map(c => ({
          id: c.peerId, full_name: c.name, avatar_url: c.avatarUrl, role: c.role,
        }))}
        onSelect={(contact) => {
          void openPeer(contact.id, {
            name: contact.full_name || 'User',
            avatar: contact.avatar_url,
            role: (contact.role as PeerRole) || 'buyer',
          });
        }}
      />
    </MessageContainer>
  );
};
