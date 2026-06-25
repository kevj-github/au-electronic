
-- 1. Helpers can now see all pesanan/item_pesanan (read-only visibility), not just their own.
--    Mutation rights (insert/update) stay scoped to the creator or owner, unchanged.
drop policy "pesanan_select" on public.pesanan;
create policy "pesanan_select" on public.pesanan
  for select using (current_user_role() is not null);

drop policy "item_pesanan_select" on public.item_pesanan;
create policy "item_pesanan_select" on public.item_pesanan
  for select using (current_user_role() is not null);

-- 2. Remove the product catalog entirely. Backfill nama_barang from produk.nama for
--    any existing catalog-linked items before dropping produk_id/the produk table.
--    Disable the write-guard trigger for this migration-only backfill UPDATE since it
--    checks auth.uid()/ownership, which has no meaning in a migration's session.
alter table public.item_pesanan disable trigger item_pesanan_write_guard;

alter table public.item_pesanan drop constraint if exists item_pesanan_produk_xor_custom;
alter table public.item_pesanan rename column nama_custom to nama_barang;

update public.item_pesanan ip
set nama_barang = p.nama
from public.produk p
where ip.produk_id = p.id and ip.nama_barang is null;

alter table public.item_pesanan
  drop column produk_id,
  alter column nama_barang set not null;

alter table public.item_pesanan enable trigger item_pesanan_write_guard;

drop table public.produk cascade;

-- 3. Drop the invoice/nota document-type distinction — one unified document format now.
alter table public.pesanan drop column tipe_dokumen;

-- 4. Redesign the sequence table for AU.YYYY.MM.NNNNN numbering (resets monthly).
drop policy "sequence_all" on public.pesanan_sequence;
alter table public.pesanan_sequence drop constraint pesanan_sequence_pkey;
alter table public.pesanan_sequence drop column tipe;
delete from public.pesanan_sequence;
alter table public.pesanan_sequence add column bulan int not null;
alter table public.pesanan_sequence add constraint pesanan_sequence_pkey primary key (tahun, bulan);
create policy "sequence_all" on public.pesanan_sequence
  for all using (current_user_role() = 'owner');

drop function if exists public.next_kode_pesanan(text);

create function public.next_kode_pesanan()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tahun int := extract(year from now());
  v_bulan int := extract(month from now());
  v_urutan int;
begin
  insert into public.pesanan_sequence (tahun, bulan, urutan)
  values (v_tahun, v_bulan, 1)
  on conflict (tahun, bulan) do update set urutan = public.pesanan_sequence.urutan + 1
  returning urutan into v_urutan;

  return 'AU.' || v_tahun || '.' || lpad(v_bulan::text, 2, '0') || '.' || lpad(v_urutan::text, 5, '0');
end;
$$;

grant execute on function public.next_kode_pesanan() to authenticated;
revoke execute on function public.next_kode_pesanan() from anon, public;

-- 5. guard_pesanan_write: drop the now-removed tipe_dokumen lockdown line.
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

  return new;
end;
$$;

-- 6. guard_item_pesanan_write: no more catalog to price against. Helpers can name
--    an item and set qty, but price/discount are forced to 0 — only an owner
--    (who short-circuits above) can set the real price afterward.
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

  if v_order.dibuat_oleh is distinct from auth.uid() then
    raise exception 'Tidak diizinkan mengubah item pesanan ini.';
  end if;

  if v_order.status <> 'draft' then
    raise exception 'Item pesanan yang sudah diproses hanya bisa diubah oleh pemilik.';
  end if;

  new.harga_satuan := 0;
  new.diskon := 0;

  return new;
end;
$$;
