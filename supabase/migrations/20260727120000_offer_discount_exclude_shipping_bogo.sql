-- compute_order_discount was counting SHIPPING (and, in the coupon branch, BOGO)
-- campaigns as product-subtotal discounts. Those campaigns are stored with the
-- sentinel value=100/type=percentage, so a shipping campaign resolved to a 100%
-- product discount — i.e. buyers were charged 0 for the products (free goods),
-- not free shipping. place_order_atomic takes the LARGER of this and the
-- (already-correct) compute_auto_apply_discount, so the buggy value won and the
-- order actually charged 0.
--
-- Fix: only `campaign_type = 'discount'` campaigns reduce the product subtotal,
-- matching compute_auto_apply_discount. Shipping campaigns waive delivery (handled
-- via the delivery fee, not here) and BOGO grants free units — neither cuts the
-- unit price. No schema change; SECURITY DEFINER / search_path preserved.
CREATE OR REPLACE FUNCTION public.compute_order_discount(p_items jsonb, p_coupon_code text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  it record; v_price numeric; v_seller uuid;
  v_subtotal numeric := 0; v_auto numeric := 0; v_coupon numeric := 0;
  v_code text := nullif(btrim(coalesce(p_coupon_code,'')),'');
  ao record; o record; v_match_sub numeric := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then return 0; end if;

  for it in select * from jsonb_to_recordset(p_items) as x(product_id uuid, variant_id uuid, quantity integer) loop
    if it.quantity is null or it.quantity <= 0 then continue; end if;
    if it.variant_id is not null then
      select pv.price, p.seller_id into v_price, v_seller
      from product_variants pv join products p on p.id=pv.product_id
      where pv.id=it.variant_id and pv.product_id=it.product_id;
    else
      select price, seller_id into v_price, v_seller from products where id=it.product_id;
    end if;
    if v_price is null then continue; end if;
    v_subtotal := v_subtotal + v_price*it.quantity;

    select * into ao from offers o2
    where o2.status='active' and o2.is_auto_apply
      and coalesce(o2.campaign_type,'discount') = 'discount'   -- was: is distinct from 'bogo' (wrongly included shipping)
      and o2.type::text in ('percentage','fixed')
      and (o2.start_date is null or o2.start_date<=now())
      and (o2.end_date is null or o2.end_date>=now())
      and (o2.max_usage is null or coalesce(o2.current_usage,0)<o2.max_usage)
      and ( o2.scope='platform'
        or (o2.target_type='product' and o2.target_ids is not null and it.product_id = any(o2.target_ids))
        or (o2.target_type='store' and o2.seller_id=v_seller) )
    order by (case when o2.type::text='percentage' then v_price*o2.value/100 else least(o2.value, v_price) end) desc
    limit 1;
    if found then
      if ao.type::text='percentage' then v_auto := v_auto + v_price*it.quantity*ao.value/100;
      else v_auto := v_auto + least(ao.value, v_price)*it.quantity; end if;
    end if;
  end loop;

  if v_code is not null then
    select * into o from offers
    where upper(code)=upper(v_code) and status='active'
      and (start_date is null or start_date<=now())
      and (end_date is null or end_date>=now())
      and (max_usage is null or coalesce(current_usage,0)<max_usage)
    limit 1;
    if found then
      select coalesce(sum(line),0) into v_match_sub from (
        select (case when itx.variant_id is not null then pv.price else p.price end) * itx.quantity as line,
               p.seller_id as sid, itx.product_id as pid
        from jsonb_to_recordset(p_items) as itx(product_id uuid, variant_id uuid, quantity integer)
        left join products p on p.id=itx.product_id
        left join product_variants pv on pv.id=itx.variant_id
      ) lines
      where ( o.scope='platform'
        or (o.target_type='store' and lines.sid=o.seller_id)
        or (o.target_type='product' and o.target_ids is not null and lines.pid = any(o.target_ids)) );
      -- Only DISCOUNT coupons cut the product subtotal. A shipping coupon waives
      -- delivery (handled via the delivery fee); a BOGO coupon grants free units
      -- (handled separately) — neither should discount the subtotal by value=100.
      if coalesce(o.campaign_type,'discount')='discount'
         and (o.min_order_value is null or v_subtotal >= o.min_order_value) and v_match_sub > 0 then
        if o.type::text='percentage' then v_coupon := floor(v_match_sub * o.value/100);
        elsif o.type::text='fixed' then v_coupon := o.value;
        else v_coupon := 0; end if;
      end if;
    end if;
  end if;

  return greatest(least(round(v_auto + v_coupon), round(v_subtotal)), 0);
end; $function$;
