-- pelanggan_write and pembayaran_write were `for all` policies, which apply
-- to SELECT as well as INSERT/UPDATE/DELETE. That made them permissive
-- duplicates of pelanggan_select/pembayaran_select on every SELECT, flagged
-- by the Supabase performance advisor (multiple_permissive_policies): both
-- policies had to be evaluated on every read. Splitting into per-action
-- policies (mirroring the existing item_pesanan_insert/update/delete split)
-- removes the SELECT overlap. Semantics are unchanged: owner-only write
-- access, identical predicate.

drop policy pelanggan_write on public.pelanggan;

create policy pelanggan_insert on public.pelanggan
  for insert with check (current_user_role() = 'owner');

create policy pelanggan_update on public.pelanggan
  for update using (current_user_role() = 'owner');

create policy pelanggan_delete on public.pelanggan
  for delete using (current_user_role() = 'owner');

drop policy pembayaran_write on public.pembayaran;

create policy pembayaran_insert on public.pembayaran
  for insert with check (current_user_role() = 'owner');

create policy pembayaran_update on public.pembayaran
  for update using (current_user_role() = 'owner');

create policy pembayaran_delete on public.pembayaran
  for delete using (current_user_role() = 'owner');
