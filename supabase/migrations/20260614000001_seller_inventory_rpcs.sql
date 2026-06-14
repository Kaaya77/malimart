-- 20260614000001_seller_inventory_rpcs.sql
-- Creates all 7 inventory RPCs the SellerInventory component calls.
-- Without these, the inventory page fails to load entirely and every
-- action (stock adjust, status toggle, boost, duplicate, archive,
-- reorder) shows an error for all sellers.
--
-- Also adds missing columns to products table that the inventory
-- component reads (is_boosted, sku, cost_price, sale_price,
-- sort_order, low_stock_threshold).
-- All idempotent: CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS.

-- ─── 0. Product table: ensure all columns exist ─────────────────────────────
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku                 TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_price          NUMERIC CHECK (sale_price >= 0);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price          NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_boosted          BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sort_order          INTEGER NOT NULL DEFAULT 0;

-- ─── 1. get_seller_inventory ────────────────────────────────────────────────
-- Returns { products[], pagination: { matched }, totals: { … } }
-- Supports: pagination, search (name/SKU), status filter, low-stock filter, sort.
-- Attaches last 5 inventory_logs per product as recent_movements.
-- Also includes units_sold_30d and revenue_30d from order_items.
CREATE OR REPLACE FUNCTION public.get_seller_inventory(
  p_seller_id     UUID,
  p_limit         INTEGER  DEFAULT 50,
  p_offset        INTEGER  DEFAULT 0,
  p_status        TEXT     DEFAULT NULL,
  p_search        TEXT     DEFAULT NULL,
  p_low_stock_only BOOLEAN DEFAULT FALSE,
  p_sort          TEXT     DEFAULT 'created_desc'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid    UUID := auth.uid();
  _result jsonb;
BEGIN
  -- Only the seller themselves (or admin) may see their inventory
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _uid <> p_seller_id THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _uid AND (role = 'admin' OR is_admin = TRUE)) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  WITH filtered AS (
    SELECT p.*,
           CASE WHEN p.stock = 0                          THEN TRUE ELSE FALSE END AS is_out_of_stock,
           CASE WHEN p.stock > 0 AND p.stock <= p.low_stock_threshold THEN TRUE ELSE FALSE END AS is_low_stock
    FROM   products p
    WHERE  p.seller_id = p_seller_id
      AND  (p_status IS NULL OR p.status = p_status)
      AND  (p.status <> 'archived' OR p_status = 'archived')
      AND  (p_search IS NULL OR p.name ILIKE '%' || p_search || '%' OR p.sku ILIKE '%' || p_search || '%')
      AND  (NOT p_low_stock_only OR (p.stock <= p.low_stock_threshold AND p.stock > 0))
  ),
  sorted AS (
    SELECT *,
           ROW_NUMBER() OVER (
             ORDER BY
               CASE p_sort
                 WHEN 'name_asc'     THEN name
                 ELSE NULL
               END ASC NULLS LAST,
               CASE p_sort
                 WHEN 'created_asc'  THEN created_at::text
                 WHEN 'created_desc' THEN NULL
                 ELSE NULL
               END ASC NULLS LAST,
               CASE p_sort
                 WHEN 'created_desc' THEN created_at
                 ELSE NULL
               END DESC NULLS LAST,
               CASE p_sort
                 WHEN 'stock_asc'    THEN stock
                 ELSE NULL
               END ASC NULLS LAST,
               CASE p_sort
                 WHEN 'stock_desc'   THEN stock
                 ELSE NULL
               END DESC NULLS LAST,
               CASE p_sort
                 WHEN 'revenue_desc' THEN price
                 ELSE NULL
               END DESC NULLS LAST,
               sort_order ASC,
               created_at DESC
           ) AS rn,
           COUNT(*) OVER () AS total_matched
    FROM filtered
  ),
  paged AS (
    SELECT * FROM sorted
    WHERE rn > p_offset AND rn <= p_offset + p_limit
  ),
  with_sales AS (
    SELECT paged.*,
           COALESCE(s.units_sold_30d, 0) AS units_sold_30d,
           COALESCE(s.revenue_30d, 0)    AS revenue_30d
    FROM paged
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(oi.quantity), 0)                         AS units_sold_30d,
        COALESCE(SUM(oi.quantity * oi.price_at_purchase), 0)  AS revenue_30d
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.product_id = paged.id
        AND o.created_at >= NOW() - INTERVAL '30 days'
        AND o.status NOT IN ('cancelled', 'refunded')
    ) s ON TRUE
  ),
  with_history AS (
    SELECT ws.*,
           COALESCE(h.movements, '[]'::jsonb) AS recent_movements
    FROM with_sales ws
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',          il.id,
          'reason',      il.reason,
          'delta',       il.delta,
          'stock_before',il.stock_before,
          'stock_after', il.stock_after,
          'notes',       il.notes,
          'created_at',  il.created_at
        ) ORDER BY il.created_at DESC
      ) AS movements
      FROM (
        SELECT * FROM inventory_logs
        WHERE product_id = ws.id
        ORDER BY created_at DESC
        LIMIT 5
      ) il
    ) h ON TRUE
  ),
  totals AS (
    SELECT
      COUNT(*)                                                        AS total,
      COUNT(*) FILTER (WHERE is_low_stock)                           AS low_stock,
      COUNT(*) FILTER (WHERE is_out_of_stock)                        AS out_of_stock,
      COUNT(*) FILTER (WHERE status = 'active')                      AS active,
      COUNT(*) FILTER (WHERE status = 'draft')                       AS draft,
      COUNT(*) FILTER (WHERE status = 'archived')                    AS archived,
      COALESCE(SUM(price * stock) FILTER (WHERE status = 'active'), 0) AS inventory_value
    FROM filtered
  )
  SELECT jsonb_build_object(
    'products',   COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',                 wh.id,
        'seller_id',          wh.seller_id,
        'name',               wh.name,
        'description',        wh.description,
        'price',              wh.price,
        'sale_price',         wh.sale_price,
        'cost_price',         wh.cost_price,
        'stock',              wh.stock,
        'low_stock_threshold',wh.low_stock_threshold,
        'images',             wh.images,
        'category',           wh.category,
        'tags',               wh.tags,
        'rating',             wh.rating,
        'status',             wh.status,
        'sku',                wh.sku,
        'is_boosted',         wh.is_boosted,
        'sort_order',         wh.sort_order,
        'created_at',         wh.created_at,
        'updated_at',         wh.updated_at,
        'is_low_stock',       wh.is_low_stock,
        'is_out_of_stock',    wh.is_out_of_stock,
        'units_sold_30d',     wh.units_sold_30d,
        'revenue_30d',        wh.revenue_30d,
        'recent_movements',   wh.recent_movements
      ) ORDER BY wh.rn
    ), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'matched', COALESCE((SELECT total_matched FROM sorted LIMIT 1), 0),
      'limit',   p_limit,
      'offset',  p_offset
    ),
    'totals', (SELECT row_to_json(t)::jsonb FROM totals t)
  ) INTO _result
  FROM with_history wh;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_seller_inventory(UUID,INTEGER,INTEGER,TEXT,TEXT,BOOLEAN,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_seller_inventory(UUID,INTEGER,INTEGER,TEXT,TEXT,BOOLEAN,TEXT) TO authenticated;


-- ─── 2. update_product_stock ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_product_stock(
  p_product_id UUID,
  p_delta      INTEGER,
  p_reason     TEXT    DEFAULT 'adjustment',
  p_notes      TEXT    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid         UUID    := auth.uid();
  _stock_before INTEGER;
  _stock_after  INTEGER;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  -- Verify ownership
  SELECT stock INTO _stock_before
  FROM products
  WHERE id = p_product_id AND seller_id = _uid AND status <> 'archived';

  IF NOT FOUND THEN RAISE EXCEPTION 'product not found or access denied'; END IF;

  _stock_after := GREATEST(0, _stock_before + p_delta);

  UPDATE products
  SET    stock      = _stock_after,
         updated_at = NOW()
  WHERE  id = p_product_id;

  -- Audit log
  INSERT INTO inventory_logs (product_id, performed_by, reason, delta, stock_before, stock_after, notes)
  VALUES (p_product_id, _uid, p_reason, _stock_after - _stock_before, _stock_before, _stock_after, p_notes);
END;
$$;

REVOKE ALL ON FUNCTION public.update_product_stock(UUID,INTEGER,TEXT,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_product_stock(UUID,INTEGER,TEXT,TEXT) TO authenticated;


-- ─── 3. toggle_product_boost ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_product_boost(
  p_product_id UUID
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid      UUID    := auth.uid();
  _new_val  BOOLEAN;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  UPDATE products
  SET    is_boosted = NOT is_boosted,
         updated_at = NOW()
  WHERE  id = p_product_id AND seller_id = _uid
  RETURNING is_boosted INTO _new_val;

  IF NOT FOUND THEN RAISE EXCEPTION 'product not found or access denied'; END IF;
  RETURN _new_val;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_product_boost(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.toggle_product_boost(UUID) TO authenticated;


-- ─── 4. set_product_status ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_product_status(
  p_product_id UUID,
  p_status     TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_status NOT IN ('active', 'draft', 'inactive', 'archived') THEN
    RAISE EXCEPTION 'invalid status: %', p_status;
  END IF;

  UPDATE products
  SET    status     = p_status,
         updated_at = NOW()
  WHERE  id = p_product_id AND seller_id = _uid;

  IF NOT FOUND THEN RAISE EXCEPTION 'product not found or access denied'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_product_status(UUID,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_product_status(UUID,TEXT) TO authenticated;


-- ─── 5. duplicate_product ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.duplicate_product(
  p_product_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid    UUID := auth.uid();
  _new_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO products (
    seller_id, name, description, price, sale_price, cost_price,
    stock, low_stock_threshold, images, category, subcategory,
    tags, weight, sku, sort_order, status
  )
  SELECT
    seller_id,
    'Copy of ' || name,
    description, price, sale_price, cost_price,
    stock, low_stock_threshold, images, category, subcategory,
    tags, weight,
    NULL,         -- SKU must be unique; let seller fill it
    sort_order,
    'draft'       -- always draft so it doesn't go live immediately
  FROM products
  WHERE id = p_product_id AND seller_id = _uid
  RETURNING id INTO _new_id;

  IF _new_id IS NULL THEN RAISE EXCEPTION 'product not found or access denied'; END IF;
  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.duplicate_product(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.duplicate_product(UUID) TO authenticated;


-- ─── 6. archive_products (batch) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.archive_products(
  p_product_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid   UUID    := auth.uid();
  _count INTEGER;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF array_length(p_product_ids, 1) IS NULL THEN RETURN 0; END IF;

  UPDATE products
  SET    status     = 'archived',
         updated_at = NOW()
  WHERE  id = ANY(p_product_ids)
    AND  seller_id = _uid
    AND  status <> 'archived';

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_products(UUID[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.archive_products(UUID[]) TO authenticated;


-- ─── 7. reorder_products ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reorder_products(
  p_ordered_ids UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  i    INTEGER;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF array_length(p_ordered_ids, 1) IS NULL THEN RETURN; END IF;

  -- Verify all ids belong to this seller before updating any
  IF (
    SELECT COUNT(*) FROM products
    WHERE id = ANY(p_ordered_ids) AND seller_id <> _uid
  ) > 0 THEN
    RAISE EXCEPTION 'forbidden: some products do not belong to you';
  END IF;

  FOR i IN 1 .. array_length(p_ordered_ids, 1) LOOP
    UPDATE products
    SET    sort_order = i,
           updated_at = NOW()
    WHERE  id = p_ordered_ids[i];
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_products(UUID[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reorder_products(UUID[]) TO authenticated;


-- ─── 8. inventory_logs: ensure table and RLS exist ──────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id    UUID        REFERENCES public.product_variants(id) ON DELETE SET NULL,
  order_id      UUID        REFERENCES public.orders(id) ON DELETE SET NULL,
  order_item_id UUID        REFERENCES public.order_items(id) ON DELETE SET NULL,
  return_id     UUID,
  performed_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason        TEXT        NOT NULL DEFAULT 'adjustment',
  delta         INTEGER     NOT NULL,
  stock_before  INTEGER     NOT NULL,
  stock_after   INTEGER     NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers view own product logs" ON public.inventory_logs;
CREATE POLICY "Sellers view own product logs"
  ON public.inventory_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = inventory_logs.product_id
        AND p.seller_id = auth.uid()
    )
  );
