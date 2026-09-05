-- The admin Security tab's checklist was 13 of 14 items hardcoded to
-- status:'pass' — a claim about the codebase's design, never actually
-- verified against the live database. Only "Audit Logging" was real
-- (logs.length > 0). Adds one genuinely live, unambiguous check: which
-- public tables currently have RLS disabled. Empty result = real pass;
-- non-empty = a real, current problem, not a stale assumption.
create or replace function public.admin_security_rls_check()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _missing jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb) into _missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  return jsonb_build_object('tables_without_rls', _missing);
end;
$$;

revoke all on function public.admin_security_rls_check() from public, anon;
grant execute on function public.admin_security_rls_check() to authenticated;
