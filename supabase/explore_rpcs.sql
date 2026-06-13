-- Run this in Supabase SQL editor (Dashboard → SQL). The MCP migration
-- pooler was timing out when this was built, so apply it manually.
-- Both functions are read-only, SECURITY DEFINER, callable by anon
-- (public catalog browsing) + authenticated.

create or replace function public.category_product_counts()
returns table (category text, product_count bigint)
language sql stable security definer set search_path = public as $$
  select p.category, count(*)
  from products p
  where p.deleted_at is null
    and coalesce(p.status,'active') not in ('inactive','draft','archived')
    and p.category is not null
  group by p.category;
$$;

create or replace function public.trending_products(p_limit int default 12)
returns table (
  id uuid, seller_id uuid, name text, category text,
  price numeric, base_price numeric, images text[],
  rating numeric, review_count int, stock int, is_verified boolean
)
language sql stable security definer set search_path = public as $$
  select p.id, p.seller_id, p.name, p.category,
         coalesce(p.price, p.base_price), p.base_price, p.images,
         p.rating, p.review_count, p.stock, p.is_verified
  from products p
  where p.deleted_at is null
    and coalesce(p.status,'active') not in ('inactive','draft','archived')
  order by coalesce(p.rating,0) * coalesce(p.review_count,1) desc nulls last,
           p.is_boosted desc nulls last,
           p.created_at desc
  limit least(greatest(p_limit,1), 40);
$$;

grant execute on function public.category_product_counts() to anon, authenticated;
grant execute on function public.trending_products(int) to anon, authenticated;
