import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

/**
 * useCartTotals — authoritative order figures from the server.
 *
 * Calls the same `compute_cart_totals` function that `place_order_atomic` uses,
 * so the previewed total can never disagree with what's actually charged:
 * VAT-exclusive pricing, per-product vat_rate, VAT only for VAT-registered
 * sellers (vrn), delivery untaxed, discount off the taxable base, rounded TZS.
 */

export interface CartLine {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  vat_amount: number;
  delivery_fee: number;
  total: number;
}

interface Args {
  items: CartLine[];
  deliveryFee?: number;
  discount?: number;
}

const ZERO: CartTotals = { subtotal: 0, discount: 0, vat_amount: 0, delivery_fee: 0, total: 0 };

export function useCartTotals({ items, deliveryFee = 0, discount = 0 }: Args): { totals: CartTotals; loading: boolean } {
  const [totals, setTotals] = useState<CartTotals>(ZERO);
  const [loading, setLoading] = useState(false);

  // Only refetch when something that affects the price actually changes.
  const signature = JSON.stringify({ items, deliveryFee, discount });

  useEffect(() => {
    let cancelled = false;

    if (!items || items.length === 0) {
      setTotals({ ...ZERO, delivery_fee: deliveryFee, total: deliveryFee });
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .rpc('compute_cart_totals', { p_items: items, p_delivery_fee: deliveryFee, p_discount: discount })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setTotals(data as CartTotals);
        setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return { totals, loading };
}
