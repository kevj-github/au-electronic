# AU Electronic — Plan 4: Documents & Payments

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PDF invoice/nota generation, WhatsApp text copy, payment recording, and the owner dashboard with receivables summary.

**Architecture:** PDFs are generated client-side using `@react-pdf/renderer` with a dynamic import to avoid SSR errors. The generated PDF is opened in a new tab for printing. WhatsApp text is formatted and copied to the OS clipboard. Payment recording is a modal form (client component) calling a Server Action.

**Tech Stack:** Next.js 15, @react-pdf/renderer, date-fns, Supabase, Vitest

**Prerequisite:** Plan 3 complete (orders exist, order detail page rendered).

**Spec:** `docs/superpowers/specs/2026-06-16-au-electronic-pos-design.md`

---

## File Structure

```
src/
├── app/(app)/
│   ├── dashboard/
│   │   └── page.tsx                    (replaces placeholder)
│   └── pesanan/
│       └── [id]/
│           └── page.tsx                (modified — add PDF + payment buttons)
├── components/
│   ├── pesanan/
│   │   ├── PaymentModal.tsx            (record payment modal)
│   │   └── DocumentButtons.tsx        (PDF + WhatsApp buttons)
│   └── invoice/
│       ├── InvoicePDF.tsx              (react-pdf Invoice template)
│       ├── NotaPDF.tsx                 (react-pdf Nota template)
│       └── whatsapp.ts                 (WhatsApp text formatter)
└── lib/
    └── invoice-data.ts                 (shared type for PDF/WhatsApp input)
```

---

## Task 1: WhatsApp Text Formatter

**Files:**
- Create: `src/components/invoice/whatsapp.ts`
- Create: `src/components/invoice/whatsapp.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/components/invoice/whatsapp.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatWhatsapp } from './whatsapp'
import type { InvoiceData } from '@/lib/invoice-data'

const mockData: InvoiceData = {
  kodePesanan: 'NOT-2026-0042',
  tanggal: '2026-06-16',
  namaPelanggan: 'Budi',
  tipeDokumen: 'nota',
  items: [
    { namaProduk: 'Dinamo Mesin', qty: 5, satuan: 'pcs', hargaSatuan: 150000, subtotal: 750000 },
    { namaProduk: 'Remote TV', qty: 10, satuan: 'pcs', hargaSatuan: 45000, subtotal: 450000 },
  ],
  totalPesanan: 1200000,
  totalDibayar: 500000,
  sisaTagihan: 700000,
  catatan: null,
}

describe('formatWhatsapp', () => {
  it('includes shop name and order code', () => {
    const text = formatWhatsapp(mockData)
    expect(text).toContain('*AU Electronic*')
    expect(text).toContain('NOT-2026-0042')
  })

  it('includes all line items', () => {
    const text = formatWhatsapp(mockData)
    expect(text).toContain('Dinamo Mesin')
    expect(text).toContain('Remote TV')
  })

  it('includes total and sisa', () => {
    const text = formatWhatsapp(mockData)
    expect(text).toContain('Rp 1.200.000')
    expect(text).toContain('Rp 700.000')
  })

  it('shows Lunas when fully paid', () => {
    const lunas = { ...mockData, totalDibayar: 1200000, sisaTagihan: 0 }
    const text = formatWhatsapp(lunas)
    expect(text).toContain('*Lunas*')
    expect(text).not.toContain('Sisa')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run src/components/invoice/whatsapp.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create InvoiceData type**

Create `src/lib/invoice-data.ts`:

```typescript
export interface InvoiceItem {
  namaProduk: string
  qty: number
  satuan: string
  hargaSatuan: number
  subtotal: number
}

export interface InvoiceData {
  kodePesanan: string
  tanggal: string              // ISO date string
  namaPelanggan: string
  alamatPelanggan?: string
  tipeDokumen: 'invoice' | 'nota'
  items: InvoiceItem[]
  totalPesanan: number
  totalDibayar: number
  sisaTagihan: number
  catatan: string | null
}
```

- [ ] **Step 4: Implement WhatsApp formatter**

Create `src/components/invoice/whatsapp.ts`:

```typescript
import { formatRupiah } from '@/lib/utils'
import type { InvoiceData } from '@/lib/invoice-data'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

export function formatWhatsapp(data: InvoiceData): string {
  const tanggal = format(new Date(data.tanggal), 'd/MM/yyyy', { locale: idLocale })

  const itemLines = data.items
    .map(
      (i) =>
        `• ${i.namaProduk} – ${i.qty}x ${formatRupiah(i.hargaSatuan)} = *${formatRupiah(i.subtotal)}*`
    )
    .join('\n')

  const pembayaranLine =
    data.sisaTagihan <= 0
      ? `*Lunas*`
      : `Dibayar: ${formatRupiah(data.totalDibayar)}\n*Sisa: ${formatRupiah(data.sisaTagihan)}*`

  const catatanLine = data.catatan ? `\nCatatan: ${data.catatan}` : ''

  return `*AU Electronic*
Pesanan #${data.kodePesanan} | ${tanggal}
Pelanggan: ${data.namaPelanggan}

${itemLines}

*Total: ${formatRupiah(data.totalPesanan)}*
${pembayaranLine}${catatanLine}

Terima kasih!`
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test:run src/components/invoice/whatsapp.test.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/invoice-data.ts src/components/invoice/whatsapp.ts src/components/invoice/whatsapp.test.ts
git commit -m "feat: add WhatsApp text formatter with tests"
```

---

## Task 2: Invoice PDF Template

**Files:**
- Create: `src/components/invoice/InvoicePDF.tsx`

- [ ] **Step 1: Install react-pdf**

```bash
npm install @react-pdf/renderer
```

- [ ] **Step 2: Create Invoice PDF component**

Create `src/components/invoice/InvoicePDF.tsx`:

```tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import { formatRupiah } from '@/lib/utils'
import type { InvoiceData } from '@/lib/invoice-data'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { marginBottom: 24 },
  shopName: { fontSize: 18, fontWeight: 'bold', marginBottom: 2 },
  shopSub: { fontSize: 9, color: '#666' },
  divider: { borderBottom: '1px solid #e5e7eb', marginVertical: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { color: '#6b7280', width: 80 },
  value: { flex: 1 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    padding: '6 8',
    borderBottom: '1px solid #e5e7eb',
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    padding: '6 8',
    borderBottom: '1px solid #f3f4f6',
  },
  colNama: { flex: 3 },
  colQty: { flex: 1, textAlign: 'right' },
  colHarga: { flex: 2, textAlign: 'right' },
  colSubtotal: { flex: 2, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 12,
  },
  totalLabel: { width: 100, textAlign: 'right', color: '#6b7280' },
  totalValue: { width: 100, textAlign: 'right', fontWeight: 'bold' },
  sisaValue: { width: 100, textAlign: 'right', fontWeight: 'bold', color: '#dc2626' },
  lunas: { width: 100, textAlign: 'right', fontWeight: 'bold', color: '#16a34a' },
  catatan: { marginTop: 16, color: '#6b7280' },
})

interface InvoicePDFProps {
  data: InvoiceData
}

export function InvoicePDF({ data }: InvoicePDFProps) {
  const tanggal = format(new Date(data.tanggal), 'd MMMM yyyy', { locale: idLocale })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.shopName}>AU Electronic</Text>
          <Text style={styles.shopSub}>Toko Spare Part Elektronik</Text>
        </View>

        <View style={styles.divider} />

        {/* Invoice meta */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8 }}>INVOICE</Text>
          <View style={styles.row}>
            <Text style={styles.label}>No</Text>
            <Text style={styles.value}>: {data.kodePesanan}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tanggal</Text>
            <Text style={styles.value}>: {tanggal}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Kepada</Text>
            <Text style={styles.value}>: {data.namaPelanggan}</Text>
          </View>
          {data.alamatPelanggan && (
            <View style={styles.row}>
              <Text style={styles.label}></Text>
              <Text style={styles.value}>  {data.alamatPelanggan}</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Table */}
        <View style={styles.tableHeader}>
          <Text style={styles.colNama}>Produk</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colHarga}>Harga Satuan</Text>
          <Text style={styles.colSubtotal}>Subtotal</Text>
        </View>
        {data.items.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.colNama}>{item.namaProduk}</Text>
            <Text style={styles.colQty}>{item.qty} {item.satuan}</Text>
            <Text style={styles.colHarga}>{formatRupiah(item.hargaSatuan)}</Text>
            <Text style={styles.colSubtotal}>{formatRupiah(item.subtotal)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={{ marginTop: 8 }}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatRupiah(data.totalPesanan)}</Text>
          </View>
          {data.totalDibayar > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Sudah Dibayar</Text>
              <Text style={styles.totalValue}>{formatRupiah(data.totalDibayar)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {data.sisaTagihan <= 0 ? 'Status' : 'Sisa Tagihan'}
            </Text>
            {data.sisaTagihan <= 0 ? (
              <Text style={styles.lunas}>LUNAS</Text>
            ) : (
              <Text style={styles.sisaValue}>{formatRupiah(data.sisaTagihan)}</Text>
            )}
          </View>
        </View>

        {data.catatan && (
          <Text style={styles.catatan}>Catatan: {data.catatan}</Text>
        )}
      </Page>
    </Document>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/invoice/InvoicePDF.tsx
git commit -m "feat: add Invoice PDF template with react-pdf"
```

---

## Task 3: Nota PDF Template

**Files:**
- Create: `src/components/invoice/NotaPDF.tsx`

- [ ] **Step 1: Create Nota PDF component**

Create `src/components/invoice/NotaPDF.tsx`:

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { formatRupiah } from '@/lib/utils'
import type { InvoiceData } from '@/lib/invoice-data'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10, fontFamily: 'Courier', width: 226 },  // ~80mm
  center: { textAlign: 'center' },
  bold: { fontFamily: 'Courier-Bold' },
  divider: { borderBottom: '1px dashed #666', marginVertical: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
    fontFamily: 'Courier-Bold',
  },
})

interface NotaPDFProps {
  data: InvoiceData
}

export function NotaPDF({ data }: NotaPDFProps) {
  const tanggal = format(new Date(data.tanggal), 'dd/MM/yyyy', { locale: idLocale })

  return (
    <Document>
      <Page size={[226, 800]} style={styles.page}>
        <Text style={{ ...styles.center, ...styles.bold, fontSize: 12, marginBottom: 2 }}>
          AU Electronic
        </Text>
        <Text style={{ ...styles.center, fontSize: 8, marginBottom: 4 }}>
          Toko Spare Part Elektronik
        </Text>
        <View style={styles.divider} />

        <View style={styles.row}>
          <Text>Nota #</Text>
          <Text style={styles.bold}>{data.kodePesanan}</Text>
        </View>
        <View style={styles.row}>
          <Text>Tgl</Text>
          <Text>{tanggal}</Text>
        </View>
        <View style={styles.row}>
          <Text>Pelanggan</Text>
          <Text>{data.namaPelanggan}</Text>
        </View>

        <View style={styles.divider} />

        {data.items.map((item, i) => (
          <View key={i} style={{ marginBottom: 3 }}>
            <Text style={styles.bold}>{item.namaProduk}</Text>
            <View style={styles.row}>
              <Text>  {item.qty}x {formatRupiah(item.hargaSatuan)}</Text>
              <Text>{formatRupiah(item.subtotal)}</Text>
            </View>
          </View>
        ))}

        <View style={styles.divider} />

        <View style={styles.totalRow}>
          <Text>Total</Text>
          <Text>{formatRupiah(data.totalPesanan)}</Text>
        </View>
        {data.totalDibayar > 0 && (
          <View style={styles.row}>
            <Text>Dibayar</Text>
            <Text>{formatRupiah(data.totalDibayar)}</Text>
          </View>
        )}
        <View style={styles.totalRow}>
          <Text>{data.sisaTagihan <= 0 ? 'Status' : 'Sisa'}</Text>
          <Text>{data.sisaTagihan <= 0 ? 'LUNAS' : formatRupiah(data.sisaTagihan)}</Text>
        </View>

        {data.catatan && (
          <>
            <View style={styles.divider} />
            <Text style={{ fontSize: 8 }}>Catatan: {data.catatan}</Text>
          </>
        )}

        <View style={styles.divider} />
        <Text style={{ ...styles.center, fontSize: 8, marginTop: 4 }}>Terima kasih!</Text>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/invoice/NotaPDF.tsx
git commit -m "feat: add Nota PDF template for B2C receipts"
```

---

## Task 4: Document Buttons Component

**Files:**
- Create: `src/components/pesanan/DocumentButtons.tsx`

- [ ] **Step 1: Create DocumentButtons client component**

Create `src/components/pesanan/DocumentButtons.tsx`:

```tsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { pdf } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { formatWhatsapp } from '@/components/invoice/whatsapp'
import type { InvoiceData } from '@/lib/invoice-data'

// Lazy-load PDF components to avoid SSR issues
const InvoicePDF = dynamic(
  () => import('@/components/invoice/InvoicePDF').then((m) => m.InvoicePDF),
  { ssr: false }
)
const NotaPDF = dynamic(
  () => import('@/components/invoice/NotaPDF').then((m) => m.NotaPDF),
  { ssr: false }
)

interface DocumentButtonsProps {
  data: InvoiceData
}

export function DocumentButtons({ data }: DocumentButtonsProps) {
  const [copying, setCopying] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  async function handlePrint() {
    setPdfLoading(true)
    try {
      const Component = data.tipeDokumen === 'invoice' ? InvoicePDF : NotaPDF
      // @ts-expect-error dynamic component type
      const blob = await pdf(<Component data={data} />).toBlob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } finally {
      setPdfLoading(false)
    }
  }

  async function handleCopyWhatsapp() {
    setCopying(true)
    try {
      const text = formatWhatsapp(data)
      await navigator.clipboard.writeText(text)
      setTimeout(() => setCopying(false), 2000)
    } catch {
      setCopying(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handlePrint} disabled={pdfLoading}>
        {pdfLoading ? 'Memuat...' : data.tipeDokumen === 'invoice' ? '🖨 Cetak Invoice' : '🖨 Cetak Nota'}
      </Button>
      <Button variant="outline" size="sm" onClick={handleCopyWhatsapp}>
        {copying ? '✓ Disalin!' : '📋 Copy WhatsApp'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/pesanan/DocumentButtons.tsx
git commit -m "feat: add DocumentButtons for PDF print and WhatsApp copy"
```

---

## Task 5: Integrate Document Buttons into Order Detail

**Files:**
- Modify: `src/app/(app)/pesanan/[id]/page.tsx`

- [ ] **Step 1: Add DocumentButtons and InvoiceData to order detail**

Open `src/app/(app)/pesanan/[id]/page.tsx`. Add the following import at the top:

```typescript
import { DocumentButtons } from '@/components/pesanan/DocumentButtons'
import type { InvoiceData } from '@/lib/invoice-data'
import { hitungSaldo } from '@/lib/utils'
```

After the `hitungSaldo` call (which already exists), build the `invoiceData` object. Add this block after the `const { sisaTagihan, statusPembayaran } = hitungSaldo(...)` line:

```typescript
  const invoiceData: InvoiceData = {
    kodePesanan: pesanan.kode_pesanan,
    tanggal: pesanan.created_at,
    namaPelanggan: pesanan.pelanggan?.nama ?? pesanan.nama_pelanggan ?? '—',
    alamatPelanggan: pesanan.pelanggan?.alamat ?? undefined,
    tipeDokumen: pesanan.tipe_dokumen,
    items: pesanan.items.map((i) => ({
      namaProduk: i.produk.nama,
      qty: i.qty,
      satuan: i.produk.satuan,
      hargaSatuan: i.harga_satuan,
      subtotal: i.subtotal,
    })),
    totalPesanan,
    totalDibayar,
    sisaTagihan,
    catatan: pesanan.catatan,
  }
```

In the JSX header section, add `<DocumentButtons data={invoiceData} />` next to the status transition buttons:

```tsx
        <div className="flex gap-2 flex-wrap">
          <DocumentButtons data={invoiceData} />
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
```

- [ ] **Step 2: Test PDF generation manually**

```bash
npm run dev
```

1. Open any order detail page
2. Click "Cetak Nota" (or "Cetak Invoice") → a new browser tab opens with the PDF
3. Click "Copy WhatsApp" → button shows "✓ Disalin!" for 2 seconds
4. Paste into a text editor → verify the WhatsApp format matches the spec

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/pesanan/
git commit -m "feat: integrate PDF print and WhatsApp copy into order detail"
```

---

## Task 6: Payment Recording

**Files:**
- Create: `src/app/(app)/pesanan/[id]/payment-actions.ts`
- Create: `src/components/pesanan/PaymentModal.tsx`
- Modify: `src/app/(app)/pesanan/[id]/page.tsx`

- [ ] **Step 1: Create payment server actions**

Create `src/app/(app)/pesanan/[id]/payment-actions.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { MetodePembayaran } from '@/lib/types'

export async function createPembayaran(
  pesananId: string,
  formData: FormData
) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single()
  if (user?.role !== 'owner') return { error: 'Hanya pemilik yang bisa mencatat pembayaran.' }

  const jumlah = Number(formData.get('jumlah'))
  const metode = formData.get('metode') as MetodePembayaran
  const catatan = formData.get('catatan') as string
  const dibayar_pada = formData.get('dibayar_pada') as string

  if (!jumlah || jumlah <= 0) return { error: 'Jumlah pembayaran tidak valid.' }
  if (!metode) return { error: 'Pilih metode pembayaran.' }

  const { error } = await supabase.from('pembayaran').insert({
    pesanan_id: pesananId,
    jumlah,
    metode,
    catatan: catatan || null,
    dibayar_pada: dibayar_pada || new Date().toISOString(),
    dicatat_oleh: authUser.id,
  })

  if (error) return { error: error.message }

  revalidatePath(`/pesanan/${pesananId}`)
  return {}
}

export async function deletePembayaran(pembayaranId: string, pesananId: string) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single()
  if (user?.role !== 'owner') return { error: 'Hanya pemilik yang bisa menghapus pembayaran.' }

  const { error } = await supabase.from('pembayaran').delete().eq('id', pembayaranId)
  if (error) return { error: error.message }

  revalidatePath(`/pesanan/${pesananId}`)
  return {}
}
```

- [ ] **Step 2: Create PaymentModal component**

Create `src/components/pesanan/PaymentModal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createPembayaran } from '@/app/(app)/pesanan/[id]/payment-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { format } from 'date-fns'

interface PaymentModalProps {
  pesananId: string
  sisaTagihan: number
}

export function PaymentModal({ pesananId, sisaTagihan }: PaymentModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await createPembayaran(pesananId, new FormData(e.currentTarget))
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setOpen(false)
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Catat Pembayaran</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Catat Pembayaran</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="jumlah">Jumlah (Rp)</Label>
            <Input
              id="jumlah"
              name="jumlah"
              type="number"
              min="1"
              defaultValue={sisaTagihan}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metode">Metode Pembayaran</Label>
            <select
              id="metode"
              name="metode"
              className="w-full border rounded-md px-3 py-2 text-sm"
              required
            >
              <option value="tunai">Tunai</option>
              <option value="transfer">Transfer</option>
              <option value="lainnya">Lainnya</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dibayar_pada">Tanggal Bayar</Label>
            <Input
              id="dibayar_pada"
              name="dibayar_pada"
              type="date"
              defaultValue={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="catatan">Catatan (opsional)</Label>
            <Input id="catatan" name="catatan" placeholder="Catatan..." />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

Add Dialog component from shadcn:

```bash
npx shadcn@latest add dialog
```

- [ ] **Step 3: Integrate PaymentModal into order detail**

Open `src/app/(app)/pesanan/[id]/page.tsx`.

Add imports:

```typescript
import { PaymentModal } from '@/components/pesanan/PaymentModal'
import { deletePembayaran } from './payment-actions'
```

Replace the payment section's placeholder comment with:

```tsx
      {/* Payment recording */}
      <div className="border rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Pembayaran</h3>
          {isOwner && sisaTagihan > 0 && (
            <PaymentModal pesananId={pesanan.id} sisaTagihan={sisaTagihan} />
          )}
        </div>
        {pesanan.pembayaran.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada pembayaran.</p>
        ) : (
          <div className="space-y-1">
            {pesanan.pembayaran.map((p) => (
              <div key={p.id} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  {format(new Date(p.dibayar_pada), 'd MMM yyyy', { locale: idLocale })} ·{' '}
                  {p.metode}
                  {p.catatan ? ` · ${p.catatan}` : ''}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono">{formatRupiah(p.jumlah)}</span>
                  {isOwner && (
                    <form action={deletePembayaran.bind(null, p.id, pesanan.id)}>
                      <button
                        type="submit"
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Hapus
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="border-t pt-2 flex justify-between font-medium">
          <span>Sisa Tagihan</span>
          <span className={sisaTagihan === 0 ? 'text-green-600' : 'font-mono'}>
            {sisaTagihan === 0 ? 'Lunas ✓' : formatRupiah(sisaTagihan)}
          </span>
        </div>
      </div>
```

- [ ] **Step 4: Test payment flow manually**

```bash
npm run dev
```

1. Open an order with outstanding balance
2. Click "+ Catat Pembayaran" → modal opens
3. Fill in amount, method, date → click "Simpan" → modal closes, payment appears in list
4. Sisa tagihan decreases accordingly
5. Record full remaining balance → status shows "Lunas ✓"
6. Click "Hapus" on a payment → payment disappears, balance recalculates
7. Login as helper → no "+ Catat Pembayaran" button visible

- [ ] **Step 5: Run all tests**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/pesanan/ src/components/pesanan/PaymentModal.tsx
git commit -m "feat: add payment recording and deletion for owner"
```

---

## Task 7: Owner Dashboard

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx` (replaces placeholder)

- [ ] **Step 1: Replace placeholder with real dashboard**

Replace `src/app/(app)/dashboard/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatRupiah, hitungSaldo } from '@/lib/utils'
import { StatusBadge } from '@/components/pesanan/StatusBadge'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import type { User } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()
  if (user?.role !== 'owner') redirect('/pesanan')

  const today = new Date()
  const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString()

  const [{ data: allPesanan }, { data: todayPesanan }] = await Promise.all([
    supabase
      .from('pesanan')
      .select(`*, pelanggan(nama), items:item_pesanan(subtotal), pembayaran(jumlah)`)
      .not('status', 'eq', 'dibatalkan')
      .order('created_at', { ascending: true }),
    supabase
      .from('pesanan')
      .select(`id`)
      .gte('created_at', todayStart)
      .not('status', 'eq', 'dibatalkan'),
  ])

  // Calculate piutang (outstanding)
  const piutangList = (allPesanan ?? [])
    .map((p) => {
      const totalPesanan = (p.items ?? []).reduce((s: number, i: any) => s + i.subtotal, 0)
      const totalDibayar = (p.pembayaran ?? []).reduce((s: number, pm: any) => s + pm.jumlah, 0)
      const { sisaTagihan, statusPembayaran } = hitungSaldo(totalPesanan, totalDibayar)
      return { ...p, totalPesanan, totalDibayar, sisaTagihan, statusPembayaran }
    })
    .filter((p) => p.sisaTagihan > 0)

  const totalPiutang = piutangList.reduce((s, p) => s + p.sisaTagihan, 0)

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Dashboard</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Pesanan Hari Ini</p>
          <p className="text-2xl font-semibold mt-1">{todayPesanan?.length ?? 0}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Piutang</p>
          <p className="text-2xl font-semibold mt-1 text-red-600">
            {formatRupiah(totalPiutang)}
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Belum Lunas</p>
          <p className="text-2xl font-semibold mt-1">{piutangList.length} pesanan</p>
        </div>
      </div>

      {/* Piutang list */}
      <div>
        <h3 className="font-medium mb-3">Tagihan Belum Lunas (terlama dulu)</h3>
        {piutangList.length === 0 ? (
          <p className="text-sm text-muted-foreground">Semua pesanan sudah lunas.</p>
        ) : (
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
                {piutangList.map((p) => (
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
                      {formatRupiah(p.totalPesanan)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-600 font-medium">
                      {formatRupiah(p.sisaTagihan)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Test dashboard manually**

```bash
npm run dev
```

1. Login as owner → click "Dashboard" in sidebar
2. Summary cards show today's order count, total piutang, and count of unpaid orders
3. Piutang table lists orders oldest first with correct sisa tagihan
4. Clicking a kode_pesanan link opens the order detail
5. After recording a payment that settles an order, it disappears from the piutang list (requires page refresh)
6. Login as helper → navigate directly to `/dashboard` → redirected to `/pesanan`

- [ ] **Step 3: Run all tests**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/dashboard/
git commit -m "feat: add owner dashboard with piutang summary"
```

---

## Task 8: Helper Account Management

**Files:**
- Create: `src/app/(app)/pengaturan/page.tsx`
- Create: `src/app/(app)/pengaturan/actions.ts`

- [ ] **Step 1: Create helper management actions**

Create `src/app/(app)/pengaturan/actions.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function createHelper(formData: FormData) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  const { data: currentUser } = await supabase
    .from('users').select('role').eq('id', authUser.id).single()
  if (currentUser?.role !== 'owner') return { error: 'Akses ditolak.' }

  const email = formData.get('email') as string
  const nama = formData.get('nama') as string
  const password = formData.get('password') as string

  if (!email || !nama || !password) return { error: 'Semua kolom wajib diisi.' }
  if (password.length < 6) return { error: 'Password minimal 6 karakter.' }

  const adminClient = getAdminClient()

  // Create auth user
  const { data: newAuthUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError) return { error: authError.message }

  // Insert users record
  const { error: userError } = await adminClient.from('users').insert({
    id: newAuthUser.user.id,
    email,
    role: 'helper',
    nama,
  })
  if (userError) return { error: userError.message }

  revalidatePath('/pengaturan')
  return {}
}

export async function deleteHelper(helperId: string) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  const { data: currentUser } = await supabase
    .from('users').select('role').eq('id', authUser.id).single()
  if (currentUser?.role !== 'owner') return { error: 'Akses ditolak.' }

  const adminClient = getAdminClient()
  const { error } = await adminClient.auth.admin.deleteUser(helperId)
  if (error) return { error: error.message }
  // The public.users row is deleted by cascade (FK on delete cascade)

  revalidatePath('/pengaturan')
  return {}
}
```

- [ ] **Step 2: Add SUPABASE_SERVICE_ROLE_KEY to environment**

Add to `.env.local`:

```
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key-from-supabase-dashboard>
```

Add to `.env.example`:

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Add to Vercel environment variables:

Go to Vercel project settings → Environment Variables → add `SUPABASE_SERVICE_ROLE_KEY` with the service role key from Supabase dashboard → Settings → API.

- [ ] **Step 3: Create settings page**

Create `src/app/(app)/pengaturan/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createHelper, deleteHelper } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { User } from '@/lib/types'

export default async function PengaturanPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()
  if (user?.role !== 'owner') redirect('/pesanan')

  const { data: helpers } = await supabase
    .from('users')
    .select('id, nama, email')
    .eq('role', 'helper')
    .order('nama')

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold">Pengaturan</h2>
        <p className="text-sm text-muted-foreground">Kelola akun helper.</p>
      </div>

      {/* Existing helpers */}
      <div>
        <h3 className="font-medium mb-3">Daftar Helper</h3>
        {!helpers || helpers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada helper terdaftar.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Nama</th>
                  <th className="text-left px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {helpers.map((h) => (
                  <tr key={h.id}>
                    <td className="px-4 py-2">{h.nama}</td>
                    <td className="px-4 py-2 text-muted-foreground">{h.email}</td>
                    <td className="px-4 py-2 text-right">
                      <form action={deleteHelper.bind(null, h.id)}>
                        <Button type="submit" variant="ghost" size="sm" className="text-red-500">
                          Hapus
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add helper form */}
      <div>
        <h3 className="font-medium mb-3">Tambah Helper Baru</h3>
        <form action={createHelper} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nama">Nama</Label>
            <Input id="nama" name="nama" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" minLength={6} required />
          </div>
          <Button type="submit">Tambah Helper</Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test helper management manually**

```bash
npm run dev
```

1. Login as owner → click "Pengaturan"
2. Fill in helper name, email, password → click "Tambah Helper" → appears in the list
3. Login with the new helper credentials → app shell loads with restricted navigation (no Produk, Dashboard, Pengaturan in sidebar)
4. Back as owner → click "Hapus" next to the helper → removed from list

- [ ] **Step 5: Run all tests**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 6: Commit and deploy**

```bash
git add src/app/\(app\)/pengaturan/ .env.example
git commit -m "feat: add helper account management for owner"
git push origin main
```

Vercel will auto-deploy on push. Verify the production URL works end-to-end.

---

## Self-Review Checklist

- [x] WhatsApp formatter tested with 4 cases including Lunas state
- [x] PDF generation uses dynamic import — no SSR crash
- [x] `SUPABASE_SERVICE_ROLE_KEY` added to `.env.example` (not `.env.local`) — safe
- [x] Payment recording is owner-only — enforced in server action (role check)
- [x] Delete payment is owner-only — same enforcement
- [x] Dashboard redirects helpers to `/pesanan`
- [x] `InvoiceData` type defined once in `src/lib/invoice-data.ts`, used by both PDF components and WhatsApp formatter — no type duplication
- [x] All function names consistent: `createPembayaran`, `deletePembayaran`, `createHelper`, `deleteHelper`

---

## What This Plan Delivers

After completing all 4 plans:
- Full order management system in Bahasa Indonesia
- Owner and helper roles with appropriate access
- Printable PDF invoice (B2B) and nota (B2C)
- WhatsApp text copy for helpers to forward to customers
- Payment recording and sisa tagihan tracking
- Owner dashboard with outstanding receivables
- Deployed on Vercel with Supabase backend
