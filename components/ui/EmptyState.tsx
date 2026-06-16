import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Package, Search, Heart, MessageSquare, BoxSelect } from 'lucide-react';

const PRESET_ICONS: Record<string, React.ElementType> = {
  cart:     ShoppingCart,
  orders:   Package,
  search:   Search,
  wishlist: Heart,
  messages: MessageSquare,
  products: BoxSelect,
};

interface EmptyStateProps {
  icon?: React.ElementType | keyof typeof PRESET_ICONS;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export const EmptyState = ({ icon, title, description, action, className = '' }: EmptyStateProps) => {
  const Icon = typeof icon === 'string' ? PRESET_ICONS[icon] ?? BoxSelect : (icon ?? BoxSelect);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center gap-4 py-16 text-center ${className}`}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-foreground/[0.05]">
        <Icon className="w-9 h-9 text-foreground/30 stroke-[1.5]" />
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-black text-foreground/70">{title}</p>
        {description && <p className="text-sm font-medium text-foreground/45 max-w-xs">{description}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 h-11 px-6 rounded-2xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
};
