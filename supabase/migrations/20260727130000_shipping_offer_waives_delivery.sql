-- Free-shipping campaigns should waive the DELIVERY FEE (not discount products).
-- compute_shipping_waiver returns the delivery amount to waive: for each seller
-- in the cart, waive that seller's vendor_profiles.delivery_fee when an active
-- shipping offer covers them (auto-apply, or the entered coupon). Capped at the
-- delivery fee actually charged so it can never go negative or over-waive.
CREATE OR REPLACE FUNCTION public.compute_shipping_waiver(
  p_items jsonb, p_coupon_code text DEFAULT NULL::text, p_delivery_fee numeric DEFAULT 0
)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_code   text := nullif(btrim(coalesce(p_coupon_code,'')),'');
  v_waiver numeric := 0;
  s        record;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then return 0; end if;

  for s in
    select distinct p.seller_id as sid
    from jsonb_to_recordset(p_items) as x(product_id uuid, variant_id uuid, quantity integer)
    join products p on p.id = x.product_id
    where x.quantity is not null and x.quantity > 0
  loop
    if exists (
      select 1 from offers o
      where o.status = 'active' and o.campaign_type = 'shipping'
        and (o.start_date is null or o.start_date <= now())
        and (o.end_date   is null or o.end_date   >= now())
        and (o.max_usage  is null or coalesce(o.current_usage,0) < o.max_usage)
        and (o.is_auto_apply or (v_code is not null and upper(o.code) = upper(v_code)))
        and (
              o.scope = 'platform'
          or (o.target_type = 'store' and o.seller_id = s.sid)
          or (o.target_type = 'product' and o.target_ids is not null and exists (
                select 1
                from jsonb_to_recordset(p_items) as y(product_id uuid, variant_id uuid, quantity integer)
                join products p2 on p2.id = y.product_id
                where p2.seller_id = s.sid and y.product_id = any(o.target_ids)))
        )
    ) then
      v_waiver := v_waiver + coalesce((select delivery_fee from vendor_profiles where seller_id = s.sid), 0);
    end if;
  end loop;

  return greatest(least(v_waiver, greatest(coalesce(p_delivery_fee,0), 0)), 0);
end;
$function$;

GRANT EXECUTE ON FUNCTION public.compute_shipping_waiver(jsonb, text, numeric) TO anon, authenticated;

-- The cart preview now nets the shipping waiver out of the delivery fee, so the
-- previewed total reflects free shipping. (place_order_atomic receives an
-- already-waived delivery fee from the client's placeOrder, which calls the same
-- function — delivery has always been client-supplied, so this adds no new trust.)
CREATE OR REPLACE FUNCTION public.compute_cart_preview(p_items jsonb, p_delivery_fee numeric DEFAULT 0, p_coupon_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.compute_cart_totals(
    p_items,
    greatest(coalesce(p_delivery_fee,0) - public.compute_shipping_waiver(p_items, p_coupon_code, p_delivery_fee), 0),
    public.compute_order_discount(p_items, p_coupon_code)
  );
$function$;
