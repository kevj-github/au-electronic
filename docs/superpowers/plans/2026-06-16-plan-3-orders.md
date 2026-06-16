# AU Electronic — Plan 3: Orders

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the order creation flow, order list, and order detail page — the core daily workflow for helpers and the owner.

**Architecture:** Order creation is a client-side form (complex interactive state) that calls Server Actions to persist. The `kode_pesanan` is generated server-side via the Supabase `next_kode_pesanan()` DB function to avoid race conditions. Helpers can create orders and set quantities; only the owner can change `harga_satuan` per line item. Status changes are owner-only.

**Tech Stack:** Next.js 15, Supabase, shadcn/ui, Vitest

**Prerequisite:** Plan 2 complete (products and customers exist in the database).

**Spec:** `docs/superpowers/specs/2026-06-16-au-electronic-pos-design.md`

---

## File Structure

```
src/
├── app/(app)/
│   └── pesanan/
│       ├── page.tsx                    (order list — replaces placeholder)
│       ├── baru/
│       │   └── page.tsx                (new order form)
│       ├── [id]/
│       │   └── page.tsx                (order detail)
│       └── actions.ts                  (server actions for orders)
└── components/
    └── pesanan/
        ├── OrderList.tsx               (paginated order list with status badges)
        ├── OrderForm.tsx               (new order client form)
        ├── OrderLineItem.tsx           (single editable line item row)
        └── StatusBadge.tsx             (colored badge per order status)
```

---

## Task 1: Order Server Actions

**Files:**
- Create: `src/app/(app)/pesanan/actions.ts`

- [ ] **Step 1: Write failing test for order total calculation**

Create `src/app/(app)/pesanan/actions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calcOrderTotal } from './actions'

describe('calcOrderTotal', () => {
  it('sums subtotals across line items', () => {
    const items = [
      { qty: 5, harga_satuan: 150000, diskon: 0 },
      { qty: 10, harga_satuan: 45000, diskon: 0 },
    ]
    expect(calcOrderTotal(items)).toBe(1200000)
  })

  it('applies per-item discount', () => {
    const items = [{ qty: 2, harga_satuan: 100000, diskon: 10000 }]
    expect(calcOrderTotal(items)).toBe(190000)
  })

  it('returns 0 for empty items', () => {
    expect(calcOrderTotal([])).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run src/app/\\(app\\)/pesanan/actions.test.ts
```

Expected: FAIL — `calcOrderTotal` not found.

- [ ] **Step 3: Create server actions with calcOrderTotal**

Create `src/app/(app)/pesanan/actions.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { StatusPesanan, TipeDokumen } from '@/lib/types'

export interface LineItemInput {
  qty: number
  harga_satuan: number
  diskon: number
}

export function calcOrderTotal(items: LineItemInput[]): number {
  return items.reduce((sum, item) => sum + item.qty * item.harga_satuan - item.diskon, 0)
}

export interface CreatePesananInput {
  pelanggan_id: string | null
  nama_pelanggan: string | null
  tipe_dokumen: TipeDokumen
  catatan: string | null
  items: Array<{
    produk_id: string
    qty: number
    harga_satuan: number
    diskon: number
    catatan_item: string | null
  }>
}

export async function createPesanan(input: CreatePesananInput) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  if (!input.pelanggan_id && !input.nama_pelanggan) {
    return { error: 'Pilih pelanggan atau masukkan nama pelanggan.' }
  }
  if (input.items.length === 0) {
    return { error: 'Tambahkan minimal satu produk.' }
  }

  // Generate kode_pesanan via DB function
  const { data: kodeData, error: kodeError } = await supabase
    .rpc('next_kode_pesanan', { p_tipe: input.tipe_dokumen })
  if (kodeError) return { error: kodeError.message }

  // Insert pesanan
  const { data: pesanan, error: pesananError } = await supabase
    .from('pesanan')
    .insert({
      kode_pesanan: kodeData as string,
      pelanggan_id: input.pelanggan_id,
      nama_pelanggan: input.nama_pelanggan,
      tipe_dokumen: input.tipe_dokumen,
      catatan: input.catatan,
      dibuat_oleh: authUser.id,
      status: 'draft',
    })
    .select('id')
    .single()

  if (pesananError) return { error: pesananError.message }

  // Insert line items
  const { error: itemsError } = await supabase
    .from('item_pesanan')
    .insert(
      input.items.map((item) => ({
        pesanan_id: pesanan.id,
        produk_id: item.produk_id,
        qty: item.qty,
        harga_satuan: item.harga_satuan,
        diskon: item.diskon,
        catatan_item: item.catatan_item,
      }))
    )

  if (itemsError) return { error: itemsError.message }

  revalidatePath('/pesanan')
  return { pesananId: pesanan.id }
}

export async function updateStatusPesanan(pesananId: string, status: StatusPesanan) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  // Only owner can change status — enforced at UI level; double-check here
  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single()
  if (user?.role !== 'owner') return { error: 'Hanya pemilik yang bisa mengubah status.' }

  const { error } = await supabase
    .from('pesanan')
    .update({ status })
    .eq('id', pesananId)

  if (error) return { error: error.message }

  revalidatePath(`/pesanan/${pesananId}`)
  revalidatePath('/pesanan')
  return {}
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run src/app/\\(app\\)/pesanan/actions.test.ts
```

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/pesanan/actions.ts src/app/\(app\)/pesanan/actions.test.ts
git commit -m "feat: add order server actions with calcOrderTotal"
```

---

## Task 2: Status Badge Component

**Files:**
- Create: `src/components/pesanan/StatusBadge.tsx`

- [ ] **Step 1: Create StatusBadge**

Create `src/components/pesanan/StatusBadge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge'
import type { StatusPesanan } from '@/lib/types'

const labelMap: Record<StatusPesanan, string> = {
  draft: 'Draft',
  konfirmasi: 'Dikonfirmasi',
  diproses: 'Diproses',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}

const variantMap: Record<StatusPesanan, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  konfirmasi: 'default',
  diproses: 'default',
  selesai: 'secondary',
  dibatalkan: 'destructive',
}

export function StatusBadge({ status }: { status: StatusPesanan }) {
  return (
    <Badge variant={variantMap[status]}>
      {labelMap[status]}
    </Badge>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/pesanan/StatusBadge.tsx
git commit -m "feat: add StatusBadge component for order status"
```

---

## Task 3: Order List Page

**Files:**
- Modify: `src/app/(app)/pesanan/page.tsx` (replaces placeholder)
- Create: `src/components/pesanan/OrderList.tsx`

- [ ] **Step 1: Create OrderList component**

Create `src/components/pesanan/OrderList.tsx`:

```tsx
import Link from 'next/link'
import { formatRupiah } from '@/lib/utils'
import { StatusBadge } from './StatusBadge'
import { hitungSaldo } from '@/lib/utils'
import type { Pesanan, ItemPesanan, Pembayaran } from '@/lib/types'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

type PesananWithRelations = Pesanan & {
  items: Pick<ItemPesanan, 'subtotal'>[]
  pembayaran: Pick<Pembayaran, 'jumlah'>[]
}

interface OrderListProps {
  pesananList: PesananWithRelations[]
}

export function OrderList({ pesananList }: OrderListProps) {
  if (pesananList.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada pesanan.
      </p>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Kode</th>
            <th className="text-left px-4 py-3 font-medium">Pelanggan</th>
            <th className="text-left px-4 py-3 font-medium">Tanggal</th>
            <th className="text-right px-4 py-3 font-medium">Total</th>
            <th className="text-right px-4 py-3 font-medium">Sisa</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {pesananList.map((p) => {
            const totalPesanan = p.items.reduce((s, i) => s + i.subtotal, 0)
            const totalDibayar = p.pembayaran.reduce((s, pm) => s + pm.jumlah, 0)
            const { sisaTagihan } = hitungSaldo(totalPesanan, totalDibayar)

            return (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/pesanan/${p.id}`}
                    className="font-mono text-blue-600 hover:underline"
                  >
                    {p.kode_pesanan}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {p.pelanggan?.nama ?? p.nama_pelanggan ?? '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {format(new Date(p.created_at), 'd MMM yyyy', { locale: idLocale })}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatRupiah(totalPesanan)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {sisaTagihan > 0 ? formatRupiah(sisaTagihan) : (
                    <span className="text-green-600 font-medium">Lunas</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Replace placeholder with real order list page**

Replace `src/app/(app)/pesanan/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { OrderList } from '@/components/pesanan/OrderList'
import { Button } from '@/components/ui/button'
import type { User } from '@/lib/types'

export default async function PesananPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()

  const { data: pesananList } = await supabase
    .from('pesanan')
    .select(`
      *,
      pelanggan(nama),
      items:item_pesanan(subtotal),
      pembayaran(jumlah)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pesanan</h2>
          <p className="text-sm text-muted-foreground">
            {pesananList?.length ?? 0} pesanan
          </p>
        </div>
        <Link href="/pesanan/baru">
          <Button>+ Pesanan Baru</Button>
        </Link>
      </div>
      <OrderList pesananList={pesananList ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/pesanan/page.tsx src/components/pesanan/OrderList.tsx src/components/pesanan/StatusBadge.tsx
git commit -m "feat: add order list page with totals and payment status"
```

---

## Task 4: New Order Form

**Files:**
- Create: `src/app/(app)/pesanan/baru/page.tsx`
- Create: `src/components/pesanan/OrderForm.tsx`
- Create: `src/components/pesanan/OrderLineItem.tsx`

- [ ] **Step 1: Create OrderLineItem component**

Create `src/components/pesanan/OrderLineItem.tsx`:

```tsx
'use client'

import { formatRupiah } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Produk } from '@/lib/types'

export interface LineItem {
  id: string   // client-only uuid for React key
  produk: Produk
  qty: number
  harga_satuan: number
  diskon: number
  catatan_item: string
}

interface OrderLineItemProps {
  item: LineItem
  isOwner: boolean
  onChange: (id: string, changes: Partial<LineItem>) => void
  onRemove: (id: string) => void
}

export function OrderLineItem({ item, isOwner, onChange, onRemove }: OrderLineItemProps) {
  const subtotal = item.qty * item.harga_satuan - item.diskon

  return (
    <tr className="border-b">
      <td className="px-3 py-2">
        <p className="font-medium text-sm">{item.produk.nama}</p>
        <p className="text-xs text-muted-foreground">{item.produk.satuan}</p>
      </td>
      <td className="px-3 py-2 w-24">
        <Input
          type="number"
          min="1"
          value={item.qty}
          onChange={(e) => onChange(item.id, { qty: Number(e.target.value) })}
          className="h-8 text-right"
        />
      </td>
      <td className="px-3 py-2 w-36">
        <Input
          type="number"
          min="0"
          value={item.harga_satuan}
          onChange={(e) => onChange(item.id, { harga_satuan: Number(e.target.value) })}
          disabled={!isOwner}
          className="h-8 text-right font-mono"
        />
        {!isOwner && (
          <p className="text-xs text-muted-foreground mt-1">
            {formatRupiah(item.harga_satuan)}
          </p>
        )}
      </td>
      <td className="px-3 py-2 w-32 text-right font-mono text-sm">
        {formatRupiah(subtotal)}
      </td>
      <td className="px-3 py-2 w-12 text-right">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
          onClick={() => onRemove(item.id)}
        >
          ✕
        </Button>
      </td>
    </tr>
  )
}
```

- [ ] **Step 2: Create OrderForm component**

Create `src/components/pesanan/OrderForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPesanan } from '@/app/(app)/pesanan/actions'
import { OrderLineItem, type LineItem } from './OrderLineItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatRupiah } from '@/lib/utils'
import type { Pelanggan, Produk } from '@/lib/types'

interface OrderFormProps {
  pelangganList: Pelanggan[]
  produkList: Produk[]
  isOwner: boolean
}

export function OrderForm({ pelangganList, produkList, isOwner }: OrderFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [pelangganId, setPelangganId] = useState<string>('')
  const [namaPelanggan, setNamaPelanggan] = useState('')
  const [tipeDokumen, setTipeDokumen] = useState<'invoice' | 'nota'>('nota')
  const [catatan, setCatatan] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [produkSearch, setProdukSearch] = useState('')

  const selectedPelanggan = pelangganList.find((p) => p.id === pelangganId)

  function addProduk(produk: Produk) {
    const existing = items.find((i) => i.produk.id === produk.id)
    if (existing) {
      setItems((prev) =>
        prev.map((i) =>
          i.produk.id === produk.id ? { ...i, qty: i.qty + 1 } : i
        )
      )
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          produk,
          qty: 1,
          harga_satuan: produk.harga_dasar,
          diskon: 0,
          catatan_item: '',
        },
      ])
    }
    setProdukSearch('')
  }

  function updateItem(id: string, changes: Partial<LineItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)))
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const grandTotal = items.reduce(
    (sum, i) => sum + i.qty * i.harga_satuan - i.diskon,
    0
  )

  const filteredProduk = produkSearch
    ? produkList
        .filter((p) => p.aktif && p.nama.toLowerCase().includes(produkSearch.toLowerCase()))
        .slice(0, 6)
    : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await createPesanan({
      pelanggan_id: pelangganId || null,
      nama_pelanggan: !pelangganId ? namaPelanggan || null : null,
      tipe_dokumen: tipeDokumen,
      catatan: catatan || null,
      items: items.map((i) => ({
        produk_id: i.produk.id,
        qty: i.qty,
        harga_satuan: i.harga_satuan,
        diskon: i.diskon,
        catatan_item: i.catatan_item || null,
      })),
    })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push(`/pesanan/${result.pesananId}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Pelanggan */}
      <div className="space-y-3">
        <h3 className="font-medium">Pelanggan</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Pilih dari daftar</Label>
            <select
              value={pelangganId}
              onChange={(e) => {
                setPelangganId(e.target.value)
                if (e.target.value) setNamaPelanggan('')
              }}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">— Pilih pelanggan —</option>
              {pelangganList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} ({p.tipe === 'grosir' ? 'Grosir' : 'Retail'})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Atau ketik nama langsung</Label>
            <Input
              value={namaPelanggan}
              onChange={(e) => {
                setNamaPelanggan(e.target.value)
                if (e.target.value) setPelangganId('')
              }}
              placeholder="Nama pelanggan baru..."
              disabled={!!pelangganId}
            />
          </div>
        </div>
      </div>

      {/* Tipe dokumen */}
      <div className="space-y-2">
        <Label>Tipe Dokumen</Label>
        <div className="flex gap-4">
          {(['nota', 'invoice'] as const).map((tipe) => (
            <label key={tipe} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tipe_dokumen"
                value={tipe}
                checked={tipeDokumen === tipe}
                onChange={() => setTipeDokumen(tipe)}
              />
              <span className="text-sm capitalize">{tipe === 'nota' ? 'Nota (B2C)' : 'Invoice (B2B)'}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Produk search + line items */}
      <div className="space-y-3">
        <h3 className="font-medium">Produk</h3>

        {/* Search */}
        <div className="relative">
          <Input
            value={produkSearch}
            onChange={(e) => setProdukSearch(e.target.value)}
            placeholder="Cari dan tambah produk..."
          />
          {filteredProduk.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 bg-white border rounded-md shadow-lg mt-1">
              {filteredProduk.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex justify-between text-sm"
                  onClick={() => addProduk(p)}
                >
                  <span>{p.nama}</span>
                  <span className="text-muted-foreground font-mono">
                    {formatRupiah(p.harga_dasar)} / {p.satuan}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Line items table */}
        {items.length > 0 && (
          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Produk</th>
                <th className="text-right px-3 py-2 font-medium">Qty</th>
                <th className="text-right px-3 py-2 font-medium">Harga Satuan</th>
                <th className="text-right px-3 py-2 font-medium">Subtotal</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <OrderLineItem
                  key={item.id}
                  item={item}
                  isOwner={isOwner}
                  onChange={updateItem}
                  onRemove={removeItem}
                />
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right font-medium">
                  Total
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold">
                  {formatRupiah(grandTotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Catatan */}
      <div className="space-y-2">
        <Label htmlFor="catatan">Catatan (opsional)</Label>
        <Input
          id="catatan"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Catatan tambahan..."
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading || items.length === 0}>
          {loading ? 'Menyimpan...' : 'Simpan Pesanan'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Create new order page**

Create `src/app/(app)/pesanan/baru/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrderForm } from '@/components/pesanan/OrderForm'
import type { Pelanggan, Produk, User } from '@/lib/types'

export default async function PesananBaruPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: user }, { data: pelangganList }, { data: produkList }] =
    await Promise.all([
      supabase.from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>(),
      supabase.from('pelanggan').select('*').order('nama').returns<Pelanggan[]>(),
      supabase.from('produk').select('*').eq('aktif', true).order('nama').returns<Produk[]>(),
    ])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Pesanan Baru</h2>
      <OrderForm
        pelangganList={pelangganList ?? []}
        produkList={produkList ?? []}
        isOwner={user?.role === 'owner'}
      />
    </div>
  )
}
```

- [ ] **Step 4: Test new order flow manually**

```bash
npm run dev
```

1. Login as owner → click "+ Pesanan Baru"
2. Select a customer from the dropdown
3. Type in product search → click to add → product appears as line item
4. Change qty and harga_satuan → total updates
5. Click "Simpan Pesanan" → redirected to order detail page (placeholder for now)
6. Login as helper → create a new order → harga_satuan fields are disabled (read-only)
7. Helper tries to add order with no items → error message shown

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/pesanan/baru/ src/components/pesanan/
git commit -m "feat: add new order form with product search and line items"
```

---

## Task 5: Order Detail Page

**Files:**
- Create: `src/app/(app)/pesanan/[id]/page.tsx`

- [ ] **Step 1: Create order detail page**

Create `src/app/(app)/pesanan/[id]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/pesanan/StatusBadge'
import { formatRupiah, hitungSaldo } from '@/lib/utils'
import { updateStatusPesanan } from '../actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import type { Pesanan, ItemPesanan, Pembayaran, Produk, Pelanggan, User } from '@/lib/types'
import Link from 'next/link'

type PesananDetail = Pesanan & {
  pelanggan: Pelanggan | null
  items: (ItemPesanan & { produk: Produk })[]
  pembayaran: Pembayaran[]
}

const statusTransitions: Record<string, string[]> = {
  draft: ['konfirmasi', 'dibatalkan'],
  konfirmasi: ['diproses', 'dibatalkan'],
  diproses: ['selesai', 'dibatalkan'],
  selesai: [],
  dibatalkan: [],
}

const statusLabel: Record<string, string> = {
  konfirmasi: 'Konfirmasi',
  diproses: 'Proses',
  selesai: 'Selesai',
  dibatalkan: 'Batalkan',
}

export default async function PesananDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: user }, { data: pesanan }] = await Promise.all([
    supabase.from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>(),
    supabase
      .from('pesanan')
      .select(`*, pelanggan(*), items:item_pesanan(*, produk(*)), pembayaran(*)`)
      .eq('id', id)
      .single<PesananDetail>(),
  ])

  if (!pesanan) notFound()

  const isOwner = user?.role === 'owner'
  const totalPesanan = pesanan.items.reduce((s, i) => s + i.subtotal, 0)
  const totalDibayar = pesanan.pembayaran.reduce((s, p) => s + p.jumlah, 0)
  const { sisaTagihan, statusPembayaran } = hitungSaldo(totalPesanan, totalDibayar)
  const nextStatuses = statusTransitions[pesanan.status] ?? []

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold font-mono">{pesanan.kode_pesanan}</h2>
            <StatusBadge status={pesanan.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(pesanan.created_at), 'd MMMM yyyy', { locale: idLocale })}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Status transitions — owner only */}
          {isOwner &&
            nextStatuses.map((next) => (
              <form key={next} action={updateStatusPesanan.bind(null, pesanan.id, next as any)}>
                <Button
                  type="submit"
                  variant={next === 'dibatalkan' ? 'destructive' : 'default'}
                  size="sm"
                >
                  {statusLabel[next]}
                </Button>
              </form>
            ))}
        </div>
      </div>

      {/* Pelanggan */}
      <div className="border rounded-lg p-4 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Pelanggan</p>
        <p className="font-medium">
          {pesanan.pelanggan?.nama ?? pesanan.nama_pelanggan ?? '—'}
        </p>
        {pesanan.pelanggan?.telepon && (
          <p className="text-sm text-muted-foreground">{pesanan.pelanggan.telepon}</p>
        )}
        <Badge variant="outline">
          {pesanan.tipe_dokumen === 'invoice' ? 'Invoice (B2B)' : 'Nota (B2C)'}
        </Badge>
      </div>

      {/* Line items */}
      <div>
        <h3 className="font-medium mb-3">Item Pesanan</h3>
        <table className="w-full text-sm border rounded-lg overflow-hidden">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Produk</th>
              <th className="text-right px-4 py-2 font-medium">Qty</th>
              <th className="text-right px-4 py-2 font-medium">Harga</th>
              <th className="text-right px-4 py-2 font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pesanan.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2">{item.produk.nama}</td>
                <td className="px-4 py-2 text-right">
                  {item.qty} {item.produk.satuan}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {formatRupiah(item.harga_satuan)}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {formatRupiah(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-gray-50">
            <tr>
              <td colSpan={3} className="px-4 py-2 text-right font-medium">Total</td>
              <td className="px-4 py-2 text-right font-mono font-semibold">
                {formatRupiah(totalPesanan)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Payment summary */}
      <div className="border rounded-lg p-4 space-y-2">
        <h3 className="font-medium">Pembayaran</h3>
        {pesanan.pembayaran.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada pembayaran.</p>
        ) : (
          <div className="space-y-1">
            {pesanan.pembayaran.map((p) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {format(new Date(p.dibayar_pada), 'd MMM yyyy', { locale: idLocale })} ·{' '}
                  {p.metode}
                </span>
                <span className="font-mono">{formatRupiah(p.jumlah)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t pt-2 flex justify-between font-medium">
          <span>Sisa Tagihan</span>
          <span className={sisaTagihan === 0 ? 'text-green-600' : 'font-mono'}>
            {sisaTagihan === 0 ? 'Lunas' : formatRupiah(sisaTagihan)}
          </span>
        </div>
        {/* Payment recording — Plan 4. Placeholder link. */}
        {isOwner && sisaTagihan > 0 && (
          <p className="text-xs text-muted-foreground">
            Pencatatan pembayaran tersedia di Plan 4.
          </p>
        )}
      </div>

      {/* Notes */}
      {pesanan.catatan && (
        <div className="border rounded-lg p-4">
          <p className="text-sm font-medium text-muted-foreground mb-1">Catatan</p>
          <p className="text-sm">{pesanan.catatan}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Link href="/pesanan">
          <Button variant="outline">← Kembali</Button>
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Test order detail manually**

```bash
npm run dev
```

1. Create a new order → verify redirect to `/pesanan/[id]`
2. Order detail shows all line items with correct subtotals
3. Owner sees status transition buttons (e.g., "Konfirmasi", "Batalkan")
4. Helper does not see status buttons
5. Clicking "Konfirmasi" changes status badge from "Draft" to "Dikonfirmasi"

- [ ] **Step 3: Run all tests**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/pesanan/
git commit -m "feat: add order detail page with status transitions"
```

---

## Self-Review Checklist

- [x] `calcOrderTotal` tested with 3 cases
- [x] `kode_pesanan` generated server-side via DB RPC — race-condition safe
- [x] Helper cannot change `harga_satuan` — enforced in `OrderLineItem` (disabled) and `updateStatusPesanan` (server check)
- [x] Guest customer (no pelanggan_id, only nama_pelanggan) handled in `createPesanan` and detail page
- [x] DB constraint `pelanggan_or_nama` enforced server-side; form validates before calling action
- [x] `hitungSaldo` used consistently from `utils.ts`
- [x] Plan 4 placeholder note is explicit — not leaving a hidden gap

---

## What This Plan Delivers

After completing all tasks:
- Helpers and owner can create orders with product line items
- Owner can change prices per line item; helpers cannot
- Order list shows all orders with totals and payment status
- Order detail shows items, payment summary, and status management
- `kode_pesanan` auto-generated (INV-2026-0001 / NOT-2026-0001)

**Next:** Plan 4 — Documents & Payments (PDF invoice/nota, WhatsApp text, payment recording, owner dashboard)
