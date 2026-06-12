import React from 'react';
import { BadgeCheck, Pin, MessageSquare } from 'lucide-react';

/* ─── Shared messaging primitives ────────────────────────────────────────────
   One visual language for buyer, seller, and admin inboxes.               */

export const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

export const formatDateLabel = (date: Date) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
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

export const DayDivider = ({ date }: { date: Date }) => (
  <div className="flex items-center gap-3 my-4" role="separator">
    <div className="flex-1 h-px bg-foreground/8" />
    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/35">{formatDateLabel(date)}</span>
    <div className="flex-1 h-px bg-foreground/8" />
  </div>
);

export interface ConversationItem {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isVerified?: boolean;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  subtitle?: string;
}

export const ConversationListItem = ({
  item, selected, pinned, onSelect, onTogglePin,
}: {
  item: ConversationItem;
  selected: boolean;
  pinned: boolean;
  onSelect: () => void;
  onTogglePin?: (e: React.MouseEvent) => void;
}) => (
  <button
    onClick={onSelect}
    aria-current={selected ? 'true' : undefined}
    className={`w-full text-left p-3.5 rounded-2xl transition-all group relative ${
      selected ? 'bg-foreground text-background' : 'hover:bg-foreground/[0.04] text-foreground'
    }`}
  >
    <div className="flex items-center gap-3">
      <div className="relative shrink-0">
        <div className="w-11 h-11 rounded-full bg-foreground/[0.08] overflow-hidden">
          <img
            src={item.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}`}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
        {(item.unreadCount || 0) > 0 && !selected && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-background">
            {item.unreadCount! > 9 ? '9+' : item.unreadCount}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`font-bold text-[13px] truncate ${selected ? 'text-background' : 'text-foreground'}`}>{item.name}</p>
          {item.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
          {pinned && <Pin className="w-3 h-3 text-emerald-500 shrink-0" />}
          {item.lastMessageAt && (
            <span className={`ml-auto text-[10px] shrink-0 ${selected ? 'text-background/55' : 'text-foreground/35'}`}>
              {relativeTime(item.lastMessageAt)}
            </span>
          )}
        </div>
        <p className={`text-[11px] truncate mt-0.5 ${
          selected ? 'text-background/60'
          : (item.unreadCount || 0) > 0 ? 'text-foreground/80 font-semibold' : 'text-foreground/45'
        }`}>
          {item.lastMessage || item.subtitle || 'Start the conversation'}
        </p>
      </div>
    </div>
    {onTogglePin && (
      <span
        onClick={onTogglePin}
        role="button"
        aria-label={pinned ? 'Unpin conversation' : 'Pin conversation'}
        className={`absolute right-2 top-2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
          selected ? 'bg-background/15 text-background/70 hover:bg-background/25' : 'bg-foreground/8 text-foreground/50 hover:bg-foreground/15'
        }`}
      >
        <Pin className="w-3 h-3" />
      </span>
    )}
  </button>
);

export const ChatEmptyState = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-foreground/40 px-6 text-center">
    <div className="w-16 h-16 rounded-full bg-foreground/[0.05] flex items-center justify-center mb-4">
      <MessageSquare className="w-7 h-7 opacity-30" />
    </div>
    <p className="text-sm font-bold text-foreground/70">{title}</p>
    {hint && <p className="text-xs text-foreground/40 mt-1 max-w-[240px]">{hint}</p>}
  </div>
);
