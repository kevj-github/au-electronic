-- Applied live to project pjkddahrjjqblexxhaef on 2026-08-05.
--
-- Atomic replacement for createPesanan's three-step sequence. The app now calls
-- this via rpc('create_pesanan_atomic'); the PGRST202 fallback that kept the old
-- path alive while this was unapplied was removed in the same commit.
--
-- Verified against live data immediately after applying:
--   * happy path, as an owner session (jwt claims set, role authenticated):
--     kode AU.2026.08.00036 drawn, status diproses, tanggal_pengiriman stored,
--     dibuat_oleh = the caller, 2 lines, total 9.500. Rolled back.
--   * ATOMICITY, the property this exists for: a payload that passes the
--     up-front validation but fails the harga_satuan cast *during the item
--     insert* — i.e. after the parent row is written — left
--         kode counter 35 -> 35   (the kode is released, not burned)
--         pesanan rows 107 -> 107 (no orphan)
--         orphaned pesanan 0 -> 0
--     Under the old three-step path that same failure committed the parent and
--     consumed kode 36 permanently.
--   * grants: security_definer = false, EXECUTE held by authenticated and
--     service_role only — not anon, not public.
--   * get_advisors(security) reports nothing new for this function. A
--     SECURITY DEFINER version would have added an
--     authenticated_security_definer_function_executable warning.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
-- createPesanan ran three steps from the app:
--
--   1. rpc next_kode_pesanan()        -- draws and increments the order number
--   2. insert into pesanan            -- the parent row
--   3. insert into item_pesanan       -- the lines
--
-- Each is its own transaction, so a failure at step 3 leaves step 2 committed:
-- an order with no items, holding a kode that is now permanently consumed. The
-- user sees a raw Postgres message and retries, orphaning another one.
--
-- item_pesanan carries `check (qty > 0)` and `nama_barang not null`, so this was
-- reachable from ordinary input until the app started validating lines up front
-- (commit 57b3ccb). That validation removed the *common* cause; it cannot remove
-- the general one — any constraint violation, trigger exception, RLS rejection
-- or dropped connection between steps 2 and 3 still orphans a row.
--
-- A plpgsql function body runs inside a single transaction, so folding all three
-- steps into one makes them atomic: either the order and every line commit, or
-- nothing does. Note this also un-burns the kode on failure, because
-- pesanan_sequence is an ordinary table (not a Postgres SEQUENCE) and its
-- increment rolls back with everything else.
--
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER, not DEFINER
-- ---------------------------------------------------------------------------
-- Deliberate, and the same choice clear_all_pelanggan made:
--
--   * The inserts must stay subject to the RLS insert policies on pesanan and
--     item_pesanan. SECURITY DEFINER would bypass them and buy nothing.
--   * next_kode_pesanan() is itself SECURITY DEFINER (it writes
--     pesanan_sequence, which authenticated cannot touch), so the kode is drawn
--     correctly from an INVOKER caller.
--   * guard_pesanan_write and guard_item_pesanan_write are triggers; they fire
--     either way and keep doing the work that matters — forcing dibuat_oleh to
--     auth.uid() and status to 'diproses' for non-owners, and zeroing
--     harga_satuan so a helper can never set a price.
--
-- The role/lock check below is defence in depth. It is NOT redundant: this
-- function is callable directly over PostgREST, and guard_pesanan_write does
-- not consult `pesanan_locked` on INSERT — so without it, a locked helper could
-- create orders by calling the RPC directly, bypassing the app-layer gate.
-- ============================================================================

create or replace function public.create_pesanan_atomic(
  p_pelanggan_id       uuid,
  p_nama_pelanggan     text,
  p_catatan            text,
  p_tanggal_pengiriman date,
  p_items              jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pesanan_id uuid;
  v_kode       text;
  v_role       text := public.current_user_role();
  v_locked     text;
begin
  if v_role is null then
    raise exception 'Tidak terautentikasi.';
  end if;

  if p_pelanggan_id is null and coalesce(btrim(p_nama_pelanggan), '') = '' then
    raise exception 'Pilih pelanggan atau masukkan nama pelanggan.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Tambahkan minimal satu barang.';
  end if;

  -- Mirrors requireUnlocked() in the app: helpers only, fail closed on a
  -- missing/unreadable row rather than treating it as unlocked.
  if v_role <> 'owner' then
    select value into v_locked
      from public.settings
     where key = 'pesanan_locked';

    if v_locked is null then
      raise exception 'Tidak dapat memverifikasi status kunci pesanan.';
    end if;
    if v_locked = 'true' then
      raise exception 'Pembuatan pesanan baru sedang dikunci oleh pemilik.';
    end if;
  end if;

  -- Validated here too, not just in the app: this is what the `check (qty > 0)`
  -- violation used to look like, and a direct RPC caller skips the app checks.
  if exists (
    select 1
      from jsonb_array_elements(p_items) as it
     where coalesce(btrim(it->>'nama_barang'), '') = ''
  ) then
    raise exception 'Nama barang tidak boleh kosong.';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_items) as it
     where (it->>'qty') is null
        or (it->>'qty') !~ '^[0-9]+$'
        or (it->>'qty')::numeric < 1
  ) then
    raise exception 'Qty setiap barang harus berupa angka bulat minimal 1.';
  end if;

  v_kode := public.next_kode_pesanan();

  -- dibuat_oleh and status are overwritten by guard_pesanan_write for
  -- non-owners; passing them keeps the owner path explicit.
  insert into public.pesanan (
    kode_pesanan, pelanggan_id, nama_pelanggan, catatan,
    tanggal_pengiriman, dibuat_oleh, status
  )
  values (
    v_kode,
    p_pelanggan_id,
    case when p_pelanggan_id is null then nullif(btrim(p_nama_pelanggan), '') end,
    nullif(btrim(p_catatan), ''),
    p_tanggal_pengiriman,
    auth.uid(),
    'diproses'
  )
  returning id into v_pesanan_id;

  -- harga_satuan is zeroed by guard_item_pesanan_write for non-owners, so the
  -- value sent by a helper is irrelevant.
  insert into public.item_pesanan (pesanan_id, nama_barang, qty, harga_satuan, catatan_item)
  select v_pesanan_id,
         btrim(it->>'nama_barang'),
         (it->>'qty')::numeric,
         coalesce(nullif(it->>'harga_satuan', '')::numeric, 0),
         null
    from jsonb_array_elements(p_items) as it;

  return v_pesanan_id;
end;
$$;

revoke execute on function public.create_pesanan_atomic(uuid, text, text, date, jsonb)
  from public, anon;
grant execute on function public.create_pesanan_atomic(uuid, text, text, date, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- VERIFY AFTER APPLYING (run inside a transaction and roll back)
-- ---------------------------------------------------------------------------
-- begin;
--   -- happy path: returns an id, order has its lines, kode advanced by one
--   select public.create_pesanan_atomic(
--     null, 'Test Atomic', null, null,
--     '[{"nama_barang":"Kabel","qty":"2","harga_satuan":"1000"}]'::jsonb);
--
--   -- atomicity: a bad line must leave NO pesanan row and NOT consume a kode
--   select urutan from public.pesanan_sequence
--    where tahun = extract(year from now()) and bulan = extract(month from now());
--   select public.create_pesanan_atomic(
--     null, 'Test Rollback', null, null,
--     '[{"nama_barang":"Kabel","qty":"0"}]'::jsonb);   -- expect: raises
--   select count(*) from public.pesanan where nama_pelanggan = 'Test Rollback'; -- expect 0
--   select urutan from public.pesanan_sequence
--    where tahun = extract(year from now()) and bulan = extract(month from now()); -- unchanged
-- rollback;
