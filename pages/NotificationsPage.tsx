import React from 'react';
import { useAppState } from '../context/AppContext';
import { Bell, CheckCheck, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../components/UI';

export const NotificationsPage = () => {
  const { notifications, markNotificationRead, markAllNotificationsRead, dismissNotification } = useAppState();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black pt-24 md:pt-28 font-sans pb-24">
      <div className="container mx-auto max-w-3xl px-4">
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col md:flex-row md:items-center md:justify-between mb-12"
        >
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter font-display text-slate-900 dark:text-white uppercase leading-none">
            Notifications
          </h1>
          {notifications.length > 0 && (
            <div className="mt-4 md:mt-0 flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => markAllNotificationsRead()} className="text-xs font-bold uppercase tracking-widest">
                <CheckCheck className="w-4 h-4 mr-2" />
                Mark All as Read
              </Button>
            </div>
          )}
        </motion.div>

        {notifications.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center py-32 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[3rem] flex flex-col items-center justify-center"
          >
            <Bell className="w-16 h-16 text-slate-200 mb-6" />
            <h3 className="text-xl font-black uppercase mb-2">No new notifications</h3>
            <p className="text-slate-400 text-sm">You're all caught up!</p>
          </motion.div>
        ) : (
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={{
                hidden: { opacity: 0 },
                visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.1 }
                }
            }}
            className="space-y-4"
          >
            {notifications.map(notification => (
              <motion.div 
                key={notification.id} 
                variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
                }}
                className={`p-6 rounded-3xl flex items-start gap-6 transition-all duration-300 ${notification.read ? 'bg-white dark:bg-slate-900/50 opacity-60' : 'bg-white dark:bg-slate-900 shadow-lg'}`}
              >
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-800 dark:text-white mb-1 pr-4">{notification.title || 'Notification'}</h4>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                      {new Date(notification.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{notification.message}</p>
                  <div className="flex items-center gap-2">
                    {!notification.read && (
                      <Button size="sm" variant="secondary" onClick={() => markNotificationRead(notification.id)} className="text-xs">
                        Mark as Read
                      </Button>
                    )}
                    {notification.link && (
                      <Button asChild size="sm" variant="outline" className="text-xs"><a href={notification.link}><span>View Details</span></a></Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => dismissNotification(notification.id)} className="ml-auto text-slate-400 hover:text-red-500 w-8 h-8">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};
