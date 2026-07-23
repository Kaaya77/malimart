import React, { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Pin, MessageSquare, Reply, Trash2, ShieldAlert, Smile, MoreVertical, Check, CheckCheck, Paperclip, Archive, ArchiveRestore, Search, X, Loader2, UserCircle2 } from 'lucide-react';
import { searchMessagingContacts } from '../../services/messagesService';

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
            {item.isVerified && <BadgeCheck className={`w-3.5 h-3.5 shrink-0 ${selected ? 'text-background/70' : 'text-emerald-500'}`} />}
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

// ─── MessageBubble ─────────────────────────────────────────────────────────

export interface BubbleProps {
  id: string;
  body?: string;
  attachmentUrl?: string | null;
  attachmentType?: 'image' | 'file' | null;
  deletedAt?: string | null;
  createdAt?: string;
  isMine: boolean;
  read?: boolean;
  reactions?: { emoji: string; user_id?: string }[];
  replyToContent?: string | null;
  /** Extra content rendered inside the bubble before the text (e.g. ProductOrderTag) */
  contextSlot?: React.ReactNode;
  onReply?: () => void;
  onDelete?: () => void;   // shown only if isMine
  onReport?: () => void;   // shown only if !isMine
  onReact?: (emoji: string) => void;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export const MessageBubble = ({
  id, body, attachmentUrl, attachmentType, deletedAt, createdAt,
  isMine, read, reactions, replyToContent, contextSlot,
  onReply, onDelete, onReport, onReact,
}: BubbleProps) => {
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const reactionMap = (reactions ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});
  const hasReactions = Object.keys(reactionMap).length > 0;

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group relative mb-0.5`}>
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

      <div className="relative max-w-[80%]">
        {/* Bubble */}
        <div className={`px-4 py-2.5 text-[13px] leading-relaxed shadow-sm relative
          ${isMine
            ? 'bg-foreground text-background rounded-2xl rounded-br-sm'
            : 'glass-surface text-foreground border border-foreground/[0.08] rounded-2xl rounded-bl-sm'
          }`}
        >
          {/* Attachment */}
          {attachmentUrl && !deletedAt && (
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
                    ${isMine ? 'bg-background/10 hover:bg-background/20' : 'bg-foreground/[0.05] hover:bg-foreground/[0.09]'}`}
                >
                  <Paperclip className="w-3.5 h-3.5 shrink-0" />
                  View attachment
                </a>
              )}
            </div>
          )}

          {/* Body */}
          {deletedAt ? (
            <em className={`text-[12px] ${isMine ? 'text-background/50' : 'text-foreground/40'}`}>
              Message deleted
            </em>
          ) : (
            <span className="whitespace-pre-wrap break-words">{body}</span>
          )}

          {/* Timestamp + read receipt */}
          <div className={`flex items-center gap-1 mt-1.5 ${isMine ? 'justify-end' : 'justify-end'}`}>
            <span className={`text-[10px] font-medium ${isMine ? 'text-background/50' : 'text-foreground/35'}`}>
              {shortTime(createdAt)}
            </span>
            {isMine && !deletedAt && (
              read
                ? <CheckCheck className={`w-3 h-3 ${isMine ? 'text-background/60' : 'text-emerald-500'}`} />
                : <Check className={`w-3 h-3 ${isMine ? 'text-background/40' : 'text-foreground/30'}`} />
            )}
          </div>

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
                  onClick={() => { onReact?.(emoji); setShowEmoji(false); }}
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
            {Object.entries(reactionMap).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact?.(emoji)}
                className="px-2 py-0.5 bg-foreground/[0.06] hover:bg-foreground/[0.1] border border-foreground/[0.08] rounded-full text-[11px] flex items-center gap-1 transition-colors"
              >
                {emoji} <span className="font-bold text-foreground/60">{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Hover actions - floating pill beside bubble */}
        {!deletedAt && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center
              ${isMine ? 'right-full pr-2' : 'left-full pl-2'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-0.5 bg-background border border-foreground/10 rounded-full shadow-md px-1 py-0.5">
              {onReply && (
                <button
                  onClick={onReply}
                  title="Reply"
                  className="p-1.5 rounded-full text-foreground/40 hover:bg-foreground/[0.06] hover:text-emerald-500 transition-colors"
                >
                  <Reply className="w-3.5 h-3.5" />
                </button>
              )}
              {onReact && (
                <button
                  onClick={() => setShowEmoji((v) => !v)}
                  title="React"
                  className="p-1.5 rounded-full text-foreground/40 hover:bg-foreground/[0.06] hover:text-amber-500 transition-colors"
                >
                  <Smile className="w-3.5 h-3.5" />
                </button>
              )}
              {isMine && onDelete && (
                <button
                  onClick={onDelete}
                  title="Delete"
                  className="p-1.5 rounded-full text-foreground/40 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {!isMine && onReport && (
                <button
                  onClick={onReport}
                  title="Report"
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
  isOpen, onClose, onSelect, roleFilter,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (contact: { id: string; full_name: string | null; avatar_url: string | null; role: string }) => void;
  /** Restrict results to one role (e.g. sellers messaging only other sellers). Omit to search everyone. */
  roleFilter?: 'buyer' | 'seller' | 'admin';
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
            <p className="text-center text-xs text-foreground/35 py-8">Type at least 2 characters to search</p>
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
