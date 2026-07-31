-- Privilege-escalation fix. APPLIED LIVE 2026-07-31.
--
-- The previous WITH CHECK was:
--   ((current_user_role() = 'owner') OR (id = auth.uid()))
--
-- The `id = auth.uid()` branch let any authenticated caller INSERT their own
-- public.users row with a client-chosen `role`. current_user_role() returns
-- NULL for a caller that has no public.users row yet, so the owner branch did
-- not constrain them: anyone holding the (public, browser-shipped) anon key who
-- could obtain an auth session was able to POST /rest/v1/users with
-- {id: <own uid>, role: 'owner'} and grant themselves full owner access.
--
-- No legitimate flow needs that branch. Both registerOwner (bootstrap) and
-- createUser insert via the service-role admin client, which bypasses RLS
-- entirely. The branch was pure attack surface.
--
-- Verified before applying: 0 auth.users rows lacked a public.users row, so
-- there was no pre-existing foothold.

drop policy if exists users_insert on public.users;

create policy users_insert on public.users
  for insert
  with check (current_user_role() = 'owner');
