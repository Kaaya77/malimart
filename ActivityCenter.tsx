import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, MessageSquare, Check, X, Loader2, RefreshCw, BellOff, ArrowRight, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';

const timeAgo = (dateStr: string) => {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const NOTIF_ICON: Record<string, string> = {
  order: '📦', payment: '💳', return: '↩️', shipment: '🚚',
  message: '💬', system: '⚙️', verification: '✅', promo: '🎉',
};

export const ActivityCenter = () => {
  const {
    notifications, markNotificationRead, markAllNotificationsRead,
    user, unreadMessages, fetchMessages, refreshNotifications
  } = useAppState();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'notifications' | 'messages'>('notifications');
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 });

  const unreadNotifs = notifications.filter(n => !n.read).length;
  const totalUnread = unreadNotifs + unreadMessages;

  const loadMessages = useCallback(async () => {
    setLoadingMsgs(true);
    const msgs = await fetchMessages();
    setMessages(msgs || []);
    setLoadingMsgs(false);
  }, [fetchMessages]);

  useEffect(() => {
    if (open && tab === 'messages') loadMessages();
  }, [open, tab]);

  useEffect(() => {
    if (!open) return;
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPanelPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    const close = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const handleNotifClick = (n: any) => {
    markNotificationRead(n.id);
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  if (!user) return null;

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div ref={panelRef}
          initial={{ opacity: 0, scale: 0.96, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -8 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="fixed z-[250] w-[360px] md:w-[400px] bg-background border border-foreground/10 rounded-3xl shadow-2xl overflow-hidden"
          style={{ top: panelPos.top, right: panelPos.right }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/8">
            <div>
              <h3 className="font-bold text-foreground text-sm">Activity</h3>
              {totalUnread > 0 && (
                <p className="text-[10px] text-foreground/40 mt-0.5">{totalUnread} unread update{totalUnread !== 1 ? 's' : ''}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => tab === 'messages' ? loadMessages() : refreshNotifications()}
                className="w-8 h-8 rounded-xl bg-foreground/[0.05] flex items-center justify-center text-foreground/50 hover:bg-foreground/10 hover:text-foreground transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5"/>
              </button>
              {tab === 'notifications' && unreadNotifs > 0 && (
                <button
                  onClick={() => markAllNotificationsRead()}
                  className="w-8 h-8 rounded-xl bg-foreground/[0.05] flex items-center justify-center text-foreground/50 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
                  title="Mark all read"
                >
                  <Check className="w-3.5 h-3.5"/>
                </button>
              )}
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-xl bg-foreground/[0.05] flex items-center justify-center text-foreground/50 hover:bg-foreground/10 transition-colors">
                <X className="w-3.5 h-3.5"/>
              </button>
            </div>
          </div>

          {/* Tab strip */}
          <div className="flex p-1.5 gap-1 bg-foreground/[0.03] border-b border-foreground/8">
            {(['notifications', 'messages'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${tab === t ? 'bg-background text-foreground shadow-sm' : 'text-foreground/40 hover:text-foreground/65'}`}>
                {t === 'notifications' ? <Bell className="w-3.5 h-3.5"/> : <MessageSquare className="w-3.5 h-3.5"/>}
                {t === 'notifications' ? `Alerts ${unreadNotifs > 0 ? `(${unreadNotifs})` : ''}` : `Messages ${unreadMessages > 0 ? `(${unreadMessages})` : ''}`}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[400px] no-scrollbar">
            {tab === 'notifications' ? (
              notifications.length === 0 ? (
                <div className="flex flex-col items-center py-14 text-foreground/25">
                  <BellOff className="w-10 h-10 mb-3 opacity-30"/>
                  <p className="text-xs font-semibold">All caught up</p>
                  <p className="text-[10px] mt-1">No new notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-foreground/5">
                  {notifications.slice(0, 20).map(n => (
                    <button key={n.id} onClick={() => handleNotifClick(n)}
                      className={`w-full text-left px-5 py-3.5 flex gap-3 items-start hover:bg-foreground/[0.03] transition-colors ${!n.read ? 'bg-foreground/[0.02]' : ''}`}>
                      <div className="relative shrink-0 mt-0.5">
                        <div className="w-9 h-9 rounded-xl bg-foreground/[0.06] flex items-center justify-center text-base">
                          {NOTIF_ICON[n.type] || '🔔'}
                        </div>
                        {!n.read && (
                          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-background"/>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] leading-snug ${!n.read ? 'font-semibold text-foreground' : 'font-medium text-foreground/70'}`}>
                          {n.title}
                        </p>
                        {n.message && (
                          <p className="text-[11px] text-foreground/45 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                        )}
                        <p className="text-[10px] text-foreground/30 mt-1 font-medium">{timeAgo(n.created_at)}</p>
                      </div>
                      {n.link && <ArrowRight className="w-3.5 h-3.5 text-foreground/25 shrink-0 mt-1"/>}
                    </button>
                  ))}
                </div>
              )
            ) : (
              loadingMsgs ? (
                <div className="flex items-center justify-center py-14">
                  <Loader2 className="w-6 h-6 animate-spin text-foreground/30"/>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center py-14 text-foreground/25">
                  <MessageSquare className="w-10 h-10 mb-3 opacity-30"/>
                  <p className="text-xs font-semibold">No messages yet</p>
                  <p className="text-[10px] mt-1">Messages from sellers will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-foreground/5">
                  {messages.slice(0, 15).map((m, i) => (
                    <button key={m.id || i}
                      onClick={() => { navigate('/buyer?tab=inbox'); setOpen(false); }}
                      className="w-full text-left px-5 py-3.5 flex gap-3 items-center hover:bg-foreground/[0.03] transition-colors">
                      <div className="w-9 h-9 rounded-xl overflow-hidden bg-foreground/[0.06] shrink-0">
                        {m.sender_avatar ? (
                          <img src={m.sender_avatar} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async"/>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm font-bold text-foreground/40">
                            {(m.sender_name || '?')[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{m.sender_name || 'Seller'}</p>
                        <p className="text-[11px] text-foreground/45 truncate mt-0.5">{m.content || m.message || 'New message'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-foreground/30">{timeAgo(m.created_at)}</p>
                        {m.is_unread && <div className="w-2 h-2 rounded-full bg-rose-500 ml-auto mt-1"/>}
                      </div>
                    </button>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-foreground/8">
            <button
              onClick={() => { navigate(tab === 'notifications' ? '/notifications' : '/messages'); setOpen(false); }}
              className="w-full h-9 rounded-xl bg-foreground/[0.05] text-foreground/60 text-[11px] font-semibold hover:bg-foreground/[0.08] hover:text-foreground transition-colors flex items-center justify-center gap-1.5">
              View all {tab} <ArrowRight className="w-3.5 h-3.5"/>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className="relative p-2.5 rounded-2xl bg-foreground/[0.05] hover:bg-foreground/[0.09] text-foreground/70 hover:text-foreground transition-all active:scale-90"
      >
        <div className="flex gap-1.5">
          <Bell className={`w-4 h-4 stroke-[2] ${open && tab === 'notifications' ? 'fill-current' : ''}`}/>
          <MessageSquare className={`w-4 h-4 stroke-[2] ${open && tab === 'messages' ? 'fill-current' : ''}`}/>
        </div>
        {totalUnread > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-background animate-pulse"/>
        )}
      </button>
      {createPortal(panel, document.body)}
    </>
  );
};
