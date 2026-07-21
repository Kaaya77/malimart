-- shop_products never returned seller_name, so every card on the main Shop
-- listing page fell back to the generic "Store" placeholder in
-- ProductCardContent instead of showing the real seller/store name.
-- Return-type change requires a drop first (Postgres won't let CREATE OR
-- REPLACE alter the row type of an existing set-returning function).
drop function if exists public.shop_products(text,text,numeric,numeric,numeric,boolean,boolean,text,text,integer,integer);

create function public.shop_products(
  p_query text default null,
  p_category text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_min_rating numeric default null,
  p_verified boolean default false,
  p_in_stock boolean default false,
  p_region text default null,
  p_sort text default 'relevance',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table(
  id uuid, seller_id uuid, seller_name text, name text, slug text, category text,
  price numeric, sale_price numeric, base_price numeric, images text[],
  rating numeric, review_count integer, stock integer, is_verified boolean,
  is_boosted boolean, region text, status text, created_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with filtered as (
    select p.*,
      case when p_query is not null and length(trim(p_query)) >= 2
           then ts_rank(p.search_vector, websearch_to_tsquery('english', p_query))
           else 0 end as rank
    from products p
    where p.deleted_at is null
      and coalesce(p.status, 'active') not in ('inactive','draft','archived')
      and (p_query is null or length(trim(p_query)) < 2
           or p.search_vector @@ websearch_to_tsquery('english', p_query))
      and (p_category is null or p.category = p_category
           or lower(p.category) = lower(p_category))
      and (p_min_price is null or coalesce(p.price, p.base_price) >= p_min_price)
      and (p_max_price is null or coalesce(p.price, p.base_price) <= p_max_price)
      and (p_min_rating is null or coalesce(p.rating, 0) >= p_min_rating)
      and (not p_verified or p.is_verified = true)
      and (not p_in_stock or p.stock > 0)
      and (p_region is null or p.region ilike '%' || p_region || '%')
  )
  select f.id, f.seller_id, vp.store_name as seller_name, f.name, f.slug, f.category,
         coalesce(f.price, f.base_price) as price, f.sale_price, f.base_price,
         f.images, f.rating, f.review_count, f.stock,
         f.is_verified, f.is_boosted, f.region,
         f.status, f.created_at,
         count(*) over () as total_count
  from filtered f
  left join vendor_profiles vp on vp.seller_id = f.seller_id
  order by
    case when p_sort = 'relevance' then f.rank end desc nulls last,
    case when p_sort = 'relevance' then f.is_boosted end desc nulls last,
    case when p_sort = 'newest'     then f.created_at end desc nulls last,
    case when p_sort = 'price_asc'  then coalesce(f.price, f.base_price) end asc nulls last,
    case when p_sort = 'price_desc' then coalesce(f.price, f.base_price) end desc nulls last,
    case when p_sort = 'rating'     then coalesce(f.rating, 0) end desc nulls last,
    case when p_sort = 'popular'    then coalesce(f.rating,0) * coalesce(f.review_count,0) end desc nulls last,
    f.created_at desc
  limit least(greatest(p_limit, 1), 60)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.shop_products(text,text,numeric,numeric,numeric,boolean,boolean,text,text,integer,integer) to anon, authenticated;
