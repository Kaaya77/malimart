-- Fix: cart lines with a variant could not be removed, and quantity buttons
-- silently did nothing.
--
-- There are two cart-loading paths and they returned DIFFERENT shapes:
--
--   context/AppContext.tsx fetchAndSetCart()   (realtime refresh)
--     embeds product.variants -> selectedVariant hydrates -> worked
--
--   public.get_dashboard_data()                (THE LOGIN PATH)
--     product = {id,name,price,sale_price,images,stock,seller_id,slug,status}
--     no `variants` key -> selectedVariant always undefined
--
-- AppContext derives the variant with
--     ci.product?.variants?.find(v => v.id === ci.variant_id)
-- so after login it was undefined even though `variant_id` was set. The cart
-- UI passed `selectedVariant?.id` (undefined) into removeFromCart, which
-- compared it to the line's real variant_id, failed to match, KEPT the row in
-- local state, and issued `.is('variant_id', null)` — deleting 0 rows. Nothing
-- errored, so the line just sat in the bag refusing to go away. updateQuantity
-- no-oped through the identical mismatch.
--
-- The client now falls back to `item.variant_id` (components/cart/CartItemRow
-- .tsx, components/CartDrawer.tsx), which fixes removal by itself. This
-- migration fixes the underlying inconsistency so both paths agree, and
-- restores the variant label, variant image and per-variant stock — all
-- silently missing on first load for the same reason.
--
-- Only the SELECTED variant is embedded, not the whole set: the product that
-- surfaced this has 27 variants and this payload loads on every single login.
--
-- Patched in place rather than retyped: the function is ~10.5KB and unrelated
-- to this fix everywhere else, so rewriting it wholesale would risk drifting
-- from whatever is actually deployed. The anchor check makes the patch fail
-- loudly instead of silently no-op'ing if the body has changed.
do $mig$
declare
  v_src text;
  v_new text;
  v_old_frag constant text := $t$'slug', p.slug, 'status', p.status$t$;
  v_new_frag constant text := $t$'slug', p.slug, 'status', p.status,
                    'variants', case
                        when ci.variant_id is null then '[]'::jsonb
                        else coalesce((
                            select jsonb_agg(to_jsonb(pv.*))
                            from public.product_variants pv
                            where pv.id = ci.variant_id
                        ), '[]'::jsonb)
                    end$t$;
begin
  select prosrc into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_dashboard_data';

  if v_src is null then
    raise exception 'get_dashboard_data not found';
  end if;

  -- Already patched (idempotent re-run) — nothing to do.
  if position($t$'variants', case$t$ in v_src) > 0 then
    raise notice 'get_dashboard_data already embeds the cart variant; skipping';
    return;
  end if;

  if position(v_old_frag in v_src) = 0 then
    raise exception 'anchor fragment not found - function body changed, patch aborted';
  end if;

  v_new := replace(v_src, v_old_frag, v_new_frag);

  execute format(
    'create or replace function public.get_dashboard_data() returns jsonb '
    'language plpgsql security definer set search_path = public as %L',
    v_new
  );
end
$mig$;
