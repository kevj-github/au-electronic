-- Applied live to project pjkddahrjjqblexxhaef on 2026-08-02.
--
-- Dashboard aggregates computed in SQL instead of by fetching every order.
--
-- The dashboard previously fetched ALL non-cancelled orders with their nested
-- items and payments (78 orders / 1464 item rows / ~76 kB at the time, growing
-- without bound) purely to sum receivables in JS, and did it twice. PostgREST
-- silently caps a result set at 1000 rows — verified empirically: an unbounded
-- read of item_pesanan (1458 rows) returns exactly 1000 with no error. So once
-- the shop passed 1000 non-cancelled orders that fetch would have truncated
-- silently and `Total Piutang` would have under-reported. A scalar sum computed
-- in SQL is never subject to the row cap.
--
-- Both objects must be SECURITY DEFINER because the phase 3 revoke
-- (20260801111127) removed column SELECT on item_pesanan.subtotal and
-- pembayaran.jumlah from `authenticated`, and the owner is also just
-- `authenticated`. That bypasses RLS, so each re-checks the caller's role
-- itself — the same contract as item_pesanan_owner / pembayaran_owner.
--
-- Verified against live data before shipping: dashboard_summary returns
-- period_count 6, period_revenue 23.505.000, total_piutang 466.550.580,
-- unpaid_count 72 — byte-identical to the JS it replaces. A helper session gets
-- 0 rows from the view and a raised exception from the function.

-- Unpaid orders, oldest first. Lets the dashboard fetch a BOUNDED slice of the
-- "Tagihan Belum Lunas" list instead of filtering the whole table client-side.
create or replace view public.pesanan_unpaid_owner as
  select p.id,
         p.kode_pesanan,
         p.created_at,
         coalesce(i.total, 0)                        as total_pesanan,
         coalesce(b.total, 0)                        as total_dibayar,
         coalesce(i.total, 0) - coalesce(b.total, 0) as sisa_tagihan
  from public.pesanan p
  left join (
    select pesanan_id, sum(subtotal) as total
    from public.item_pesanan group by pesanan_id
  ) i on i.pesanan_id = p.id
  left join (
    select pesanan_id, sum(jumlah) as total
    from public.pembayaran group by pesanan_id
  ) b on b.pesanan_id = p.id
  where public.current_user_role() = 'owner'
    and p.status <> 'dibatalkan'
    and coalesce(i.total, 0) - coalesce(b.total, 0) > 0;

grant select on public.pesanan_unpaid_owner to authenticated;

-- The four dashboard stat tiles, as one row. Takes timestamptz bounds so the
-- caller passes exactly the strings it already builds, keeping period semantics
-- identical to the JS this replaces.
create or replace function public.dashboard_summary(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  period_count   bigint,
  period_revenue numeric,
  total_piutang  numeric,
  unpaid_count   bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  -- Essential: SECURITY DEFINER means this reads the masked price columns, so
  -- without this check any signed-in helper could call it and read shop revenue.
  if public.current_user_role() <> 'owner' then
    raise exception 'Hanya owner yang dapat melihat ringkasan dashboard.';
  end if;

  return query
  with totals as (
    select p.id,
           p.created_at,
           coalesce((select sum(i.subtotal) from public.item_pesanan i
                      where i.pesanan_id = p.id), 0) as total_pesanan,
           coalesce((select sum(pm.jumlah) from public.pembayaran pm
                      where pm.pesanan_id = p.id), 0) as total_dibayar
    from public.pesanan p
    where p.status <> 'dibatalkan'
  )
  select
    (select count(*) from totals t
       where t.created_at >= p_from and t.created_at <= p_to),
    (select coalesce(sum(t.total_pesanan), 0) from totals t
       where t.created_at >= p_from and t.created_at <= p_to),
    (select coalesce(sum(t.total_pesanan - t.total_dibayar), 0) from totals t
       where t.total_pesanan - t.total_dibayar > 0),
    (select count(*) from totals t
       where t.total_pesanan - t.total_dibayar > 0);
end;
$$;

-- Only signed-in users may call it; the body then restricts to owners. Keeping
-- anon off the list avoids the anon_security_definer_function_executable advisor.
revoke execute on function public.dashboard_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.dashboard_summary(timestamptz, timestamptz) to authenticated;
