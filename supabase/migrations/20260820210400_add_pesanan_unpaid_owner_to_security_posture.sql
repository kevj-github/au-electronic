-- security_posture()'s owner_views clause hardcoded exactly two view names
-- (item_pesanan_owner, pembayaran_owner). pesanan_unpaid_owner
-- (20260802045800_add_dashboard_summary_and_unpaid_view.sql) is a third view
-- with the identical shape — SECURITY DEFINER, bypasses RLS, re-checks
-- current_user_role() = 'owner' in its own predicate because it aggregates
-- item_pesanan.subtotal and pembayaran.jumlah, both masked from
-- `authenticated`. It was added three days before security_posture() and was
-- never folded in, so npm run test:db has never asserted that this view still
-- gates on owner or still runs as its creator. Widen the view list so a
-- future edit that drops the role check or flips security_invoker is caught
-- the same way it would be for the other two.

create or replace function public.security_posture()
returns jsonb
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select jsonb_build_object(

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
         and c.relname in ('item_pesanan_owner','pembayaran_owner','pesanan_unpaid_owner')
    ),

    'realtime_tables', (
      select coalesce(jsonb_agg(tablename order by tablename), '[]'::jsonb)
        from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public'
    )
  );
$$;
