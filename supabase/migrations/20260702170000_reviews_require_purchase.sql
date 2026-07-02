-- Reviews must come from verified purchases.
--
-- The live reviews_insert policy only checked user_id = auth.uid() — any
-- authenticated user could review any product without ever buying it.
-- (The repo's rls_policies.sql version *tried* to verify purchase but had a
-- scoping bug: `oi.product_id = product_id` binds both sides to order_items
-- in the subquery scope, i.e. always true.)
--
-- New rule: you can only review a product from an order of yours that was
-- DELIVERED. Rating bounds and comment length guards included.
DROP POLICY IF EXISTS "reviews_insert" ON public.reviews;
CREATE POLICY "reviews_insert" ON public.reviews
  FOR INSERT WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE oi.product_id = reviews.product_id   -- qualified: the NEW review's product
        AND o.user_id = (SELECT auth.uid())
        AND o.status = 'delivered'
    )
    AND rating >= 1 AND rating <= 5
    AND length(COALESCE(comment, '')) <= 2000
  );
