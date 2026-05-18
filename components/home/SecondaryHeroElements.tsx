import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Users } from 'lucide-react';

interface SecondaryHeroElementsProps {
  tickerIndex: number;
  tickerItems: string[];
  trendingCategories: { name: string; icon: string; count?: number }[];
  userCount: number;
  recentUserAvatars: string[];
  weeklyOrderCount: number;
  user: any;
  navigate: (path: string) => void;
  containerVariants: any;
}

export const SecondaryHeroElements = ({
  tickerIndex,
  tickerItems,
  trendingCategories,
  userCount,
  recentUserAvatars,
  weeklyOrderCount,
  user,
  navigate,
  containerVariants
}: SecondaryHeroElementsProps) => {
  return (
    <motion.section 
        className="py-12 bg-background border-b border-foreground/10"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
    >
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-center gap-8">
            {/* Live Activity Ticker */}
            <div className="flex items-center gap-2">
                <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                </span>
                <div className="h-4 overflow-hidden relative w-48">
                    <AnimatePresence mode="wait">
                        <motion.p
                            key={tickerIndex}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.5 }}
                            className="text-[9px] font-semibold uppercase tracking-widest text-foreground/50 absolute inset-0 truncate"
                        >
                            {tickerItems[tickerIndex]}
                        </motion.p>
                    </AnimatePresence>
                </div>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2">
                {trendingCategories.map(tag => (
                    <button 
                        key={tag.name}
                        onClick={() => navigate(`/shop?category=${tag.name}`)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary/5 border border-foreground/10 text-foreground transition-colors shadow-sm hover:shadow-md"
                    >
                        <span className="w-3 h-3 flex items-center justify-center opacity-70 text-[10px]">{tag.icon}</span>
                        <span>{tag.name}</span>
                    </button>
                ))}
            </div>

            {/* Trust Badge / Social Proof */}
            {userCount > 0 && (
                <div className="flex items-center gap-3 pl-6 border-l border-foreground/10">
                    <div className="flex -space-x-2">
                        {recentUserAvatars.length > 0 ? (
                            recentUserAvatars.map((avatar, i) => (
                                <img key={i} className="w-8 h-8 rounded-full border-2 border-background object-cover" src={avatar} alt="User" referrerPolicy="no-referrer" />
                            ))
                        ) : (
                            <div className="w-8 h-8 rounded-full border-2 border-background bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <Users className="w-3 h-3 text-amber-600" />
                            </div>
                        )}
                        <div className="w-8 h-8 rounded-full border-2 border-background bg-primary text-primary-foreground flex items-center justify-center text-[8px] font-bold">
                            {userCount > 1000 ? `+${(userCount / 1000).toFixed(1)}k` : `+${userCount}`}
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1 text-yellow-500">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} className="w-3 h-3 fill-current" />
                            ))}
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/60">
                            {weeklyOrderCount > 0 ? `${weeklyOrderCount}+ orders this week` : (user?.region ? `Verified in ${user.region}` : 'Verified Community')}
                        </span>
                    </div>
                </div>
            )}
        </div>
    </motion.section>
  );
};
