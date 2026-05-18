import React from 'react';
import { motion } from 'framer-motion';

interface QuickCategoriesProps {
  categories: { name: string; icon: string; link: string }[];
  navigate: (path: string) => void;
}

export const QuickCategories = ({ categories, navigate }: QuickCategoriesProps) => {
  return (
    <motion.section 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="py-8"
    >
        <div className="container mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
                {categories.map((cat, idx) => (
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        key={idx}
                        onClick={() => navigate(cat.link)}
                        className="flex flex-col items-center justify-center p-4 md:p-6 rounded-3xl bg-primary/10 hover:bg-primary/20 transition-colors border-none group"
                    >
                        <span className="text-3xl md:text-4xl mb-2 md:mb-3 transform group-hover:-translate-y-1 transition-transform">{cat.icon}</span>
                        <span className="text-xs md:text-sm font-bold text-foreground text-center leading-tight">{cat.name}</span>
                    </motion.button>
                ))}
            </div>
        </div>
    </motion.section>
  );
};
