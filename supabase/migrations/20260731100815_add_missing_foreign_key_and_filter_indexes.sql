-- APPLIED LIVE 2026-07-31.
--
-- The schema had no indexes at all beyond primary keys and the implicit
-- unique index on pesanan.kode_pesanan. Postgres does not auto-index foreign
-- keys, so PostgREST embeds (items:item_pesanan(...), pembayaran(...)) resolved
-- via `... where pesanan_id in (...)` were sequential scans, as were the
-- dashboard's status/created_at filters and the pelanggan_id updates run by
-- deletePelanggan / clearAllPelanggan.

-- Foreign keys used by every order-detail and list embed.
create index if not exists item_pesanan_pesanan_id_idx on public.item_pesanan (pesanan_id);
create index if not exists pembayaran_pesanan_id_idx on public.pembayaran (pesanan_id);
create index if not exists pesanan_pelanggan_id_idx on public.pesanan (pelanggan_id);
create index if not exists pesanan_dibuat_oleh_idx on public.pesanan (dibuat_oleh);

-- The pesanan list and dashboard filter by status and order by created_at desc.
create index if not exists pesanan_status_created_at_idx on public.pesanan (status, created_at desc);
