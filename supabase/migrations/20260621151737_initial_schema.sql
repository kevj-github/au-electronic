-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Users (mirrors auth.users, adds role)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'helper')),
  nama text not null,
  created_at timestamptz default now()
);

-- Customers
create table public.pelanggan (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  telepon text,
  alamat text,
  tipe text not null check (tipe in ('retail', 'grosir')) default 'retail',
  created_at timestamptz default now()
);

-- Products
create table public.produk (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  deskripsi text,
  satuan text not null default 'pcs',
  harga_dasar numeric not null default 0,
  aktif boolean not null default true,
  created_at timestamptz default now()
);

-- Orders
create table public.pesanan (
  id uuid primary key default gen_random_uuid(),
  kode_pesanan text unique not null,
  pelanggan_id uuid references public.pelanggan(id),
  nama_pelanggan text,
  tipe_dokumen text not null check (tipe_dokumen in ('invoice', 'nota')),
  status text not null check (status in ('draft', 'konfirmasi', 'diproses', 'selesai', 'dibatalkan')) default 'draft',
  catatan text,
  dibuat_oleh uuid not null references public.users(id),
  created_at timestamptz default now(),
  constraint pelanggan_or_nama check (
    pelanggan_id is not null or nama_pelanggan is not null
  )
);

-- Order line items
create table public.item_pesanan (
  id uuid primary key default gen_random_uuid(),
  pesanan_id uuid not null references public.pesanan(id) on delete cascade,
  produk_id uuid not null references public.produk(id),
  qty numeric not null check (qty > 0),
  harga_satuan numeric not null check (harga_satuan >= 0),
  diskon numeric not null default 0 check (diskon >= 0),
  subtotal numeric generated always as (qty * harga_satuan - diskon) stored,
  catatan_item text
);

-- Payments
create table public.pembayaran (
  id uuid primary key default gen_random_uuid(),
  pesanan_id uuid not null references public.pesanan(id) on delete cascade,
  jumlah numeric not null check (jumlah > 0),
  metode text not null check (metode in ('tunai', 'transfer', 'lainnya')),
  catatan text,
  dibayar_pada timestamptz not null default now(),
  dicatat_oleh uuid not null references public.users(id)
);

-- Sequence table for auto-generating kode_pesanan
create table public.pesanan_sequence (
  tipe text primary key check (tipe in ('invoice', 'nota')),
  tahun int not null,
  urutan int not null default 0
);
insert into public.pesanan_sequence (tipe, tahun, urutan) values ('invoice', 2026, 0), ('nota', 2026, 0);

-- Function to get next sequence number (safe against concurrent inserts)
create or replace function public.next_kode_pesanan(p_tipe text)
returns text
language plpgsql
as $$
declare
  v_tahun int := extract(year from now());
  v_urutan int;
  v_prefix text;
begin
  -- Reset sequence if new year
  update public.pesanan_sequence
  set urutan = case when tahun < v_tahun then 1 else urutan + 1 end,
      tahun = v_tahun
  where tipe = p_tipe
  returning urutan into v_urutan;

  v_prefix := case when p_tipe = 'invoice' then 'INV' else 'NOT' end;
  return v_prefix || '-' || v_tahun || '-' || lpad(v_urutan::text, 4, '0');
end;
$$;
