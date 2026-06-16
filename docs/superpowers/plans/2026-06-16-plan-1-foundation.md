# AU Electronic — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the Next.js + Supabase project with working authentication, role-based route protection, database schema, and an app shell layout in Bahasa Indonesia.

**Architecture:** Next.js 15 App Router on Vercel. Supabase handles PostgreSQL, Auth (email/password), and file Storage. Auth state managed via `@supabase/ssr` with a Next.js middleware guard. Two roles: `owner` and `helper`, stored in a `users` table and embedded in the Supabase JWT via `app_metadata`.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, @supabase/supabase-js v2, @supabase/ssr, Vitest, @testing-library/react, @testing-library/jest-dom

**Spec:** `docs/superpowers/specs/2026-06-16-au-electronic-pos-design.md`

---

## File Structure

```
au-electronic/
├── .env.local                          (gitignored — Supabase keys)
├── .env.example                        (committed — template)
├── next.config.ts
├── tailwind.config.ts
├── vitest.config.ts
├── vitest.setup.ts
│
├── supabase/
│   └── migrations/
│       ├── 20260616000001_initial_schema.sql
│       └── 20260616000002_rls_policies.sql
│
└── src/
    ├── middleware.ts                    (route protection)
    ├── app/
    │   ├── layout.tsx                  (root layout)
    │   ├── (auth)/
    │   │   └── login/
    │   │       └── page.tsx            (login form)
    │   └── (app)/
    │       ├── layout.tsx              (app shell — sidebar + topbar)
    │       ├── dashboard/
    │       │   └── page.tsx            (placeholder — implemented in Plan 4)
    │       └── pesanan/
    │           └── page.tsx            (placeholder — implemented in Plan 3)
    ├── components/
    │   └── layout/
    │       ├── Sidebar.tsx
    │       └── TopBar.tsx
    └── lib/
        ├── supabase/
        │   ├── client.ts               (browser Supabase client)
        │   └── server.ts               (server-side Supabase client)
        ├── types.ts                    (shared TypeScript types)
        └── utils.ts                    (formatRupiah, cn helper)
```

---

## Task 1: Initialize Next.js Project

**Files:**
- Create: `au-electronic/` (project root, run from `au-electronic/`)

- [ ] **Step 1: Scaffold the project**

Run from `/root/project/au-electronic/au-electronic/` — this directory already exists with a README, so scaffold into it:

```bash
cd /root/project/au-electronic/au-electronic
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

When prompted: accept all defaults. The `.` installs into the current directory.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install date-fns
npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted: choose **Default** style, **Slate** base color, yes to CSS variables.

Then add the components we need immediately:

```bash
npx shadcn@latest add button input label card form toast badge separator
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Create `vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

Add to `package.json` scripts:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 5: Verify setup compiles**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors. (Warnings about empty pages are fine.)

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: initialize Next.js 15 project with shadcn/ui and Vitest"
```

---

## Task 2: TypeScript Types & Utility Functions

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/utils.ts`
- Create: `src/lib/utils.test.ts`

- [ ] **Step 1: Write failing tests for utility functions**

Create `src/lib/utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatRupiah, generateKodePesanan, hitungSaldo } from './utils'

describe('formatRupiah', () => {
  it('formats zero', () => {
    expect(formatRupiah(0)).toBe('Rp 0')
  })
  it('formats thousands', () => {
    expect(formatRupiah(150000)).toBe('Rp 150.000')
  })
  it('formats millions', () => {
    expect(formatRupiah(1200000)).toBe('Rp 1.200.000')
  })
})

describe('generateKodePesanan', () => {
  it('generates invoice code', () => {
    expect(generateKodePesanan('invoice', 2026, 1)).toBe('INV-2026-0001')
  })
  it('generates nota code', () => {
    expect(generateKodePesanan('nota', 2026, 42)).toBe('NOT-2026-0042')
  })
  it('zero-pads sequence to 4 digits', () => {
    expect(generateKodePesanan('invoice', 2026, 999)).toBe('INV-2026-0999')
  })
})

describe('hitungSaldo', () => {
  it('returns full amount when nothing paid', () => {
    expect(hitungSaldo(1200000, 0)).toEqual({
      totalPesanan: 1200000,
      totalDibayar: 0,
      sisaTagihan: 1200000,
      statusPembayaran: 'belum_dibayar',
    })
  })
  it('returns partial when partially paid', () => {
    expect(hitungSaldo(1200000, 500000)).toEqual({
      totalPesanan: 1200000,
      totalDibayar: 500000,
      sisaTagihan: 700000,
      statusPembayaran: 'bayar_sebagian',
    })
  })
  it('returns lunas when fully paid', () => {
    expect(hitungSaldo(1200000, 1200000)).toEqual({
      totalPesanan: 1200000,
      totalDibayar: 1200000,
      sisaTagihan: 0,
      statusPembayaran: 'lunas',
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run src/lib/utils.test.ts
```

Expected: FAIL — `formatRupiah`, `generateKodePesanan`, `hitungSaldo` not found.

- [ ] **Step 3: Define shared TypeScript types**

Create `src/lib/types.ts`:

```typescript
export type UserRole = 'owner' | 'helper'

export type TipePelanggan = 'retail' | 'grosir'

export type TipeDokumen = 'invoice' | 'nota'

export type StatusPesanan =
  | 'draft'
  | 'konfirmasi'
  | 'diproses'
  | 'selesai'
  | 'dibatalkan'

export type MetodePembayaran = 'tunai' | 'transfer' | 'lainnya'

export type StatusPembayaran = 'belum_dibayar' | 'bayar_sebagian' | 'lunas'

export interface User {
  id: string
  email: string
  role: UserRole
  nama: string
  created_at: string
}

export interface Pelanggan {
  id: string
  nama: string
  telepon: string | null
  alamat: string | null
  tipe: TipePelanggan
  created_at: string
}

export interface Produk {
  id: string
  nama: string
  deskripsi: string | null
  satuan: string
  harga_dasar: number
  aktif: boolean
  created_at: string
}

export interface Pesanan {
  id: string
  kode_pesanan: string
  pelanggan_id: string | null
  nama_pelanggan: string | null
  tipe_dokumen: TipeDokumen
  status: StatusPesanan
  catatan: string | null
  dibuat_oleh: string
  created_at: string
  pelanggan?: Pelanggan
  items?: ItemPesanan[]
  pembayaran?: Pembayaran[]
}

export interface ItemPesanan {
  id: string
  pesanan_id: string
  produk_id: string
  qty: number
  harga_satuan: number
  diskon: number
  subtotal: number
  catatan_item: string | null
  produk?: Produk
}

export interface Pembayaran {
  id: string
  pesanan_id: string
  jumlah: number
  metode: MetodePembayaran
  catatan: string | null
  dibayar_pada: string
  dicatat_oleh: string
}

export interface SaldoPesanan {
  totalPesanan: number
  totalDibayar: number
  sisaTagihan: number
  statusPembayaran: StatusPembayaran
}
```

- [ ] **Step 4: Implement utility functions**

Replace the existing `src/lib/utils.ts` (shadcn generates a `cn` helper there — keep it and add below):

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { SaldoPesanan, TipeDokumen } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

export function generateKodePesanan(
  tipe: TipeDokumen,
  year: number,
  seq: number
): string {
  const prefix = tipe === 'invoice' ? 'INV' : 'NOT'
  const padded = String(seq).padStart(4, '0')
  return `${prefix}-${year}-${padded}`
}

export function hitungSaldo(
  totalPesanan: number,
  totalDibayar: number
): SaldoPesanan {
  const sisaTagihan = totalPesanan - totalDibayar
  let statusPembayaran: SaldoPesanan['statusPembayaran']
  if (sisaTagihan <= 0) {
    statusPembayaran = 'lunas'
  } else if (totalDibayar > 0) {
    statusPembayaran = 'bayar_sebagian'
  } else {
    statusPembayaran = 'belum_dibayar'
  }
  return { totalPesanan, totalDibayar, sisaTagihan, statusPembayaran }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test:run src/lib/utils.test.ts
```

Expected: PASS — all 7 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/utils.ts src/lib/utils.test.ts vitest.config.ts vitest.setup.ts package.json
git commit -m "feat: add shared types, utility functions, and Vitest config"
```

---

## Task 3: Supabase Project & Environment Setup

**Files:**
- Create: `.env.example`
- Create: `.env.local` (gitignored)
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`

- [ ] **Step 1: Create a Supabase project**

Go to [supabase.com](https://supabase.com), create a new project named `au-electronic`. Note the **Project URL** and **anon public key** from Project Settings → API.

- [ ] **Step 2: Create `.env.example`**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 3: Create `.env.local` with real values**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

- [ ] **Step 4: Ensure `.env.local` is gitignored**

Verify `.gitignore` contains `.env.local` (Next.js adds this by default). If missing, add it.

- [ ] **Step 5: Create browser Supabase client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 6: Create server-side Supabase client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — cookies will be set by middleware
          }
        },
      },
    }
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase/ .env.example
git commit -m "feat: add Supabase client setup for browser and server"
```

---

## Task 4: Database Schema Migrations

**Files:**
- Create: `supabase/migrations/20260616000001_initial_schema.sql`
- Create: `supabase/migrations/20260616000002_rls_policies.sql`

- [ ] **Step 1: Install Supabase CLI (if not already installed)**

```bash
npm install supabase --save-dev
```

Initialize Supabase local config:

```bash
npx supabase init
```

- [ ] **Step 2: Create initial schema migration**

Create `supabase/migrations/20260616000001_initial_schema.sql`:

```sql
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
```

- [ ] **Step 3: Create RLS policies migration**

Create `supabase/migrations/20260616000002_rls_policies.sql`:

```sql
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
```

- [ ] **Step 4: Apply migrations to Supabase**

In the Supabase dashboard, go to **SQL Editor** and run both migration files in order (copy-paste each one). Or use the CLI if you have a local Docker setup:

```bash
npx supabase db push
```

- [ ] **Step 5: Create the first owner account**

In Supabase dashboard → Authentication → Users → "Invite user" or "Add user":
- Email: owner's email
- Password: temporary password

Then in SQL Editor, insert the user record:

```sql
insert into public.users (id, email, role, nama)
values (
  '<uuid-from-auth-users>',
  'owner@example.com',
  'owner',
  'Nama Pemilik'
);
```

- [ ] **Step 6: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema and RLS policies"
```

---

## Task 5: Auth Middleware & Route Protection

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create middleware**

Create `src/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Unauthenticated users can only access /login
  if (!user && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated users are redirected away from /login
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/pesanan', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Verify middleware compiles**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth middleware with route protection"
```

---

## Task 6: Login Page

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/login/actions.ts`

- [ ] **Step 1: Create login server action**

Create `src/app/(auth)/login/actions.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Email atau password salah.' }
  }

  revalidatePath('/', 'layout')
  redirect('/pesanan')
}
```

- [ ] **Step 2: Create login page**

Create `src/app/(auth)/login/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email atau password salah.')
      setLoading(false)
      return
    }

    router.push('/pesanan')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">AU Electronic</CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            Masuk ke sistem
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Masuk...' : 'Masuk'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Test login manually**

```bash
npm run dev
```

Open `http://localhost:3000/login`. Try logging in with the owner account created in Task 4. Expected: redirect to `/pesanan` after successful login. Attempting to visit `http://localhost:3000/pesanan` while logged out redirects to `/login`.

- [ ] **Step 4: Commit**

```bash
git add src/app/
git commit -m "feat: add login page with Supabase auth"
```

---

## Task 7: App Shell Layout

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/TopBar.tsx`
- Create: `src/app/(app)/pesanan/page.tsx` (placeholder)
- Create: `src/app/(app)/dashboard/page.tsx` (placeholder)

- [ ] **Step 1: Create Sidebar component**

Create `src/components/layout/Sidebar.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/types'

interface NavItem {
  href: string
  label: string
  roles: UserRole[]
}

const navItems: NavItem[] = [
  { href: '/pesanan', label: 'Pesanan', roles: ['owner', 'helper'] },
  { href: '/pelanggan', label: 'Pelanggan', roles: ['owner', 'helper'] },
  { href: '/produk', label: 'Produk', roles: ['owner'] },
  { href: '/dashboard', label: 'Dashboard', roles: ['owner'] },
  { href: '/pengaturan', label: 'Pengaturan', roles: ['owner'] },
]

interface SidebarProps {
  role: UserRole
  nama: string
}

export function Sidebar({ role, nama }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-56 min-h-screen bg-white border-r flex flex-col">
      <div className="p-4 border-b">
        <p className="font-semibold text-sm">AU Electronic</p>
        <p className="text-xs text-muted-foreground">{nama}</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems
          .filter((item) => item.roles.includes(role))
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
                pathname.startsWith(item.href)
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              {item.label}
            </Link>
          ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Create TopBar component**

Create `src/components/layout/TopBar.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface TopBarProps {
  title: string
}

export function TopBar({ title }: TopBarProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-4">
      <h1 className="text-sm font-medium text-slate-700">{title}</h1>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        Keluar
      </Button>
    </header>
  )
}
```

- [ ] **Step 3: Create app shell layout**

Create `src/app/(app)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import type { User } from '@/lib/types'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single<User>()

  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role={user.role} nama={user.nama} />
      <div className="flex-1 flex flex-col">
        <TopBar title="AU Electronic" />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create placeholder pages**

Create `src/app/(app)/pesanan/page.tsx`:

```tsx
export default function PesananPage() {
  return (
    <div>
      <h2 className="text-lg font-semibold">Daftar Pesanan</h2>
      <p className="text-muted-foreground text-sm mt-1">Segera hadir — Plan 3.</p>
    </div>
  )
}
```

Create `src/app/(app)/dashboard/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-lg font-semibold">Dashboard</h2>
      <p className="text-muted-foreground text-sm mt-1">Segera hadir — Plan 4.</p>
    </div>
  )
}
```

- [ ] **Step 5: Test the full auth flow manually**

```bash
npm run dev
```

1. Open `http://localhost:3000` — expect redirect to `/login`
2. Login with owner credentials — expect redirect to `/pesanan` with sidebar visible
3. Click "Keluar" — expect redirect to `/login`
4. Sidebar should show all 5 nav items for owner role

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat: add app shell layout with sidebar and role-aware navigation"
```

---

## Task 8: Deploy to Vercel

**Files:**
- No new files — deployment configuration only

- [ ] **Step 1: Push project to GitHub**

```bash
git remote add origin https://github.com/<your-username>/au-electronic.git
git push -u origin main
```

- [ ] **Step 2: Connect to Vercel**

Go to [vercel.com](https://vercel.com) → "Add New Project" → import the `au-electronic` repository. Set **Root Directory** to `au-electronic` (since the Next.js project is inside the monorepo subfolder).

- [ ] **Step 3: Set environment variables in Vercel**

In Vercel project settings → Environment Variables, add:

```
NEXT_PUBLIC_SUPABASE_URL = <your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY = <your-anon-key>
```

- [ ] **Step 4: Deploy**

Click "Deploy". Wait for build to complete.

Expected: deployment succeeds. Visit the Vercel URL, login page appears, login works, app shell loads.

- [ ] **Step 5: Update Supabase allowed redirect URLs**

In Supabase dashboard → Authentication → URL Configuration, add your Vercel URL to **Redirect URLs**:

```
https://your-project.vercel.app/**
```

- [ ] **Step 6: Verify production login works**

Visit `https://your-project.vercel.app/login`, log in with owner credentials. Expected: app shell loads with correct sidebar.

---

## Self-Review Checklist

- [x] All spec requirements for auth covered: owner/helper roles, login page, route protection
- [x] All spec requirements for schema covered: all 6 tables + sequence function
- [x] RLS policies set: helpers see only their pesanan, owner sees all
- [x] No TBD or placeholder in critical tasks — placeholder pages are intentional stubs for future plans
- [x] Type names consistent across types.ts and all component files
- [x] `hitungSaldo` used in types.ts return type — consistent
- [x] `kode_pesanan` generation uses DB function to avoid race conditions

---

## What This Plan Delivers

After completing all tasks:
- Login/logout works
- Owner and helper can log in and see role-appropriate navigation
- Database schema is live in Supabase with RLS
- App is deployed and accessible on Vercel
- Utility functions are tested

**Next:** Plan 2 — Master Data (product catalog + customer management)
