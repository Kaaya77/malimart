-- 20260723140000_fix_deleted_product_editing.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Bug: a soft-deleted product (products.deleted_at set) still appeared
-- completely normal in the seller's own inventory — get_seller_inventory()
-- never filtered deleted_at — and editing it "worked" until the save
-- touched variants, at which point upsert_product_variants() (which DOES
-- check deleted_at IS NULL) threw a bare "Unauthorized or product not
-- found", with no indication the product had been deleted. save_product()
-- itself never checked deleted_at at all, so the failure mode was
-- inconsistent depending on whether the edit happened to include variants.
--
-- Fix: exclude deleted products from the inventory read model, and make
-- save_product() fail fast with a clear message instead of silently
-- "succeeding" on the row itself and blowing up later in a helper.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_seller_inventory(
  p_seller_id      UUID,
  p_limit          INTEGER DEFAULT 50,
  p_offset         INTEGER DEFAULT 0,
  p_status         TEXT DEFAULT NULL,
  p_search         TEXT DEFAULT NULL,
  p_low_stock_only BOOLEAN DEFAULT false,
  p_sort           TEXT DEFAULT 'created_desc',
  p_category       TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid UUID := auth.uid(); _result jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _uid <> p_seller_id THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _uid AND (role = 'admin' OR is_admin = TRUE))
    THEN RAISE EXCEPTION 'forbidden'; END IF;
  END IF;
  WITH filtered AS (
    SELECT p.*,
           CASE WHEN p.stock = 0 THEN TRUE ELSE FALSE END AS is_out_of_stock,
           CASE WHEN p.stock > 0 AND p.stock <= p.low_stock_threshold THEN TRUE ELSE FALSE END AS is_low_stock
    FROM products p
    WHERE p.seller_id = p_seller_id
      AND p.deleted_at IS NULL
      AND (p_status IS NULL OR p.status = p_status)
      AND (p.status <> 'archived' OR p_status = 'archived')
      AND (p_category IS NULL OR p.category = p_category)
      AND (p_search IS NULL OR p.name ILIKE '%' || p_search || '%' OR p.sku ILIKE '%' || p_search || '%')
      AND (NOT p_low_stock_only OR (p.stock <= p.low_stock_threshold AND p.stock > 0))
  ),
  sorted AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY
      CASE p_sort WHEN 'name_asc'      THEN name             ELSE NULL END ASC  NULLS LAST,
      CASE p_sort WHEN 'created_asc'   THEN created_at::text ELSE NULL END ASC  NULLS LAST,
      CASE p_sort WHEN 'created_desc'  THEN created_at       ELSE NULL END DESC NULLS LAST,
      CASE p_sort WHEN 'stock_asc'     THEN stock            ELSE NULL END ASC  NULLS LAST,
      CASE p_sort WHEN 'stock_desc'    THEN stock            ELSE NULL END DESC NULLS LAST,
      CASE p_sort WHEN 'revenue_desc'  THEN price            ELSE NULL END DESC NULLS LAST,
      sort_order ASC, created_at DESC
    ) AS rn,
    COUNT(*) OVER () AS total_matched
    FROM filtered
  ),
  paged AS (SELECT * FROM sorted WHERE rn > p_offset AND rn <= p_offset + p_limit),
  with_sales AS (
    SELECT paged.*, COALESCE(s.units_sold_30d,0) AS units_sold_30d, COALESCE(s.revenue_30d,0) AS revenue_30d
    FROM paged
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(oi.quantity),0) AS units_sold_30d,
             COALESCE(SUM(oi.quantity * oi.price_at_purchase),0) AS revenue_30d
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE oi.product_id = paged.id
        AND o.created_at >= NOW() - INTERVAL '30 days'
        AND o.status NOT IN ('cancelled','refunded')
    ) s ON TRUE
  ),
  with_history AS (
    SELECT ws.*, COALESCE(h.movements,'[]'::jsonb) AS recent_movements
    FROM with_sales ws
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object('id',il.id,'reason',il.reason,'delta',il.delta,
          'stock_before',il.stock_before,'stock_after',il.stock_after,
          'notes',il.notes,'created_at',il.created_at)
        ORDER BY il.created_at DESC
      ) AS movements
      FROM (SELECT * FROM inventory_logs WHERE product_id = ws.id ORDER BY created_at DESC LIMIT 5) il
    ) h ON TRUE
  ),
  totals AS (
    SELECT COUNT(*)                                             AS total,
           COUNT(*) FILTER (WHERE is_low_stock)                AS low_stock,
           COUNT(*) FILTER (WHERE is_out_of_stock)             AS out_of_stock,
           COUNT(*) FILTER (WHERE status = 'active')           AS active,
           COUNT(*) FILTER (WHERE status = 'draft')            AS draft,
           COUNT(*) FILTER (WHERE status = 'archived')         AS archived,
           COALESCE(SUM(price * stock) FILTER (WHERE status = 'active'), 0) AS inventory_value
    FROM filtered
  )
  SELECT jsonb_build_object(
    'products', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',wh.id,'seller_id',wh.seller_id,'name',wh.name,'description',wh.description,
        'price',wh.price,'sale_price',wh.sale_price,'cost_price',wh.cost_price,
        'stock',wh.stock,'low_stock_threshold',wh.low_stock_threshold,
        'images',wh.images,'category',wh.category,'tags',wh.tags,
        'rating',wh.rating,'status',wh.status,'sku',wh.sku,
        'is_boosted',wh.is_boosted,'sort_order',wh.sort_order,
        'created_at',wh.created_at,'updated_at',wh.updated_at,
        'is_low_stock',wh.is_low_stock,'is_out_of_stock',wh.is_out_of_stock,
        'units_sold_30d',wh.units_sold_30d,'revenue_30d',wh.revenue_30d,
        'recent_movements',wh.recent_movements
      ) ORDER BY wh.rn
    ), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'matched', COALESCE((SELECT total_matched FROM sorted LIMIT 1), 0),
      'limit',   p_limit,
      'offset',  p_offset
    ),
    'totals', (SELECT row_to_json(t)::jsonb FROM totals t)
  ) INTO _result FROM with_history wh;
  RETURN _result;
END;
$function$;

-- save_product(): fail fast on a deleted product with a message the seller
-- can actually understand, instead of letting it fall through to whichever
-- helper happens to check deleted_at.
CREATE OR REPLACE FUNCTION public.save_product(p_product jsonb, p_variants jsonb DEFAULT '[]'::jsonb)
RETURNS products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := coalesce(public.is_admin(), false);
  v_id uuid := nullif(p_product->>'id','')::uuid;
  v_old public.products;
  v_res public.products;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode='28000'; end if;
  if coalesce(nullif(btrim(p_product->>'name'),''),'') = '' then
    raise exception 'Product name is required' using errcode='22023'; end if;
  if coalesce(nullif(p_product->>'price','')::numeric,0) < 0 then
    raise exception 'Price must be >= 0' using errcode='22023'; end if;

  if v_id is not null then
    select * into v_old from public.products where id = v_id;
    if not found then raise exception 'Product not found' using errcode='P0002'; end if;
    if v_old.seller_id <> v_uid and not v_admin then
      raise exception 'Not authorized to edit this product' using errcode='42501'; end if;
    if v_old.deleted_at is not null then
      raise exception 'This product was deleted and can no longer be edited' using errcode='22023'; end if;
  end if;

  insert into public.products as p (
    id, seller_id, name, slug, description, brand, sku, barcode,
    price, sale_price, cost_price, vat_rate, stock, low_stock_threshold,
    weight, dimensions, images, tags, badges, attributes, status,
    category, subcategory, condition, warranty_period, latitude, longitude, location, region, updated_at
  ) values (
    coalesce(v_id, gen_random_uuid()),
    coalesce(v_old.seller_id, v_uid),
    p_product->>'name',
    coalesce(nullif(p_product->>'slug',''), v_old.slug),
    coalesce(p_product->>'description', v_old.description),
    coalesce(p_product->>'brand', v_old.brand),
    coalesce(nullif(p_product->>'sku',''), v_old.sku),
    coalesce(nullif(p_product->>'barcode',''), v_old.barcode),
    coalesce(nullif(p_product->>'price','')::numeric, v_old.price, 0),
    nullif(p_product->>'sale_price','')::numeric,
    coalesce(nullif(p_product->>'cost_price','')::numeric, v_old.cost_price, 0),
    coalesce(nullif(p_product->>'vat_rate','')::numeric, v_old.vat_rate, 0),
    coalesce(nullif(p_product->>'stock','')::int, v_old.stock, 0),
    coalesce(nullif(p_product->>'low_stock_threshold','')::int, v_old.low_stock_threshold, 5),
    coalesce(nullif(p_product->>'weight','')::numeric, v_old.weight, 0),
    coalesce(p_product->'dimensions', v_old.dimensions),
    coalesce(public.jsonb_to_text_array(p_product->'images'), v_old.images, '{}'::text[]),
    coalesce(public.jsonb_to_text_array(p_product->'tags'), v_old.tags, '{}'::text[]),
    coalesce(public.jsonb_to_text_array(p_product->'badges'), v_old.badges),
    coalesce(p_product->'attributes', v_old.attributes, '{}'::jsonb),
    coalesce(nullif(p_product->>'status',''), v_old.status, 'active'),
    coalesce(p_product->>'category', v_old.category),
    coalesce(p_product->>'subcategory', v_old.subcategory),
    coalesce(p_product->>'condition', v_old.condition),
    coalesce(p_product->>'warranty_period', v_old.warranty_period),
    nullif(p_product->>'latitude','')::numeric,
    nullif(p_product->>'longitude','')::numeric,
    coalesce(p_product->'location', v_old.location),
    coalesce(p_product->>'region', v_old.region),
    now()
  )
  on conflict (id) do update set
    name=excluded.name, slug=excluded.slug, description=excluded.description, brand=excluded.brand,
    sku=excluded.sku, barcode=excluded.barcode, price=excluded.price, sale_price=excluded.sale_price,
    cost_price=excluded.cost_price, vat_rate=excluded.vat_rate, stock=excluded.stock,
    low_stock_threshold=excluded.low_stock_threshold, weight=excluded.weight, dimensions=excluded.dimensions,
    images=excluded.images, tags=excluded.tags, badges=excluded.badges, attributes=excluded.attributes,
    status=excluded.status, category=excluded.category, subcategory=excluded.subcategory,
    condition=excluded.condition, warranty_period=excluded.warranty_period, latitude=excluded.latitude,
    longitude=excluded.longitude, location=excluded.location, region=excluded.region, updated_at=now()
  returning * into v_res;

  if p_variants is not null and jsonb_typeof(p_variants)='array' and jsonb_array_length(p_variants) > 0 then
    perform public.upsert_product_variants(v_res.id, p_variants);
  end if;
  return v_res;
end $function$;
