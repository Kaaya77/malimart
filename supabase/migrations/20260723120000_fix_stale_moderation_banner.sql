-- 20260723120000_fix_stale_moderation_banner.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Bug: get_my_product_moderation() (20260702160000) returns a product
-- forever once it has ANY product_appeals row — the EXISTS check had no
-- status filter. InventoryRow.tsx renders its suspension/appeal banner on
-- `product.status === 'suspended' || moderation?.appeal`, so a seller whose
-- appeal was approved (or rejected) months ago still sees a permanent
-- "Suspended" / appeal banner on an otherwise active listing — reported as
-- "product was unbanned but still shows banned".
--
-- Fix: only surface a product here while it is still actionable — currently
-- suspended, or has a pending appeal. Once the product is active again and
-- its appeal is resolved, stop returning it.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_my_product_moderation()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(entry), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'product_id',      p.id,
      'product_status',  p.status,
      'takedown_reason', p.takedown_reason,
      'appeal', (
        SELECT jsonb_build_object(
          'id',             a.id,
          'status',         a.status,
          'reason',         a.reason,
          'admin_response', a.admin_response,
          'created_at',     a.created_at,
          'resolved_at',    a.resolved_at
        )
        FROM product_appeals a
        WHERE a.product_id = p.id AND a.seller_id = auth.uid()
        ORDER BY a.created_at DESC
        LIMIT 1
      )
    ) AS entry
    FROM products p
    WHERE p.seller_id = auth.uid()
      AND (
        p.status = 'suspended'
        OR EXISTS (
          SELECT 1 FROM product_appeals a
          WHERE a.product_id = p.id AND a.status = 'pending'
        )
      )
  ) sub;
$$;

REVOKE ALL ON FUNCTION public.get_my_product_moderation() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_product_moderation() TO authenticated;
