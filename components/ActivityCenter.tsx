import React, { useState, useRef, useEffect } from 'react';
import { Bell, MessageSquare, Check, X, Loader2, RefreshCw } from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
};

export const ActivityCenter = () => {
    const { notifications, markNotificationRead, markAllNotificationsRead, user, unreadMessages, fetchMessages, refreshNotifications } = useAppState();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'notifications' | 'messages'>('notifications');
    const [messages, setMessages] = useState<any[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const unreadNotifCount = notifications.filter(n => !n.read).length;

    const loadMessages = async () => {
        setIsLoadingMessages(true);
        const msgs = await fetchMessages();
        setMessages(msgs);
        setIsLoadingMessages(false);
    };

    useEffect(() => {
        if (isOpen && activeTab === 'messages') {
            loadMessages();
        }
    }, [isOpen, activeTab]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    if (!user) return null;

    return (
        <div className="relative" ref={containerRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="relative p-3 rounded-2xl hover:bg-background text-foreground transition-all duration-300 group active:scale-95"
            >
                <div className="flex gap-2">
                    <Bell className={`w-4 h-4 transition-transform duration-500 group-hover:rotate-12 ${isOpen && activeTab === 'notifications' ? 'fill-current' : ''}`} />
                    <MessageSquare className={`w-4 h-4 transition-transform duration-500 group-hover:-rotate-12 ${isOpen && activeTab === 'messages' ? 'fill-current' : ''}`} />
                </div>
                {(unreadNotifCount > 0 || unreadMessages > 0) && (
                    <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-black animate-pulse shadow-lg shadow-red-500/50"></span>
                )}
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-4 w-[380px] md:w-[420px] bg-white/95 dark:bg-primary/95 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl border border-foreground/5 overflow-hidden z-50 animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-500">
                    
                    {/* Header */}
                    <div className="p-8 pb-6 border-b border-foreground/5">
                        <div className="flex justify-between items-center mb-8">
                            <div className="space-y-1">
                                <h3 className="text-xl font-sans font-extrabold text-foreground">Activity</h3>
                                <p className="text-[9px] uppercase tracking-[0.2em] font-black text-foreground/40">Real-time updates</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={activeTab === 'messages' ? loadMessages : refreshNotifications} className="p-2 rounded-xl bg-background dark:bg-white/5 hover:bg-primary/5 dark:hover:bg-white/10 transition-all active:rotate-180 duration-500">
                                    <RefreshCw className="w-3.5 h-3.5 text-foreground"/>
                                </button>
                                <button onClick={() => setIsOpen(false)} className="p-2 rounded-xl bg-background dark:bg-white/5 hover:bg-primary/5 dark:hover:bg-white/10 transition-all">
                                    <X className="w-3.5 h-3.5 text-foreground"/>
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-2 p-1 bg-background dark:bg-white/5 rounded-2xl">
                            <button 
                                onClick={() => setActiveTab('notifications')}
                                className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'notifications' ? 'bg-primary text-white dark:bg-white dark:text-black shadow-lg shadow-foreground/10 dark:shadow-white/10' : 'text-foreground/40 hover:text-foreground '}`}
                            >
                                Notifications ({unreadNotifCount})
                            </button>
                            <button 
                                onClick={() => setActiveTab('messages')}
                                className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'messages' ? 'bg-primary text-white dark:bg-white dark:text-black shadow-lg shadow-foreground/10 dark:shadow-white/10' : 'text-foreground/40 hover:text-foreground '}`}
                            >
                                Messages ({unreadMessages})
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="max-h-[450px] overflow-y-auto no-scrollbar py-4">
                        {activeTab === 'notifications' ? (
                            <>
                                {unreadNotifCount > 0 && (
                                    <button onClick={markAllNotificationsRead} className="w-full text-center py-4 text-[9px] font-black uppercase tracking-[0.3em] text-foreground/40 hover:text-foreground  transition-colors border-b border-foreground/5">
                                        Mark all as read
                                    </button>
                                )}
                                {notifications.length === 0 ? (
                                    <div className="py-20 text-center flex flex-col items-center justify-center space-y-4">
                                        <div className="w-16 h-16 rounded-full bg-background dark:bg-white/5 flex items-center justify-center">
                                            <Bell className="w-6 h-6 text-foreground/20/20" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground">All Caught Up</p>
                                    </div>
                                ) : (
                                    <div className="px-4 space-y-2">
                                        {notifications.map((notif) => (
                                            <div key={notif.id} className={`p-6 rounded-[1.5rem] transition-all duration-300 cursor-pointer ${!notif.read ? 'bg-background dark:bg-white/5' : 'hover:bg-background/50 dark:hover:bg-white/[0.02]'}`} onClick={() => { markNotificationRead(notif.id); setIsOpen(false); navigate(notif.link || '/notifications'); }}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className={`text-xs font-sans font-bold ${!notif.read ? 'text-foreground' : 'text-foreground/60/60'}`}>{notif.title}</h4>
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-foreground/30/30">{timeAgo(notif.created_at)}</span>
                                                </div>
                                                <p className="text-[11px] text-foreground/60/60 line-clamp-2 font-sans font-medium leading-relaxed">{notif.message}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            isLoadingMessages ? (
                                <div className="px-4 space-y-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="p-6 rounded-[1.5rem] bg-background/50 dark:bg-white/[0.02] animate-pulse">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="h-3 bg-primary/10 dark:bg-white/10 w-1/3 rounded"></div>
                                                <div className="h-2 bg-primary/10 dark:bg-white/10 w-1/6 rounded"></div>
                                            </div>
                                            <div className="h-2 bg-primary/10 dark:bg-white/10 w-3/4 rounded mt-2"></div>
                                            <div className="h-2 bg-primary/10 dark:bg-white/10 w-1/2 rounded mt-2"></div>
                                        </div>
                                    ))}
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="py-20 text-center flex flex-col items-center justify-center space-y-4">
                                    <div className="w-16 h-16 rounded-full bg-background dark:bg-white/5 flex items-center justify-center">
                                        <MessageSquare className="w-6 h-6 text-foreground/20/20" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground">No Messages</p>
                                </div>
                            ) : (
                                <div className="px-4 space-y-2">
                                    {messages.map((msg) => (
                                        <div key={msg.id} className="p-6 rounded-[1.5rem] bg-background/50 dark:bg-white/[0.02] hover:bg-background transition-all duration-300 cursor-pointer" onClick={() => { setIsOpen(false); navigate('/messages'); }}>
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="text-xs font-sans font-bold text-foreground truncate">Message from {msg.sender_name || 'User'}</h4>
                                                <span className="text-[8px] font-black uppercase tracking-widest text-foreground/30/30">{timeAgo(msg.created_at)}</span>
                                            </div>
                                            <p className="text-[11px] text-foreground/60/60 line-clamp-2 font-sans font-medium leading-relaxed">{msg.text || msg.body}</p>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </div>
                    
                    {/* Footer */}
                    <div className="p-6 bg-background/50 dark:bg-white/[0.02] border-t border-foreground/5 text-center">
                        <button 
                            className="text-[9px] font-black uppercase tracking-[0.3em] text-foreground/40 hover:text-foreground  transition-colors" 
                            onClick={() => { setIsOpen(false); navigate(activeTab === 'notifications' ? '/notifications' : '/messages'); }}
                        >
                            View All Activity
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
