-- Applied live to project pjkddahrjjqblexxhaef on 2026-08-01.
--
-- PHASE 1 of price/payment column masking. See
-- supabase/prepared/20260731_price_column_masking_NOT_APPLIED.sql for the full
-- rationale, the threat model and the remaining phase 3.
--
-- Additive only: creates the owner-gated views and their INSTEAD OF write
-- triggers. The REVOKE that actually masks the columns is PHASE 3 and is
-- deliberately NOT included here, so this migration cannot break any existing
-- call site. Phase 2 (rerouting the owner reads in app code onto these views)
-- ships in the same commit as this file.
--
-- On the two `security_definer_view` ERROR advisories this raises: they are
-- intentional. The views must run as their owner (security_invoker off) so they
-- can read the columns phase 3 revokes from `authenticated` — `security_invoker
-- = true` would subject them to the same revoke and defeat the purpose. Because
-- that also bypasses RLS on the base table, each view re-checks the caller's
-- role itself via the current_user_role() = 'owner' predicate. Verified against
-- live data: an owner session sees all 1458 item rows through
-- item_pesanan_owner (identical to the base table), a helper session sees 0.

create or replace view public.item_pesanan_owner as
  select i.id, i.pesanan_id, i.nama_barang, i.qty,
         i.harga_satuan, i.subtotal,
         i.diambil_oleh_helper, i.dicek_oleh_owner, i.jumlah_diambil
  from public.item_pesanan i
  where public.current_user_role() = 'owner';

create or replace view public.pembayaran_owner as
  select p.*
  from public.pembayaran p
  where public.current_user_role() = 'owner';

grant select on public.item_pesanan_owner to authenticated;
grant select on public.pembayaran_owner to authenticated;

-- subtotal is a generated column (qty * harga_satuan) and must never be written.
create or replace function public.item_pesanan_owner_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'owner' then
    raise exception 'Hanya owner yang dapat mengubah data harga.';
  end if;

  if tg_op = 'INSERT' then
    insert into public.item_pesanan
      (pesanan_id, nama_barang, qty, harga_satuan, jumlah_diambil, dicek_oleh_owner)
    values
      (new.pesanan_id, new.nama_barang, new.qty, new.harga_satuan,
       coalesce(new.jumlah_diambil, 0), coalesce(new.dicek_oleh_owner, false))
    returning id into new.id;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    update public.item_pesanan
       set nama_barang      = new.nama_barang,
           qty              = new.qty,
           harga_satuan     = new.harga_satuan,
           jumlah_diambil   = new.jumlah_diambil,
           dicek_oleh_owner = new.dicek_oleh_owner
     where id = old.id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    delete from public.item_pesanan where id = old.id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists item_pesanan_owner_write_trg on public.item_pesanan_owner;

create trigger item_pesanan_owner_write_trg
  instead of insert or update or delete on public.item_pesanan_owner
  for each row execute function public.item_pesanan_owner_write();

revoke execute on function public.item_pesanan_owner_write() from anon, authenticated, public;
