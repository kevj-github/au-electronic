-- Helper "pengambilan dari etalase" checklist, plus a separate owner double-check
-- checklist over the same items. Both are plain booleans on item_pesanan since
-- the checklist is tracked per order line, matching the existing one-row-per-line model.
alter table public.item_pesanan
  add column diambil_oleh_helper boolean not null default false,
  add column dicek_oleh_owner boolean not null default false;

-- Previously item_pesanan_write (FOR ALL) restricted every write — insert, update,
-- delete — to the order's creator or the owner. The checklist needs any authenticated
-- helper to be able to tick items on ANY order (not just ones they created), so UPDATE
-- is opened up to all authenticated users; guard_item_pesanan_write below is the real
-- gatekeeper that limits what a non-owner/non-creator update is allowed to change.
drop policy "item_pesanan_write" on public.item_pesanan;

create policy "item_pesanan_insert" on public.item_pesanan
  for insert with check (
    exists (
      select 1 from public.pesanan p
      where p.id = pesanan_id
        and (p.dibuat_oleh = auth.uid() or current_user_role() = 'owner')
    )
  );

create policy "item_pesanan_update" on public.item_pesanan
  for update using (current_user_role() is not null);

create policy "item_pesanan_delete" on public.item_pesanan
  for delete using (
    exists (
      select 1 from public.pesanan p
      where p.id = pesanan_id
        and (p.dibuat_oleh = auth.uid() or current_user_role() = 'owner')
    )
  );

create or replace function public.guard_item_pesanan_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  if public.current_user_role() = 'owner' then
    return new;
  end if;

  select dibuat_oleh, status into v_order
  from public.pesanan where id = new.pesanan_id;

  if tg_op = 'INSERT' then
    if v_order.dibuat_oleh is distinct from auth.uid() then
      raise exception 'Tidak diizinkan mengubah item pesanan ini.';
    end if;
    if v_order.status <> 'draft' then
      raise exception 'Item pesanan yang sudah diproses hanya bisa diubah oleh pemilik.';
    end if;
    new.harga_satuan := 0;
    new.diskon := 0;
    return new;
  end if;

  -- UPDATE. The owner's double-check column is never settable by a non-owner.
  new.dicek_oleh_owner := old.dicek_oleh_owner;

  if v_order.dibuat_oleh is distinct from auth.uid() or v_order.status <> 'draft' then
    -- Not their own draft order — only the "diambil dari etalase" checklist
    -- toggle is allowed here; revert every other column to its old value.
    new.pesanan_id := old.pesanan_id;
    new.nama_barang := old.nama_barang;
    new.qty := old.qty;
    new.harga_satuan := old.harga_satuan;
    new.diskon := old.diskon;
    new.catatan_item := old.catatan_item;
    return new;
  end if;

  -- Own draft order: unchanged behavior — price stays locked to 0 for non-owners.
  new.harga_satuan := 0;
  new.diskon := 0;

  return new;
end;
$$;
