-- Pin search_path on SECURITY-sensitive functions (advisor: function_search_path_mutable)
create or replace function public.current_user_role()
returns text
language sql
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.next_kode_pesanan(p_tipe text)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_tahun int := extract(year from now());
  v_urutan int;
  v_prefix text;
begin
  update public.pesanan_sequence
  set urutan = case when tahun < v_tahun then 1 else urutan + 1 end,
      tahun = v_tahun
  where tipe = p_tipe
  returning urutan into v_urutan;

  v_prefix := case when p_tipe = 'invoice' then 'INV' else 'NOT' end;
  return v_prefix || '-' || v_tahun || '-' || lpad(v_urutan::text, 4, '0');
end;
$$;

-- Trigger functions aren't meant to be called directly via PostgREST RPC
-- (advisor: anon/authenticated_security_definer_function_executable)
revoke execute on function public.guard_pesanan_write() from public, anon, authenticated;
revoke execute on function public.guard_item_pesanan_write() from public, anon, authenticated;
