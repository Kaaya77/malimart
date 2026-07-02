import React, { useState, useMemo } from 'react';
import { useAppState } from '../context/AppContext';
import { Bell, CheckCheck, X, ShoppingBag, Store, AlertCircle, Info, Star, Gift, Package, MessageSquare, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { SwipeableRow } from '../components/SwipeableRow';
import { BackButton } from '../components/BackButton';
import { EmptyState } from '../components/UI';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40';

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  order:       { icon: ShoppingBag, color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  payment:     { icon: CreditCard,  color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  message:     { icon: MessageSquare, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  dispute:     { icon: AlertCircle, color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-900/20' },
  review:      { icon: Star,        color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
  promotion:   { icon: Gift,        color: 'text-pink-500',   bg: 'bg-pink-50 dark:bg-pink-900/20' },
  shipment:    { icon: Package,     color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  vendor:      { icon: Store,       color: 'text-teal-500',   bg: 'bg-teal-50 dark:bg-teal-900/20' },
  system:      { icon: Info,        color: 'text-foreground/40', bg: 'bg-foreground/[0.04]' },
};

const FILTERS = ['all', 'order', 'payment', 'message', 'dispute', 'promotion', 'system'] as const;

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const NotificationsPage = () => {
  const { notifications, markNotificationRead, markAllNotificationsRead, dismissNotification } = useAppState();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    return notifications.filter(n => (n.type || 'system') === filter);
  }, [notifications, filter]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleClick = (notif: any) => {
    markNotificationRead(notif.id);
    const link = notif.link || notif.payload?.action_link;
    if (link) navigate(link);
  };

  return (
    <div className="min-h-screen bg-background font-sans" style={{ paddingTop: 'max(72px, env(safe-area-inset-top) + 56px)' }}>
      <div className="max-w-2xl mx-auto px-4 pb-24 pt-6 md:pt-10">

        {/* Header */}
        <div className="mb-2 -ml-1">
          <BackButton label="Back" />
        </div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-foreground">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-[10px] font-black uppercase tracking-wider text-foreground/40 mt-0.5">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllNotificationsRead}
              className={`flex items-center gap-1.5 min-h-11 px-4 rounded-2xl border border-foreground/12 text-[10px] font-black uppercase tracking-widest text-foreground/50 hover:text-foreground hover:border-foreground/25 transition-all ${FOCUS_RING}`}
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark All Read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar mb-6">
          {FILTERS.map(f => {
            const count = f === 'all' ? notifications.length : notifications.filter(n => (n.type || 'system') === f).length;
            return (
              <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
                className={`flex items-center gap-1.5 px-4 min-h-11 rounded-2xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 transition-all ${FOCUS_RING} ${filter === f ? 'bg-foreground text-background' : 'bg-foreground/[0.05] text-foreground/50 hover:bg-foreground/[0.08] hover:text-foreground'}`}
              >
                {f}
                {count > 0 && (
                  <span className={`text-[10px] font-black px-1.5 rounded-full tabular-nums ${filter === f ? 'bg-background/20 text-background' : 'bg-foreground/10 text-foreground/50'}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
            <EmptyState
              icon={Bell}
              title={filter === 'all' ? "You're all caught up" : `No ${filter} notifications`}
              subtitle={filter === 'all' ? 'New order updates, messages and offers will appear here.' : 'Try another category or check back later.'}
              className="rounded-3xl border border-foreground/8 bg-foreground/[0.02]"
            />
          </motion.div>
        )}

        {/* Notification list */}
        <motion.div layout className="space-y-2">
          <AnimatePresence initial={false}>
            {filtered.map(notif => {
              const type = notif.type || 'system';
              const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.system;
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.25 }}
                  className="rounded-2xl overflow-hidden border border-foreground/6"
                >
                  <SwipeableRow onDelete={() => dismissNotification(notif.id)}>
                    <div
                      className={`relative flex gap-4 p-4 cursor-pointer group transition-colors ${
                        notif.read ? 'bg-background hover:bg-foreground/[0.02]' : 'bg-foreground/[0.02] hover:bg-foreground/[0.04]'
                      }`}
                      onClick={() => handleClick(notif)}
                    >
                      {/* Unread dot */}
                      {!notif.read && (
                        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-foreground" />
                      )}

                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-6">
                        {notif.title && (
                          <p className={`text-[12px] font-black leading-tight mb-0.5 ${notif.read ? 'text-foreground/60' : 'text-foreground'}`}>
                            {notif.title}
                          </p>
                        )}
                        <p className={`text-[11px] leading-relaxed font-medium ${notif.read ? 'text-foreground/40' : 'text-foreground/60'}`}>
                          {notif.message}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest">
                            {timeAgo(notif.created_at)}
                          </span>
                          {(notif.link || notif.payload?.action_link) && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40 hover:text-foreground transition-colors">
                              {notif.payload?.action_label || 'View →'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dismiss (desktop hover) */}
                      <button
                        onClick={e => { e.stopPropagation(); dismissNotification(notif.id); }}
                        className={`absolute top-2 right-2 w-8 h-8 hidden md:flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100 bg-foreground/[0.06] hover:bg-foreground/15 transition-all ${FOCUS_RING}`}
                        aria-label="Dismiss notification"
                      >
                        <X className="w-3 h-3 text-foreground/50" />
                      </button>
                    </div>
                  </SwipeableRow>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};
