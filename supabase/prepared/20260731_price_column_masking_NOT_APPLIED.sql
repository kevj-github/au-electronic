-- ============================================================================
-- PRICE / PAYMENT COLUMN MASKING  —  *** NOT APPLIED ***
-- ============================================================================
--
-- THIS FILE IS DELIBERATELY NOT IN supabase/migrations/. Do not apply it until
-- the app-code reroute below is done, or you WILL break the owner's own price
-- and payment views in production.
--
-- ---------------------------------------------------------------------------
-- The problem it solves
-- ---------------------------------------------------------------------------
-- Postgres RLS restricts ROWS, not COLUMNS. All signed-in users share the one
-- `authenticated` Postgres role; the owner/helper distinction is just a data
-- column. The current policies on item_pesanan and pembayaran are effectively
-- "any authenticated user", so a helper holding the anon key (it ships in the
-- browser bundle) plus their own JWT can call the REST API directly:
--
--   GET /rest/v1/item_pesanan?select=harga_satuan,subtotal
--   GET /rest/v1/pembayaran?select=jumlah
--
-- ...and read margin and payment data for EVERY order. The app-layer defence
-- (not selecting price columns for helpers in Server Components, so they never
-- enter the RSC payload) is real and worth keeping, but it only protects the
-- app's own rendering path — it does nothing about a direct REST call.
--
-- ---------------------------------------------------------------------------
-- REQUIRED APP-CODE REROUTE — do this FIRST
-- ---------------------------------------------------------------------------
-- The REVOKE below removes SELECT on the price columns from `authenticated`.
-- Every read of those columns that runs under the CALLER'S session — which is
-- the owner's session too, since the owner is also just `authenticated` —
-- starts failing with "permission denied for column". These call sites must be
-- rerouted to the SECURITY DEFINER views (or an owner-gated RPC) first:
--
--   1. src/app/(app)/pesanan/[id]/page.tsx
--      Owner branch selects `harga_satuan, subtotal` via item_pesanan and
--      `pembayaran(*)`. -> read from item_pesanan_owner / pembayaran_owner.
--
--   2. src/app/(app)/pesanan/actions.ts  ->  getInvoiceData()
--      Fetches the full priced order under the caller's session after
--      requireOwner(). -> same reroute.
--
--   3. src/app/(app)/pesanan/page.tsx
--      Owner branch selects items:item_pesanan(subtotal) and pembayaran(jumlah)
--      for the list totals. -> same reroute.
--
--   4. src/app/(app)/dashboard/page.tsx
--      Aggregates subtotal / pembayaran for the revenue figures.
--
--   5. src/app/(app)/pesanan/actions.ts  ->  updateItemHarga()
--      WRITES harga_satuan. Writes keep working through the INSTEAD OF triggers
--      below, but re-verify after applying.
--
-- Note `subtotal` is a GENERATED column (qty * harga_satuan); the view must
-- expose it read-only and the INSTEAD OF triggers must never try to write it.
--
-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
--   grant select (harga_satuan, subtotal) on public.item_pesanan to authenticated;
--   grant select (jumlah) on public.pembayaran to authenticated;
--   drop view if exists public.item_pesanan_owner, public.pembayaran_owner cascade;
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Revoke column-level SELECT on the sensitive columns.
--    Column-level GRANTs require re-granting the columns that stay readable,
--    so spell out the full allowed set explicitly.
-- ---------------------------------------------------------------------------
revoke select on public.item_pesanan from authenticated;
grant select (
  id, pesanan_id, nama_barang, qty,
  diambil_oleh_helper, dicek_oleh_owner, jumlah_diambil
) on public.item_pesanan to authenticated;

revoke select on public.pembayaran from authenticated;
-- Helpers get nothing useful from pembayaran; keep only the keys so existence
-- checks still work. Adjust if a non-price column is added later.
grant select (id, pesanan_id) on public.pembayaran to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Owner-only SECURITY DEFINER views exposing the masked columns.
--    security_invoker = off (the default for these) means the view runs as its
--    owner, bypassing the column revoke — so the view itself MUST re-check the
--    caller's role. Without that check the view would hand prices to helpers.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3. INSTEAD OF triggers so existing write paths keep working through the view.
--    subtotal is generated and must never be written.
-- ---------------------------------------------------------------------------
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
       set nama_barang     = new.nama_barang,
           qty             = new.qty,
           harga_satuan    = new.harga_satuan,
           jumlah_diambil  = new.jumlah_diambil,
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

create trigger item_pesanan_owner_write_trg
  instead of insert or update or delete on public.item_pesanan_owner
  for each row execute function public.item_pesanan_owner_write();

revoke execute on function public.item_pesanan_owner_write() from anon, authenticated, public;

commit;
