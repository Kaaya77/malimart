import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Search, ChevronRight } from 'lucide-react';

interface HeroSectionProps {
  heroRecommendation: any;
  heroSettings: { badgeText: string; headline: string; subheadline: string };
  greeting: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleSearch: (e: React.FormEvent) => void;
  searchPlaceholders: string[];
  currentPlaceholderIdx: number;
  containerVariants: any;
  itemVariants: any;
}

export const HeroSection = ({
  heroRecommendation,
  heroSettings,
  greeting,
  searchQuery,
  setSearchQuery,
  handleSearch,
  searchPlaceholders,
  currentPlaceholderIdx,
  containerVariants,
  itemVariants
}: HeroSectionProps) => {
  return (
    <motion.section 
        className="relative min-h-[85vh] flex items-center justify-center px-4 sm:px-6 bg-background pt-24 overflow-hidden"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
    >
        {/* Dynamic Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/20 blur-[120px] rounded-full pointer-events-none -z-10" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[300px] bg-yellow-500/10 blur-[100px] rounded-full pointer-events-none -z-10" />

        <div className="container mx-auto max-w-5xl text-center z-10">
            <motion.div variants={itemVariants} className="mb-8 flex justify-center">
                <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/60 dark:bg-black/60 shadow-lg border border-white/20 dark:border-white/5 backdrop-blur-xl group hover:scale-105 transition-transform duration-300 cursor-pointer">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary">
                        <Sparkles className="w-4 h-4" /> 
                    </span>
                    <span className="text-foreground text-[11px] sm:text-xs font-bold uppercase tracking-widest">
                        {heroRecommendation ? (() => {
                            try {
                                const offer = JSON.parse(heroRecommendation.offer_text);
                                return offer.text;
                            } catch (e) {
                                return heroRecommendation.offer_text;
                            }
                        })() : heroSettings.badgeText}
                    </span>
                    <ChevronRight className="w-4 h-4 text-foreground/40 group-hover:text-primary transition-colors" />
                </div>
            </motion.div>
            
            <motion.h1 variants={itemVariants} className="text-5xl sm:text-7xl md:text-8xl font-sans font-black tracking-tighter mb-6 text-foreground leading-[1.05]">
                {greeting && (
                    <span className="block text-2xl sm:text-3xl font-bold text-primary mb-4 tracking-tight">
                        {greeting}
                    </span>
                )}
                <span className="relative">
                    {heroRecommendation ? heroRecommendation.title : "Get it delivered."}
                    <motion.span 
                        className="absolute -bottom-2 left-0 right-0 h-3 sm:h-5 bg-primary/20 -z-10 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ delay: 0.8, duration: 1, ease: 'easeOut' }}
                    />
                </span>
                <br />
                <span className="text-foreground/70">Right now.</span>
            </motion.h1>
            
            <motion.p variants={itemVariants} className="text-lg md:text-2xl text-foreground/60 mb-12 font-medium max-w-2xl mx-auto tracking-tight">
                {heroRecommendation ? heroRecommendation.description : "Groceries, food, pharmacy, and more. Delivered in minutes to your door."}
            </motion.p>
            
            <motion.form variants={itemVariants} onSubmit={handleSearch} className="w-full max-w-2xl mx-auto relative flex items-center group shadow-2xl rounded-full bg-white dark:bg-zinc-900 border-4 border-transparent focus-within:border-primary/20 transition-all duration-300 hover:shadow-primary/10">
                <Search className="absolute left-6 sm:left-8 w-6 h-6 text-foreground/40 z-20 stroke-[2.5]" />
                <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-16 sm:h-20 pl-16 sm:pl-20 pr-36 sm:pr-48 bg-transparent focus:outline-none text-foreground text-lg sm:text-2xl font-bold relative z-10 placeholder:text-foreground/30 placeholder:font-medium transition-all"
                    placeholder={searchPlaceholders[currentPlaceholderIdx]}
                />
                <button type="submit" className="absolute right-2 sm:right-3 h-[calc(100%-16px)] sm:h-[calc(100%-24px)] px-6 sm:px-10 rounded-full bg-primary text-primary-foreground text-sm sm:text-base font-extrabold hover:scale-105 active:scale-95 transition-transform duration-300 z-20 shadow-lg shadow-primary/30">
                    Search
                </button>
            </motion.form>
        </div>
    </motion.section>
  );
};
