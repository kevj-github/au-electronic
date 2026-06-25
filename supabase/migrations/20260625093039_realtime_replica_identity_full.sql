-- Realtime's postgres_changes evaluates each subscriber's RLS policy against
-- the WAL row image. With the default replica identity (primary key only),
-- Postgres doesn't include enough of the row in the WAL for that RLS check,
-- so UPDATE/DELETE change events are silently dropped for RLS-protected
-- tables even though the client's subscription reports SUBSCRIBED.
alter table public.pesanan replica identity full;
alter table public.pelanggan replica identity full;
alter table public.users replica identity full;
