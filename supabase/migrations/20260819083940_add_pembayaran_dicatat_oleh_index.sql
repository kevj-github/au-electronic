-- Covers the pembayaran_dicatat_oleh_fkey foreign key (pembayaran.dicatat_oleh
-- -> users.id), flagged by the Supabase performance advisor
-- (unindexed_foreign_keys). Without it, deletes/updates on users and any
-- query filtering pembayaran by recorder force a sequential scan.
create index pembayaran_dicatat_oleh_idx on public.pembayaran using btree (dicatat_oleh);
