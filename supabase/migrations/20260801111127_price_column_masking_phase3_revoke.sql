-- Applied live to project pjkddahrjjqblexxhaef on 2026-08-01.
--
-- PHASE 3 (final) of price/payment column masking — section 1 of
-- supabase/prepared/20260731_price_column_masking_APPLIED.sql, verbatim.
-- This is the step that actually closes the leak: before it, any signed-in
-- helper could read harga_satuan/subtotal for every order with a direct REST
-- call, because RLS restricts rows but not columns and all signed-in users
-- share the one `authenticated` Postgres role.
--
-- Ordering that made this safe (all three confirmed before applying):
--   phase 1  20260801104617_add_owner_price_views_phase1.sql  (views live)
--   phase 2  commit 79ac2f9, owner reads rerouted onto those views
--   phase 2  DEPLOYED to production (Vercel production deployment for 79ac2f9
--            reported success) — the revoke breaks the owner's own reads if it
--            lands before the reroute is serving traffic.
--
-- Column-level GRANTs require re-granting the columns that stay readable, so
-- the allowed set is spelled out explicitly. `catatan_item` is deliberately
-- omitted: it is written (always null) but never read by any select — verified
-- across the app before applying. If a read of it is ever added, grant it here.
--
-- Note this section revokes from `authenticated` only. `anon` still holds
-- column SELECT on harga_satuan/subtotal/jumlah. That leaks nothing today
-- because every relevant RLS policy requires a signed-in user, so an anon REST
-- call returns [] (verified) — but it is latent debt: loosening any of those
-- policies would immediately expose the columns. Left as-is deliberately,
-- since section 1 as written does not cover it.
--
-- Rollback if this ever breaks a call site:
--   grant select (harga_satuan, subtotal) on public.item_pesanan to authenticated;
--   grant select (jumlah) on public.pembayaran to authenticated;

revoke select on public.item_pesanan from authenticated;
grant select (
  id, pesanan_id, nama_barang, qty,
  diambil_oleh_helper, dicek_oleh_owner, jumlah_diambil
) on public.item_pesanan to authenticated;

revoke select on public.pembayaran from authenticated;
-- Helpers get nothing useful from pembayaran; keep only the keys so existence
-- checks still work (payment-actions.ts selects pesanan_id).
grant select (id, pesanan_id) on public.pembayaran to authenticated;
