import React, { useEffect, useRef, useState } from 'react';
import { VerifiedBadge } from '../UI';
import { Pin, MessageSquare, Reply, Trash2, ShieldAlert, Smile, Check, CheckCheck, Paperclip, Archive, ArchiveRestore, Search, X, Loader2, UserCircle2, Package, Tag, AlertCircle, RotateCcw } from 'lucide-react';
import { searchMessagingContacts, Reaction } from '../../services/messagesService';
import { formatTZS } from '../../constants';

// ─── Date helpers ────────────────────────────────────────────────────────────

export const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

export const formatDateLabel = (date: Date) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
};

export const relativeTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const shortTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

// ─── DayDivider ──────────────────────────────────────────────────────────────

export const DayDivider = ({ date }: { date: Date }) => (
  <div className="flex items-center gap-3 my-5" role="separator">
    <div className="flex-1 h-px bg-foreground/[0.06]" />
    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/35 px-1">
      {formatDateLabel(date)}
    </span>
    <div className="flex-1 h-px bg-foreground/[0.06]" />
  </div>
);

// ─── ConversationListItem ─────────────────────────────────────────────────────

export interface ConversationItem {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isVerified?: boolean;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  subtitle?: string;
  isOnline?: boolean;
}

export const ConversationListItem = ({
  item, selected, pinned, archived, onSelect, onTogglePin, onToggleArchive,
}: {
  item: ConversationItem;
  selected: boolean;
  pinned: boolean;
  archived?: boolean;
  onSelect: () => void;
  onTogglePin?: (e: React.MouseEvent) => void;
  onToggleArchive?: (e: React.MouseEvent) => void;
}) => {
  const unread = item.unreadCount ?? 0;
  return (
    <button
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={`w-full text-left px-3 py-3 rounded-xl transition-all group relative
        ${selected
          ? 'bg-foreground text-background shadow-sm'
          : 'hover:bg-foreground/[0.04] text-foreground'
        }`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-full bg-foreground/[0.08] overflow-hidden ring-2 ring-transparent">
            <img
              src={item.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random`}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
          {item.isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-background" />
          )}
          {unread > 0 && !selected && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-background">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            <p className={`font-bold text-[13px] truncate flex-1 ${selected ? 'text-background' : 'text-foreground'}`}>
              {item.name}
            </p>
            {item.isVerified && <VerifiedBadge iconOnly size="w-3.5 h-3.5" />}
            {pinned && <Pin className={`w-3 h-3 shrink-0 ${selected ? 'text-background/60' : 'text-foreground/40'}`} />}
            {item.lastMessageAt && (
              <span className={`text-[10px] shrink-0 ml-auto ${selected ? 'text-background/55' : unread > 0 ? 'text-emerald-500 font-bold' : 'text-foreground/35'}`}>
                {relativeTime(item.lastMessageAt)}
              </span>
            )}
          </div>
          <p className={`text-[11px] truncate leading-snug ${
            selected ? 'text-background/60'
            : unread > 0 ? 'text-foreground/80 font-semibold'
            : 'text-foreground/45'
          }`}>
            {item.lastMessage || item.subtitle || 'Start the conversation'}
          </p>
        </div>
      </div>

      {/* Conversation-level actions */}
      {(onTogglePin || onToggleArchive) && (
        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onTogglePin && (
            <span
              onClick={onTogglePin}
              role="button"
              aria-label={pinned ? 'Unpin' : 'Pin'}
              className={`p-1.5 rounded-full cursor-pointer
                ${selected ? 'bg-background/15 text-background/60 hover:bg-background/25' : 'bg-foreground/[0.06] text-foreground/40 hover:bg-foreground/12'}`}
            >
              <Pin className="w-3 h-3" />
            </span>
          )}
          {onToggleArchive && (
            <span
              onClick={onToggleArchive}
              role="button"
              aria-label={archived ? 'Unarchive' : 'Archive'}
              className={`p-1.5 rounded-full cursor-pointer
                ${selected ? 'bg-background/15 text-background/60 hover:bg-background/25' : 'bg-foreground/[0.06] text-foreground/40 hover:bg-foreground/12'}`}
            >
              {archived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
            </span>
          )}
        </div>
      )}
    </button>
  );
};

// ─── ChatEmptyState ───────────────────────────────────────────────────────────

export const ChatEmptyState = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-foreground/40 px-8 text-center gap-3">
    <div className="w-16 h-16 rounded-2xl bg-foreground/[0.04] flex items-center justify-center">
      <MessageSquare className="w-7 h-7 opacity-30" />
    </div>
    <div>
      <p className="text-sm font-bold text-foreground/60">{title}</p>
      {hint && <p className="text-xs text-foreground/35 mt-1 max-w-[220px] leading-relaxed">{hint}</p>}
    </div>
  </div>
);

// ─── TypingIndicator ─────────────────────────────────────────────────────────

export const TypingIndicator = () => (
  <div className="flex items-end gap-2 mt-2 animate-in fade-in slide-in-from-bottom-2">
    <div className="bg-foreground/[0.06] border border-foreground/[0.08] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center h-10 shadow-sm">
      <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  </div>
);

// ─── MessageContextTag ───────────────────────────────────────────────────────
// The product/order a message is about, rendered inside the bubble.
//
// Was `ProductOrderTag` in SellerMessages.tsx, cross-imported by both other
// inboxes. Two things changed: it lives with the rest of the kit now, and it
// no longer uses UI.tsx's GraphicalTag, which paints `bg-blue-50` /
// `bg-white` (fixed light surfaces) and puts `text-foreground` on top — an
// inverting ink on a pinned surface, so the label vanished in dark mode.

export const MessageContextTag = ({
  product, orderId, onViewProduct, onViewOrder,
}: {
  product?: { id: string; name: string; price: number; slug: string | null; image: string | null } | null;
  orderId?: string | null;
  onViewProduct?: (productId: string) => void;
  onViewOrder?: (orderId: string) => void;
}) => {
  if (!product && !orderId) return null;
  return (
    <div className="mb-2 flex flex-col gap-1.5 max-w-[80%]">
      {orderId && (
        <button
          type="button"
          onClick={() => onViewOrder?.(orderId)}
          disabled={!onViewOrder}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-foreground/[0.05] border border-foreground/10 text-left transition-colors enabled:hover:bg-foreground/[0.09] disabled:cursor-default"
        >
          <span className="w-7 h-7 rounded-lg bg-foreground/[0.07] flex items-center justify-center shrink-0">
            <Package className="w-3.5 h-3.5 text-foreground/60" />
          </span>
          <span className="min-w-0">
            <span className="block text-[9px] font-black uppercase tracking-widest text-foreground/40">Order</span>
            <span className="block text-[11px] font-bold text-foreground truncate">
              #{orderId.slice(0, 8).toUpperCase()}
            </span>
          </span>
        </button>
      )}
      {product && (
        <button
          type="button"
          onClick={() => onViewProduct?.(product.id)}
          disabled={!onViewProduct}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-foreground/[0.05] border border-foreground/10 text-left transition-colors enabled:hover:bg-foreground/[0.09] disabled:cursor-default"
        >
          {product.image ? (
            <img
              src={product.image}
              alt=""
              className="w-9 h-9 object-cover rounded-lg shrink-0"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="w-9 h-9 rounded-lg bg-foreground/[0.07] flex items-center justify-center shrink-0">
              <Tag className="w-3.5 h-3.5 text-foreground/60" />
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-[11px] font-bold text-foreground truncate">{product.name}</span>
            {typeof product.price === 'number' && (
              <span className="block text-[10px] font-semibold text-foreground/50">
                {formatTZS(product.price)}
              </span>
            )}
          </span>
        </button>
      )}
    </div>
  );
};

// ─── MessageBubble ─────────────────────────────────────────────────────────

export interface BubbleProps {
  id: string;
  body?: string | null;
  attachmentUrl?: string | null;
  attachmentType?: 'image' | 'file' | null;
  deleted?: boolean;
  createdAt?: string;
  isMine: boolean;
  read?: boolean;
  reactions?: Reaction[];
  /** Used to mark which reaction chips are the current user's own. */
  myUserId?: string;
  replyToContent?: string | null;
  /** Awaiting server confirmation — rendered dimmed with a clock. */
  pending?: boolean;
  /** The send failed; offer retry/discard instead of a timestamp. */
  failed?: boolean;
  /** Extra content rendered above the bubble (product/order tags). */
  contextSlot?: React.ReactNode;
  onReply?: () => void;
  /** Hide from my side only. Shown for any message I can see. */
  onDelete?: () => void;
  /** Tombstone for both sides — sender only, inside the 1h window. */
  onDeleteForEveryone?: () => void;
  onReport?: () => void;   // shown only if !isMine
  onReact?: (emoji: string) => void;
  onRetry?: () => void;
  onDiscard?: () => void;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export const MessageBubble = ({
  id, body, attachmentUrl, attachmentType, deleted, createdAt,
  isMine, read, reactions, myUserId, replyToContent, pending, failed, contextSlot,
  onReply, onDelete, onDeleteForEveryone, onReport, onReact, onRetry, onDiscard,
}: BubbleProps) => {
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Long-press (touch) reveals the reply/react/delete actions — on mobile there
  // is no hover, so "hold a message" is the only way to get to them (#19).
  const startPress = () => {
    if (deleted) return;
    pressTimer.current = setTimeout(() => {
      setShowMenu(true);
      try { navigator.vibrate?.(15); } catch { /* not supported */ }
    }, 420);
  };
  const cancelPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };

  // Group identical emoji, and remember whether one of them is mine so the
  // chip can show as active — the reaction toggle used to be an insert-only
  // call, so there was never any "mine" state to show.
  const grouped = (reactions ?? []).reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    const entry = acc[r.emoji] ?? { count: 0, mine: false };
    entry.count += 1;
    if (myUserId && r.user_id === myUserId) entry.mine = true;
    acc[r.emoji] = entry;
    return acc;
  }, {});
  const hasReactions = Object.keys(grouped).length > 0;
  const actionable = !deleted && !pending && !failed;

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group relative mb-0.5`}>
      {/* Tap-catcher to dismiss the long-press action menu */}
      {showMenu && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowMenu(false); setShowEmoji(false); }} />
      )}
      {/* Reply preview */}
      {replyToContent && (
        <div className={`mb-1 max-w-[75%] px-3 py-1.5 rounded-xl text-[11px] leading-snug
          border-l-2 opacity-70
          ${isMine
            ? 'bg-foreground/[0.06] border-foreground/25 self-end text-foreground'
            : 'bg-foreground/[0.04] border-foreground/20 self-start text-foreground'
          }`}>
          <span className="truncate block">{replyToContent}</span>
        </div>
      )}

      {/* Context slot (product/order tags) */}
      {contextSlot}

      <div className={`relative max-w-[80%] z-50 ${pending ? 'opacity-60' : ''}`}>
        {/* Bubble */}
        <div className={`px-4 py-2.5 text-[13px] leading-relaxed shadow-sm relative select-none
          ${failed
            ? 'bg-rose-500/10 text-foreground border border-rose-500/30 rounded-2xl rounded-br-sm'
            : isMine
              ? 'bg-foreground text-background rounded-2xl rounded-br-sm'
              : 'glass-surface text-foreground border border-foreground/[0.08] rounded-2xl rounded-bl-sm'
          }`}
          onTouchStart={startPress}
          onTouchEnd={cancelPress}
          onTouchMove={cancelPress}
          onContextMenu={(e) => { if (actionable && (onReply || onReact)) { e.preventDefault(); setShowMenu(true); } }}
        >
          {/* Attachment */}
          {attachmentUrl && !deleted && (
            <div className="mb-2">
              {attachmentType === 'image' ? (
                <img
                  src={attachmentUrl}
                  alt="Attachment"
                  className="max-w-full h-auto rounded-xl border border-foreground/8 max-h-64 object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <a
                  href={attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-[11px] font-semibold transition-colors
                    ${isMine && !failed ? 'bg-background/10 hover:bg-background/20' : 'bg-foreground/[0.05] hover:bg-foreground/[0.09]'}`}
                >
                  <Paperclip className="w-3.5 h-3.5 shrink-0" />
                  View attachment
                </a>
              )}
            </div>
          )}

          {/* Body */}
          {deleted ? (
            <em className={`text-[12px] ${isMine ? 'text-background/50' : 'text-foreground/40'}`}>
              Message deleted
            </em>
          ) : (
            <span className="whitespace-pre-wrap break-words">{body}</span>
          )}

          {/* Footer: failure actions, or timestamp + receipt */}
          {failed ? (
            <div className="flex items-center gap-2 mt-2">
              <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
              <span className="text-[10px] font-semibold text-rose-500 flex-1">Not sent</span>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1 text-[10px] font-bold text-foreground/70 hover:text-foreground px-1.5 py-0.5 rounded-md hover:bg-foreground/[0.06] transition-colors"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> Retry
                </button>
              )}
              {onDiscard && (
                <button
                  onClick={onDiscard}
                  aria-label="Discard unsent message"
                  className="text-[10px] font-bold text-foreground/40 hover:text-rose-500 px-1.5 py-0.5 rounded-md transition-colors"
                >
                  Discard
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1 mt-1.5">
              <span className={`text-[10px] font-medium ${isMine ? 'text-background/50' : 'text-foreground/35'}`}>
                {pending ? 'Sending…' : shortTime(createdAt)}
              </span>
              {isMine && !deleted && !pending && (
                read
                  ? <CheckCheck className="w-3 h-3 text-background/60" />
                  : <Check className="w-3 h-3 text-background/40" />
              )}
            </div>
          )}

          {/* Emoji picker */}
          {showEmoji && (
            <div
              className={`absolute bottom-full mb-2 bg-background border border-foreground/10 rounded-2xl p-2 flex gap-2 z-50 shadow-xl
                ${isMine ? 'right-0' : 'left-0'}`}
              onClick={(e) => e.stopPropagation()}
            >
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { onReact?.(emoji); setShowEmoji(false); setShowMenu(false); }}
                  aria-label={`React ${emoji}`}
                  className="hover:scale-125 transition-transform p-1 text-base"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reactions row */}
        {hasReactions && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(grouped).map(([emoji, { count, mine }]) => (
              <button
                key={emoji}
                onClick={() => onReact?.(emoji)}
                aria-pressed={mine}
                title={mine ? 'Remove your reaction' : `React ${emoji}`}
                className={`px-2 py-0.5 rounded-full text-[11px] flex items-center gap-1 transition-colors border
                  ${mine
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-foreground'
                    : 'bg-foreground/[0.06] border-foreground/[0.08] text-foreground hover:bg-foreground/[0.1]'
                  }`}
              >
                {emoji} <span className={`font-bold ${mine ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/60'}`}>{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Hover actions - floating pill beside bubble */}
        {actionable && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 transition-opacity flex items-center z-50
              ${showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}
              ${isMine ? 'right-full pr-2' : 'left-full pl-2'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-0.5 bg-background border border-foreground/10 rounded-full shadow-md px-1 py-0.5">
              {onReply && (
                <button
                  onClick={() => { onReply(); setShowMenu(false); }}
                  title="Reply"
                  aria-label="Reply"
                  className="p-1.5 rounded-full text-foreground/40 hover:bg-foreground/[0.06] hover:text-emerald-500 transition-colors"
                >
                  <Reply className="w-3.5 h-3.5" />
                </button>
              )}
              {onReact && (
                <button
                  onClick={() => setShowEmoji((v) => !v)}
                  title="React"
                  aria-label="React"
                  className="p-1.5 rounded-full text-foreground/40 hover:bg-foreground/[0.06] hover:text-amber-500 transition-colors"
                >
                  <Smile className="w-3.5 h-3.5" />
                </button>
              )}
              {onDeleteForEveryone && (
                <button
                  onClick={() => { onDeleteForEveryone(); setShowMenu(false); }}
                  title="Delete for everyone"
                  aria-label="Delete for everyone"
                  className="p-1.5 rounded-full text-foreground/40 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {!onDeleteForEveryone && onDelete && (
                <button
                  onClick={() => { onDelete(); setShowMenu(false); }}
                  title="Remove from my side"
                  aria-label="Remove from my side"
                  className="p-1.5 rounded-full text-foreground/40 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {!isMine && onReport && (
                <button
                  onClick={() => { onReport(); setShowMenu(false); }}
                  title="Report"
                  aria-label="Report message"
                  className="p-1.5 rounded-full text-foreground/40 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── New conversation ────────────────────────────────────────────────────────
// Contacts are only discoverable through search_messaging_contacts (profiles
// has no client-readable policy for other users' rows) — see the RPC's own
// comment for why. Any authenticated user can message any other; this modal
// is what lets a seller reach another seller, or anyone reach a buyer, when
// no thread exists yet.
export const NewConversationModal = ({
  isOpen, onClose, onSelect, roleFilter, recentContacts = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (contact: { id: string; full_name: string | null; avatar_url: string | null; role: string }) => void;
  /** Restrict results to one role (e.g. sellers messaging only other sellers). Omit to search everyone. */
  roleFilter?: 'buyer' | 'seller' | 'admin';
  /** People the user has already chatted with — shown before they type (#19). */
  recentContacts?: Array<{ id: string; full_name: string | null; avatar_url: string | null; role: string }>;
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; full_name: string | null; avatar_url: string | null; role: string }>>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) { setQuery(''); setResults([]); return; }
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const data = await searchMessagingContacts(q, roleFilter);
      setResults(data);
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, roleFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-24 px-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-background rounded-2xl border border-foreground/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 p-4 border-b border-foreground/8">
          <Search className="w-4 h-4 text-foreground/35 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={roleFilter ? `Search ${roleFilter}s by name…` : 'Search people by name…'}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground/35 outline-none"
          />
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-full hover:bg-foreground/[0.06] text-foreground/40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-foreground/40 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
            </div>
          )}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-center text-xs text-foreground/40 py-8">No one found matching "{query.trim()}"</p>
          )}
          {!loading && query.trim().length < 2 && (
            recentContacts.length > 0 ? (
              <>
                <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-foreground/40">Recent</p>
                {recentContacts.map(r => (
                  <button
                    key={r.id}
                    onClick={() => { onSelect(r); onClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/[0.04] transition-colors text-left"
                  >
                    {r.avatar_url ? (
                      <img src={r.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" loading="lazy" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-foreground/[0.08] flex items-center justify-center shrink-0">
                        <UserCircle2 className="w-5 h-5 text-foreground/40" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{r.full_name || 'User'}</p>
                      <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-bold">{r.role}</p>
                    </div>
                  </button>
                ))}
                <p className="text-center text-[10px] text-foreground/30 py-3">Or search everyone by name above</p>
              </>
            ) : (
              <p className="text-center text-xs text-foreground/35 py-8">Type at least 2 characters to search</p>
            )
          )}
          {!loading && results.map(r => (
            <button
              key={r.id}
              onClick={() => { onSelect(r); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/[0.04] transition-colors text-left"
            >
              {r.avatar_url ? (
                <img src={r.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" loading="lazy" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-foreground/[0.08] flex items-center justify-center shrink-0">
                  <UserCircle2 className="w-5 h-5 text-foreground/40" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{r.full_name || 'User'}</p>
                <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-bold">{r.role}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
