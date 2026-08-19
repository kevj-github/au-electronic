-- Wrap auth.uid() calls in RLS policies with (select ...) so the planner
-- evaluates them once per statement instead of once per row (initplan
-- caching). Purely a performance change: predicate semantics are identical.
-- Flagged by the Supabase performance advisor (auth_rls_initplan).

alter policy pelanggan_select on public.pelanggan
  using ((select auth.uid()) is not null);

alter policy pesanan_insert on public.pesanan
  with check (dibuat_oleh = (select auth.uid()));

alter policy pesanan_update on public.pesanan
  using ((dibuat_oleh = (select auth.uid())) or (current_user_role() = 'owner'::text));

alter policy pembayaran_select on public.pembayaran
  using (exists (
    select 1
    from pesanan p
    where p.id = pembayaran.pesanan_id
      and (p.dibuat_oleh = (select auth.uid()) or current_user_role() = 'owner'::text)
  ));

alter policy users_select on public.users
  using ((id = (select auth.uid())) or (current_user_role() = 'owner'::text));
