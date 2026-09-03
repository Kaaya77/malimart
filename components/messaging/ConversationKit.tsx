/**
 * ConversationKit — the presentational pieces of the messaging surface.
 *
 * Restyled into the seller-dashboard language that the rest of the app uses:
 * `rounded-2xl` panels on `bg-foreground/[0.02]`, `text-[10px] uppercase
 * tracking-[0.15em]` labels, `font-black` headings, emerald active states,
 * and nothing below `text-[10px]`.
 *
 * Three things the old styling got wrong, all of them theme bugs rather than
 * taste:
 *
 *  * The selected conversation and every outgoing bubble were painted
 *    `bg-foreground text-background`. That pair INVERTS with the theme, so the
 *    "selected" colour was near-black in light mode and cream in dark — the
 *    accent changed identity between themes instead of staying emerald.
 *  * Labels sat at `text-[9px]`, below the project's floor.
 *  * The bubble's hover actions were positioned `right-full` / `left-full`,
 *    i.e. OUTSIDE the bubble, so in a narrow pane they rendered off the edge
 *    of the scroll container. They now sit inside the bubble's own column.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { VerifiedBadge, EmptyState } from '../UI';
import {
  Pin, MessageSquare, Reply, Trash2, ShieldAlert, Smile, Check, CheckCheck,
  Paperclip, Archive, ArchiveRestore, Search, X, Loader2, UserCircle2,
  Package, Tag, AlertCircle, RotateCcw, Clock, ArrowUpRight,
} from 'lucide-react';
import { searchMessagingContacts, Reaction, PeerRole } from '../../services/messagesService';
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

// ─── Shared label ────────────────────────────────────────────────────────────

/** The dashboard's section label. One definition, so the scale can't drift. */
export const SectionLabel = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/40 ${className}`}>
    {children}
  </p>
);

// ─── DayDivider ──────────────────────────────────────────────────────────────

export const DayDivider = ({ date }: { date: Date }) => (
  <div className="flex items-center justify-center my-6" role="separator">
    <span className="px-3 py-1 rounded-full bg-foreground/[0.05] border border-foreground/[0.06] text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/45">
      {formatDateLabel(date)}
    </span>
  </div>
);

// ─── Presence dot ────────────────────────────────────────────────────────────

const PresenceDot = ({ className = '' }: { className?: string }) => (
  <span className={`rounded-full bg-emerald-500 ring-2 ring-background ${className}`} />
);

// ─── Avatar ──────────────────────────────────────────────────────────────────

export const PeerAvatar = ({
  name, url, size = 'md', online, className = '',
}: {
  name: string;
  url?: string | null;
  size?: 'sm' | 'md' | 'lg';
  online?: boolean;
  className?: string;
}) => {
  const dims = size === 'lg' ? 'w-16 h-16 text-xl rounded-3xl'
    : size === 'sm' ? 'w-9 h-9 text-xs rounded-xl'
    : 'w-11 h-11 text-sm rounded-2xl';
  const dot = size === 'lg' ? 'w-3.5 h-3.5' : 'w-3 h-3';
  return (
    <div className={`relative shrink-0 ${className}`}>
      <div className={`${dims} overflow-hidden bg-foreground/[0.06] border border-foreground/[0.08] flex items-center justify-center font-black text-foreground/50`}>
        {url
          ? <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          : (name || 'U').slice(0, 1).toUpperCase()}
      </div>
      {online && <PresenceDot className={`absolute -bottom-0.5 -right-0.5 ${dot}`} />}
    </div>
  );
};

// ─── ConversationListItem ────────────────────────────────────────────────────

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

// ─── Row swipe / hold ────────────────────────────────────────────────────────

/** Width of one revealed action button. Two of them = the full drawer. */
const ACTION_W = 72;
/** Past this much horizontal travel, the drawer snaps open on release. */
const SNAP_AT = 32;
/** Below this, treat the gesture as a vertical list scroll and let it go. */
const AXIS_LOCK = 8;
/** Hold this long to open the drawer without swiping. */
const HOLD_MS = 480;

/**
 * Swipe-left / press-and-hold to reveal a row's actions.
 *
 * The pin and archive buttons were `opacity-0 group-hover:opacity-100` — on a
 * phone there is no hover, so on the surface most of this app's users are on,
 * they did not exist. This gives the same actions a touch affordance.
 *
 * The axis lock matters: the row lives inside a vertical scroller, so a
 * gesture is only claimed once it is clearly more horizontal than vertical,
 * and `touch-action: pan-y` on the row tells the browser the same thing.
 */
function useRowSwipe({ enabled }: { enabled: boolean }) {
  const [dragX, setDragX] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<'undecided' | 'x' | 'y'>('undecided');
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const width = ACTION_W * 2;

  const close = useCallback(() => {
    setRevealed(false);
    setDragX(0);
  }, []);

  const open = useCallback(() => {
    setRevealed(true);
    setDragX(-width);
    try { navigator.vibrate?.(12); } catch { /* not supported */ }
  }, [width]);

  const clearHold = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (!enabled) return;
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
    axis.current = 'undecided';
    clearHold();
    holdTimer.current = setTimeout(() => { if (axis.current !== 'x') open(); }, HOLD_MS);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!enabled || !start.current) return;
    const t = e.touches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;

    if (axis.current === 'undecided') {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axis.current === 'x') clearHold();
    }
    if (axis.current !== 'x') { clearHold(); return; }

    const base = revealed ? -width : 0;
    // Left-swipe only, and never past the drawer's own width.
    setDragX(Math.max(-width, Math.min(0, base + dx)));
  };

  const onTouchEnd = () => {
    clearHold();
    if (!enabled || axis.current !== 'x') { start.current = null; return; }
    start.current = null;
    if (dragX < -SNAP_AT) open(); else close();
  };

  useEffect(() => () => clearHold(), []);

  return {
    dragX,
    revealed,
    open,
    close,
    actionWidth: width,
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd },
  };
}

export const ConversationListItem = ({
  item, selected, pinned, archived, onSelect, onTogglePin, onToggleArchive, onDelete,
}: {
  item: ConversationItem;
  selected: boolean;
  pinned: boolean;
  archived?: boolean;
  onSelect: () => void;
  onTogglePin?: (e: React.MouseEvent) => void;
  onToggleArchive?: (e: React.MouseEvent) => void;
  /** Delete the whole conversation from my side. Enables the swipe action. */
  onDelete?: () => void;
}) => {
  const unread = item.unreadCount ?? 0;
  const { dragX, revealed, close, handlers } = useRowSwipe({ enabled: !!(onToggleArchive || onDelete) });

  const runAction = (fn?: (e: any) => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    close();
    fn?.(e);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Swipe/hold drawer, sitting behind the row. Revealed by dragging the
          row left on touch, or by holding it — on a phone there is no hover,
          so the pin/archive affordances above were desktop-only. */}
      {(onToggleArchive || onDelete) && (dragX !== 0 || revealed) && (
        <div className="absolute inset-y-0 right-0 flex items-stretch">
          {onToggleArchive && (
            <button
              onClick={runAction(onToggleArchive)}
              tabIndex={revealed ? 0 : -1}
              aria-label={archived ? `Unarchive ${item.name}` : `Archive ${item.name}`}
              className="w-[72px] flex flex-col items-center justify-center gap-1 bg-foreground/[0.07] text-foreground/70 hover:bg-foreground/[0.12] transition-colors"
            >
              {archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              <span className="text-[10px] font-black uppercase tracking-[0.1em]">
                {archived ? 'Restore' : 'Archive'}
              </span>
            </button>
          )}
          {onDelete && (
            <button
              onClick={runAction(onDelete)}
              tabIndex={revealed ? 0 : -1}
              aria-label={`Delete conversation with ${item.name}`}
              className="w-[72px] flex flex-col items-center justify-center gap-1 bg-rose-500 text-white hover:bg-rose-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.1em]">Delete</span>
            </button>
          )}
        </div>
      )}

      <div
        {...handlers}
        style={{
          transform: `translateX(${dragX}px)`,
          // pan-y keeps vertical list scrolling native while we own the
          // horizontal axis.
          touchAction: 'pan-y',
        }}
        className={`group relative rounded-2xl border bg-background transition-[border-color]
          ${dragX !== 0 || revealed ? 'rounded-r-none' : ''}
          ${dragX === 0 ? 'duration-200' : 'duration-0'}
          ${selected
            ? 'border-emerald-500/40'
            : 'border-transparent hover:border-foreground/[0.08]'
          }`}
      >
        {/* Tint as an overlay, not as the row's own background: the row has to
            stay opaque or the swipe drawer shows through it. */}
        <span
          aria-hidden="true"
          className={`absolute inset-0 rounded-2xl pointer-events-none transition-colors duration-200
            ${selected ? 'bg-emerald-500/[0.08]' : 'group-hover:bg-foreground/[0.03]'}`}
        />
        {/* Selected marker — an emerald spine rather than an inverted slab, so
            the accent means the same thing in both themes. */}
        {selected && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-[3px] rounded-r-full bg-emerald-500" aria-hidden="true" />
        )}
        <button
          onClick={() => { if (revealed) { close(); return; } onSelect(); }}
          aria-current={selected ? 'true' : undefined}
          className="w-full text-left px-3 py-3 min-h-[68px] flex items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          <PeerAvatar name={item.name} url={item.avatarUrl} online={item.isOnline} />

          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-1.5 mb-0.5">
              <span className={`truncate text-sm ${unread > 0 ? 'font-black text-foreground' : 'font-bold text-foreground/85'}`}>
                {item.name}
              </span>
              {item.isVerified && <VerifiedBadge iconOnly size="w-3.5 h-3.5" />}
              {pinned && <Pin className="w-3 h-3 shrink-0 text-emerald-600 dark:text-emerald-400" />}
              {item.lastMessageAt && (
                <span className={`ml-auto shrink-0 text-[10px] font-bold tabular-nums ${unread > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/35'}`}>
                  {relativeTime(item.lastMessageAt)}
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <span className={`flex-1 truncate text-xs leading-snug ${unread > 0 ? 'text-foreground/75 font-semibold' : 'text-foreground/45 font-medium'}`}>
                {item.lastMessage || item.subtitle || 'Start the conversation'}
              </span>
              {unread > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-black tabular-nums shrink-0">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </span>
          </span>
        </button>

        {/* Pointer-device actions. Hidden once the swipe drawer is open, so the
            two affordances never stack on top of each other. */}
        {(onTogglePin || onToggleArchive) && !revealed && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            {onTogglePin && (
              <button
                onClick={runAction(onTogglePin)}
                aria-label={pinned ? `Unpin ${item.name}` : `Pin ${item.name}`}
                className="h-11 w-11 flex items-center justify-center rounded-2xl bg-background/90 border border-foreground/[0.08] text-foreground/45 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <Pin className="w-3.5 h-3.5" />
              </button>
            )}
            {onToggleArchive && (
              <button
                onClick={runAction(onToggleArchive)}
                aria-label={archived ? `Unarchive ${item.name}` : `Archive ${item.name}`}
                className="h-11 w-11 flex items-center justify-center rounded-2xl bg-background/90 border border-foreground/[0.08] text-foreground/45 hover:text-foreground hover:border-foreground/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                {archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── ChatEmptyState ──────────────────────────────────────────────────────────

/** Thin wrapper on the shared primitive, so messaging can't drift from it. */
export const ChatEmptyState = ({
  title, hint, icon, action,
}: {
  title: string;
  hint?: string;
  icon?: any;
  action?: React.ReactNode;
}) => (
  <div className="flex-1 flex items-center justify-center">
    <EmptyState icon={icon ?? MessageSquare} title={title} subtitle={hint} action={action} />
  </div>
);

// ─── TypingIndicator ─────────────────────────────────────────────────────────

export const TypingIndicator = ({ name }: { name?: string }) => (
  <div className="flex items-center gap-2 mt-3 animate-in fade-in slide-in-from-bottom-2">
    <div className="bg-foreground/[0.04] border border-foreground/[0.08] rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5 items-center shadow-sm">
      <span className="w-1.5 h-1.5 bg-foreground/35 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-foreground/35 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-foreground/35 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
    {name && <span className="text-[10px] font-bold text-foreground/35">{name} is typing</span>}
  </div>
);

// ─── MessageContextTag ───────────────────────────────────────────────────────
// The product/order a message is about, rendered above the bubble.
//
// Was `ProductOrderTag` in SellerMessages.tsx, cross-imported by both other
// inboxes. It used UI.tsx's GraphicalTag, which paints `bg-blue-50` / `bg-white`
// (fixed light surfaces) under `text-foreground` — an inverting ink on a pinned
// surface, so the label disappeared in dark mode.

export const MessageContextTag = ({
  product, orderId, orderItems, mine, onViewOrder,
}: {
  product?: { id: string; name: string; price: number; slug: string | null; image: string | null } | null;
  orderId?: string | null;
  /** The order's line items, hydrated server-side. Each one links straight to
   *  its product page — the opaque order id alone had nowhere useful to go. */
  orderItems?: Array<{ id: string; name: string; image: string | null; quantity: number; price: number }>;
  mine?: boolean;
  onViewOrder?: (orderId: string) => void;
}) => {
  if (!product && !orderId) return null;
  const shell = 'flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-foreground/[0.04] border border-foreground/[0.08] text-left transition-colors enabled:hover:bg-foreground/[0.07] enabled:hover:border-foreground/[0.14] disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40';
  const hasItems = !!orderItems && orderItems.length > 0;
  return (
    <div className={`mb-1.5 flex flex-col gap-1.5 max-w-[85%] ${mine ? 'items-end self-end' : 'items-start self-start'}`}>
      {orderId && hasItems && (
        <div className="w-full rounded-2xl border border-foreground/[0.08] bg-foreground/[0.04] overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-foreground/[0.06]">
            <Package className="w-3.5 h-3.5 text-foreground/45 shrink-0" />
            <SectionLabel>Order #{orderId.slice(0, 8).toUpperCase()}</SectionLabel>
          </div>
          {/* Each line item is its own link — this is the whole point: the tag
              used to say "about order #4A2B91C7" and go nowhere. Now it goes
              straight to the thing that was actually ordered. */}
          <div className="divide-y divide-foreground/[0.06]">
            {orderItems!.map(item => (
              <Link
                key={item.id}
                to={`/product/${item.id}`}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-foreground/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-inset"
                aria-label={`View ${item.name}`}
              >
                {item.image ? (
                  <img src={item.image} alt="" className="w-9 h-9 object-cover rounded-lg shrink-0" loading="lazy" decoding="async" />
                ) : (
                  <span className="w-9 h-9 rounded-lg bg-foreground/[0.06] flex items-center justify-center shrink-0">
                    <Tag className="w-3.5 h-3.5 text-foreground/50" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-foreground truncate">{item.name}</span>
                  <span className="block text-[10px] font-bold text-foreground/45 tabular-nums">
                    {item.quantity} × {formatTZS(item.price)}
                  </span>
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-foreground/35" />
              </Link>
            ))}
          </div>
        </div>
      )}
      {/* Fallback: the order id is known but its items could not be resolved
          (permission boundary, or a legacy order without item rows) — still
          say WHICH order, without pretending there is somewhere to click. */}
      {orderId && !hasItems && (
        <div className={shell}>
          <span className="w-8 h-8 rounded-xl bg-foreground/[0.06] flex items-center justify-center shrink-0">
            <Package className="w-4 h-4 text-foreground/55" />
          </span>
          <span className="min-w-0">
            <SectionLabel>Order</SectionLabel>
            <span className="block text-xs font-black text-foreground truncate tabular-nums">
              #{orderId.slice(0, 8).toUpperCase()}
            </span>
          </span>
        </div>
      )}
      {/* A real <Link>, not a button that opened a modal. "Asking about this
          product" has to be able to take you BACK to the product — including
          via middle-click or copy-link, which a button can never offer. */}
      {product && (
        <Link to={`/product/${product.id}`} className={shell} aria-label={`View ${product.name}`}>
          {product.image ? (
            <img src={product.image} alt="" className="w-10 h-10 object-cover rounded-xl shrink-0" loading="lazy" decoding="async" />
          ) : (
            <span className="w-10 h-10 rounded-xl bg-foreground/[0.06] flex items-center justify-center shrink-0">
              <Tag className="w-4 h-4 text-foreground/55" />
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-xs font-black text-foreground truncate">{product.name}</span>
            {typeof product.price === 'number' && (
              <span className="block text-[10px] font-bold text-foreground/50 tabular-nums">
                {formatTZS(product.price)}
              </span>
            )}
          </span>
          <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-foreground/35" />
        </Link>
      )}
    </div>
  );
};

// ─── MessageBubble ───────────────────────────────────────────────────────────

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
  /** Awaiting server confirmation — dimmed, with a clock instead of a receipt. */
  pending?: boolean;
  /** The send failed; offer retry/discard instead of a timestamp. */
  failed?: boolean;
  /** Product/order tags, rendered above the bubble. */
  contextSlot?: React.ReactNode;
  onReply?: () => void;
  /** Hide from my side only. */
  onDelete?: () => void;
  /** Tombstone for both sides — sender only, inside the 1h window. */
  onDeleteForEveryone?: () => void;
  onReport?: () => void;
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

  // Long-press (touch) reveals the actions — on mobile there is no hover, so
  // "hold a message" is the only way to reach them.
  const startPress = () => {
    if (deleted || pending || failed) return;
    pressTimer.current = setTimeout(() => {
      setShowMenu(true);
      try { navigator.vibrate?.(15); } catch { /* not supported */ }
    }, 420);
  };
  const cancelPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };

  // Group identical emoji, remembering whether one is mine so the chip can read
  // as active — the reaction call used to be insert-only, so there was never
  // any "mine" state to show.
  const grouped = (reactions ?? []).reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    const entry = acc[r.emoji] ?? { count: 0, mine: false };
    entry.count += 1;
    if (myUserId && r.user_id === myUserId) entry.mine = true;
    acc[r.emoji] = entry;
    return acc;
  }, {});
  const hasReactions = Object.keys(grouped).length > 0;
  const actionable = !deleted && !pending && !failed;
  const hasActions = actionable && (onReply || onReact || onDelete || onDeleteForEveryone || onReport);

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group relative mb-1`}>
      {/* Tap-catcher to dismiss the long-press menu */}
      {(showMenu || showEmoji) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setShowMenu(false); setShowEmoji(false); }}
          aria-hidden="true"
        />
      )}

      {contextSlot}

      {replyToContent && (
        <div className={`mb-1 max-w-[85%] px-3 py-1.5 rounded-2xl text-xs leading-snug border-l-[3px] bg-foreground/[0.04] text-foreground/70
          ${isMine ? 'border-emerald-500/50 self-end' : 'border-foreground/25 self-start'}`}>
          <span className="truncate block font-medium">{replyToContent}</span>
        </div>
      )}

      <div className={`relative max-w-[85%] sm:max-w-[75%] ${pending ? 'opacity-60' : ''}`}>
        <div
          className={`px-4 py-2.5 text-sm leading-relaxed shadow-sm relative select-none
            ${failed
              ? 'bg-rose-500/10 text-foreground border border-rose-500/30 rounded-2xl rounded-br-md'
              : isMine
                // Emerald, not `bg-foreground text-background`: a fixed pair
                // that keeps its identity in both themes.
                ? 'bg-emerald-600 text-white rounded-2xl rounded-br-md'
                : 'bg-foreground/[0.04] text-foreground border border-foreground/[0.08] rounded-2xl rounded-bl-md'
            }`}
          onTouchStart={startPress}
          onTouchEnd={cancelPress}
          onTouchMove={cancelPress}
          onContextMenu={(e) => { if (hasActions) { e.preventDefault(); setShowMenu(true); } }}
        >
          {attachmentUrl && !deleted && (
            <div className="mb-2">
              {attachmentType === 'image' ? (
                <img
                  src={attachmentUrl}
                  alt="Attachment"
                  className="max-w-full h-auto rounded-2xl border border-black/10 max-h-72 object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <a
                  href={attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 p-2.5 rounded-2xl text-xs font-bold transition-colors
                    ${isMine && !failed ? 'bg-white/15 hover:bg-white/25' : 'bg-foreground/[0.05] hover:bg-foreground/[0.09]'}`}
                >
                  <Paperclip className="w-3.5 h-3.5 shrink-0" />
                  View attachment
                </a>
              )}
            </div>
          )}

          {deleted ? (
            <em className={`text-xs ${isMine ? 'text-white/60' : 'text-foreground/40'}`}>Message deleted</em>
          ) : (
            <span className="whitespace-pre-wrap break-words">{body}</span>
          )}

          {failed ? (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-rose-500/20">
              <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-rose-500 flex-1">Not sent</span>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1 text-[10px] font-black text-foreground/70 hover:text-foreground px-2 py-1 rounded-lg hover:bg-foreground/[0.06] transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Retry
                </button>
              )}
              {onDiscard && (
                <button
                  onClick={onDiscard}
                  className="text-[10px] font-black text-foreground/40 hover:text-rose-500 px-2 py-1 rounded-lg transition-colors"
                >
                  Discard
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className={`text-[10px] font-bold tabular-nums ${isMine ? 'text-white/60' : 'text-foreground/35'}`}>
                {pending ? 'Sending' : shortTime(createdAt)}
              </span>
              {pending && <Clock className="w-3 h-3 text-white/60" />}
              {isMine && !deleted && !pending && (
                read
                  ? <CheckCheck className="w-3.5 h-3.5 text-white/90" />
                  : <Check className="w-3.5 h-3.5 text-white/55" />
              )}
            </div>
          )}
        </div>

        {/* Actions. Anchored INSIDE the bubble's column — the previous version
            used right-full/left-full, which pushed them outside the scroll
            container and off-screen in a narrow pane. */}
        {hasActions && (
          <div
            className={`absolute -top-3 z-50 flex items-center transition-opacity
              ${showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}
              ${isMine ? 'right-2' : 'left-2'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-0.5 bg-background border border-foreground/[0.1] rounded-full shadow-lg px-1 py-0.5">
              {onReact && (
                <button
                  onClick={() => setShowEmoji(v => !v)}
                  title="React" aria-label="React"
                  className="p-1.5 rounded-full text-foreground/45 hover:bg-amber-500/10 hover:text-amber-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                >
                  <Smile className="w-3.5 h-3.5" />
                </button>
              )}
              {onReply && (
                <button
                  onClick={() => { onReply(); setShowMenu(false); }}
                  title="Reply" aria-label="Reply"
                  className="p-1.5 rounded-full text-foreground/45 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                >
                  <Reply className="w-3.5 h-3.5" />
                </button>
              )}
              {(onDeleteForEveryone || onDelete) && (
                <button
                  onClick={() => { (onDeleteForEveryone ?? onDelete)?.(); setShowMenu(false); }}
                  title={onDeleteForEveryone ? 'Delete for everyone' : 'Remove from my side'}
                  aria-label={onDeleteForEveryone ? 'Delete for everyone' : 'Remove from my side'}
                  className="p-1.5 rounded-full text-foreground/45 hover:bg-rose-500/10 hover:text-rose-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {!isMine && onReport && (
                <button
                  onClick={() => { onReport(); setShowMenu(false); }}
                  title="Report" aria-label="Report message"
                  className="p-1.5 rounded-full text-foreground/45 hover:bg-rose-500/10 hover:text-rose-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {showEmoji && (
          <div
            className={`absolute bottom-full mb-2 z-50 bg-background border border-foreground/[0.1] rounded-2xl p-1.5 flex gap-1 shadow-xl ${isMine ? 'right-0' : 'left-0'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => { onReact?.(emoji); setShowEmoji(false); setShowMenu(false); }}
                aria-label={`React ${emoji}`}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-base hover:bg-foreground/[0.06] hover:scale-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {hasReactions && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(grouped).map(([emoji, { count, mine }]) => (
              <button
                key={emoji}
                onClick={() => onReact?.(emoji)}
                aria-pressed={mine}
                title={mine ? 'Remove your reaction' : `React ${emoji}`}
                className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40
                  ${mine
                    ? 'bg-emerald-500/15 border-emerald-500/40'
                    : 'bg-foreground/[0.05] border-foreground/[0.08] hover:bg-foreground/[0.09]'
                  }`}
              >
                {emoji}
                <span className={`text-[10px] font-black tabular-nums ${mine ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/55'}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── New conversation ────────────────────────────────────────────────────────
// Contacts are only discoverable through search_messaging_contacts (profiles
// has no client-readable policy for other users' rows). Any authenticated user
// can message any other; this modal is what lets a seller reach another seller,
// or anyone reach a buyer, when no thread exists yet.

export const NewConversationModal = ({
  isOpen, onClose, onSelect, roleFilter, recentContacts = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (contact: { id: string; full_name: string | null; avatar_url: string | null; role: string }) => void;
  roleFilter?: PeerRole;
  recentContacts?: Array<{ id: string; full_name: string | null; avatar_url: string | null; role: string }>;
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; full_name: string | null; avatar_url: string | null; role: string }>>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) { setQuery(''); setResults([]); return; }
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

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
  }, [query, roleFilter, isOpen]);

  if (!isOpen) return null;

  const Row = ({ c }: { c: { id: string; full_name: string | null; avatar_url: string | null; role: string } }) => (
    <button
      onClick={() => { onSelect(c); onClose(); }}
      className="w-full flex items-center gap-3 px-4 py-3 min-h-[60px] hover:bg-foreground/[0.04] transition-colors text-left focus-visible:outline-none focus-visible:bg-foreground/[0.04]"
    >
      {c.avatar_url
        ? <img src={c.avatar_url} alt="" className="w-10 h-10 rounded-2xl object-cover shrink-0" loading="lazy" />
        : (
          <div className="w-10 h-10 rounded-2xl bg-foreground/[0.06] border border-foreground/[0.08] flex items-center justify-center shrink-0">
            <UserCircle2 className="w-5 h-5 text-foreground/40" />
          </div>
        )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground truncate">{c.full_name || 'User'}</p>
        <SectionLabel>{c.role}</SectionLabel>
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-20 sm:pt-24 px-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New message"
        className="w-full max-w-md bg-background rounded-3xl border border-foreground/[0.1] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-foreground/[0.08]">
          <Search className="w-4 h-4 text-foreground/35 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={roleFilter ? `Search ${roleFilter}s by name` : 'Search people by name'}
            aria-label="Search contacts"
            className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-foreground/35 outline-none"
          />
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 -mr-1 flex items-center justify-center rounded-2xl hover:bg-foreground/[0.06] text-foreground/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[22rem] overflow-y-auto no-scrollbar">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-foreground/40 text-xs font-bold">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching
            </div>
          )}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-center text-xs font-medium text-foreground/40 py-10">
              No one found matching "{query.trim()}"
            </p>
          )}
          {!loading && query.trim().length < 2 && (
            recentContacts.length > 0 ? (
              <>
                <div className="px-4 pt-4 pb-1"><SectionLabel>Recent</SectionLabel></div>
                {recentContacts.map(c => <Row key={c.id} c={c} />)}
                <p className="text-center text-[10px] font-bold text-foreground/30 py-3">
                  Or search everyone by name above
                </p>
              </>
            ) : (
              <p className="text-center text-xs font-medium text-foreground/35 py-10">
                Type at least 2 characters to search
              </p>
            )
          )}
          {!loading && results.map(c => <Row key={c.id} c={c} />)}
        </div>
      </div>
    </div>
  );
};
