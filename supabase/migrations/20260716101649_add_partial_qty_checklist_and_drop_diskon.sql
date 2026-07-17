-- Helper checklist gets a partial-quantity input instead of a plain on/off box.
-- jumlah_diambil holds however much of the ordered qty has been taken; diambil_oleh_helper
-- becomes a generated column so it can never drift out of sync with jumlah_diambil (checked
-- iff the full ordered quantity has been taken).
alter table public.item_pesanan
  add column jumlah_diambil numeric not null default 0;

-- Migrations run without a real authenticated session, so guard_item_pesanan_write
-- (which blocks writes on selesai/dibatalkan orders) would reject this backfill.
alter table public.item_pesanan disable trigger item_pesanan_write_guard;
update public.item_pesanan set jumlah_diambil = qty where diambil_oleh_helper = true;
alter table public.item_pesanan enable trigger item_pesanan_write_guard;

alter table public.item_pesanan
  add constraint item_pesanan_jumlah_diambil_range check (jumlah_diambil >= 0 and jumlah_diambil <= qty);

alter table public.item_pesanan drop column diambil_oleh_helper;

alter table public.item_pesanan
  add column diambil_oleh_helper boolean generated always as (jumlah_diambil >= qty and qty > 0) stored;

-- Discount is being removed entirely (no historical rows use it — verified sum(diskon) = 0).
-- subtotal is a generated column referencing diskon, so it must be dropped and rebuilt.
alter table public.item_pesanan drop column subtotal;
alter table public.item_pesanan drop constraint item_pesanan_diskon_check;
alter table public.item_pesanan drop constraint item_pesanan_diskon_max;
alter table public.item_pesanan drop column diskon;
alter table public.item_pesanan
  add column subtotal numeric generated always as (qty * harga_satuan) stored;

-- guard_item_pesanan_write: drop diskon handling, clamp jumlah_diambil to qty on every
-- write (covers owner-driven qty edits too, since the clamp runs before the owner
-- short-circuit that otherwise skips the rest of this function for owners).
create or replace function public.guard_item_pesanan_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if new.jumlah_diambil > new.qty then
    new.jumlah_diambil := new.qty;
  end if;
  if new.jumlah_diambil < 0 then
    new.jumlah_diambil := 0;
  end if;

  if public.current_user_role() = 'owner' then
    return new;
  end if;

  select status into v_status from public.pesanan where id = new.pesanan_id;

  if v_status in ('selesai', 'dibatalkan') then
    raise exception 'Pesanan yang sudah selesai atau dibatalkan tidak bisa diubah.';
  end if;

  if tg_op = 'INSERT' then
    new.harga_satuan := 0;
    return new;
  end if;

  -- UPDATE: revert owner-only fields
  new.harga_satuan     := old.harga_satuan;
  new.dicek_oleh_owner := old.dicek_oleh_owner;
  new.pesanan_id       := old.pesanan_id;

  return new;
end;
$$;
