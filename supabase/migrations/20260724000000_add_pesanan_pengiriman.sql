-- Courier/ekspedisi name (e.g. "Expedisi Jaya") the owner fills in per order.
-- Written on the "Penerima," signature line of the PDF and Epson receipts.
-- Nullable and owner-editable via the existing owner-only pesanan UPDATE RLS.
alter table public.pesanan
  add column if not exists pengiriman text;
