/**
 * Conversations — the ONE messaging surface, for all three roles.
 *
 * Replaces BuyerMessages (823 lines), SellerMessages (833) and AdminMessages
 * (537): three near-identical screens, each with its own copy of the composer,
 * the attachment upload, the typing broadcast, the report modal and the
 * conversation list. Every fix had to be made three times, and in practice
 * never was.
 *
 * What differs per role is small and declarative — see ROLE_CONFIG. What is
 * shared is everything else.
 *
 * ── Layout ──────────────────────────────────────────────────────────────────
 * Two panes, plus peer details as a drawer over the thread. The previous
 * chassis mounted details as a permanent third column that held an avatar and
 * three buttons, spending a quarter of a large screen to do it. The drawer
 * gives that width back to the conversation AND lets the panel carry real
 * content — what has been referenced in the thread, and the moderation
 * actions.
 *
 * ── Composer ────────────────────────────────────────────────────────────────
 * Reply, attachment and reference used to each open their own stacked panel,
 * so a reply-with-attachment-about-an-order pushed the input most of the way
 * up the pane. They are compact chips on one row now, and the AI suggestions,
 * quick replies and tone picker share a single scrolling strip.
 *
 * All data flows through useMessaging → messagesService → RPCs. There is no
 * supabase.from() in this file.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Send, Loader2, Sparkles, Wand2, Search, X, Paperclip, Ban,
  ShieldAlert, MoreVertical, Truck, MessageSquarePlus, Plus, Trash2, ArrowUpRight,
  ArrowUp, Info, Reply as ReplyIcon, Package, Inbox, MailOpen, UserRound, Archive, MessageSquare, Store, Receipt,
  CheckSquare, ArrowDown, ArchiveRestore,
} from 'lucide-react';
import { useAppState } from '../../context/AppContext';
import { Button, Input, useToast, ConfirmDialog, UserProfileModal, Skeleton } from '../UI';
import { OrderDetailsModal } from '../OrderDetailsModal';
import { compressImage, IMMUTABLE_CACHE } from '../../services/imageCompression';
import { formatTZS } from '../../constants';
import { Product, Order } from '../../types';
import * as aiService from '../../services/geminiService';
import { sanitizeText, rateLimit } from '../../src/security';
import { useMessaging, isOnline } from '../../hooks/useMessaging';
import {
  Conversation, PeerRole, ThreadMessage, PeerProfile, SharedEngagement, ThreadSearchHit,
  uploadAttachment, fetchPeerProfile, fetchProfileRole, listSharedEngagements,
} from '../../services/messagesService';
import { fetchProductById } from '../../services/shopService';
import { getOrderAsAdmin } from '../../services/adminApi';
import { MessagingShell, ConversationPane, ThreadPane, DetailsDrawer } from '../MessageShared';
import {
  ConversationListItem, ChatEmptyState, DayDivider, isSameDay, SectionLabel,
  MessageBubble, TypingIndicator, NewConversationModal, MessageContextTag, PeerAvatar,
  MessageSearchPanel,
} from './ConversationKit';

// ─── Role configuration ──────────────────────────────────────────────────────

export type MessagingRole = 'buyer' | 'seller' | 'admin';

interface RoleConfig {
  inboxTitle: string;
  /** What the other party is called in this role's copy. */
  peerNoun: string;
  detailsTitle: string;
  /** Restrict the contact search to one role, or search everyone. */
  contactFilter?: PeerRole;
  aiSuggestions: boolean;
  /** Saved reply templates: user-editable, a fixed set, or none. */
  quickReplies: 'editable' | 'fixed' | 'none';
  canBlock: boolean;
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
    // Admins moderate; blocking from the admin inbox would silently cut the
    // support channel the user is trying to reach.
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

// ─── Draft persistence ────────────────────────────────────────────────────────
// A half-typed reply used to vanish the instant you switched conversations —
// `draft` was plain component state, wiped by the per-conversation reset
// effect. Local-only (localStorage), never synced: it's a save against
// losing your own half-finished text, not a cross-device feature.
const draftKey = (userId: string, peerId: string) => `malimart_draft_${userId}_${peerId}`;
const loadDraft = (userId: string, peerId: string): string => {
  try { return localStorage.getItem(draftKey(userId, peerId)) || ''; } catch { return ''; }
};
const saveDraft = (userId: string, peerId: string, text: string) => {
  try {
    if (text) localStorage.setItem(draftKey(userId, peerId), text);
    else localStorage.removeItem(draftKey(userId, peerId));
  } catch { /* private mode / storage full — the draft just won't survive a switch */ }
};

const REPORT_REASONS = ['Spam', 'Harassment', 'Fraud/Scam', 'Inappropriate Content', 'Other'];
const TONES = ['professional', 'persuasive', 'friendly'] as const;
type Tone = typeof TONES[number];

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

// ─── Small building blocks ───────────────────────────────────────────────────

/** Filter pill in the list header. */
const FilterPill = ({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    className={`h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40
      ${active
        ? 'bg-emerald-500 text-white shadow-sm'
        : 'bg-foreground/[0.05] text-foreground/50 hover:text-foreground hover:bg-foreground/[0.09]'
      }`}
  >
    {children}
  </button>
);

/** Compact composer chip — reply target, attachment, or message reference. */
const ComposerChip = ({
  icon: Icon, label, value, onClear, onOpen, tone = 'neutral',
}: {
  icon: any;
  label: string;
  value: string;
  onClear: () => void;
  onOpen?: () => void;
  tone?: 'neutral' | 'accent';
}) => (
  <div
    className={`flex items-center gap-2 pl-2.5 pr-1 py-1.5 rounded-2xl border min-w-0 max-w-full sm:max-w-[19rem]
      ${tone === 'accent'
        ? 'bg-emerald-500/[0.08] border-emerald-500/30'
        : 'bg-foreground/[0.04] border-foreground/[0.08]'
      }`}
  >
    <Icon className={`w-3.5 h-3.5 shrink-0 ${tone === 'accent' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/45'}`} />
    <span className="min-w-0 flex-1">
      <SectionLabel className={tone === 'accent' ? 'text-emerald-600/80 dark:text-emerald-400/80' : undefined}>
        {label}
      </SectionLabel>
      <span className="block text-xs font-bold text-foreground truncate">{value}</span>
    </span>
    {onOpen && (
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${label.toLowerCase()}`}
        className="h-9 w-9 flex items-center justify-center rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
      >
        <ArrowUpRight className="w-3.5 h-3.5" />
      </button>
    )}
    <button
      type="button"
      onClick={onClear}
      aria-label={`Remove ${label.toLowerCase()}`}
      className="h-9 w-9 flex items-center justify-center rounded-xl text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  </div>
);

/** A labelled row in the details drawer. */
const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 py-2.5 border-b border-foreground/[0.06] last:border-0">
    <SectionLabel>{label}</SectionLabel>
    <span className="text-xs font-bold text-foreground text-right truncate">{value}</span>
  </div>
);

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

  // ─── Composer ──────────────────────────────────────────────────────────────
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null);
  const [attachment, setAttachment] = useState<{ url: string; type: 'image' | 'file' } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // ─── List ──────────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);

  // ─── Bulk select ─────────────────────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPeerIds, setSelectedPeerIds] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const exitSelectMode = useCallback(() => { setSelectMode(false); setSelectedPeerIds(new Set()); }, []);
  const toggleSelected = useCallback((peerId: string) => {
    setSelectedPeerIds(prev => {
      const next = new Set(prev);
      if (next.has(peerId)) next.delete(peerId); else next.add(peerId);
      return next;
    });
  }, []);

  // ─── Image lightbox ──────────────────────────────────────────────────────────
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!lightboxUrl) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxUrl(null); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [lightboxUrl]);

  // ─── AI ────────────────────────────────────────────────────────────────────
  const [magicMode, setMagicMode] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [magicTone, setMagicTone] = useState<Tone>('professional');
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);

  // ─── Quick replies (seller: editable, persisted per user) ──────────────────
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

  // ─── Panels & modals ───────────────────────────────────────────────────────
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [peerDetail, setPeerDetail] = useState<PeerProfile | null>(null);
  const [engagements, setEngagements] = useState<SharedEngagement[] | null>(null);
  const [viewingProfile, setViewingProfile] = useState<any | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [reportingPeer, setReportingPeer] = useState<Conversation | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    { type: 'delete-chat' | 'block'; peerId: string } | null
  >(null);

  // ─── Message reference ─────────────────────────────────────────────────────
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

  // True once a search jump has repositioned the thread view somewhere in
  // history — jumpToMessage replaces the loaded page, so the live tail is no
  // longer necessarily on screen until the user asks to go back to it.
  const [viewingHistory, setViewingHistory] = useState(false);

  // ─── In-thread search ───────────────────────────────────────────────────────
  const [showThreadSearch, setShowThreadSearch] = useState(false);
  const [threadSearchQuery, setThreadSearchQuery] = useState('');
  const [highlightMsgId, setHighlightMsgId] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeThreadSearch = useCallback(() => {
    setShowThreadSearch(false);
    setThreadSearchQuery('');
    m.clearSearch();
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  }, [m]);

  const handleSearchQueryChange = useCallback((q: string) => {
    setThreadSearchQuery(q);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!activePeerId) return;
    if (!q.trim()) { m.clearSearch(); return; }
    searchDebounceRef.current = setTimeout(() => { void m.searchThread(activePeerId, q); }, 300);
  }, [activePeerId, m]);

  useEffect(() => () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
  }, []);

  const jumpToSearchHit = useCallback(async (hit: ThreadSearchHit) => {
    if (!activePeerId) return;
    closeThreadSearch();
    await m.jumpToMessage(activePeerId, hit);
    setViewingHistory(true);
    setHighlightMsgId(hit.id);
    requestAnimationFrame(() => {
      document.getElementById(`msg-${hit.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightMsgId(null), 2200);
  }, [activePeerId, closeThreadSearch, m]);

  const jumpToLatest = useCallback(() => {
    if (!activePeerId) return;
    setViewingHistory(false);
    selectPeer(activePeerId);
  }, [activePeerId, selectPeer]);

  // ─── Deep link ─────────────────────────────────────────────────────────────
  const openedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialPeerId || openedRef.current === initialPeerId) return;
    // SellerPage feeds our own selection back in through initialPeerId (it is
    // the same state onPeerChange writes). Without this guard, every click in
    // the sidebar would round-trip back here and re-fetch the open thread.
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

  // ─── Hydrate the reference chip ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!context) return;
    if (context.type === 'product') {
      fetchProductById(context.id).then(p => { if (!cancelled && p) setContextProduct(p); });
    } else {
      // The buyer's own orders are already in AppState via the buyer-orders
      // RPC; admins read through the admin RPC. Sellers get the id-only chip,
      // since orders has no seller_id column to read it back by.
      const own = orders.find(o => o.id === context.id);
      if (own) {
        setContextOrder(own);
      } else if (role === 'admin') {
        getOrderAsAdmin(context.id)
          .then(o => { if (!cancelled && o) setContextOrder(o as Order); })
          .catch(() => { /* chip still renders from the id alone */ });
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

  // ─── Scroll ────────────────────────────────────────────────────────────────
  // Stick to the bottom for new messages, but do NOT yank the view when an
  // older page is prepended (or a search jump lands elsewhere) — leave the
  // reader where they were / where they jumped to.
  const prevOldestRef = useRef<string | null>(null);
  useEffect(() => {
    const oldest = m.thread[0]?.id ?? null;
    if (prevOldestRef.current && oldest !== prevOldestRef.current) {
      prevOldestRef.current = oldest;
      return;
    }
    // A conversation that was empty a moment ago (prevOldestRef still null)
    // and now has messages is a FRESH open, not a new arrival — land on the
    // first unread message instead of the bottom, the way opening a long
    // unread backlog should, rather than always burying it under "newest".
    const freshOpen = !prevOldestRef.current && m.thread.length > 0;
    prevOldestRef.current = oldest;
    if (freshOpen) {
      const firstUnread = m.thread.find(msg => !msg.read && msg.senderId !== userId && !msg.deletedAt);
      if (firstUnread) {
        requestAnimationFrame(() => {
          document.getElementById(`msg-${firstUnread.id}`)?.scrollIntoView({ behavior: 'auto', block: 'center' });
        });
        return;
      }
    }
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [m.thread, userId]);

  // Reset per-conversation state on switch. The draft itself is restored,
  // not cleared — see the draft-persistence effect below, which owns writing
  // it back out per peer so a half-typed reply survives switching away and
  // back (or the tab closing) instead of vanishing with the rest of this
  // per-conversation UI state.
  useEffect(() => {
    setDraft(activePeerId ? loadDraft(userId, activePeerId) : '');
    setReplyingTo(null);
    setAttachment(null);
    setMagicMode(false);
    setSuggestedReplies([]);
    setChatMenuOpen(false);
    setDetailsOpen(false);
    setPeerDetail(null);
    setEngagements(null);
    setShowThreadSearch(false);
    setThreadSearchQuery('');
    setHighlightMsgId(null);
    setViewingHistory(false);
    m.clearSearch();
    lastSuggestedFor.current = null;
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeerId]);

  // Persist the draft for the OPEN conversation as it's typed, debounced so
  // every keystroke doesn't hit storage.
  useEffect(() => {
    if (!activePeerId) return;
    const t = setTimeout(() => saveDraft(userId, activePeerId, draft), 400);
    return () => clearTimeout(t);
  }, [draft, activePeerId, userId]);

  // Load the richer profile and the shared order history only when the drawer
  // actually opens — neither is needed to read a conversation.
  useEffect(() => {
    if (!detailsOpen || !activePeerId || peerDetail?.id === activePeerId) return;
    let cancelled = false;
    void Promise.all([
      fetchPeerProfile(activePeerId),
      listSharedEngagements(activePeerId),
    ]).then(([p, e]) => {
      if (cancelled) return;
      setPeerDetail(p);
      setEngagements(e);
    });
    return () => { cancelled = true; };
  }, [detailsOpen, activePeerId, peerDetail?.id]);

  // ─── Derived ───────────────────────────────────────────────────────────────
  const visibleConversations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return m.conversations.filter(c => {
      // A seller who also buys shows up as a "seller" account everywhere, but
      // a given thread's peer.role tells us which hat they were wearing in
      // it — someone who messaged them as a customer (role 'buyer') belongs
      // in the Seller Inbox, someone they messaged as a shopper (role
      // 'seller', i.e. another store) belongs in their own Buyer inbox.
      // Without this split every thread appeared in both dashboards at once.
      if (cfg.contactFilter && c.role !== cfg.contactFilter) return false;
      if (cfg.canArchive && (showArchived ? !c.archived : c.archived)) return false;
      if (filterUnread && c.unreadCount === 0) return false;
      if (q && !c.name.toLowerCase().includes(q) && !(c.lastBody || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [m.conversations, searchTerm, filterUnread, showArchived, cfg.canArchive, cfg.contactFilter]);

  /**
   * Pinned / Unread / Earlier. Every row used to carry identical visual
   * weight, so a 40-conversation inbox gave no clue where to look first.
   * Grouping is suppressed while searching or filtering, where a flat list of
   * matches is what the user asked for.
   */
  const grouped = useMemo(() => {
    const flat = !!searchTerm.trim() || filterUnread || showArchived;
    if (flat) return [{ label: null, items: visibleConversations }];
    const pinned = visibleConversations.filter(c => c.pinned);
    const unread = visibleConversations.filter(c => !c.pinned && c.unreadCount > 0);
    const rest = visibleConversations.filter(c => !c.pinned && c.unreadCount === 0);
    return [
      { label: 'Pinned', items: pinned },
      { label: 'Unread', items: unread },
      { label: pinned.length || unread.length ? 'Earlier' : null, items: rest },
    ].filter(g => g.items.length > 0);
  }, [visibleConversations, searchTerm, filterUnread, showArchived]);

  const active = m.activeConversation;
  const peerBlocked = !!active && (active.isBlocked || blockedUsers.has(active.peerId));
  const composerLocked = peerBlocked || !active;

  /** Products and orders referenced anywhere in the loaded thread. */
  const threadReferences = useMemo(() => {
    const products = new Map<string, NonNullable<ThreadMessage['product']>>();
    const orderIds = new Set<string>();
    for (const msg of m.thread) {
      if (msg.product) products.set(msg.product.id, msg.product);
      if (msg.orderId) orderIds.add(msg.orderId);
    }
    return { products: [...products.values()], orderIds: [...orderIds] };
  }, [m.thread]);

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
    setShowQuickReplies(false);
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
      setAttachment(await uploadAttachment(userId, file, compressImage, IMMUTABLE_CACHE));
      addToast('Attachment ready', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleMagicPolish = async (tone?: Tone) => {
    if (!draft.trim()) { addToast('Type a message first, then pick a tone', 'info'); return; }
    setIsPolishing(true);
    try {
      setDraft(await aiService.refineMessage(draft, tone ?? magicTone));
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

  const addQuickReply = () => {
    const t = newQuickReply.trim();
    if (!t) return;
    saveQuickReplies([...quickReplies, t]);
    setNewQuickReply('');
  };

  const handleReport = async () => {
    if (!reportingPeer) return;
    setIsReporting(true);
    try {
      if (await fetchProfileRole(reportingPeer.peerId) === 'admin') {
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

  const handleBulkArchive = async () => {
    const ids = [...selectedPeerIds];
    if (ids.length === 0) return;
    setBulkWorking(true);
    try {
      await Promise.all(ids.map(id => m.setPref(id, { archived: !showArchived })));
      addToast(`${ids.length} conversation${ids.length === 1 ? '' : 's'} ${showArchived ? 'restored' : 'archived'}`, 'success');
      exitSelectMode();
    } catch {
      addToast('Some conversations could not be updated', 'error');
    } finally {
      setBulkWorking(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedPeerIds];
    if (ids.length === 0) return;
    setBulkWorking(true);
    try {
      await Promise.all(ids.map(id => m.removeConversation(id)));
      addToast(`${ids.length} chat${ids.length === 1 ? '' : 's'} deleted`, 'success');
      exitSelectMode();
    } catch {
      addToast('Some chats could not be deleted', 'error');
    } finally {
      setBulkWorking(false);
    }
  };

  const handleBlock = async (peerId: string) => {
    if (await fetchProfileRole(peerId) === 'admin') {
      addToast('Cannot block an administrator', 'error');
      return;
    }
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

  const iconBtn = 'h-11 w-11 flex items-center justify-center rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-40';
  const menuItem = 'w-full flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-xl text-left text-xs font-bold transition-colors';

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <MessagingShell>
      {/* ══ Conversation list ══ */}
      <ConversationPane hidden={!!activePeerId}>
        <div className="px-4 pt-4 pb-3 border-b border-foreground/[0.08] flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
              {cfg.inboxTitle}
              {m.totalUnread > 0 && (
                <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-black tabular-nums">
                  {m.totalUnread > 99 ? '99+' : m.totalUnread}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-1.5">
              {!selectMode && visibleConversations.length > 0 && (
                <button
                  onClick={() => setSelectMode(true)}
                  aria-label="Select conversations"
                  className="h-10 w-10 flex items-center justify-center rounded-2xl text-foreground/45 hover:text-foreground hover:bg-foreground/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                >
                  <CheckSquare className="w-4 h-4" />
                </button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowNewChat(true)}
                aria-label="New message"
                className="h-10 w-10 p-0 rounded-2xl"
              >
                <MessageSquarePlus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {!selectMode && (
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/35 pointer-events-none z-10" />
              <Input
                placeholder="Search conversations"
                aria-label="Search conversations"
                value={searchTerm}
                onChange={(e: any) => setSearchTerm(e.target.value)}
                className="h-10 pl-10 text-xs rounded-2xl bg-foreground/[0.04] border-transparent"
              />
            </div>
          )}

          {selectMode ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={exitSelectMode}
                className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-[0.12em] text-foreground/55 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
              >
                Cancel
              </button>
              <span className="text-[10px] font-bold text-foreground/40 tabular-nums flex-1">
                {selectedPeerIds.size} selected
              </span>
              {cfg.canArchive && (
                <button
                  onClick={() => void handleBulkArchive()}
                  disabled={bulkWorking || selectedPeerIds.size === 0}
                  aria-label={showArchived ? 'Restore selected' : 'Archive selected'}
                  className="h-9 w-9 flex items-center justify-center rounded-xl text-foreground/55 hover:text-foreground hover:bg-foreground/[0.06] transition-colors disabled:opacity-40"
                >
                  {showArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={() => setConfirmBulkDelete(true)}
                disabled={bulkWorking || selectedPeerIds.size === 0}
                aria-label="Delete selected"
                className="h-9 w-9 flex items-center justify-center rounded-xl text-rose-500/80 hover:text-rose-500 hover:bg-rose-500/[0.08] transition-colors disabled:opacity-40"
              >
                {bulkWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <FilterPill active={filterUnread} onClick={() => setFilterUnread(v => !v)}>Unread</FilterPill>
              {cfg.canArchive && (
                <FilterPill active={showArchived} onClick={() => setShowArchived(v => !v)}>Archived</FilterPill>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-2 py-2">
          {m.listLoading ? (
            <div className="space-y-1.5 p-1">
              {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />)}
            </div>
          ) : m.listError ? (
            <ChatEmptyState
              icon={Inbox}
              title="Could not load your conversations"
              hint={m.listError}
              action={
                <Button variant="secondary" size="sm" onClick={() => void m.refreshList()} className="rounded-2xl">
                  Try again
                </Button>
              }
            />
          ) : visibleConversations.length === 0 ? (
            <ChatEmptyState
              icon={showArchived ? Archive : filterUnread ? MailOpen : Inbox}
              title={
                showArchived ? 'No archived chats'
                : filterUnread ? 'You are all caught up'
                : searchTerm ? 'No matches'
                : 'No conversations yet'
              }
              hint={!showArchived && !filterUnread && !searchTerm ? cfg.emptyHint : undefined}
            />
          ) : grouped.map(group => (
            <div key={group.label ?? 'all'} className="mb-2 last:mb-0">
              {group.label && (
                <div className="px-3 pt-3 pb-1.5">
                  <SectionLabel>{group.label} · {group.items.length}</SectionLabel>
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map(c => (
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
                    // Swiping to delete still goes through the confirm dialog —
                    // a gesture that destroys a conversation on contact is the
                    // one place a swipe should NOT be the whole interaction.
                    onDelete={() => setConfirmAction({ type: 'delete-chat', peerId: c.peerId })}
                    selectMode={selectMode}
                    checked={selectedPeerIds.has(c.peerId)}
                    onToggleCheck={() => toggleSelected(c.peerId)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ConversationPane>

      {/* ══ Thread ══ */}
      <ThreadPane hidden={!activePeerId}>
        {!active ? (
          <ChatEmptyState
            icon={MessageSquare}
            title="Select a conversation"
            hint={cfg.emptyHint}
          />
        ) : (
          <>
            {/* Header */}
            <div className="px-3 sm:px-4 py-3 border-b border-foreground/[0.08] flex items-center gap-2 bg-background/95 backdrop-blur-sm shrink-0">
              <button
                onClick={() => selectPeer(null)}
                aria-label="Back to conversations"
                className={`md:hidden ${iconBtn} text-foreground/60 hover:bg-foreground/[0.06] shrink-0`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-2xl px-1 py-1 hover:bg-foreground/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <PeerAvatar name={active.name} url={active.avatarUrl} online={m.peerPresent || isOnline(active.lastSeenAt)} size="sm" />
                <span className="min-w-0">
                  <span className="block text-sm font-black text-foreground truncate">{active.name}</span>
                  {context && context.type !== 'product' ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <Truck className="w-3 h-3" />
                      Re: Order #{context.id.slice(0, 8).toUpperCase()}
                    </span>
                  ) : (
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/40">
                      {peerBlocked ? 'Blocked' : (m.peerPresent || isOnline(active.lastSeenAt)) ? 'Online' : cfg.peerNoun}
                    </span>
                  )}
                </span>
              </button>

              <button
                onClick={() => setShowThreadSearch(v => !v)}
                aria-label="Search this conversation"
                aria-pressed={showThreadSearch}
                className={`hidden sm:flex ${iconBtn} shrink-0 ${showThreadSearch ? 'bg-emerald-500 text-white' : 'text-foreground/50 hover:text-foreground hover:bg-foreground/[0.06]'}`}
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDetailsOpen(true)}
                aria-label="Conversation details"
                className={`hidden sm:flex ${iconBtn} text-foreground/50 hover:text-foreground hover:bg-foreground/[0.06] shrink-0`}
              >
                <Info className="w-4 h-4" />
              </button>

              <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setChatMenuOpen(o => !o)}
                  aria-label="Conversation options"
                  aria-expanded={chatMenuOpen}
                  className={`${iconBtn} text-foreground/50 hover:text-foreground hover:bg-foreground/[0.06]`}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {chatMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setChatMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-56 bg-background border border-foreground/[0.1] rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <button
                        onClick={() => { setChatMenuOpen(false); setShowThreadSearch(true); }}
                        className={`${menuItem} text-foreground/70 hover:bg-foreground/[0.05] sm:hidden`}
                      >
                        <Search className="w-4 h-4" /> Search conversation
                      </button>
                      <button
                        onClick={() => { setChatMenuOpen(false); setDetailsOpen(true); }}
                        className={`${menuItem} text-foreground/70 hover:bg-foreground/[0.05]`}
                      >
                        <UserRound className="w-4 h-4" /> View details
                      </button>
                      <button
                        onClick={() => { setChatMenuOpen(false); setReportingPeer(active); }}
                        className={`${menuItem} text-foreground/70 hover:bg-foreground/[0.05]`}
                      >
                        <ShieldAlert className="w-4 h-4" /> Report user
                      </button>
                      {cfg.canBlock && (
                        <button
                          onClick={() => {
                            setChatMenuOpen(false);
                            if (peerBlocked) void unblockUser(active.peerId);
                            else setConfirmAction({ type: 'block', peerId: active.peerId });
                          }}
                          className={`${menuItem} text-foreground/70 hover:bg-foreground/[0.05]`}
                        >
                          <Ban className="w-4 h-4" /> {peerBlocked ? 'Unblock user' : 'Block user'}
                        </button>
                      )}
                      <button
                        onClick={() => { setChatMenuOpen(false); setConfirmAction({ type: 'delete-chat', peerId: active.peerId }); }}
                        className={`${menuItem} text-rose-500 hover:bg-rose-500/[0.08]`}
                      >
                        <Trash2 className="w-4 h-4" /> Delete chat
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {showThreadSearch && (
              <MessageSearchPanel
                query={threadSearchQuery}
                onQueryChange={handleSearchQueryChange}
                onClose={closeThreadSearch}
                results={m.searchResults}
                loading={m.searching}
                myUserId={userId}
                onSelect={(hit) => void jumpToSearchHit(hit)}
              />
            )}

            {/* Messages */}
            <div ref={scrollBoxRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 sm:px-5 py-4">
              {m.threadLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className={`h-14 rounded-2xl ${i % 2 ? 'w-1/2 ml-auto' : 'w-2/3'}`} />
                  ))}
                </div>
              ) : m.threadError ? (
                <ChatEmptyState
                  title="Could not load this conversation"
                  hint={m.threadError}
                  action={
                    <Button variant="secondary" size="sm" onClick={() => selectPeer(active.peerId)} className="rounded-2xl">
                      Try again
                    </Button>
                  }
                />
              ) : (
                <>
                  {m.hasMore && (
                    <div className="flex justify-center mb-5">
                      <button
                        onClick={() => void m.loadOlder()}
                        disabled={m.loadingOlder}
                        className="flex items-center gap-1.5 px-4 h-9 rounded-2xl bg-foreground/[0.04] border border-foreground/[0.08] text-[10px] font-black uppercase tracking-[0.12em] text-foreground/55 hover:text-foreground hover:bg-foreground/[0.08] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                      >
                        {m.loadingOlder
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading</>
                          : <><ArrowUp className="w-3.5 h-3.5" /> Earlier messages</>}
                      </button>
                    </div>
                  )}

                  {m.thread.length === 0 && (
                    <ChatEmptyState
                      title={`Say hello to ${active.name}`}
                      hint="Messages here are private between the two of you."
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
                          highlighted={msg.id === highlightMsgId}
                          body={msg.body}
                          editedAt={msg.editedAt}
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
                              orderItems={msg.orderItems}
                              mine={mine}
                              onViewOrder={openOrder}
                            />
                          ) : undefined}
                          onReply={() => setReplyingTo(msg)}
                          onDelete={() => void m.removeMessage(msg.id, false)}
                          onDeleteForEveryone={withinRecall ? () => void m.removeMessage(msg.id, true) : undefined}
                          onEdit={withinRecall
                            ? (text) => m.editMessage(msg.id, text).catch((e: any) => {
                                addToast(e?.message || 'Could not save that edit', 'error');
                                throw e;
                              })
                            : undefined}
                          onReport={!mine ? () => setReportingPeer(active) : undefined}
                          onReact={(emoji) => void m.react(msg.id, emoji)}
                          onRetry={msg.failed ? () => void handleRetry(msg) : undefined}
                          onDiscard={msg.failed ? () => m.discardFailed(msg.id) : undefined}
                          onViewImage={msg.attachmentType === 'image' ? setLightboxUrl : undefined}
                        />
                      </React.Fragment>
                    );
                  })}
                </>
              )}
              {m.peerTyping && <TypingIndicator name={active.name} />}
              <div ref={scrollAnchorRef} />
            </div>

            {viewingHistory && (
              <div className="flex justify-center -mt-2 mb-2 px-3 shrink-0">
                <button
                  onClick={jumpToLatest}
                  className="flex items-center gap-1.5 px-3.5 h-8 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-[0.1em] shadow-lg hover:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                >
                  <ArrowDown className="w-3.5 h-3.5" /> Jump to latest
                </button>
              </div>
            )}

            {/* Composer */}
            <div className="px-3 sm:px-4 py-3 bg-background border-t border-foreground/[0.08] flex flex-col gap-2.5 shrink-0">
              {peerBlocked && (
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-rose-500/[0.06] border border-rose-500/25">
                  <Ban className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="text-xs font-semibold text-foreground/70 flex-1">
                    You have blocked {active.name}.
                  </span>
                  {cfg.canBlock && (
                    <button
                      onClick={() => { void unblockUser(active.peerId); void m.refreshList(); }}
                      className="text-xs font-black text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 px-2 py-1"
                    >
                      Unblock
                    </button>
                  )}
                </div>
              )}

              {/* One scrolling strip for suggestions, templates and tones */}
              {!composerLocked && (suggestedReplies.length > 0 || magicMode || (cfg.quickReplies === 'fixed' && !showQuickReplies)) && (
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  {magicMode ? (
                    <>
                      <span className="flex items-center gap-1.5 shrink-0 pr-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="w-3.5 h-3.5" /> Tone
                      </span>
                      {TONES.map(tone => (
                        <button
                          key={tone}
                          onClick={() => { setMagicTone(tone); void handleMagicPolish(tone); }}
                          disabled={isPolishing}
                          className={`shrink-0 h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-[0.12em] border transition-all disabled:opacity-50
                            ${magicTone === tone
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300 border-emerald-500/25 hover:border-emerald-500/50'}`}
                        >
                          {tone}
                        </button>
                      ))}
                      <button
                        onClick={() => setMagicMode(false)}
                        aria-label="Close tone picker"
                        className="shrink-0 h-8 w-8 flex items-center justify-center rounded-xl text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      {suggestedReplies.length > 0 && (
                        <span className="flex items-center gap-1 shrink-0 pr-1 text-[10px] font-black uppercase tracking-[0.12em] text-foreground/30">
                          <Sparkles className="w-3 h-3" /> AI
                        </span>
                      )}
                      {suggestedReplies.map((reply, i) => (
                        <button
                          key={`ai-${i}`}
                          onClick={() => void handleSend(reply)}
                          className="shrink-0 h-8 px-3 rounded-xl bg-foreground/[0.04] border border-foreground/[0.08] text-xs font-semibold text-foreground/70 hover:bg-foreground/[0.08] hover:text-foreground whitespace-nowrap transition-colors"
                        >
                          {reply}
                        </button>
                      ))}
                      {cfg.quickReplies === 'fixed' && quickReplies.map((reply, i) => (
                        <button
                          key={`qr-${i}`}
                          onClick={() => setDraft(reply)}
                          className="shrink-0 h-8 px-3 rounded-xl bg-foreground/[0.03] border border-foreground/[0.06] text-xs font-medium text-foreground/55 hover:bg-foreground/[0.07] hover:text-foreground whitespace-nowrap transition-colors"
                        >
                          {reply}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Editable templates (seller) */}
              {cfg.quickReplies === 'editable' && showQuickReplies && (
                <div className="p-3 bg-foreground/[0.03] rounded-2xl border border-foreground/[0.08] animate-in slide-in-from-bottom-2 duration-200">
                  <div className="flex items-center justify-between mb-2.5">
                    <SectionLabel>Quick replies</SectionLabel>
                    <button
                      onClick={() => setShowQuickReplies(false)}
                      aria-label="Close quick replies"
                      className="h-8 w-8 -mr-1 flex items-center justify-center rounded-xl hover:bg-foreground/[0.06] text-foreground/40 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5 mb-2.5 max-h-40 overflow-y-auto no-scrollbar">
                    {quickReplies.map((reply, i) => (
                      <div key={i} className="flex items-center gap-1.5 group">
                        <button
                          onClick={() => void handleSend(reply)}
                          className="flex-1 min-w-0 text-left px-3 py-2 rounded-xl bg-background border border-foreground/[0.08] text-xs font-semibold text-foreground/75 hover:border-emerald-500/30 hover:text-foreground transition-colors truncate"
                        >
                          {reply}
                        </button>
                        <button
                          onClick={() => saveQuickReplies(quickReplies.filter((_, j) => j !== i))}
                          aria-label={`Remove template: ${reply}`}
                          className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl text-foreground/30 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      placeholder="Add a template"
                      aria-label="New quick reply"
                      value={newQuickReply}
                      onChange={(e: any) => setNewQuickReply(e.target.value)}
                      onKeyDown={(e: any) => { if (e.key === 'Enter') { e.preventDefault(); addQuickReply(); } }}
                      className="h-10 text-xs rounded-xl bg-background border-foreground/[0.08]"
                    />
                    <button
                      onClick={addQuickReply}
                      aria-label="Save template"
                      className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Compact chips: reference, reply target, attachment */}
              {(contextProduct || contextOrder || (context && context.type !== 'product') || replyingTo || attachment) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {contextProduct && (
                    <ComposerChip
                      icon={Package}
                      label="Asking about"
                      value={`${contextProduct.name}${typeof contextProduct.price === 'number' ? ` · ${formatTZS(contextProduct.price)}` : ''}`}
                      tone="accent"
                      onOpen={() => navigate(`/product/${contextProduct.id}`)}
                      onClear={clearContext}
                    />
                  )}
                  {!contextProduct && context && context.type !== 'product' && (
                    <ComposerChip
                      icon={Truck}
                      label={context.type === 'return' ? 'About your return' : 'About your order'}
                      value={`#${(contextOrder?.id || context.id).slice(0, 8).toUpperCase()}`}
                      tone="accent"
                      onOpen={contextOrder ? () => setViewingOrder(contextOrder) : undefined}
                      onClear={clearContext}
                    />
                  )}
                  {replyingTo && (
                    <ComposerChip
                      icon={ReplyIcon}
                      label="Replying to"
                      value={replyingTo.body?.slice(0, 60) || 'Attachment'}
                      onClear={() => setReplyingTo(null)}
                    />
                  )}
                  {attachment && (
                    <ComposerChip
                      icon={Paperclip}
                      label="Attached"
                      value={attachment.type === 'image' ? 'Image' : 'File'}
                      onClear={() => setAttachment(null)}
                    />
                  )}
                </div>
              )}

              <div className="flex items-end gap-1.5">
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
                  className={`${iconBtn} shrink-0 ${attachment ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-foreground/40 hover:bg-foreground/[0.06] hover:text-foreground'}`}
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => magicMode ? void handleMagicPolish() : setMagicMode(true)}
                  disabled={composerLocked}
                  aria-label="Polish this draft with AI"
                  className={`${iconBtn} shrink-0 ${magicMode ? 'bg-emerald-500 text-white' : 'text-foreground/40 hover:bg-foreground/[0.06] hover:text-emerald-600 dark:hover:text-emerald-400'}`}
                >
                  {isPolishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                </button>
                {cfg.quickReplies === 'editable' && (
                  <button
                    type="button"
                    onClick={() => setShowQuickReplies(v => !v)}
                    disabled={composerLocked}
                    aria-label="Quick replies"
                    className={`${iconBtn} shrink-0 hidden sm:flex ${showQuickReplies ? 'bg-emerald-500 text-white' : 'text-foreground/40 hover:bg-foreground/[0.06] hover:text-emerald-600 dark:hover:text-emerald-400'}`}
                  >
                    <MessageSquarePlus className="w-4 h-4" />
                  </button>
                )}

                <div className="relative flex-1 min-w-0 bg-foreground/[0.04] rounded-2xl border border-foreground/[0.08] focus-within:border-emerald-500/40 focus-within:bg-background transition-all">
                  {draft.length > 3800 && (
                    <span
                      className={`absolute -top-5 right-1 text-[10px] font-bold tabular-nums ${draft.length >= 4000 ? 'text-rose-500' : 'text-foreground/55'}`}
                      aria-live="polite"
                    >
                      {draft.length}/4000
                    </span>
                  )}
                  <textarea
                    ref={textareaRef}
                    aria-label="Message"
                    placeholder={
                      peerBlocked ? 'You have blocked this user'
                      : contextProduct ? `Ask about ${contextProduct.name}`
                      : 'Type a message'
                    }
                    disabled={composerLocked}
                    value={draft}
                    maxLength={4000}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      m.notifyTyping();
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
                    }}
                    rows={1}
                    className="w-full bg-transparent text-sm font-medium px-4 py-3 min-h-[44px] max-h-[120px] resize-none outline-none overflow-y-auto placeholder:text-foreground/35 text-foreground disabled:opacity-50"
                  />
                </div>

                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void handleSend()}
                  disabled={composerLocked || isSending || (!draft.trim() && !attachment)}
                  className="h-11 w-11 p-0 rounded-2xl shrink-0"
                  aria-label="Send message"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </ThreadPane>

      {/* ══ Details drawer ══ */}
      <DetailsDrawer open={detailsOpen && !!active} onClose={() => setDetailsOpen(false)} title={cfg.detailsTitle}>
        {active && (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center gap-3">
              <PeerAvatar name={active.name} url={active.avatarUrl} size="lg" online={m.peerPresent || isOnline(active.lastSeenAt)} />
              <div>
                <h4 className="text-lg font-black tracking-tight text-foreground">{active.name}</h4>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/40 mt-0.5">
                  {m.peerPresent || isOnline(active.lastSeenAt) ? 'Online now' : active.role}
                </p>
              </div>
            </div>

            {/* A seller peer has a storefront — the thing you actually want
                when you tap their avatar. Buyers have no shop, so they get
                their shared trading history below instead. */}
            {active.role === 'seller' && (
              <Link
                to={`/store/${active.peerId}`}
                className="flex items-center gap-3 p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] hover:bg-emerald-500/[0.12] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <span className="w-10 h-10 rounded-2xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </span>
                <span className="min-w-0 flex-1">
                  <SectionLabel className="text-emerald-600/80 dark:text-emerald-400/80">Storefront</SectionLabel>
                  <span className="block text-xs font-black text-foreground truncate">Visit {active.name}'s shop</span>
                </span>
                <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              </Link>
            )}

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] px-4 py-1">
              <DetailRow label="Role" value={<span className="capitalize">{active.role}</span>} />
              {peerDetail?.region && <DetailRow label="Region" value={peerDetail.region} />}
              {peerDetail?.created_at && (
                <DetailRow
                  label="Member since"
                  value={new Date(peerDetail.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                />
              )}
              <DetailRow label="Unread" value={<span className="tabular-nums">{active.unreadCount}</span>} />
            </div>

            {/* Past engagements — the orders we have actually done together,
                in whichever direction they ran. For a seller opening a buyer's
                chat this is the real question: have they bought before? */}
            {engagements === null ? (
              <div className="space-y-1.5">
                <SectionLabel className="mb-2">Past engagements</SectionLabel>
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-14 w-full rounded-2xl" />
              </div>
            ) : engagements.length > 0 ? (
              <div>
                <SectionLabel className="mb-2">Past engagements · {engagements.length}</SectionLabel>
                <div className="space-y-1.5">
                  {engagements.map(e => (
                    <button
                      key={e.orderId}
                      onClick={() => void openOrder(e.orderId)}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] hover:bg-foreground/[0.05] hover:border-foreground/[0.14] transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                    >
                      <span className="w-9 h-9 rounded-xl bg-foreground/[0.06] flex items-center justify-center shrink-0">
                        <Receipt className="w-4 h-4 text-foreground/45" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-foreground tabular-nums">
                            #{e.orderId.slice(0, 8).toUpperCase()}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/40">
                            {e.direction === 'i_bought' ? 'Bought' : 'Sold'}
                          </span>
                        </span>
                        <span className="block text-[10px] font-bold text-foreground/45 tabular-nums">
                          {new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' · '}{e.itemCount} item{e.itemCount === 1 ? '' : 's'}
                          {' · '}{formatTZS(e.total)}
                        </span>
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-foreground/35 shrink-0 capitalize">
                        {e.status}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null /* Nothing to show yet — a header over an empty state was
                        just clutter; "Referenced here" below already follows
                        this same collapse-when-empty rule. */}

            {/* What this conversation has been about. Free — it comes from the
                thread already loaded, and it is the question the old details
                column could never answer. */}
            {(threadReferences.products.length > 0 || threadReferences.orderIds.length > 0) && (
              <div>
                <SectionLabel className="mb-2">Referenced here</SectionLabel>
                <div className="space-y-1.5">
                  {threadReferences.products.map(p => (
                    <Link
                      key={p.id}
                      to={`/product/${p.id}`}
                      className="w-full flex items-center gap-2.5 p-2 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] hover:bg-foreground/[0.05] hover:border-foreground/[0.14] transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                    >
                      {p.image
                        ? <img src={p.image} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" loading="lazy" />
                        : (
                          <span className="w-10 h-10 rounded-xl bg-foreground/[0.06] flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-foreground/45" />
                          </span>
                        )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-foreground truncate">{p.name}</span>
                        {typeof p.price === 'number' && (
                          <span className="block text-[10px] font-bold text-foreground/45 tabular-nums">{formatTZS(p.price)}</span>
                        )}
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-foreground/35 shrink-0" />
                    </Link>
                  ))}
                  {threadReferences.orderIds.map(id => (
                    <button
                      key={id}
                      onClick={() => void openOrder(id)}
                      className="w-full flex items-center gap-2.5 p-2 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] hover:bg-foreground/[0.05] hover:border-foreground/[0.14] transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                    >
                      <span className="w-10 h-10 rounded-xl bg-foreground/[0.06] flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4 text-foreground/45" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <SectionLabel>Order</SectionLabel>
                        <span className="block text-xs font-bold text-foreground truncate tabular-nums">
                          #{id.slice(0, 8).toUpperCase()}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <SectionLabel className="mb-2">Actions</SectionLabel>
              <Button
                variant="secondary"
                onClick={() => void openPeerProfile(active.peerId)}
                className="w-full h-11 rounded-2xl text-xs"
              >
                View full profile
              </Button>
              {cfg.canBlock && (
                <button
                  onClick={() => peerBlocked
                    ? void unblockUser(active.peerId)
                    : setConfirmAction({ type: 'block', peerId: active.peerId })}
                  className={`w-full h-11 rounded-2xl border text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40
                    ${peerBlocked
                      ? 'border-emerald-500/25 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/5'
                      : 'border-rose-500/25 text-rose-500 hover:bg-rose-500/5'}`}
                >
                  {peerBlocked ? 'Unblock user' : 'Block user'}
                </button>
              )}
              <button
                onClick={() => setReportingPeer(active)}
                className="w-full h-11 rounded-2xl border border-transparent text-xs font-bold text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/5 hover:border-rose-500/25 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                Report user
              </button>
              <button
                onClick={() => setConfirmAction({ type: 'delete-chat', peerId: active.peerId })}
                className="w-full h-11 rounded-2xl border border-transparent text-xs font-bold text-foreground/45 hover:text-rose-500 hover:bg-rose-500/5 hover:border-rose-500/25 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                Delete chat
              </button>
            </div>
          </div>
        )}
      </DetailsDrawer>

      {/* ══ Modals ══ */}
      {lightboxUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image attachment"
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 animate-in fade-in duration-150"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            aria-label="Close"
            className="absolute top-4 right-4 h-11 w-11 flex items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Attachment, full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <UserProfileModal isOpen={!!viewingProfile} onClose={() => setViewingProfile(null)} user={viewingProfile} />
      <OrderDetailsModal isOpen={!!viewingOrder} onClose={() => setViewingOrder(null)} order={viewingOrder} />

      {reportingPeer && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Report user"
            className="bg-background border border-foreground/[0.1] w-full max-w-sm p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <h3 className="text-xl font-black tracking-tight mb-5 text-foreground">Report {reportingPeer.name}</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="report-reason" className="block mb-1.5">
                  <SectionLabel>Reason</SectionLabel>
                </label>
                <select
                  id="report-reason"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full h-12 bg-foreground/[0.03] border border-foreground/[0.1] rounded-2xl px-3 text-sm font-medium text-foreground focus:outline-none focus:border-emerald-500/40 transition-colors"
                >
                  {REPORT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="report-details" className="block mb-1.5">
                  <SectionLabel>Details (optional)</SectionLabel>
                </label>
                <textarea
                  id="report-details"
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="What happened?"
                  className="w-full h-24 bg-foreground/[0.03] border border-foreground/[0.1] rounded-2xl p-3 text-sm font-medium text-foreground focus:outline-none focus:border-emerald-500/40 transition-colors resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="secondary" onClick={() => setReportingPeer(null)} className="flex-1 rounded-2xl">Cancel</Button>
                <Button variant="danger" onClick={() => void handleReport()} isLoading={isReporting} className="flex-1 rounded-2xl">Submit</Button>
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
            else {
              await m.removeConversation(a.peerId);
              setDetailsOpen(false);
              addToast('Chat deleted', 'success');
            }
          } catch (e: any) {
            addToast(e?.message || 'That did not work', 'error');
          }
        }}
      />

      <ConfirmDialog
        isOpen={confirmBulkDelete}
        title={`Delete ${selectedPeerIds.size} chat${selectedPeerIds.size === 1 ? '' : 's'}?`}
        message="Removed from your inbox only — the other person in each conversation keeps their copy."
        confirmText="Delete chats"
        isDangerous
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={async () => {
          setConfirmBulkDelete(false);
          await handleBulkDelete();
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
    </MessagingShell>
  );
};
