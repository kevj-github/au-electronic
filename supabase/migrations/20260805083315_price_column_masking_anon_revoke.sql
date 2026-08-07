-- Applied live to project pjkddahrjjqblexxhaef on 2026-08-05.
--
-- Closes the gap 20260801111127_price_column_masking_phase3_revoke.sql left
-- open. That migration revoked column SELECT on harga_satuan/subtotal/jumlah
-- from `authenticated` only, and recorded in its own header that `anon` still
-- held them: harmless while every relevant RLS policy requires a signed-in user
-- (an anon REST call returns []), but one loosened policy away from exposing
-- price data to an unauthenticated caller holding only the public anon key.
--
-- anon had TABLE-level SELECT here — relacl showed `anon=arwdDxtm` (note the
-- `r`) against `authenticated=awdDxtm` with no `r`. A column-level REVOKE does
-- not remove a table-level grant, so this revokes the table grant and re-grants
-- the columns that stay readable, the same shape phase 3 used.
--
-- The re-granted set is exactly what `authenticated` already holds, rather than
-- only dropping the three priced columns. anon holding broader column access
-- than a signed-in user is indefensible, and the difference (catatan_item on
-- item_pesanan; metode/catatan/dibayar_pada/dicatat_oleh on pembayaran) is
-- unreadable to anon regardless, so there was nothing to lose by aligning them.
--
-- The owner-gated views are unaffected: item_pesanan_owner / pembayaran_owner
-- are SECURITY DEFINER and read as their owner, not as the caller.
--
-- Verified against live data immediately after applying:
--   * anon-key REST, the leak this closes:
--       /rest/v1/item_pesanan?select=harga_satuan -> 42501 permission denied
--       /rest/v1/item_pesanan?select=subtotal     -> 42501 permission denied
--       /rest/v1/pembayaran?select=jumlah         -> 42501 permission denied
--   * precisely scoped, not a blanket lockout:
--       /rest/v1/item_pesanan?select=nama_barang  -> []   (RLS, not 42501)
--   * owner reads unaffected: item_pesanan_owner still returns 1975 rows,
--     subtotal sum 724.639.730, in an owner session.
--   * anon and authenticated now hold identical SELECT column sets on both
--     tables.
--
-- Rollback if this ever breaks a call site:
--   grant select on public.item_pesanan to anon;
--   grant select on public.pembayaran to anon;

revoke select on public.item_pesanan from anon;
grant select (
  id, pesanan_id, nama_barang, qty,
  diambil_oleh_helper, dicek_oleh_owner, jumlah_diambil
) on public.item_pesanan to anon;

revoke select on public.pembayaran from anon;
grant select (
  id, pesanan_id
) on public.pembayaran to anon;
