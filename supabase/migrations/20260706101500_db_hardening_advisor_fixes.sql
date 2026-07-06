-- Fixes from Supabase advisors (security + performance), 2026-07-06.
--
-- 1. Privileged SECURITY DEFINER functions were EXECUTE-able by anon.
--    All of them do check auth internally (auth.uid()/is_admin guards were
--    verified), so this is defense-in-depth, not a live-hole fix: anon has
--    no legitimate call path to seller/admin mutations, so remove the
--    surface entirely. Public storefront/cart RPCs (shop_products,
--    trending_products, compute_cart_*, get_public_*, …) stay anon-callable.
revoke execute on function public.adjust_stock(uuid, integer, text, text) from public, anon;
grant  execute on function public.adjust_stock(uuid, integer, text, text) to authenticated, service_role;

revoke execute on function public.restore_products(uuid[]) from public, anon;
grant  execute on function public.restore_products(uuid[]) to authenticated, service_role;

revoke execute on function public.save_product(jsonb, jsonb) from public, anon;
grant  execute on function public.save_product(jsonb, jsonb) to authenticated, service_role;

revoke execute on function public.get_seller_inventory(uuid, integer, integer, text, text, boolean, text, text) from public, anon;
grant  execute on function public.get_seller_inventory(uuid, integer, integer, text, text, boolean, text, text) to authenticated, service_role;

revoke execute on function public.get_admin_top_sellers(integer, integer) from public, anon;
grant  execute on function public.get_admin_top_sellers(integer, integer) to authenticated, service_role;

-- 2. Trigger functions with a role-mutable search_path (advisor:
--    function_search_path_mutable). Pin them.
alter function public.touch_product_appeals_updated_at() set search_path = public;
alter function public.enforce_product_suspension() set search_path = public;

-- 3. Covering index for product_appeals.resolved_by FK (advisor:
--    unindexed_foreign_keys).
create index if not exists idx_product_appeals_resolved_by
  on public.product_appeals (resolved_by);

-- 4. product_appeals RLS: the old three policies re-evaluated auth.uid()
--    per row (advisor: auth_rls_initplan) and overlapped for SELECT/INSERT
--    (advisor: multiple_permissive_policies). Rebuild as one policy per
--    action with initplan-friendly (select ...) wrappers. Semantics are
--    identical: sellers read/insert their own pending appeals on their own
--    suspended products; admins can do everything.
drop policy if exists "product_appeals_admin_all"     on public.product_appeals;
drop policy if exists "product_appeals_seller_select" on public.product_appeals;
drop policy if exists "product_appeals_seller_insert" on public.product_appeals;

create policy "product_appeals_select" on public.product_appeals
  for select using (
    (select is_admin()) or seller_id = (select auth.uid())
  );

create policy "product_appeals_insert" on public.product_appeals
  for insert with check (
    (select is_admin())
    or (
      seller_id = (select auth.uid())
      and status = 'pending'
      and admin_response is null
      and resolved_at is null
      and resolved_by is null
      and exists (
        select 1 from products p
        where p.id = product_appeals.product_id
          and p.seller_id = (select auth.uid())
          and p.status = 'suspended'
      )
    )
  );

create policy "product_appeals_update" on public.product_appeals
  for update using ((select is_admin())) with check ((select is_admin()));

create policy "product_appeals_delete" on public.product_appeals
  for delete using ((select is_admin()));
