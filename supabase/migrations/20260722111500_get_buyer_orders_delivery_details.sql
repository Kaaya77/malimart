-- Extends get_buyer_orders to surface the new delivery_method/actual_delivery_fee/
-- driver_name/delivery_notes fields (driver_phone was already selected).
CREATE OR REPLACE FUNCTION public.get_buyer_orders(p_user_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  WITH paged_orders AS (
    SELECT
      o.id,
      o.user_id,
      o.status,
      o.created_at,
      o.updated_at,
      o.total,
      o.subtotal,
      o.delivery_fee,
      o.discount_amount,
      o.discount,
      o.vat_amount,
      o.vat,
      o.payment_method,
      o.payment_ref,
      o.note,
      o.customer_notes,
      o.shipping_address,
      o.shipping_address_snap,
      o.address,
      o.cancel_reason,
      o.is_gift,
      o.gift_message,
      o.driver_phone,
      o.driver_name,
      o.delivery_method,
      o.actual_delivery_fee,
      o.delivery_notes
    FROM public.orders o
    WHERE o.user_id = p_user_id
      AND o.deleted_at IS NULL
    ORDER BY o.created_at DESC
    LIMIT GREATEST(p_limit, 1)
    OFFSET GREATEST(p_offset, 0)
  ),
  order_items_agg AS (
    SELECT
      oi.order_id,
      jsonb_agg(
        jsonb_build_object(
          'id',                oi.id,
          'order_id',          oi.order_id,
          'seller_id',         oi.seller_id,
          'product_id',        oi.product_id,
          'variant_id',        oi.variant_id,
          'quantity',          oi.quantity,
          'price_at_purchase', COALESCE(oi.price_at_purchase, oi.price, 0),
          'sku',               oi.sku,
          'products', jsonb_build_object(
            'id',        p.id,
            'name',      p.name,
            'images',    p.images,
            'price',     p.price,
            'category',  p.category,
            'seller_id', p.seller_id,
            'slug',      p.slug
          ),
          'seller', jsonb_build_object(
            'store_name',    vp.store_name,
            'contact_phone', vp.contact_phone,
            'logo_url',      vp.logo_url
          )
        )
        ORDER BY oi.created_at
      ) AS items
    FROM public.order_items oi
    JOIN paged_orders po ON po.id = oi.order_id
    JOIN public.products p ON p.id = oi.product_id
    LEFT JOIN public.vendor_profiles vp ON vp.seller_id = oi.seller_id
    GROUP BY oi.order_id
  )
  SELECT jsonb_agg(row_data ORDER BY row_data->>'created_at' DESC)
  INTO result
  FROM (
    SELECT jsonb_build_object(
      'id',                  po.id,
      'user_id',              po.user_id,
      'status',               po.status::text,
      'created_at',           po.created_at,
      'updated_at',           po.updated_at,
      'total',                po.total,
      'subtotal',             po.subtotal,
      'delivery_fee',         po.delivery_fee,
      'discount_amount',      COALESCE(po.discount_amount, po.discount, 0),
      'vat_amount',           COALESCE(po.vat_amount, po.vat, 0),
      'payment_method',       po.payment_method,
      'payment_ref',          po.payment_ref,
      'note',                 COALESCE(po.note, po.customer_notes),
      'shipping_address',     COALESCE(po.shipping_address, po.shipping_address_snap, po.address),
      'cancel_reason',        po.cancel_reason,
      'is_gift',              po.is_gift,
      'gift_message',         po.gift_message,
      'driver_phone',         po.driver_phone,
      'driver_name',          po.driver_name,
      'delivery_method',      po.delivery_method,
      'actual_delivery_fee',  po.actual_delivery_fee,
      'delivery_notes',       po.delivery_notes,
      'items',                COALESCE(oia.items, '[]'::jsonb)
    ) AS row_data
    FROM paged_orders po
    LEFT JOIN order_items_agg oia ON oia.order_id = po.id
  ) sub;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$function$;
