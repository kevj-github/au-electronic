-- Lets owners add a line item for a product that isn't in the catalog yet,
-- by typing a free-text name instead of picking a produk_id. Helpers cannot
-- use this path since there's no harga_dasar to lock pricing against.
alter table public.item_pesanan
  alter column produk_id drop not null,
  add column nama_custom text;

alter table public.item_pesanan
  add constraint item_pesanan_produk_xor_custom
  check ((produk_id is not null) <> (nama_custom is not null));

create or replace function public.guard_item_pesanan_write()
returns trigger language plpgsql security definer set search_path = public as $$
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

  if new.produk_id is null then
    raise exception 'Hanya pemilik yang dapat menambahkan produk di luar katalog.';
  end if;

  select harga_dasar into v_harga_dasar from public.produk where id = new.produk_id;
  if v_harga_dasar is null then
    raise exception 'Produk tidak ditemukan.';
  end if;

  new.harga_satuan := v_harga_dasar;
  new.diskon := 0;
  new.nama_custom := null;

  return new;
end;
$$;
