-- current_user_role() queried public.users without SECURITY DEFINER, so its
-- own SELECT re-triggered the users_select RLS policy, which calls
-- current_user_role() again. For authenticated callers this terminated in
-- one extra hop (the row being read has id = auth.uid(), so the policy's
-- left OR-branch short-circuits), but for anonymous/expired-session requests
-- (auth.uid() is null) the left branch is never true and Postgres recurses
-- until it hits "stack depth limit exceeded". SECURITY DEFINER makes the
-- internal lookup run as the function owner (postgres, who owns
-- public.users without FORCE ROW LEVEL SECURITY), bypassing RLS there and
-- breaking the recursion.
create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.users where id = auth.uid()
$$;

grant execute on function public.current_user_role() to anon, authenticated;
