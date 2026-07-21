# Cetak Epson (ESC/P via QZ Tray) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an owner-only "Cetak Epson" button that prints a crisp ESC/P text receipt to an Epson LX-310 via QZ Tray, leaving the existing "Cetak PDF" flow untouched.

**Architecture:** A pure `buildEscP(data)` module turns an order into an ESC/P command string sized for a 9.5×5.5″ continuous form at 10 CPI / 80 columns. A thin `qz.ts` helper lazy-loads and configures QZ Tray (community/unsigned) for raw printing. A new Pengaturan setting stores the target printer name (with a QZ "Deteksi" helper). The print button reads that name, builds the ESC/P, and sends it raw over `wss://localhost` to the printer's spooler in RAW mode, bypassing driver rasterization.

**Tech Stack:** Next.js (this repo's fork — see `AGENTS.md`), React client components, `@react-pdf/renderer` (existing, untouched), `qz-tray` (new), Supabase (settings table), Vitest, date-fns.

## Global Constraints

- **Printer:** Epson LX-310, 9-pin, ESC/P (not ESC/P2), single black ribbon, ~8″ printable width. Minimal bold only (blur mitigation).
- **Paper / layout:** 9.5 × 5.5 inch form → page length 33 lines (6 LPI), 80-column grid at 10 CPI. Keep all content within **79 columns** so nothing clips in the tractor zone.
- **`'use server'` files: every export must be `async`.** Sync exports break `npm run build`. Always run `npm run build` before considering a Server Action change done.
- **Never import `qz-tray` at module top level or into a Server Component.** It is browser-only; import it dynamically inside client handlers (via `@/lib/qz`). Mirrors the existing rule for not passing `next/dynamic` components into `pdf()`.
- **Owner-only surface:** the button lives inside `DocumentButtons`, already gated by `{isOwner && invoiceData && ...}` in `pesanan/[id]/page.tsx:158`. All new Server Actions must call `requireOwner`.
- **`requireOwner(supabase)`** returns `null` on success or `{ error: string }` on failure.
- **Supabase is remote-only.** Schema/seed changes go to the live project (ref `pjkddahrjjqblexxhaef`) via the Supabase MCP tools; migration files under `supabase/migrations/` are a record of what was applied.
- **All UI copy in Indonesian.**
- **This feature's only real proof is the physical printout.** Unit tests cover the ESC/P bytes; crispness, clipping, and top-of-form alignment need on-hardware verification. `ITEMS_PER_PAGE` and page length may need tuning on the LX-310.

---

### Task 1: ESC/P builder (`buildEscP`)

**Files:**
- Create: `src/lib/escp.ts`
- Test: `src/lib/escp.test.ts`

**Interfaces:**
- Consumes: `InvoiceData` from `@/lib/invoice-data`; `formatNumberID` from `@/lib/utils`.
- Produces: `export function buildEscP(data: InvoiceData): string` — an ESC/P command stream (control chars embedded). Used by Task 4.

- [ ] **Step 1: Write the failing test**

Create `src/lib/escp.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildEscP } from './escp'
import type { InvoiceData } from '@/lib/invoice-data'

const base: InvoiceData = {
  kodePesanan: 'AU.2026.07.00042',
  tanggal: '2026-07-16',
  tanggalPengiriman: '2026-07-20',
  namaPelanggan: 'Budi',
  alamatPelanggan: 'Jl. Mawar 10',
  items: [
    { namaBarang: 'Relay PTC 3 Pin', qty: 10, hargaSatuan: 8500, subtotal: 85000 },
    { namaBarang: 'Kit Tunersys 504', qty: 4, hargaSatuan: 620000, subtotal: 1240000 },
  ],
  totalPesanan: 1325000,
  totalDibayar: 0,
  sisaTagihan: 1325000,
  catatan: null,
}

// 13 items force a second page (ITEMS_PER_PAGE = 12).
const manyItems: InvoiceData = {
  ...base,
  items: Array.from({ length: 13 }, (_, i) => ({
    namaBarang: `Barang ${i + 1}`,
    qty: 1,
    hargaSatuan: 1000,
    subtotal: 1000,
  })),
  totalPesanan: 13000,
  sisaTagihan: 13000,
}

describe('buildEscP', () => {
  it('starts with the printer reset and page-length commands', () => {
    const out = buildEscP(base)
    expect(out.startsWith('\x1B@')).toBe(true)   // ESC @ reset
    expect(out).toContain('\x1B\x43\x21')          // ESC C 33 (page length)
  })

  it('includes the shop name and both dates in the header', () => {
    const out = buildEscP(base)
    expect(out).toContain('AU ELECTRONIC')
    expect(out).toContain('Tgl. Pesanan: 16 Jul 2026')
    expect(out).toContain('Tgl. Pengiriman: 20 Jul 2026')
    expect(out).toContain('Kepada Yth: Budi')
  })

  it('formats numbers with Indonesian dot grouping', () => {
    const out = buildEscP(base)
    expect(out).toContain('1.240.000')
    expect(out).toContain('TOTAL')
    expect(out).toContain('1.325.000')
  })

  it('keeps every printed line within 79 columns', () => {
    // Strip ESC/P control codes, then check visible line widths.
    const visible = buildEscP(base)
      .replace(/\x1B[@EFP]/g, '')
      .replace(/\x1B\x43\x21/g, '')
    for (const line of visible.split('\n')) {
      const clean = line.replace(/\x0C/g, '')
      expect(clean.length).toBeLessThanOrEqual(79)
    }
  })

  it('shows "Belum ditentukan" when there is no delivery date', () => {
    const out = buildEscP({ ...base, tanggalPengiriman: undefined })
    expect(out).toContain('Tgl. Pengiriman: Belum ditentukan')
  })

  it('paginates at 12 items with a form-feed per page and TOTAL only on the last', () => {
    const out = buildEscP(manyItems)
    const formFeeds = (out.match(/\x0C/g) ?? []).length
    expect(formFeeds).toBe(2)                         // two pages -> two FFs
    expect((out.match(/TOTAL/g) ?? []).length).toBe(1) // TOTAL once, last page
  })

  it('ends with a form-feed so the next receipt aligns to the next form', () => {
    expect(buildEscP(base).endsWith('\x0C')).toBe(true)
  })

  it('wraps item names longer than the name column onto a continuation line', () => {
    const longName = 'RELAY PTC 3 PIN PANJANG SEKALI UNTUK MENGUJI PEMBUNGKUSAN'
    const out = buildEscP({
      ...base,
      items: [{ namaBarang: longName, qty: 1, hargaSatuan: 1000, subtotal: 1000 }],
    })
    // Remainder past 34 chars appears on its own line.
    expect(out).toContain(longName.slice(34))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/lib/escp.test.ts`
Expected: FAIL — `Failed to resolve import "./escp"` / `buildEscP is not a function`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/escp.ts`:

```ts
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { formatNumberID } from '@/lib/utils'
import type { InvoiceData } from '@/lib/invoice-data'

// ESC/P control codes for the 9-pin Epson LX-310.
const ESC = '\x1B'
const INIT = ESC + '@' // reset printer to power-on defaults
const PAGE_LENGTH_33 = ESC + 'C' + '\x21' // ESC C n -> page length = 33 lines (5.5" @ 6 LPI)
const BOLD_ON = ESC + 'E'
const BOLD_OFF = ESC + 'F'
const FF = '\x0C' // form feed -> advance to next form's top edge
const LF = '\n'

// Keep everything inside 79 columns so nothing lands in the tractor-hole strip.
const WIDTH = 79
// Matches DocumentPDF's ITEMS_PER_PAGE so Epson and PDF page breaks align.
const ITEMS_PER_PAGE = 12

// Column character widths; fields are joined with single spaces (5 separators).
// 3 + 4 + 34 + 12 + 12 + 8 + 5 = 78 <= 79.
const COL = { no: 3, qty: 4, nama: 34, harga: 12, jumlah: 12, check: 8 } as const

function padEnd(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length)
}
function padStart(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s
}

// One fixed-width table row (used for both the header row and item rows).
function row(no: string, qty: string, nama: string, harga: string, jumlah: string, check: string): string {
  return [
    padEnd(no, COL.no),
    padStart(qty, COL.qty),
    padEnd(nama, COL.nama),
    padStart(harga, COL.harga),
    padStart(jumlah, COL.jumlah),
    padEnd(check, COL.check),
  ].join(' ')
}

// Split a name into chunks that each fit the NAMA column.
function wrapName(name: string): string[] {
  const chunks: string[] = []
  for (let i = 0; i < name.length; i += COL.nama) chunks.push(name.slice(i, i + COL.nama))
  return chunks.length ? chunks : ['']
}

function itemLines(item: InvoiceData['items'][number], index: number): string {
  const chunks = wrapName(item.namaBarang.toUpperCase())
  const lines: string[] = [
    row(
      String(index + 1),
      String(item.qty),
      chunks[0],
      formatNumberID(item.hargaSatuan),
      formatNumberID(item.subtotal),
      '',
    ),
  ]
  for (let i = 1; i < chunks.length; i++) lines.push(row('', '', chunks[i], '', '', ''))
  return lines.join(LF)
}

function headerBlock(data: InvoiceData, tanggal: string, tanggalPengiriman: string): string {
  const shopName = 'AU ELECTRONIC  spare parts'
  const left = [
    shopName,
    'Genteng Electronic Center',
    'Jl. Genteng Besar 43 Lt. 1 No. 109-111 Surabaya',
    'No. HP/WA: 081 2351 7994',
  ]
  const right = [
    `Tgl. Pesanan: ${tanggal}`,
    `Tgl. Pengiriman: ${tanggalPengiriman}`,
    `Kepada Yth: ${data.namaPelanggan}`,
    data.alamatPelanggan ?? '',
  ]
  return left
    .map((l, i) => {
      const r = right[i]
      const gap = Math.max(1, WIDTH - l.length - r.length)
      const line = l + ' '.repeat(gap) + r
      // Bold only the shop-name portion of the first line (blur mitigation).
      return i === 0 ? BOLD_ON + shopName + BOLD_OFF + line.slice(shopName.length) : line
    })
    .join(LF)
}

function footerBlock(data: InvoiceData, isLastPage: boolean): string {
  const lines = [
    '',
    'Perhatian:',
    'Barang yang sudah dibeli, tidak bisa ditukar / dikembalikan,',
    'kecuali sesuai perjanjian.',
    '',
    'Penerima,',
    '',
    '_______________________',
  ]
  if (isLastPage) {
    const totalText = `TOTAL : ${formatNumberID(data.totalPesanan)}`
    lines.push('', BOLD_ON + padStart(totalText, WIDTH) + BOLD_OFF)
  }
  return lines.join(LF)
}

/**
 * Build a raw ESC/P command stream for the Epson LX-310. Pure function of its
 * input: no browser or printer dependency, so it is fully unit-testable. The
 * stream resets the printer, sets a 33-line page length, then emits one form per
 * chunk of 12 items (header + rows + per-page subtotal + footer), form-feeding
 * between forms and at the end so each receipt lands on a fresh form's top edge.
 */
export function buildEscP(data: InvoiceData): string {
  const tanggal = format(new Date(data.tanggal), 'd MMM yyyy', { locale: idLocale })
  const tanggalPengiriman = data.tanggalPengiriman
    ? format(new Date(data.tanggalPengiriman), 'd MMM yyyy', { locale: idLocale })
    : 'Belum ditentukan'

  const chunks: InvoiceData['items'][] = []
  for (let i = 0; i < data.items.length; i += ITEMS_PER_PAGE) {
    chunks.push(data.items.slice(i, i + ITEMS_PER_PAGE))
  }
  if (chunks.length === 0) chunks.push([])

  let out = INIT + PAGE_LENGTH_33

  chunks.forEach((pageItems, pageIndex) => {
    const isLast = pageIndex === chunks.length - 1
    const startIndex = pageIndex * ITEMS_PER_PAGE
    const pageSubtotal = pageItems.reduce((s, it) => s + it.subtotal, 0)

    const parts = [
      headerBlock(data, tanggal, tanggalPengiriman),
      '='.repeat(WIDTH),
      row('NO', 'QTY', 'NAMA BARANG', 'HARGA(Rp)', 'JUMLAH(Rp)', 'CHECK'),
      '-'.repeat(WIDTH),
      ...pageItems.map((item, i) => itemLines(item, startIndex + i)),
      padStart(`SUBTOTAL : ${formatNumberID(pageSubtotal)}`, WIDTH),
      footerBlock(data, isLast),
    ]
    out += parts.join(LF) + FF
  })

  return out
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/lib/escp.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/escp.ts src/lib/escp.test.ts
git commit -m "feat: tambah ESC/P builder untuk struk Epson LX-310"
```

---

### Task 2: Printer-name setting backend

**Files:**
- Create: `supabase/migrations/20260721120000_add_epson_printer_name_setting.sql`
- Modify: `src/app/(app)/pengaturan/actions.ts` (append two exports)

**Interfaces:**
- Produces:
  - `export async function updateEpsonPrinterName(name: string): Promise<{ error?: string }>` — used by Task 3.
  - `export async function getEpsonPrinterName(): Promise<{ name: string; error?: string }>` — used by Task 4.
- Depends on: `settings` key-value table (existing); `requireOwner` (existing).

- [ ] **Step 1: Create the migration file (record of the seed)**

Create `supabase/migrations/20260721120000_add_epson_printer_name_setting.sql`:

```sql
-- Seed the settings row that stores the Epson (LX-310) printer name used by the
-- "Cetak Epson" button. Empty until the owner sets it in Pengaturan.
insert into public.settings (key, value)
values ('epson_printer_name', '')
on conflict (key) do nothing;
```

- [ ] **Step 2: Apply the seed to the remote project**

Supabase is remote-only. Apply via the Supabase MCP tool `apply_migration` (project ref `pjkddahrjjqblexxhaef`), name `add_epson_printer_name_setting`, with the SQL above. Then verify:

Run (via Supabase MCP `execute_sql`): `select key, value from public.settings where key = 'epson_printer_name';`
Expected: one row, `value` = `''`.

- [ ] **Step 3: Add the two Server Actions**

Append to `src/app/(app)/pengaturan/actions.ts` (the file already imports `revalidatePath`, `createClient`, and `requireOwner`):

```ts
export async function updateEpsonPrinterName(name: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  const { error } = await supabase
    .from('settings')
    .update({ value: name })
    .eq('key', 'epson_printer_name')

  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  return {}
}

export async function getEpsonPrinterName(): Promise<{ name: string; error?: string }> {
  const supabase = await createClient()
  const ownerError = await requireOwner(supabase)
  if (ownerError) return { name: '', error: ownerError.error }

  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'epson_printer_name')
    .single<{ value: string }>()

  return { name: data?.value ?? '' }
}
```

- [ ] **Step 4: Verify the build (catches sync-export / type errors)**

Run: `npm run build`
Expected: build succeeds with no errors in `pengaturan/actions.ts`.

- [ ] **Step 5: Commit**

```bash
git add "supabase/migrations/20260721120000_add_epson_printer_name_setting.sql" "src/app/(app)/pengaturan/actions.ts"
git commit -m "feat: setting nama printer Epson (aksi baca/tulis)"
```

---

### Task 3: QZ Tray helper + Pengaturan UI (with Deteksi)

**Files:**
- Create: `src/lib/qz.ts`
- Create: `src/types/qz-tray.d.ts`
- Create: `src/components/pengaturan/EpsonPrinterSetting.tsx`
- Modify: `src/app/(app)/pengaturan/page.tsx` (fetch the setting + render the section)
- Modify: `package.json` (add `qz-tray`)

**Interfaces:**
- Consumes: `updateEpsonPrinterName` (Task 2).
- Produces:
  - `export function connectQz(): Promise<any>` — connects (if needed) and returns the configured `qz` object; used by Task 4.
  - `export function getQz(): Promise<any>` — lazy-loads + configures `qz` without connecting.
  - `<EpsonPrinterSetting name={string} />` client component.

- [ ] **Step 1: Add the dependency**

Run: `npm install qz-tray`
Expected: `qz-tray` appears in `package.json` dependencies.

- [ ] **Step 2: Add a minimal ambient type so the build stays green**

Create `src/types/qz-tray.d.ts`:

```ts
// qz-tray ships without first-class types for our usage; treat as untyped.
declare module 'qz-tray'
```

- [ ] **Step 3: Write the QZ helper**

Create `src/lib/qz.ts`:

```ts
// Lazy-load and configure QZ Tray for community/unsigned use. Browser-only:
// never import this from a Server Component or at a module's top level in one.
// Unsigned mode uses an empty certificate + empty signature, so QZ shows a
// one-time "Allow this site?" prompt instead of requiring a signing cert.
let qzPromise: Promise<any> | null = null

export function getQz(): Promise<any> {
  if (!qzPromise) {
    qzPromise = import('qz-tray').then(({ default: qz }) => {
      qz.security.setCertificatePromise((resolve: () => void) => resolve())
      qz.security.setSignaturePromise(() => (resolve: () => void) => resolve())
      return qz
    })
  }
  return qzPromise
}

export async function connectQz(): Promise<any> {
  const qz = await getQz()
  if (!qz.websocket.isActive()) await qz.websocket.connect()
  return qz
}
```

- [ ] **Step 4: Write the Pengaturan setting component**

Create `src/components/pengaturan/EpsonPrinterSetting.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Printer, Save, Search } from 'lucide-react'
import { updateEpsonPrinterName } from '@/app/(app)/pengaturan/actions'
import { connectQz } from '@/lib/qz'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface EpsonPrinterSettingProps {
  name: string
}

export function EpsonPrinterSetting({ name: initialName }: EpsonPrinterSettingProps) {
  const [name, setName] = useState(initialName)
  const [printers, setPrinters] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDetect() {
    setError(null)
    setStatus(null)
    setDetecting(true)
    try {
      const qz = await connectQz()
      const found = await qz.printers.find()
      setPrinters(Array.isArray(found) ? found : [found])
    } catch {
      setError('QZ Tray tidak berjalan. Jalankan QZ Tray di PC lalu coba lagi.')
    } finally {
      setDetecting(false)
    }
  }

  async function handleSave() {
    setError(null)
    setStatus(null)
    setSaving(true)
    const result = await updateEpsonPrinterName(name)
    if (result?.error) setError(result.error)
    else setStatus('Tersimpan.')
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Printer Epson (Cetak Epson)</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Nama printer LX-310 di komputer ini. Gunakan Deteksi untuk memilih dari daftar.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="EPSON LX-310"
          className="max-w-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={handleDetect} disabled={detecting}>
          <Search className="size-4 mr-1.5" />
          {detecting ? 'Mendeteksi...' : 'Deteksi Printer'}
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
          <Save className="size-4 mr-1.5" />
          {saving ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </div>
      {printers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {printers.map((p) => (
            <Button
              key={p}
              type="button"
              variant={p === name ? 'default' : 'outline'}
              size="sm"
              onClick={() => setName(p)}
            >
              <Printer className="size-4 mr-1.5" />
              {p}
            </Button>
          ))}
        </div>
      )}
      {status && <p className="text-xs text-green-600">{status}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 5: Render it in the Pengaturan page**

In `src/app/(app)/pengaturan/page.tsx`:

Add the import near the other component imports:

```tsx
import { EpsonPrinterSetting } from '@/components/pengaturan/EpsonPrinterSetting'
```

Add the `epson_printer_name` fetch to the existing `Promise.all` (which currently destructures `userList` and `lockSetting`):

```tsx
  const [{ data: userList }, { data: lockSetting }, { data: epsonSetting }] = await Promise.all([
    supabase.from('users').select('*').order('created_at', { ascending: true }).returns<User[]>(),
    supabase.from('settings').select('value').eq('key', 'pesanan_locked').single<{ value: string }>(),
    supabase.from('settings').select('value').eq('key', 'epson_printer_name').single<{ value: string }>(),
  ])
  const pesananLocked = lockSetting?.value === 'true'
  const epsonPrinterName = epsonSetting?.value ?? ''
```

In the "Kontrol Pesanan" card, render the setting under the existing `PesananLockToggle`:

```tsx
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-medium">Kontrol Pesanan</h3>
        <PesananLockToggle locked={pesananLocked} />
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-medium">Printer</h3>
        <EpsonPrinterSetting name={epsonPrinterName} />
      </div>
```

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: build succeeds; no type error for `qz-tray` or the new component.

- [ ] **Step 7: Manual smoke check (dev)**

Run: `npm run dev`, log in as owner, open Pengaturan. Confirm the "Printer" card renders with the input, Deteksi, and Simpan. (With QZ Tray installed and running, Deteksi lists printers; without it, Deteksi shows the "QZ Tray tidak berjalan" message — both are acceptable here.)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/lib/qz.ts src/types/qz-tray.d.ts src/components/pengaturan/EpsonPrinterSetting.tsx "src/app/(app)/pengaturan/page.tsx"
git commit -m "feat: helper QZ Tray + pengaturan nama printer Epson (Deteksi)"
```

---

### Task 4: "Cetak Epson" button

**Files:**
- Modify: `src/components/pesanan/DocumentButtons.tsx`

**Interfaces:**
- Consumes: `buildEscP` (Task 1), `getEpsonPrinterName` (Task 2), `connectQz` (Task 3), and the existing `freshData()` helper in this file.

- [ ] **Step 1: Add the import for the printer-name getter**

In `src/components/pesanan/DocumentButtons.tsx`, add to the existing import from the pesanan actions (currently `import { getInvoiceData } from '@/app/(app)/pesanan/actions'`) a sibling import from the pengaturan actions:

```tsx
import { getEpsonPrinterName } from '@/app/(app)/pengaturan/actions'
```

- [ ] **Step 2: Add the loading state**

Next to the existing `const [pdfLoading, setPdfLoading] = useState(false)`:

```tsx
  const [epsonLoading, setEpsonLoading] = useState(false)
```

- [ ] **Step 3: Add the print handler**

Add this handler inside the component (e.g. after `handlePreview`). `qz-tray` and `@/lib/escp` are imported dynamically so nothing browser-only loads at module level:

```tsx
  // Print a crisp ESC/P text receipt to the Epson LX-310 via QZ Tray. Separate
  // from the PDF flow: reads the saved printer name, builds raw ESC/P, and sends
  // it RAW so the printer uses its built-in font (no driver rasterization).
  async function handleEpsonPrint() {
    setError(null)
    setEpsonLoading(true)
    try {
      const { name } = await getEpsonPrinterName()
      if (!name) {
        setError('Atur nama printer Epson di Pengaturan terlebih dahulu.')
        return
      }
      const [{ buildEscP }, { connectQz }, latest] = await Promise.all([
        import('@/lib/escp'),
        import('@/lib/qz'),
        freshData(),
      ])
      const escp = buildEscP(latest)

      let qz
      try {
        qz = await connectQz()
      } catch {
        setError('QZ Tray tidak berjalan. Jalankan QZ Tray di PC.')
        return
      }

      const config = qz.configs.create(name)
      await qz.print(config, [{ type: 'raw', format: 'command', flavor: 'plain', data: escp }])
    } catch {
      setError('Gagal mencetak ke Epson.')
    } finally {
      setEpsonLoading(false)
    }
  }
```

- [ ] **Step 4: Add the button**

In the returned JSX, add the button right after the existing "Cetak PDF" `<Button>` (which uses `handlePrint`):

```tsx
        <Button variant="outline" size="sm" onClick={handleEpsonPrint} disabled={epsonLoading}>
          <Printer className="size-4" />
          {epsonLoading ? 'Mencetak...' : 'Cetak Epson'}
        </Button>
```

(`Printer` is already imported in this file.)

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build succeeds; `DocumentButtons.tsx` compiles with the new handler and button.

- [ ] **Step 6: Run the existing test suite**

Run: `npm run test:run`
Expected: all tests pass (Task 1's `escp.test.ts` included; nothing else regressed).

- [ ] **Step 7: Commit**

```bash
git add src/components/pesanan/DocumentButtons.tsx
git commit -m "feat: tombol Cetak Epson (ESC/P via QZ Tray) di detail pesanan"
```

---

### Task 5: Setup + manual test documentation

**Files:**
- Create: `docs/cetak-epson-setup.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Write the setup + verification doc**

Create `docs/cetak-epson-setup.md`:

```markdown
# Cetak Epson (LX-310) — Setup & Verifikasi

Fitur "Cetak Epson" mengirim struk sebagai teks ESC/P mentah ke printer dot-matrix
Epson LX-310 lewat QZ Tray, sehingga hasil cetak tajam (memakai font bawaan
printer) — berbeda dari "Cetak PDF" yang berbasis gambar.

## Setup satu kali (di PC Windows kasir)

1. Install **QZ Tray** dan biarkan berjalan di system tray. Saat pertama kali
   mencetak, klik **Allow** (centang "remember") pada dialog izin QZ.
2. Buka **Pengaturan → Printer**, klik **Deteksi Printer**, pilih LX-310, lalu
   **Simpan**. (Bisa juga ketik manual nama printer persis seperti di Windows.)
3. Di Windows, atur ukuran form/kertas printer menjadi **9.5 × 5.5 inch**.

## Verifikasi di hardware (checklist)

- [ ] Struk pendek (≤12 item): teks tajam, tidak buram, tanpa dither/abu-abu.
- [ ] Kolom kanan (Tgl. Pesanan / Tgl. Pengiriman) tidak terpotong.
- [ ] Angka rapi rata kanan di kolom HARGA & JUMLAH.
- [ ] Struk panjang (>12 item): halaman ke-2 mulai tepat di atas form berikutnya
      (form-feed benar); TOTAL hanya muncul di halaman terakhir.
- [ ] Setelah cetak, kertas berhenti di awal form berikutnya (siap struk baru).

## Penyetelan bila perlu (di kode)

- Baris per halaman: `ITEMS_PER_PAGE` di `src/lib/escp.ts`.
- Panjang halaman: konstanta `PAGE_LENGTH_33` (ESC C n) di `src/lib/escp.ts`.
- Lebar kolom: konstanta `COL` di `src/lib/escp.ts`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/cetak-epson-setup.md
git commit -m "docs: panduan setup & verifikasi Cetak Epson"
```

---

## Self-Review Notes

- **Spec coverage:** ESC/P builder (Task 1); QZ community/unsigned bridge (Task 3, `qz.ts`); printer-name setting + Deteksi (Tasks 2–3); additive owner-only button reusing `freshData` (Task 4); full-parity 80-col layout with wrap, per-page subtotal, Perhatian, Penerima, last-page TOTAL, form-feeds (Task 1); Vitest coverage (Task 1); setup + manual checklist (Task 5). The spec said the printer name would be passed as a prop; this plan instead reads it at click time via `getEpsonPrinterName()` so `pesanan/[id]/page.tsx` needs no change — same result, less coupling.
- **Type consistency:** `buildEscP(data: InvoiceData): string`, `getEpsonPrinterName(): Promise<{ name: string; error?: string }>`, `updateEpsonPrinterName(name: string): Promise<{ error?: string }>`, `connectQz(): Promise<any>` are referenced identically in producing and consuming tasks.
- **Hardware caveat:** on-printer behavior (crispness, clipping, alignment, `ITEMS_PER_PAGE`) can only be confirmed on the LX-310; Task 5 is that checklist.
```
