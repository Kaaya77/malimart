-- Close the `authenticated` half of the platform_settings leak.
--
-- 20260902140000 stopped ANONYMOUS callers reading the whole config row, but
-- left `authenticated` with full-row SELECT, because services/adminApi.ts did
-- `.from('platform_settings').select('*')` and column grants are per-role —
-- tightening the role would have broken the admin settings page. So every
-- logged-in buyer could still read `global_commission`, `auto_approve_vendors`,
-- `require_vendor_verification`, `max_products_per_vendor`.
--
-- RLS cannot express this: the read policy is USING (true) and RLS is
-- row-level, while the distinction we need is column-level AND role-level
-- (admins get all columns, everyone else gets the hero columns).
--
-- So admin access moves behind is_admin()-gated RPCs — the pattern CLAUDE.md
-- already mandates for cross-user data — and the table's own grants shrink to
-- just the public hero columns.
--
-- Writes were ALREADY correctly gated (platform_settings_update /
-- _insert both check is_admin()). They move to an RPC anyway so the admin
-- page does not depend on `ON CONFLICT DO UPDATE` retaining privileges after
-- the column-grant change.

-- ---------------------------------------------------------------------------
-- READ: full row, admins only.
-- ---------------------------------------------------------------------------
create or replace function public.get_platform_settings()
returns public.platform_settings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.platform_settings;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into result from public.platform_settings where id = 1;
  return result;
end;
$$;

revoke execute on function public.get_platform_settings() from public, anon;
grant  execute on function public.get_platform_settings() to authenticated;

-- ---------------------------------------------------------------------------
-- WRITE: admins only, with an explicit column whitelist.
--
-- The whitelist matters — this is SECURITY DEFINER, so a bare
-- `update ... set (jsonb_populate_record)` would let an admin-crafted payload
-- reach any column ever added to this table, including ones added later.
-- ---------------------------------------------------------------------------
create or replace function public.update_platform_settings(p_settings jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.platform_settings as ps (
    id,
    maintenance_mode, new_signups, global_commission, auto_approve_vendors,
    default_currency, audit_retention_days, require_vendor_verification,
    max_products_per_vendor, enable_loyalty_program
  )
  values (
    1,
    coalesce((p_settings ->> 'maintenance_mode')::boolean, false),
    coalesce((p_settings ->> 'new_signups')::boolean, true),
    coalesce((p_settings ->> 'global_commission')::numeric, 5),
    coalesce((p_settings ->> 'auto_approve_vendors')::boolean, false),
    coalesce( p_settings ->> 'default_currency', 'TZS'),
    coalesce((p_settings ->> 'audit_retention_days')::integer, 30),
    coalesce((p_settings ->> 'require_vendor_verification')::boolean, true),
    coalesce((p_settings ->> 'max_products_per_vendor')::integer, 1000),
    coalesce((p_settings ->> 'enable_loyalty_program')::boolean, true)
  )
  on conflict (id) do update set
    maintenance_mode            = excluded.maintenance_mode,
    new_signups                 = excluded.new_signups,
    global_commission           = excluded.global_commission,
    auto_approve_vendors        = excluded.auto_approve_vendors,
    default_currency            = excluded.default_currency,
    audit_retention_days        = excluded.audit_retention_days,
    require_vendor_verification = excluded.require_vendor_verification,
    max_products_per_vendor     = excluded.max_products_per_vendor,
    enable_loyalty_program      = excluded.enable_loyalty_program;
end;
$$;

revoke execute on function public.update_platform_settings(jsonb) from public, anon;
grant  execute on function public.update_platform_settings(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Shrink the table's own grants to the public hero columns.
-- Logged-in users still load the homepage, so `authenticated` keeps the same
-- narrow column set `anon` has — nothing more.
-- ---------------------------------------------------------------------------
revoke select, insert, update, delete on public.platform_settings from authenticated;

grant select (
  id,
  hero_badge_text,
  hero_headline,
  hero_subheadline
) on public.platform_settings to authenticated;
