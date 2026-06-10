import { CartItem } from '../../types';

export const getEffectiveUnitPrice = (item: CartItem): number => {
  if (typeof item.price_at_add === 'number' && item.price_at_add > 0) return item.price_at_add;
  if (item.selectedVariant) return item.selectedVariant.sale_price ?? item.selectedVariant.base_price ?? 0;
  return item.price ?? 0;
};
