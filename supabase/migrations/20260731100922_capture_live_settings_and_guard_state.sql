-- APPLIED LIVE 2026-07-31. Idempotent no-op against production.
--
-- Drift capture: these objects existed only on the live project, applied
-- out-of-band and never written back to supabase/migrations/. A fresh replay
-- (staging, DR, a new environment) would therefore NOT reproduce production.
--
-- Everything here matches the live definitions exactly, so applying it changes
-- nothing. Its purpose is to make the migration history reproduce reality.
--
-- Note the recorded guard_pesanan_write in
-- 20260624164532_remove_produk_catalog_unify_pesanan_and_fix_visibility.sql is
-- STALE: it still forces the removed 'draft' status and lacks the
-- pg_trigger_depth() bypass. Live had already been corrected by hand; the body
-- below is that live definition verbatim. The pesanan.status CHECK was likewise
-- already narrowed to the three-value model on live.

-- 1. settings: key/value store backing pesanan_locked and epson_printer_name.
create table if not exists public.settings (
  key text primary key,
  value text not null
);

alter table public.settings enable row level security;

-- Any authenticated user may read; only the owner may update. There is
-- deliberately no INSERT/DELETE policy: rows are seeded by migration, and
-- writes from the app are always UPDATEs of an existing key.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'settings' and policyname = 'settings_read'
  ) then
    create policy settings_read on public.settings
      for select using (public.current_user_role() is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'settings' and policyname = 'settings_update'
  ) then
    create policy settings_update on public.settings
      for update using (public.current_user_role() = 'owner')
      with check (public.current_user_role() = 'owner');
  end if;
end $$;

-- Seeds. The app fails closed when a settings row is missing, so both keys
-- must exist for helper mutations and Epson printing to work at all.
insert into public.settings (key, value) values ('pesanan_locked', 'false')
  on conflict (key) do nothing;
insert into public.settings (key, value) values ('epson_printer_name', '')
  on conflict (key) do nothing;

-- 2. guard_pesanan_write, live definition verbatim.
create or replace function public.guard_pesanan_write()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Cascade triggers (bump_pesanan_updated_at_from_item, etc.) run at depth > 1.
  -- They only touch updated_at and must not be blocked by auth checks.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if public.current_user_role() = 'owner' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.dibuat_oleh := auth.uid();
    new.status := 'diproses';
    return new;
  end if;

  -- Non-owner UPDATE: only own pesanan, only while still active
  if old.dibuat_oleh <> auth.uid() then
    raise exception 'Tidak diizinkan mengubah pesanan ini.';
  end if;
  if old.status <> 'diproses' then
    raise exception 'Pesanan yang sudah selesai atau dibatalkan tidak bisa diubah.';
  end if;

  new.status     := old.status;
  new.dibuat_oleh := old.dibuat_oleh;
  new.kode_pesanan := old.kode_pesanan;

  return new;
end;
$function$;
