-- Seller dashboard "Recent Orders" was permanently empty.
--
-- Both recompute_seller_dashboard (which builds the snapshot the UI reads via
-- get_seller_dashboard_fast) and get_seller_dashboard sourced that list from
-- public.fulfillments. Verified against production:
--
--   * public.fulfillments contains 0 rows
--   * NO routine in the public schema inserts into it
--
-- So the list could never populate, while every other figure on the same
-- dashboard reads `orders` and showed real values — a seller saw
-- "revenue 25,000, 2 pending" beside an empty order list.
--
-- Now derived from orders the seller actually has line items on. The amount is
-- the SELLER'S OWN share (sum of their line items), not o.total: on a
-- multi-seller order o.total includes other sellers' goods and delivery, so
-- showing it would overstate what this seller is owed.
--
-- Row shape is unchanged (id, order_id, status, total, created_at), so no UI
-- change is needed.
--
-- NOTE: fulfillments is read in 4 more places (gross_revenue, net_payout,
-- commission in recompute_seller_dashboard, plus the admin dashboard). Those
-- remain zero and are NOT addressed here — see the accompanying note; deciding
-- how seller payouts and commission are derived is a product decision, not a
-- mechanical one.
do $mig$
declare
  v_src text; v_new_src text; r record; v_old text; v_new text; n int := 0;
begin
  for r in
    select p.proname, p.prosrc, pg_get_function_arguments(p.oid) as args,
           case p.proname when 'recompute_seller_dashboard' then 'p_seller' else 'v_seller' end as sv,
           case p.proname when 'recompute_seller_dashboard' then 'void' else 'jsonb' end as rt,
           case p.proname when 'recompute_seller_dashboard' then 'f.status::text' else 'f.status' end as stat
    from pg_proc p join pg_namespace n2 on n2.oid = p.pronamespace
    where n2.nspname='public' and p.proname in ('recompute_seller_dashboard','get_seller_dashboard')
  loop
    v_src := r.prosrc;

    v_old := 'SELECT f.id, f.order_id, ' || r.stat || ', f.total, f.created_at' || chr(10) ||
             '      FROM public.fulfillments f' || chr(10) ||
             '      WHERE f.seller_id = ' || r.sv;

    if position(v_old in v_src) = 0 then
      raise notice '% : recent_orders anchor not found, skipping', r.proname;
      continue;
    end if;

    v_new := 'SELECT o.id, o.id AS order_id, o.status::text, ' ||
             'SUM(oi.price_at_purchase * oi.quantity) AS total, o.created_at' || chr(10) ||
             '      FROM public.orders o JOIN public.order_items oi ON oi.order_id = o.id' || chr(10) ||
             '      WHERE oi.seller_id = ' || r.sv || ' AND o.deleted_at IS NULL' || chr(10) ||
             '      GROUP BY o.id, o.status, o.created_at';

    v_new_src := replace(v_src, v_old, v_new);
    v_new_src := replace(v_new_src, 'ORDER BY f.created_at DESC' || chr(10) || '      LIMIT 10',
                                    'ORDER BY o.created_at DESC' || chr(10) || '      LIMIT 10');
    v_new_src := replace(v_new_src, 'ORDER BY f.created_at DESC LIMIT 10',
                                    'ORDER BY o.created_at DESC LIMIT 10');

    execute format(
      'create or replace function public.%I(%s) returns %s language plpgsql security definer set search_path = public as %L',
      r.proname, r.args, r.rt, v_new_src);
    n := n + 1;
  end loop;

  if n = 0 then raise exception 'nothing patched'; end if;
  raise notice 'patched % function(s)', n;
end
$mig$;

-- Existing snapshots were built with the empty list; refresh them.
do $$
declare s record;
begin
  for s in select seller_id from public.seller_dashboard_snapshot loop
    perform public.recompute_seller_dashboard(s.seller_id);
  end loop;
end $$;
