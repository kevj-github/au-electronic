# AU Electronic — Plan 2: Master Data

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build product catalog management (owner only) and customer management (owner writes, helper reads) pages.

**Architecture:** React Server Components fetch data from Supabase. Forms use Server Actions for mutations. shadcn/ui for all UI. Owner-only write operations enforced at both RLS level (Supabase) and UI level (hiding controls for helpers).

**Tech Stack:** Next.js 15 App Router, Supabase, shadcn/ui, Vitest + React Testing Library

**Prerequisite:** Plan 1 complete (auth, schema, app shell deployed).

**Spec:** `docs/superpowers/specs/2026-06-16-au-electronic-pos-design.md`

---

## File Structure

```
src/
├── app/(app)/
│   ├── produk/
│   │   └── page.tsx                    (owner: product list + inline add/edit)
│   ├── pelanggan/
│   │   ├── page.tsx                    (all: customer list)
│   │   ├── baru/
│   │   │   └── page.tsx                (owner: new customer form)
│   │   └── [id]/
│   │       └── page.tsx                (owner: edit customer)
└── components/
    ├── produk/
    │   ├── ProdukList.tsx
    │   ├── ProdukForm.tsx
    │   └── ProdukActions.tsx           (owner-only edit/deactivate buttons)
    └── pelanggan/
        ├── PelangganList.tsx
        └── PelangganForm.tsx
```

---

## Task 1: Product Catalog Page (Owner)

**Files:**
- Create: `src/app/(app)/produk/page.tsx`
- Create: `src/app/(app)/produk/actions.ts`
- Create: `src/components/produk/ProdukForm.tsx`
- Create: `src/components/produk/ProdukList.tsx`

- [ ] **Step 1: Create server actions for products**

Create `src/app/(app)/produk/actions.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function upsertProduk(formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string | null
  const nama = formData.get('nama') as string
  const deskripsi = formData.get('deskripsi') as string
  const satuan = formData.get('satuan') as string
  const harga_dasar = Number(formData.get('harga_dasar'))

  if (!nama || !satuan || isNaN(harga_dasar)) {
    return { error: 'Data produk tidak lengkap.' }
  }

  if (id) {
    const { error } = await supabase
      .from('produk')
      .update({ nama, deskripsi, satuan, harga_dasar })
      .eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('produk')
      .insert({ nama, deskripsi, satuan, harga_dasar })
    if (error) return { error: error.message }
  }

  revalidatePath('/produk')
  redirect('/produk')
}

export async function toggleAktifProduk(id: string, aktif: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('produk')
    .update({ aktif: !aktif })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/produk')
}
```

- [ ] **Step 2: Create ProdukForm component**

Create `src/components/produk/ProdukForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { upsertProduk } from '@/app/(app)/produk/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Produk } from '@/lib/types'

interface ProdukFormProps {
  produk?: Produk
}

export function ProdukForm({ produk }: ProdukFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await upsertProduk(new FormData(e.currentTarget))
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {produk && <input type="hidden" name="id" value={produk.id} />}
      <div className="space-y-2">
        <Label htmlFor="nama">Nama Produk</Label>
        <Input id="nama" name="nama" defaultValue={produk?.nama} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="deskripsi">Deskripsi</Label>
        <Input id="deskripsi" name="deskripsi" defaultValue={produk?.deskripsi ?? ''} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="satuan">Satuan</Label>
          <Input id="satuan" name="satuan" defaultValue={produk?.satuan ?? 'pcs'} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="harga_dasar">Harga Dasar (Rp)</Label>
          <Input
            id="harga_dasar"
            name="harga_dasar"
            type="number"
            min="0"
            defaultValue={produk?.harga_dasar ?? 0}
            required
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Menyimpan...' : 'Simpan'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Create ProdukList component**

Create `src/components/produk/ProdukList.tsx`:

```tsx
'use client'

import { toggleAktifProduk } from '@/app/(app)/produk/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatRupiah } from '@/lib/utils'
import type { Produk } from '@/lib/types'
import Link from 'next/link'

interface ProdukListProps {
  produkList: Produk[]
  isOwner: boolean
}

export function ProdukList({ produkList, isOwner }: ProdukListProps) {
  if (produkList.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada produk.</p>
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Nama</th>
            <th className="text-left px-4 py-3 font-medium">Satuan</th>
            <th className="text-right px-4 py-3 font-medium">Harga Dasar</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            {isOwner && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y">
          {produkList.map((produk) => (
            <tr key={produk.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <p className="font-medium">{produk.nama}</p>
                {produk.deskripsi && (
                  <p className="text-muted-foreground text-xs">{produk.deskripsi}</p>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{produk.satuan}</td>
              <td className="px-4 py-3 text-right font-mono">
                {formatRupiah(produk.harga_dasar)}
              </td>
              <td className="px-4 py-3">
                <Badge variant={produk.aktif ? 'default' : 'secondary'}>
                  {produk.aktif ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </td>
              {isOwner && (
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <Link href={`/produk/${produk.id}/edit`}>
                      <Button variant="outline" size="sm">Edit</Button>
                    </Link>
                    <form action={toggleAktifProduk.bind(null, produk.id, produk.aktif)}>
                      <Button variant="ghost" size="sm" type="submit">
                        {produk.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    </form>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Create produk page**

Create `src/app/(app)/produk/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProdukList } from '@/components/produk/ProdukList'
import { Button } from '@/components/ui/button'
import type { Produk, User } from '@/lib/types'

export default async function ProdukPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()

  if (user?.role !== 'owner') redirect('/pesanan')

  const { data: produkList } = await supabase
    .from('produk')
    .select('*')
    .order('nama')
    .returns<Produk[]>()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Katalog Produk</h2>
          <p className="text-sm text-muted-foreground">
            {produkList?.length ?? 0} produk terdaftar
          </p>
        </div>
        <Link href="/produk/baru">
          <Button>+ Tambah Produk</Button>
        </Link>
      </div>
      <ProdukList produkList={produkList ?? []} isOwner />
    </div>
  )
}
```

- [ ] **Step 5: Create new product page**

Create `src/app/(app)/produk/baru/page.tsx`:

```tsx
import { ProdukForm } from '@/components/produk/ProdukForm'

export default function ProdukBaruPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tambah Produk Baru</h2>
      <ProdukForm />
    </div>
  )
}
```

Create `src/app/(app)/produk/[id]/edit/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProdukForm } from '@/components/produk/ProdukForm'
import type { Produk, User } from '@/lib/types'

export default async function EditProdukPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()
  if (user?.role !== 'owner') redirect('/pesanan')

  const { data: produk } = await supabase
    .from('produk').select('*').eq('id', id).single<Produk>()
  if (!produk) notFound()

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Edit Produk</h2>
      <ProdukForm produk={produk} />
    </div>
  )
}
```

- [ ] **Step 6: Add Produk link to Sidebar (it's already there from Plan 1)**

Verify `src/components/layout/Sidebar.tsx` has `{ href: '/produk', label: 'Produk', roles: ['owner'] }`. It does — no change needed.

- [ ] **Step 7: Test manually**

```bash
npm run dev
```

1. Login as owner → click "Produk" in sidebar → product list page loads
2. Click "+ Tambah Produk" → fill form → save → product appears in list
3. Click "Edit" on a product → edit name/price → save → changes reflected
4. Click "Nonaktifkan" → badge changes to Nonaktif
5. Login as helper → navigate directly to `/produk` → redirected to `/pesanan`

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/produk/ src/components/produk/
git commit -m "feat: add product catalog management for owner"
```

---

## Task 2: Customer Management

**Files:**
- Create: `src/app/(app)/pelanggan/page.tsx`
- Create: `src/app/(app)/pelanggan/baru/page.tsx`
- Create: `src/app/(app)/pelanggan/[id]/page.tsx`
- Create: `src/app/(app)/pelanggan/actions.ts`
- Create: `src/components/pelanggan/PelangganForm.tsx`
- Create: `src/components/pelanggan/PelangganList.tsx`

- [ ] **Step 1: Create server actions for customers**

Create `src/app/(app)/pelanggan/actions.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function upsertPelanggan(formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string | null
  const nama = formData.get('nama') as string
  const telepon = formData.get('telepon') as string
  const alamat = formData.get('alamat') as string
  const tipe = formData.get('tipe') as 'retail' | 'grosir'

  if (!nama) return { error: 'Nama pelanggan wajib diisi.' }

  if (id) {
    const { error } = await supabase
      .from('pelanggan')
      .update({ nama, telepon: telepon || null, alamat: alamat || null, tipe })
      .eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('pelanggan')
      .insert({ nama, telepon: telepon || null, alamat: alamat || null, tipe })
    if (error) return { error: error.message }
  }

  revalidatePath('/pelanggan')
  redirect('/pelanggan')
}
```

- [ ] **Step 2: Create PelangganForm component**

Create `src/components/pelanggan/PelangganForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { upsertPelanggan } from '@/app/(app)/pelanggan/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Pelanggan } from '@/lib/types'

interface PelangganFormProps {
  pelanggan?: Pelanggan
}

export function PelangganForm({ pelanggan }: PelangganFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await upsertPelanggan(new FormData(e.currentTarget))
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {pelanggan && <input type="hidden" name="id" value={pelanggan.id} />}
      <div className="space-y-2">
        <Label htmlFor="nama">Nama Pelanggan</Label>
        <Input id="nama" name="nama" defaultValue={pelanggan?.nama} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="telepon">Nomor Telepon</Label>
        <Input id="telepon" name="telepon" defaultValue={pelanggan?.telepon ?? ''} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="alamat">Alamat</Label>
        <Input id="alamat" name="alamat" defaultValue={pelanggan?.alamat ?? ''} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tipe">Tipe Pelanggan</Label>
        <select
          id="tipe"
          name="tipe"
          defaultValue={pelanggan?.tipe ?? 'retail'}
          className="w-full border rounded-md px-3 py-2 text-sm"
        >
          <option value="retail">Retail (B2C)</option>
          <option value="grosir">Grosir (B2B)</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Menyimpan...' : 'Simpan'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Create PelangganList component**

Create `src/components/pelanggan/PelangganList.tsx`:

```tsx
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Pelanggan } from '@/lib/types'

interface PelangganListProps {
  pelangganList: Pelanggan[]
  isOwner: boolean
}

export function PelangganList({ pelangganList, isOwner }: PelangganListProps) {
  if (pelangganList.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada pelanggan.</p>
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Nama</th>
            <th className="text-left px-4 py-3 font-medium">Telepon</th>
            <th className="text-left px-4 py-3 font-medium">Tipe</th>
            {isOwner && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y">
          {pelangganList.map((p) => (
            <tr key={p.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">{p.nama}</td>
              <td className="px-4 py-3 text-muted-foreground">{p.telepon ?? '—'}</td>
              <td className="px-4 py-3">
                <Badge variant={p.tipe === 'grosir' ? 'default' : 'secondary'}>
                  {p.tipe === 'grosir' ? 'Grosir' : 'Retail'}
                </Badge>
              </td>
              {isOwner && (
                <td className="px-4 py-3 text-right">
                  <Link href={`/pelanggan/${p.id}`}>
                    <Button variant="outline" size="sm">Edit</Button>
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Create customer list page**

Create `src/app/(app)/pelanggan/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PelangganList } from '@/components/pelanggan/PelangganList'
import { Button } from '@/components/ui/button'
import type { Pelanggan, User } from '@/lib/types'

export default async function PelangganPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()

  const { data: pelangganList } = await supabase
    .from('pelanggan')
    .select('*')
    .order('nama')
    .returns<Pelanggan[]>()

  const isOwner = user?.role === 'owner'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pelanggan</h2>
          <p className="text-sm text-muted-foreground">
            {pelangganList?.length ?? 0} pelanggan terdaftar
          </p>
        </div>
        {isOwner && (
          <Link href="/pelanggan/baru">
            <Button>+ Tambah Pelanggan</Button>
          </Link>
        )}
      </div>
      <PelangganList pelangganList={pelangganList ?? []} isOwner={isOwner} />
    </div>
  )
}
```

- [ ] **Step 5: Create new/edit customer pages**

Create `src/app/(app)/pelanggan/baru/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PelangganForm } from '@/components/pelanggan/PelangganForm'
import type { User } from '@/lib/types'

export default async function PelangganBaruPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')
  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()
  if (user?.role !== 'owner') redirect('/pelanggan')

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tambah Pelanggan Baru</h2>
      <PelangganForm />
    </div>
  )
}
```

Create `src/app/(app)/pelanggan/[id]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PelangganForm } from '@/components/pelanggan/PelangganForm'
import type { Pelanggan, User } from '@/lib/types'

export default async function EditPelangganPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')
  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()
  if (user?.role !== 'owner') redirect('/pelanggan')

  const { data: pelanggan } = await supabase
    .from('pelanggan').select('*').eq('id', id).single<Pelanggan>()
  if (!pelanggan) notFound()

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Edit Pelanggan</h2>
      <PelangganForm pelanggan={pelanggan} />
    </div>
  )
}
```

- [ ] **Step 6: Test manually**

```bash
npm run dev
```

1. Login as owner → click "Pelanggan" → list loads
2. Click "+ Tambah Pelanggan" → fill form → select "Grosir" → save → appears in list with Grosir badge
3. Click "Edit" → change name → save → list updated
4. Login as helper → click "Pelanggan" → list loads but no edit buttons and no "+ Tambah" button visible
5. Helper navigates directly to `/pelanggan/baru` → redirected to `/pelanggan`

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/pelanggan/ src/components/pelanggan/
git commit -m "feat: add customer management with owner-write, helper-read access"
```

---

## Self-Review Checklist

- [x] Owner redirect for helper accessing `/produk` — implemented
- [x] Helper can view pelanggan but not write — implemented via isOwner prop + redirect in baru/edit pages
- [x] `tipe` column used to determine invoice vs nota template (consumed in Plan 3)
- [x] No TBD placeholders — all steps have real code
- [x] Type names consistent with `src/lib/types.ts` from Plan 1
- [x] Both toggleAktifProduk and upsertProduk revalidate `/produk` path

---

## What This Plan Delivers

After completing all tasks:
- Owner can add, edit, activate/deactivate products with harga_dasar
- Owner can add and edit customers with tipe (retail/grosir)
- Helpers can view both lists but cannot modify anything

**Next:** Plan 3 — Orders (order creation, management, and detail view)
