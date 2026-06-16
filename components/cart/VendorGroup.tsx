import React from 'react';
import { motion } from 'framer-motion';
import { Store, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../UI';
import { CartItemRow } from './CartItemRow';
import { CartItem, Offer } from '../../types';
import { formatTZS } from '../../constants';

interface VendorInfo {
  name: string;
  fee: number;
  verified: boolean;
}

interface VendorGroupProps {
  sellerId: string;
  items: CartItem[];
  vendor: VendorInfo | undefined;
  vendorIndex: number;
  calculateItemPrice: (item: CartItem) => { price: number; originalPrice: number | null; offer: Offer | null };
  onUpdateQuantity: (id: string, delta: number, variantId?: string) => void;
  onRemove: (item: CartItem, variantId?: string) => void;
  onSaveForLater: (item: CartItem, variantId?: string) => void;
  onNavigate: (path: string) => void;
}

const groupVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

export const VendorGroup: React.FC<VendorGroupProps> = ({
  sellerId, items, vendor, vendorIndex,
  calculateItemPrice, onUpdateQuantity, onRemove, onSaveForLater, onNavigate,
}) => (
  <motion.div
    key={sellerId}
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-50px' }}
    transition={{ duration: 0.6, delay: vendorIndex * 0.1, ease: [0.22, 1, 0.36, 1] }}
    className="space-y-4"
  >
    <div className="flex items-center justify-between px-2">
      <Link
        to={`/store/${sellerId}`}
        className="flex items-center gap-2 text-foreground uppercase tracking-widest text-xs font-black hover:opacity-70 transition-colors"
      >
        <Store className="w-4 h-4 text-brand-500" />
        <span>{vendor?.name || 'Loading Store...'}</span>
        {vendor?.verified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />}
      </Link>
      <Badge variant="outline" className="text-[9px] font-bold border-brand-200 text-brand-700 bg-brand-50 dark:bg-brand-900/10 dark:border-brand-900/50">
        Delivery: {formatTZS(vendor?.fee || 0)}
      </Badge>
    </div>

    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={groupVariants}
      className="bg-background rounded-3xl border border-foreground/8 overflow-hidden shadow-sm divide-y divide-foreground/5"
    >
      {items.map((item, index) => {
        const { price, originalPrice, offer } = calculateItemPrice(item);
        return (
          <CartItemRow
            key={item.selectedVariant?.id ? `${item.id}-${item.selectedVariant.id}` : `${item.id}-${index}`}
            item={item}
            index={index}
            price={price}
            originalPrice={originalPrice}
            offer={offer}
            onUpdateQuantity={onUpdateQuantity}
            onRemove={onRemove}
            onSaveForLater={onSaveForLater}
            onNavigate={onNavigate}
          />
        );
      })}
    </motion.div>
  </motion.div>
);
