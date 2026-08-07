-- Applied live to project pjkddahrjjqblexxhaef on 2026-08-05.
--
-- Returns the price-masking / realtime invariants as data, so `npm run test:db`
-- (scripts/db-security.test.ts) can assert them instead of relying on curl
-- commands pasted into migration comments. That reliance is why the `anon`
-- column grant survived unnoticed from 2026-08-01 to 2026-08-05.
--
-- SECURITY DEFINER because the catalog views only reveal grants involving roles
-- the caller is a member of; running as the owner is what makes anon's grants
-- visible at all. EXECUTE is revoked from anon and authenticated and held by
-- service_role only, so the posture is not itself readable by the roles it
-- describes. Verified: an anon-key call returns 42501.
--
-- Column grants and the table grant are BOTH reported. A NULL pg_attribute.attacl
-- means the column inherits the table-level grant, so checking only column ACLs
-- would report a masked column as safe while `anon=arwdDxtm` on the table still
-- exposed it — precisely the hole this is meant to catch.
--
-- Detection verified inside rolled-back transactions, so the checks are known to
-- have teeth rather than merely being green:
--   grant select (harga_satuan) on item_pesanan to anon
--     -> priced_column_grants: [{item_pesanan, harga_satuan, anon}]
--   grant select on pembayaran to authenticated
--     -> table_select_grants:  [{pembayaran, authenticated}]

create or replace function public.security_posture()
returns jsonb
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select jsonb_build_object(

    -- Explicit per-column SELECT grants on priced columns. Expected: [].
    'priced_column_grants', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'table', c.relname, 'column', att.attname,
               'grantee', a.grantee::regrole::text)
             order by c.relname, att.attname, a.grantee::regrole::text), '[]'::jsonb)
        from pg_class c
        join pg_namespace n   on n.oid = c.relnamespace
        join pg_attribute att on att.attrelid = c.oid
        cross join lateral aclexplode(att.attacl) a
       where n.nspname = 'public'
         and ((c.relname = 'item_pesanan' and att.attname in ('harga_satuan','subtotal'))
           or (c.relname = 'pembayaran'   and att.attname = 'jumlah'))
         and a.privilege_type = 'SELECT'
         and a.grantee::regrole::text in ('anon','authenticated')
    ),

    -- Table-level SELECT, which would override any column masking. Expected: [].
    'table_select_grants', (
      select coalesce(jsonb_agg(distinct jsonb_build_object(
               'table', c.relname, 'grantee', a.grantee::regrole::text)), '[]'::jsonb)
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        cross join lateral aclexplode(c.relacl) a
       where n.nspname = 'public'
         and c.relname in ('item_pesanan','pembayaran')
         and a.privilege_type = 'SELECT'
         and a.grantee::regrole::text in ('anon','authenticated')
    ),

    -- The owner views must re-check the role themselves: they bypass RLS, so
    -- the predicate is the only thing standing between a helper and prices.
    'owner_views', (
      select coalesce(jsonb_object_agg(c.relname, jsonb_build_object(
               'rechecks_owner',
                 pg_get_viewdef(c.oid, true) like '%current_user_role() = ''owner''%',
               'security_invoker',
                 coalesce(array_to_string(c.reloptions,',') like '%security_invoker=true%', false)
             )), '{}'::jsonb)
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relname in ('item_pesanan_owner','pembayaran_owner')
    ),

    -- item_pesanan and pembayaran must NEVER be published: their WAL images
    -- carry price data that would reach helpers over the websocket.
    'realtime_tables', (
      select coalesce(jsonb_agg(tablename order by tablename), '[]'::jsonb)
        from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public'
    )
  );
$$;

revoke execute on function public.security_posture() from public, anon, authenticated;
grant execute on function public.security_posture() to service_role;
