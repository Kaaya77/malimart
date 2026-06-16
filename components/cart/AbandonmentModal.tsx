import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CartItem } from '../../types';

interface AbandonmentModalProps {
  open: boolean;
  cart: CartItem[];
  onClose: () => void;
  onCheckout: () => void;
}

export const AbandonmentModal: React.FC<AbandonmentModalProps> = ({ open, cart, onClose, onCheckout }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-sm bg-background rounded-3xl p-6 shadow-2xl"
        >
          <div className="text-3xl mb-3 text-center">🛍️</div>
          <h3 className="text-lg font-black text-foreground text-center mb-1">Your bag is waiting</h3>
          <p className="text-sm text-foreground/55 text-center mb-5">
            You have {cart.length} item{cart.length !== 1 ? 's' : ''} that would love to come home with you.
          </p>
          <div className="flex justify-center gap-2 mb-6">
            {cart.slice(0, 4).map(item => (
              <img
                key={item.id}
                src={item.images?.[0]}
                alt={item.name}
                className="w-14 h-14 rounded-xl object-cover bg-foreground/5"
              />
            ))}
          </div>
          <button
            onClick={onCheckout}
            className="w-full h-12 rounded-2xl bg-foreground text-background font-black text-sm uppercase tracking-widest mb-3 active:scale-[0.98] transition-transform"
          >
            Checkout now
          </button>
          <button
            onClick={onClose}
            className="w-full h-10 text-sm text-foreground/45 hover:text-foreground font-semibold transition-colors"
          >
            Leave anyway
          </button>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
