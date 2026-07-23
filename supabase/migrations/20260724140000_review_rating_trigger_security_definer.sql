-- refresh_product_rating (AFTER INSERT/UPDATE/DELETE on reviews) UPDATEs
-- products.rating/review_count, but it ran with the reviewer's privileges. The
-- products_update RLS policy only allows the seller/admin, so a review left by
-- anyone else was rolled back — "cannot publish review". Recreate the function
-- as SECURITY DEFINER so the aggregate refresh runs with the owner's rights.
create or replace function public.refresh_product_rating()
returns trigger
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
begin
  update public.products
  set
    rating       = (select round(avg(rating)::numeric, 2) from public.reviews where product_id = coalesce(new.product_id, old.product_id) and deleted_at is null),
    review_count = (select count(*) from public.reviews where product_id = coalesce(new.product_id, old.product_id) and deleted_at is null)
  where id = coalesce(new.product_id, old.product_id);
  return null;
end;
$function$;
