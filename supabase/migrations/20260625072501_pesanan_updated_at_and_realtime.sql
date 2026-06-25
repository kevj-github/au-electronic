-- 1. Add updated_at to pesanan, defaulting existing rows to created_at.
alter table public.pesanan add column updated_at timestamptz not null default now();

-- The pesanan_write_guard trigger rejects updates to non-draft pesanan from
-- a non-owner session; migrations run without a real auth session, so the
-- backfill below must run with that guard disabled (same pattern as the
-- existing kode_pesanan backfill in this codebase).
alter table public.pesanan disable trigger pesanan_write_guard;
update public.pesanan set updated_at = created_at;
alter table public.pesanan enable trigger pesanan_write_guard;

-- 2. Bump updated_at on any direct edit to pesanan itself.
create or replace function public.set_pesanan_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger pesanan_set_updated_at
before update on public.pesanan
for each row
execute function public.set_pesanan_updated_at();

-- 3. Cascade item_pesanan changes into the parent pesanan's updated_at.
create or replace function public.bump_pesanan_updated_at_from_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pesanan
  set updated_at = now()
  where id = coalesce(new.pesanan_id, old.pesanan_id);
  return coalesce(new, old);
end;
$$;

create trigger item_pesanan_bump_pesanan
after insert or update or delete on public.item_pesanan
for each row
execute function public.bump_pesanan_updated_at_from_item();

-- 4. Cascade pembayaran changes into the parent pesanan's updated_at.
create or replace function public.bump_pesanan_updated_at_from_pembayaran()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pesanan
  set updated_at = now()
  where id = coalesce(new.pesanan_id, old.pesanan_id);
  return coalesce(new, old);
end;
$$;

create trigger pembayaran_bump_pesanan
after insert or update or delete on public.pembayaran
for each row
execute function public.bump_pesanan_updated_at_from_pembayaran();

-- 5. Enable Realtime for the tables the client will subscribe to.
alter publication supabase_realtime add table public.pesanan, public.pelanggan, public.users;
