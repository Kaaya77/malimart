-- RLS / privilege invariants for the `public` schema.
--
-- Run against any environment; raises with a full violation list, or reports
-- 'RLS INVARIANTS OK'. Read-only — it inspects catalogs and never writes.
--
--   supabase db execute --file supabase/tests/rls_invariants.sql
--   psql "$SUPABASE_DB_URL" -f supabase/tests/rls_invariants.sql
--
-- Exists because of the 2026-09-02 incident: `public_profiles` was a
-- SECURITY DEFINER, auto-updatable view with the default ACL's write grants
-- still attached, which let anonymous callers UPDATE `profiles.role` to
-- 'admin' with RLS bypassed. Invariant 1 is the direct regression test.
do $$
declare
  v text;
  problems text[] := '{}';
begin
  -- 1. VIEWS: no RLS of their own + SECURITY DEFINER by default, so a write
  --    grant on a view is a direct RLS bypass on its base table.
  for v in
    select format('view %I grants %s to %s', c.relname, g.privilege_type, g.grantee)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join information_schema.role_table_grants g
      on g.table_schema = n.nspname and g.table_name = c.relname
    where n.nspname = 'public'
      and c.relkind in ('v','m')
      and g.grantee in ('anon','authenticated')
      and g.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
  loop problems := problems || v; end loop;

  -- 2. TABLES: RLS is the only boundary, so it must actually be on.
  for v in
    select format('table %I has RLS disabled', c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p')
      and not c.relrowsecurity
      and exists (
        select 1 from information_schema.role_table_grants g
        where g.table_schema='public' and g.table_name=c.relname
          and g.grantee in ('anon','authenticated'))
  loop problems := problems || v; end loop;

  -- 3. RLS enabled but zero policies = deny-all, which silently breaks
  --    features rather than protecting them. Usually an unfinished migration.
  for v in
    select format('table %I has RLS on but no policies', c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity
      and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
      and exists (
        select 1 from information_schema.role_table_grants g
        where g.table_schema='public' and g.table_name=c.relname
          and g.grantee in ('anon','authenticated'))
  loop problems := problems || v; end loop;

  -- 4. Trigger functions are not RPCs. NOTE: these are usually granted to
  --    PUBLIC, not to anon/authenticated directly, so this checks effective
  --    privilege (has_function_privilege) rather than the ACL entries.
  for v in
    select format('trigger function %s is EXECUTE-able by %s', p.oid::regprocedure, r)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral (values ('anon'),('authenticated')) as roles(r)
    where n.nspname='public'
      and p.prorettype = 'pg_catalog.trigger'::regtype
      and has_function_privilege(roles.r, p.oid, 'EXECUTE')
  loop problems := problems || v; end loop;

  -- 5. The GraphQL endpoint is a second data path that bypasses every
  --    convention in this repo. The app does not use it.
  if exists (select 1 from pg_extension where extname='pg_graphql') then
    problems := problems || 'pg_graphql is installed - /graphql/v1 exposes public schema outside PostgREST review';
  end if;

  if array_length(problems, 1) > 0 then
    raise exception E'RLS INVARIANT VIOLATIONS (%):\n  - %',
      array_length(problems,1), array_to_string(problems, E'\n  - ');
  end if;

  raise notice 'RLS INVARIANTS OK';
end $$;

-- ---------------------------------------------------------------------------
-- SELF-TEST: an invariant that can only ever pass is worthless. This
-- reintroduces the exact 2026-09-02 bug inside a subtransaction, confirms
-- invariant 1 detects it, and rolls the grant back.
--
-- The GRANT is inside a BEGIN/EXCEPTION block, which is a subtransaction, so
-- it is ALWAYS rolled back — including if this file is interrupted. PL/pgSQL
-- variables survive the rollback, so `detected` still carries the result.
-- ---------------------------------------------------------------------------
do $$
declare detected boolean := false;
begin
  begin
    grant update on public.public_profiles to anon;

    select exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join information_schema.role_table_grants g
        on g.table_schema = n.nspname and g.table_name = c.relname
      where n.nspname='public' and c.relkind in ('v','m')
        and g.grantee in ('anon','authenticated')
        and g.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
    ) into detected;

    raise exception 'rollback_self_test';
  exception when others then
    null;  -- discards the GRANT
  end;

  if not detected then
    raise exception 'SELF-TEST FAILED: invariant 1 did not detect a known-bad view grant. The check is broken.';
  end if;

  raise notice 'RLS invariant self-test passed';
end $$;
