-- Applied live to project pjkddahrjjqblexxhaef on 2026-08-01.
--
-- Number of packages (colly) handed to the courier. Owner-entered, optional, and
-- printed on the signature line of both documents as "Exp. <pengiriman> ( N colly )".
-- Nullable because most orders are picked up rather than shipped; the check
-- constraint keeps 0 and negatives out so the printed text is always meaningful.

alter table public.pesanan
  add column if not exists colly integer;

alter table public.pesanan
  drop constraint if exists pesanan_colly_positive;

alter table public.pesanan
  add constraint pesanan_colly_positive check (colly is null or colly > 0);
