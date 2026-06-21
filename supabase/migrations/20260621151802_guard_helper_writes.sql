-- RLS policies alone can't compare OLD vs NEW row values, so a helper holding
-- the anon key could call supabase-js directly (bypassing actions.ts) to:
--   - move their own pesanan past 'draft' or reassign it to another user
--   - set arbitrary harga_satuan/diskon on item_pesanan
-- These triggers close that gap; owners are unaffected.

create or replace function public.guard_pesanan_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() = 'owner' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.dibuat_oleh := auth.uid();
    new.status := 'draft';
    return new;
  end if;

  if old.dibuat_oleh <> auth.uid() then
    raise exception 'Tidak diizinkan mengubah pesanan ini.';
  end if;

  if old.status <> 'draft' or new.status <> 'draft' then
    raise exception 'Pesanan yang sudah diproses hanya bisa diubah oleh pemilik.';
  end if;

  new.dibuat_oleh := old.dibuat_oleh;
  new.kode_pesanan := old.kode_pesanan;
  new.tipe_dokumen := old.tipe_dokumen;

  return new;
end;
$$;

create trigger pesanan_write_guard
  before insert or update on public.pesanan
  for each row
  execute function public.guard_pesanan_write();

create or replace function public.guard_item_pesanan_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_harga_dasar numeric;
begin
  if public.current_user_role() = 'owner' then
    return new;
  end if;

  select dibuat_oleh, status into v_order
  from public.pesanan where id = new.pesanan_id;

  if v_order.dibuat_oleh is distinct from auth.uid() then
    raise exception 'Tidak diizinkan mengubah item pesanan ini.';
  end if;

  if v_order.status <> 'draft' then
    raise exception 'Item pesanan yang sudah diproses hanya bisa diubah oleh pemilik.';
  end if;

  select harga_dasar into v_harga_dasar from public.produk where id = new.produk_id;
  if v_harga_dasar is null then
    raise exception 'Produk tidak ditemukan.';
  end if;

  new.harga_satuan := v_harga_dasar;
  new.diskon := 0;

  return new;
end;
$$;

create trigger item_pesanan_write_guard
  before insert or update on public.item_pesanan
  for each row
  execute function public.guard_item_pesanan_write();

-- Belt-and-suspenders: a discount larger than the line total should never be possible.
alter table public.item_pesanan
  add constraint item_pesanan_diskon_max check (diskon <= qty * harga_satuan);
