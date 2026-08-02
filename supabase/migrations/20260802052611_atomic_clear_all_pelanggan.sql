-- Applied live to project pjkddahrjjqblexxhaef on 2026-08-02.
--
-- Atomic replacement for the clearAllPelanggan Server Action.
--
-- The action did this in three steps from the app: SELECT every pelanggan, then
-- one UPDATE per pelanggan to copy its name onto the linked orders, then DELETE
-- all pelanggan. Three problems:
--
--   1. The SELECT was unbounded, and PostgREST silently caps a result set at
--      1000 rows. Past 1000 customers only the first 1000 get their name copied.
--   2. Because pesanan.pelanggan_id is a plain FK with no ON DELETE clause
--      (NO ACTION), the final DELETE then fails with a foreign-key violation —
--      but the name-copying UPDATEs have already committed. The result is a
--      half-done destructive operation: ~1000 orders detached from their
--      customer while every customer row still exists. Loud, not silent, but
--      not recoverable by retrying either, since the names are already moved.
--   3. It issued one round-trip per customer.
--
-- Doing both statements inside one function makes them a single transaction, so
-- it either fully succeeds or fully rolls back. No row cap applies to SQL-side
-- statements, and it is one round-trip.
--
-- SECURITY INVOKER on purpose: pelanggan_write already restricts writes to the
-- owner and guard_pesanan_write lets owners through, so RLS is a sufficient
-- boundary here and there is no reason to bypass it. The explicit role check is
-- defence in depth and gives a clear Indonesian error instead of an empty result.
--
-- Verified against live data inside a rolled-back transaction: as owner it
-- deleted all 53 pelanggan and left all 78 orders carrying their customer name
-- (nama_pelanggan went 0 -> 78, pelanggan_id 78 -> 0); a helper session is
-- rejected with the raised exception.

create or replace function public.clear_all_pelanggan()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if public.current_user_role() <> 'owner' then
    raise exception 'Hanya owner yang dapat menghapus semua pelanggan.';
  end if;

  -- Preserve the customer name on every linked order before cutting the link,
  -- so historical orders keep showing who they were for.
  update public.pesanan p
     set pelanggan_id   = null,
         nama_pelanggan = pl.nama
    from public.pelanggan pl
   where p.pelanggan_id = pl.id;

  delete from public.pelanggan;
  get diagnostics deleted_count = row_count;

  return deleted_count;
end;
$$;

revoke execute on function public.clear_all_pelanggan() from public, anon;
grant execute on function public.clear_all_pelanggan() to authenticated;
