import { useMemo } from 'react';
import { useCatalog } from '../context/AppContext';
import { CATEGORY_HIERARCHY } from '../constants';

/**
 * The one category list every seller-facing form/filter should offer.
 *
 * Three of four seller entry points (ProductForm, QuickProductForm,
 * SellerInventory's filter) used to build their category `<select>` straight
 * from the hardcoded CATEGORY_HIERARCHY in constants.ts, while the
 * homepage/Shop pages filter by the LIVE `categories` table. A seller could
 * pick a category name that no storefront filter would ever match, or an
 * inventory filter could omit a category the storefront actually uses. Only
 * the product-form's DetailsStep read the live table; this hook is that same
 * logic, shared, so every seller-facing category list agrees with what
 * buyers actually filter by.
 */
export function useCategoryOptions(): string[] {
  const { categories } = useCatalog();
  return useMemo(() => {
    const db = (categories || [])
      .filter((c: any) => !c.parent_id && c.is_active !== false)
      .map((c: any) => c.name);
    return db.length >= 2 ? db : Object.keys(CATEGORY_HIERARCHY);
  }, [categories]);
}
