-- ═══════════════════════════════════════════════════════════════════════════
-- INVENTORY FIXES
--
-- Two real defects found by reading SellerInventory.tsx end to end against
-- its RPCs, not by symptom report.
--
-- 1. STAT CARDS AND TAB BADGES LIED ONCE YOU FILTERED.
--    get_seller_inventory computed `totals` (Total Products, Inventory Value,
--    Low Stock, Out of Stock, and every status-tab count) from the SAME
--    filtered CTE as the paginated product list — the one narrowed by
--    p_status/p_search/p_category/p_low_stock_only. Type a search, or switch
--    to the Draft tab, and the header stats and every OTHER tab's badge count
--    silently recomputed against that narrowed set. On the Archived tab,
--    "Total Products" showed the archived count, not the seller's real total.
--
--    Fixed by splitting `totals` into its own CTE, scoped only to
--    seller_id + deleted_at — independent of every list-scoping filter, and
--    computed once per call rather than drifting with whatever the paginated
--    query happened to be showing.
--
-- 2. BULK EDIT COULD UN-SUSPEND A LISTING MALIMART TOOK DOWN.
--    set_product_status explicitly blocks a seller from moving their own
--    suspended product to any other status ("submit an appeal to request
--    reinstatement"). bulk_edit_products had no such check — it wrote
--    `status` unconditionally after only an ownership check, so a suspended
--    row selected in Bulk Edit (nothing stopped a suspended product from
--    being selected) and saved with any status change reinstated it with no
--    appeal, no review. Same guard as set_product_status, applied per-row.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.get_seller_inventory(
  p_seller_id uuid,
  p_limit integer default 50,
  p_offset integer default 0,
  p_status text default null,
  p_search text default null,
  p_low_stock_only boolean default false,
  p_sort text default 'created_desc',
  p_category text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare _uid uuid := auth.uid(); _result jsonb;
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  if _uid <> p_seller_id then
    if not exists (select 1 from profiles where id = _uid and (role = 'admin' or is_admin = true))
    then raise exception 'forbidden'; end if;
  end if;

  with filtered as (
    select p.*,
           case when p.stock = 0 then true else false end as is_out_of_stock,
           case when p.stock > 0 and p.stock <= p.low_stock_threshold then true else false end as is_low_stock
    from products p
    where p.seller_id = p_seller_id
      and p.deleted_at is null
      and (p_status is null or p.status = p_status)
      and (p.status <> 'archived' or p_status = 'archived')
      and (p_category is null or p.category = p_category)
      and (p_search is null or p.name ilike '%' || p_search || '%' or p.sku ilike '%' || p_search || '%')
      and (not p_low_stock_only or (p.stock <= p.low_stock_threshold and p.stock > 0))
  ),
  sorted as (
    select *, row_number() over (order by
      case p_sort when 'name_asc'      then name             else null end asc  nulls last,
      case p_sort when 'created_asc'   then created_at::text else null end asc  nulls last,
      case p_sort when 'created_desc'  then created_at       else null end desc nulls last,
      case p_sort when 'stock_asc'     then stock            else null end asc  nulls last,
      case p_sort when 'stock_desc'    then stock            else null end desc nulls last,
      case p_sort when 'revenue_desc'  then price            else null end desc nulls last,
      sort_order asc, created_at desc
    ) as rn,
    count(*) over () as total_matched
    from filtered
  ),
  paged as (select * from sorted where rn > p_offset and rn <= p_offset + p_limit),
  with_sales as (
    select paged.*, coalesce(s.units_sold_30d,0) as units_sold_30d, coalesce(s.revenue_30d,0) as revenue_30d
    from paged
    left join lateral (
      select coalesce(sum(oi.quantity),0) as units_sold_30d,
             coalesce(sum(oi.quantity * oi.price_at_purchase),0) as revenue_30d
      from order_items oi join orders o on o.id = oi.order_id
      where oi.product_id = paged.id
        and o.created_at >= now() - interval '30 days'
        and o.status not in ('cancelled','refunded')
    ) s on true
  ),
  with_history as (
    select ws.*, coalesce(h.movements,'[]'::jsonb) as recent_movements
    from with_sales ws
    left join lateral (
      select jsonb_agg(
        jsonb_build_object('id',il.id,'reason',il.reason,'delta',il.delta,
          'stock_before',il.stock_before,'stock_after',il.stock_after,
          'notes',il.notes,'created_at',il.created_at)
        order by il.created_at desc
      ) as movements
      from (select * from inventory_logs where product_id = ws.id order by created_at desc limit 5) il
    ) h on true
  ),
  -- Independent of every list filter above — this is the seller's whole
  -- catalog, so the header stats and OTHER tabs' badges never drift with
  -- whatever the current search/status/category happens to be.
  totals_base as (
    select p.status, p.stock, p.low_stock_threshold, p.price
    from products p
    where p.seller_id = p_seller_id and p.deleted_at is null
  ),
  totals as (
    select
      count(*) filter (where status <> 'archived')                                       as total,
      count(*) filter (where status <> 'archived' and stock > 0
                        and stock <= low_stock_threshold)                                 as low_stock,
      count(*) filter (where status <> 'archived' and stock = 0)                          as out_of_stock,
      count(*) filter (where status = 'active')                                           as active,
      count(*) filter (where status = 'draft')                                            as draft,
      count(*) filter (where status = 'archived')                                         as archived,
      coalesce(sum(price * stock) filter (where status = 'active'), 0)                    as inventory_value
    from totals_base
  )
  select jsonb_build_object(
    'products', coalesce((select jsonb_agg(
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
      ) order by wh.rn
    ) from with_history wh), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'matched', coalesce((select total_matched from sorted limit 1), 0),
      'limit',   p_limit,
      'offset',  p_offset
    ),
    'totals', (select row_to_json(t)::jsonb from totals t)
  ) into _result;
  return _result;
end;
$function$;

-- ---------------------------------------------------------------------------
-- bulk_edit_products: the same suspended-guard set_product_status enforces.
-- ---------------------------------------------------------------------------
create or replace function public.bulk_edit_products(p_updates jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_caller  uuid := auth.uid();
    v_update  jsonb;
    v_product public.products%rowtype;
    v_new_stock integer;
    v_new_status text;
    v_saved   integer := 0;
    v_errors  jsonb[] := '{}';
begin
    for v_update in select * from jsonb_array_elements(p_updates) loop
        begin
            select * into v_product
            from public.products
            where id = (v_update->>'id')::uuid and deleted_at is null;

            if not found then
                v_errors := v_errors || jsonb_build_object('id', v_update->>'id', 'error', 'Not found');
                continue;
            end if;

            if v_product.seller_id != v_caller and not (select public.is_admin()) then
                v_errors := v_errors || jsonb_build_object('id', v_update->>'id', 'error', 'Unauthorized');
                continue;
            end if;

            -- A suspended listing is MaliMart's call to reverse, not the
            -- seller's — same rule set_product_status enforces on the
            -- single-row path. Bulk edit must not be a back door around it.
            v_new_status := v_update->>'status';
            if v_product.status = 'suspended' and v_new_status is not null
               and v_new_status <> v_product.status and not (select public.is_admin()) then
                v_errors := v_errors || jsonb_build_object(
                    'id', v_update->>'id',
                    'error', 'This product was suspended by MaliMart. Submit an appeal to request reinstatement.'
                );
                continue;
            end if;
            if v_new_status is not null and v_new_status not in ('active','draft','inactive','archived','suspended') then
                v_errors := v_errors || jsonb_build_object('id', v_update->>'id', 'error', 'Invalid status: ' || v_new_status);
                continue;
            end if;

            update public.products set
                name       = coalesce(v_update->>'name',   name),
                price      = coalesce((v_update->>'price')::numeric, price),
                base_price = coalesce((v_update->>'price')::numeric, base_price),
                status     = coalesce(v_new_status, status),
                updated_at = now()
            where id = v_product.id;

            if v_update ? 'stock' and (v_update->>'stock')::integer != v_product.stock then
                v_new_stock := greatest(0, (v_update->>'stock')::integer);
                update public.products set stock = v_new_stock where id = v_product.id;
                insert into public.inventory_logs (
                    product_id, reason, delta, stock_before, stock_after, performed_by, notes
                ) values (
                    v_product.id, 'adjustment', v_new_stock - v_product.stock,
                    v_product.stock, v_new_stock, v_caller, 'Bulk edit'
                );
            end if;

            v_saved := v_saved + 1;

        exception when others then
            v_errors := v_errors || jsonb_build_object('id', v_update->>'id', 'error', sqlerrm);
        end;
    end loop;

    return jsonb_build_object('saved', v_saved, 'errors', to_jsonb(v_errors));
end;
$function$;
