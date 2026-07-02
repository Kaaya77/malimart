-- refresh_seller_snapshot() reads COALESCE(NEW.seller_id, OLD.seller_id), which is valid
-- on order_items but not on orders (orders has NO seller_id column). The orders trigger
-- therefore made every order status update fail with:
--   record "new" has no field "seller_id"
-- blocking sellers from confirming orders. Seller snapshot invalidation for orders is
-- already handled by tg_orders_seller_snapshot (_tg_orders_mark_sellers_stale), which
-- correctly derives seller ids from order_items.
-- Applied to production 2026-07-02 via MCP (migration: drop_broken_orders_snapshot_trigger).
DROP TRIGGER IF EXISTS trg_refresh_seller_snapshot_orders ON public.orders;
