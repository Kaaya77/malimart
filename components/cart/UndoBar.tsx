import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CartItem } from '../../types';

interface UndoBarProps {
  lastRemoved: CartItem | null;
  onUndo: () => void;
}

export const UndoBar: React.FC<UndoBarProps> = ({ lastRemoved, onUndo }) => (
  <AnimatePresence>
    {lastRemoved && (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 bg-foreground text-background px-5 py-3 rounded-2xl shadow-2xl"
      >
        <span className="text-sm font-medium whitespace-nowrap">Removed from bag</span>
        <button
          onClick={onUndo}
          className="text-emerald-400 font-black text-sm uppercase tracking-widest hover:text-emerald-300 transition-colors"
        >
          Undo
        </button>
      </motion.div>
    )}
  </AnimatePresence>
);
