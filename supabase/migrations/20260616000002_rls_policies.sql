-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.pelanggan enable row level security;
alter table public.produk enable row level security;
alter table public.pesanan enable row level security;
alter table public.item_pesanan enable row level security;
alter table public.pembayaran enable row level security;
alter table public.pesanan_sequence enable row level security;

-- Helper function to get current user role
create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select role from public.users where id = auth.uid()
$$;

-- users: can read own record; owner can read all
create policy "users_select" on public.users
  for select using (id = auth.uid() or current_user_role() = 'owner');

create policy "users_insert" on public.users
  for insert with check (current_user_role() = 'owner' or id = auth.uid());

-- pelanggan: all authenticated users can read; owner can write
create policy "pelanggan_select" on public.pelanggan
  for select using (auth.uid() is not null);

create policy "pelanggan_write" on public.pelanggan
  for all using (current_user_role() = 'owner');

-- produk: all authenticated users can read; owner can write
create policy "produk_select" on public.produk
  for select using (auth.uid() is not null);

create policy "produk_write" on public.produk
  for all using (current_user_role() = 'owner');

-- pesanan: helpers see only their own; owner sees all
create policy "pesanan_select" on public.pesanan
  for select using (
    dibuat_oleh = auth.uid() or current_user_role() = 'owner'
  );

create policy "pesanan_insert" on public.pesanan
  for insert with check (dibuat_oleh = auth.uid());

create policy "pesanan_update" on public.pesanan
  for update using (
    dibuat_oleh = auth.uid() or current_user_role() = 'owner'
  );

-- item_pesanan: follows pesanan visibility
create policy "item_pesanan_select" on public.item_pesanan
  for select using (
    exists (
      select 1 from public.pesanan p
      where p.id = pesanan_id
        and (p.dibuat_oleh = auth.uid() or current_user_role() = 'owner')
    )
  );

create policy "item_pesanan_write" on public.item_pesanan
  for all using (
    exists (
      select 1 from public.pesanan p
      where p.id = pesanan_id
        and (p.dibuat_oleh = auth.uid() or current_user_role() = 'owner')
    )
  );

-- pembayaran: owner only can write; all authenticated can read their order's payments
create policy "pembayaran_select" on public.pembayaran
  for select using (
    exists (
      select 1 from public.pesanan p
      where p.id = pesanan_id
        and (p.dibuat_oleh = auth.uid() or current_user_role() = 'owner')
    )
  );

create policy "pembayaran_write" on public.pembayaran
  for all using (current_user_role() = 'owner');

-- pesanan_sequence: owner only
create policy "sequence_all" on public.pesanan_sequence
  for all using (current_user_role() = 'owner');
