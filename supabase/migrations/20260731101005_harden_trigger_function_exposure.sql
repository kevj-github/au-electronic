-- APPLIED LIVE 2026-07-31. Clears two Supabase security-advisor warnings.
--
-- 1. set_pesanan_updated_at had no pinned search_path (advisor
--    function_search_path_mutable). Pin it like every other function here.
alter function public.set_pesanan_updated_at() set search_path = public;

-- 2. Trigger functions were reachable as RPC endpoints (/rest/v1/rpc/<name>)
--    by anon and authenticated. Firing a trigger does NOT require EXECUTE on
--    its function, so revoking is safe and removes the exposed surface.
--    Verified after applying: an item_pesanan UPDATE on an active pesanan still
--    fires guard_item_pesanan_write and cascades through
--    bump_pesanan_updated_at_from_item into guard_pesanan_write at depth > 1.
--
--    current_user_role() is deliberately NOT revoked: RLS policy expressions
--    are evaluated as the querying role, so anon/authenticated must retain
--    EXECUTE on it or every policy that calls it starts failing.
revoke execute on function public.set_pesanan_updated_at() from anon, authenticated, public;
revoke execute on function public.bump_pesanan_updated_at_from_item() from anon, authenticated, public;
revoke execute on function public.bump_pesanan_updated_at_from_pembayaran() from anon, authenticated, public;
revoke execute on function public.guard_pesanan_write() from anon, authenticated, public;
revoke execute on function public.guard_item_pesanan_write() from anon, authenticated, public;
